(function (root) {
  "use strict";

  var TRUSTED_MOBILE_API = "https://speech.uspesni-jezek.de";
  var LOCAL_DEVELOPMENT = root.location && String(root.location.port) === "8001";
  var speechConfig = root.ATENA_SPEECH_CONFIG || {};
  var API = LOCAL_DEVELOPMENT
    ? String(root.location.origin || "") + "/__dev-atena-speech"
    : speechConfig.endpointVerified === true && String(speechConfig.baseUrl || "").replace(/\/+$/, "") === TRUSTED_MOBILE_API
      ? TRUSTED_MOBILE_API
      : "";
  var EXPECTED_ENGINE = "nemotron-3.5-de-streaming";
  // Govorni strežnik sporoči varen prag dovajanja glede na svoj dejanski runtime.
  var streamFeedSamples = 17920;

  function appendText(left, right) {
    var before = String(left || "").trim();
    var next = String(right || "").trim();
    if (!next) return before;
    if (!before) return next;
    return /^[,.;:!?)]/.test(next) ? before + next : before + " " + next;
  }

  function createDownsampler(sourceRate) {
    if (sourceRate === 16000) return { process: function (input) { return new Float32Array(input); } };
    var ratio = sourceRate / 16000;
    var carry = 0;
    var previous = 0;
    return {
      process: function (input) {
        var outputLength = Math.max(0, Math.floor((input.length + carry) / ratio));
        var output = new Float32Array(outputLength);
        var position = ratio - carry;
        for (var i = 0; i < outputLength; i += 1) {
          var sourcePosition = position + i * ratio;
          var leftIndex = Math.floor(sourcePosition);
          var fraction = sourcePosition - leftIndex;
          var left = leftIndex >= 0 ? input[Math.min(leftIndex, input.length - 1)] : previous;
          var right = input[Math.min(leftIndex + 1, input.length - 1)] || left;
          output[i] = left + (right - left) * fraction;
        }
        previous = input.length ? input[input.length - 1] : previous;
        carry = input.length + carry - outputLength * ratio;
        return output;
      },
    };
  }

  function mergeChunks(chunks, count) {
    var output = new Float32Array(count);
    var offset = 0;
    chunks.forEach(function (chunk) { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }

  function requestMicrophone(constraints) {
    if (root.navigator && root.navigator.mediaDevices && typeof root.navigator.mediaDevices.getUserMedia === "function") {
      return root.navigator.mediaDevices.getUserMedia(constraints);
    }
    var legacy = root.navigator && (root.navigator.getUserMedia || root.navigator.webkitGetUserMedia || root.navigator.mozGetUserMedia);
    if (typeof legacy === "function") {
      return new Promise(function (resolve, reject) { legacy.call(root.navigator, constraints, resolve, reject); });
    }
    var error = new Error(root.isSecureContext
      ? "Ta brskalnik ne omogoča dostopa do mikrofona. Odprite lokalni app v Chromu ali Safariju."
      : "Mikrofon zahteva varno povezavo. Na tem računalniku odprite http://localhost:8001; na telefonu bo potreben HTTPS.");
    error.code = "MICROPHONE_API_UNAVAILABLE";
    throw error;
  }

  function microphoneConstraints() {
    return {
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
  }

  function drainCaptureMessages() {
    return new Promise(function (resolve) { setTimeout(resolve, 50); });
  }

  function createSpeechAudioContext() {
    var AudioContextClass = root.AudioContext || root.webkitAudioContext;
    try { return new AudioContextClass({ latencyHint: "interactive", sampleRate: 16000 }); }
    catch (_) { return new AudioContextClass({ latencyHint: "interactive" }); }
  }

  function audioLevel(input) {
    if (!input || !input.length) return 0;
    var sum = 0;
    for (var i = 0; i < input.length; i += 1) sum += input[i] * input[i];
    return Math.min(1, Math.max(0, Math.sqrt(sum / input.length) * 8));
  }

  function create(options) {
    options = options || {};
    var recording = false;
    var stopping = false;
    var sessionId = "";
    var sessionAccessToken = "";
    var mediaStream = null;
    var audioContext = null;
    var sourceNode = null;
    var processorNode = null;
    var silentGain = null;
    var downsampler = null;
    var chunks = [];
    var sampleCount = 0;
    var uploadQueue = Promise.resolve();
    var epoch = 0;
    var baseText = "";
    var sessionText = "";
    var smoothedLevel = 0;
    var lastLevelAt = 0;

    function notifyState(state, message) {
      if (typeof options.onState === "function") options.onState({ state: state, message: message });
    }

    function notifyText() {
      if (typeof options.onText === "function") options.onText(appendText(baseText, sessionText));
    }

    function notifyError(error) {
      if (typeof options.onError === "function") options.onError(error);
    }

    function notifyLevel(input, force) {
      if (typeof options.onLevel !== "function") return;
      var measured = input ? audioLevel(input) : 0;
      smoothedLevel = measured > smoothedLevel
        ? smoothedLevel * 0.35 + measured * 0.65
        : smoothedLevel * 0.72 + measured * 0.28;
      var now = Date.now();
      if (!force && now - lastLevelAt < 50) return;
      lastLevelAt = now;
      options.onLevel({ level: force ? measured : smoothedLevel });
    }

    async function api(path, requestOptions) {
      if (!API) throw new Error("Atenin mobilni govorni servis še ni nastavljen.");
      requestOptions = requestOptions || {};
      requestOptions.headers = Object.assign({}, requestOptions.headers || {});
      if (sessionAccessToken && path.indexOf("/session/") === 0) {
        requestOptions.headers.Authorization = "Bearer " + sessionAccessToken;
      }
      if (sessionId && path.indexOf("/session/") === 0 && path !== "/session/start") {
        requestOptions.headers["X-UJ-Prepis-Session"] = sessionId;
      }
      var response = await fetch(API + path, requestOptions);
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok || body.ok === false) throw new Error(body.error || "Atenin govorni prepis ni dosegljiv.");
      return body;
    }

    async function getAccessToken() {
      var client = typeof supabaseKlient !== "undefined" ? supabaseKlient : null;
      if (!client || !client.auth || typeof client.auth.getSession !== "function") {
        if (LOCAL_DEVELOPMENT) return "";
        throw new Error("Za varen govorni prepis se najprej prijavite.");
      }
      var result = await client.auth.getSession();
      var token = result && result.data && result.data.session && result.data.session.access_token;
      if (!token && !LOCAL_DEVELOPMENT) throw new Error("Prijava je potekla. Prijavite se znova.");
      return String(token || "");
    }

    function consume(result) {
      if (!result) return;
      sessionText = String(result.finalText || result.text || appendText(result.committedText, result.tentativeText) || "").trim();
      notifyText();
    }

    function queueAudio(force) {
      if (!sampleCount || (!force && sampleCount < streamFeedSamples)) return;
      var audio = mergeChunks(chunks, sampleCount);
      chunks = [];
      sampleCount = 0;
      var requestEpoch = epoch;
      uploadQueue = uploadQueue.then(async function () {
        if (!recording || requestEpoch !== epoch) return;
        notifyState("transcribing", "Pretvarjam govor v besedilo …");
        var result = await api("/session/audio", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: audio.buffer,
        });
        if (recording && requestEpoch === epoch) consume(result);
        if (recording && requestEpoch === epoch) notifyState("recording", "Poslušam …");
      }).catch(function (error) {
        if (requestEpoch !== epoch) return;
        notifyError(error);
        setTimeout(function () { stop().catch(function () {}); }, 0);
      });
    }

    function capture(input) {
      if (!recording || !downsampler) return;
      notifyLevel(input, false);
      var chunk = downsampler.process(input);
      if (!chunk.length) return;
      chunks.push(chunk);
      sampleCount += chunk.length;
      queueAudio(false);
    }

    async function createProcessor(context) {
      if (context.audioWorklet && typeof AudioWorkletNode === "function") {
        var source = "class UJHandyCapture extends AudioWorkletProcessor { process(inputs) { const input=inputs[0]&&inputs[0][0]; if(input){ const copy=new Float32Array(input); this.port.postMessage(copy.buffer,[copy.buffer]); } return true; } } registerProcessor('uj-handy-capture',UJHandyCapture);";
        var url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        try { await context.audioWorklet.addModule(url); }
        finally { URL.revokeObjectURL(url); }
        var worklet = new AudioWorkletNode(context, "uj-handy-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        worklet.port.onmessage = function (event) { capture(new Float32Array(event.data)); };
        return worklet;
      }
      var processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = function (event) { capture(event.inputBuffer.getChannelData(0)); };
      return processor;
    }

    async function health() {
      var result = await api("/health");
      if (result.liveEngine !== EXPECTED_ENGINE || result.language !== "de-DE" || result.status !== "ready") {
        throw new Error(result.error || "Atenin nemški prepis še ni pripravljen.");
      }
      return result;
    }

    async function start(initialText) {
      if (recording) return;
      var runtime = await health();
      var recommendedFeedSamples = Number(runtime.directFeedSamples);
      streamFeedSamples = Number.isInteger(recommendedFeedSamples) && recommendedFeedSamples >= 1280 && recommendedFeedSamples <= 17920
        ? recommendedFeedSamples
        : 17920;
      epoch += 1;
      chunks = [];
      sampleCount = 0;
      smoothedLevel = 0;
      lastLevelAt = 0;
      notifyLevel(null, true);
      uploadQueue = Promise.resolve();
      baseText = String(initialText || "").trim();
      sessionText = "";
      notifyState("starting", "Odpiram mikrofon …");
      sessionAccessToken = await getAccessToken();
      var started;
      try {
        started = await api("/session/start", { method: "POST" });
      } catch (error) {
        sessionAccessToken = "";
        throw error;
      }
      sessionId = String(started.sessionId || "");
      if (!sessionId) throw new Error("Nemotron ni vrnil varne snemalne seje.");
      try {
        mediaStream = await requestMicrophone(microphoneConstraints());
        audioContext = createSpeechAudioContext();
        await audioContext.resume();
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        downsampler = createDownsampler(audioContext.sampleRate);
        processorNode = await createProcessor(audioContext);
        silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        recording = true;
        sourceNode.connect(processorNode);
        processorNode.connect(silentGain);
        silentGain.connect(audioContext.destination);
        mediaStream.getAudioTracks().forEach(function (track) {
          track.addEventListener("ended", function () { if (recording && !stopping) stop().catch(function () {}); }, { once: true });
        });
        notifyState("recording", "Poslušam …");
      } catch (error) {
        await api("/session/stop", { method: "POST" }).catch(function () {});
        mediaStream && mediaStream.getTracks().forEach(function (track) { track.stop(); });
        await (audioContext && audioContext.close ? audioContext.close().catch(function () {}) : Promise.resolve());
        mediaStream = null;
        audioContext = null;
        sourceNode = null;
        processorNode = null;
        silentGain = null;
        downsampler = null;
        sessionId = "";
        sessionAccessToken = "";
        notifyLevel(null, true);
        throw error;
      }
    }

    async function stop() {
      if (!recording && !mediaStream) return appendText(baseText, sessionText);
      if (stopping) return appendText(baseText, sessionText);
      stopping = true;
      notifyState("stopping", "Zaključujem prepis …");
      try {
        sourceNode && sourceNode.disconnect();
        await drainCaptureMessages();
        processorNode && processorNode.disconnect();
        silentGain && silentGain.disconnect();
        mediaStream && mediaStream.getTracks().forEach(function (track) { track.stop(); });
        queueAudio(true);
        await uploadQueue;
        recording = false;
        var result = await api("/session/stop", { method: "POST" });
        consume(result);
      } finally {
        recording = false;
        epoch += 1;
        await (audioContext && audioContext.close ? audioContext.close().catch(function () {}) : Promise.resolve());
        mediaStream = null;
        audioContext = null;
        sourceNode = null;
        processorNode = null;
        silentGain = null;
        downsampler = null;
        sessionId = "";
        sessionAccessToken = "";
        chunks = [];
        sampleCount = 0;
        smoothedLevel = 0;
        stopping = false;
        notifyLevel(null, true);
        notifyState("ready", "Besedilo je pripravljeno");
      }
      return appendText(baseText, sessionText);
    }

    async function cancel() {
      baseText = "";
      sessionText = "";
      await stop().catch(function () {});
      notifyText();
    }

    return { start: start, stop: stop, cancel: cancel, health: health, isRecording: function () { return recording; } };
  }

  root.UJHandyCanary = { create: create, API: API, EXPECTED_ENGINE: EXPECTED_ENGINE, _test: { appendText: appendText, createDownsampler: createDownsampler, createSpeechAudioContext: createSpeechAudioContext, requestMicrophone: requestMicrophone, microphoneConstraints: microphoneConstraints, audioLevel: audioLevel } };
})(typeof window !== "undefined" ? window : globalThis);
