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

  function sanitizeTranscript(value) {
    var text = String(value || "").trim();
    if (/^(\d)\1{7,}$/.test(text)) return "";
    return text.replace(/(?:^|\s)(\d)\1{7,}(?=\s|$|[.,;:!?])/g, " ").replace(/\s{2,}/g, " ").trim();
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
    var lastCaptureAt = 0;
    var captureWatchdog = 0;
    var captureRestarting = false;
    var captureRecoveryFailures = 0;
    var workletRegistered = false;

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
      var timeoutMs = path === "/health" ? 8000 : path === "/session/audio" ? 30000 : path === "/session/stop" ? 45000 : 30000;
      var controller = typeof root.AbortController === "function" && !requestOptions.signal ? new root.AbortController() : null;
      var timeout = 0;
      if (controller) {
        requestOptions.signal = controller.signal;
        timeout = root.setTimeout(function () { controller.abort(); }, timeoutMs);
      }
      try {
        var response = await fetch(API + path, requestOptions);
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok || body.ok === false) throw new Error(body.error || "Atenin govorni prepis ni dosegljiv.");
        return body;
      } catch (error) {
        if (controller && controller.signal.aborted) throw new Error("Povezava z Ateninim govornim servisom je trajala predolgo.");
        throw error;
      } finally {
        if (timeout) root.clearTimeout(timeout);
      }
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
      var nextText = sanitizeTranscript(result.finalText || result.text || appendText(result.committedText, result.tentativeText));
      if (nextText) sessionText = nextText;
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
        setTimeout(function () { failAndStop(error).catch(function () {}); }, 0);
      });
    }

    function capture(input) {
      if (!recording || !downsampler) return;
      lastCaptureAt = Date.now();
      notifyLevel(input, false);
      var chunk = downsampler.process(input);
      if (!chunk.length) return;
      chunks.push(chunk);
      sampleCount += chunk.length;
      queueAudio(false);
    }

    function clearCaptureWatchdog() {
      if (captureWatchdog) root.clearInterval(captureWatchdog);
      captureWatchdog = 0;
      captureRestarting = false;
      captureRecoveryFailures = 0;
    }

    function watchMicrophoneTracks(stream) {
      if (!stream || typeof stream.getAudioTracks !== "function") return;
      stream.getAudioTracks().forEach(function (track) {
        var stalled = function () { if (recording && !stopping) lastCaptureAt = 0; };
        track.addEventListener("mute", stalled);
        track.addEventListener("ended", stalled);
      });
    }

    async function failAndStop(error) {
      await stop().catch(function () {});
      notifyError(error instanceof Error ? error : new Error(String(error || "Mikrofonski tok se je ustavil.")));
    }

    async function restartCaptureIfStalled() {
      if (!recording || stopping || captureRestarting || !audioContext || !sourceNode || !silentGain) return;
      if (Date.now() - lastCaptureAt < 2500) return;
      captureRestarting = true;
      var replacementStream = null;
      try {
        if (audioContext.state !== "running" && typeof audioContext.resume === "function") {
          await audioContext.resume().catch(function () {});
        }
        var currentTrack = mediaStream && mediaStream.getAudioTracks && mediaStream.getAudioTracks()[0];
        var replaceStream = !currentTrack || currentTrack.readyState === "ended" || currentTrack.muted === true;
        if (replaceStream) replacementStream = await requestMicrophone(microphoneConstraints());
        var replacementSource = replacementStream
          ? audioContext.createMediaStreamSource(replacementStream)
          : sourceNode;
        var replacementProcessor = await createProcessor(audioContext);
        sourceNode.disconnect();
        if (processorNode) {
          if (processorNode.port) processorNode.port.onmessage = null;
          if ("onaudioprocess" in processorNode) processorNode.onaudioprocess = null;
          processorNode.disconnect();
        }
        if (replacementStream) {
          mediaStream && mediaStream.getTracks().forEach(function (track) { track.stop(); });
          mediaStream = replacementStream;
          sourceNode = replacementSource;
          watchMicrophoneTracks(mediaStream);
        }
        processorNode = replacementProcessor;
        sourceNode.connect(processorNode);
        processorNode.connect(silentGain);
        lastCaptureAt = Date.now();
        captureRecoveryFailures = 0;
        notifyState("recording", "Poslušam …");
      } catch (error) {
        replacementStream && replacementStream.getTracks().forEach(function (track) { track.stop(); });
        lastCaptureAt = Date.now();
        captureRecoveryFailures += 1;
        if (captureRecoveryFailures >= 3) {
          setTimeout(function () { failAndStop(new Error("Mikrofonski tok se je ustavil in ga ni bilo mogoče obnoviti.")).catch(function () {}); }, 0);
        } else {
          notifyState("recording", "Obnavljam mikrofon …");
        }
      } finally {
        captureRestarting = false;
      }
    }

    function startCaptureWatchdog() {
      clearCaptureWatchdog();
      lastCaptureAt = Date.now();
      captureWatchdog = root.setInterval(function () {
        restartCaptureIfStalled().catch(function () {});
      }, 1000);
    }

    async function createProcessor(context) {
      if (context.audioWorklet && typeof AudioWorkletNode === "function") {
        if (!workletRegistered) {
          var source = "class UJHandyCapture extends AudioWorkletProcessor { constructor(){ super(); this.frameSize=Math.max(128,Math.round(sampleRate*0.03)); this.buffer=new Float32Array(this.frameSize); this.offset=0; this.port.onmessage=(event)=>{ if(event.data&&event.data.command==='flush') this.flush(); }; } flush(){ if(!this.offset)return; const copy=this.buffer.slice(0,this.offset); this.offset=0; this.port.postMessage(copy.buffer,[copy.buffer]); } process(inputs){ const input=inputs[0]&&inputs[0][0]; if(input){ let cursor=0; while(cursor<input.length){ const take=Math.min(this.frameSize-this.offset,input.length-cursor); this.buffer.set(input.subarray(cursor,cursor+take),this.offset); this.offset+=take; cursor+=take; if(this.offset===this.frameSize)this.flush(); } } return true; } } registerProcessor('uj-handy-capture',UJHandyCapture);";
          var url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
          try { await context.audioWorklet.addModule(url); workletRegistered = true; }
          finally { URL.revokeObjectURL(url); }
        }
        var worklet = new AudioWorkletNode(context, "uj-handy-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        worklet.port.onmessage = function (event) { capture(new Float32Array(event.data)); };
        worklet.onprocessorerror = function () { lastCaptureAt = 0; };
        return worklet;
      }
      var processor = context.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = function (event) { capture(event.inputBuffer.getChannelData(0)); };
      return processor;
    }

    async function health() {
      var result;
      var lastError;
      for (var attempt = 0; attempt < 3; attempt += 1) {
        try {
          result = await api("/health");
          if (result.liveEngine === EXPECTED_ENGINE && result.language === "de-DE" && result.status === "ready") return result;
          lastError = new Error(result && result.error || "Atenin nemški prepis še ni pripravljen.");
        } catch (error) {
          lastError = error;
        }
        if (attempt < 2) await new Promise(function (resolve) { setTimeout(resolve, 750); });
      }
      throw lastError || new Error("Atenin nemški prepis še ni pripravljen.");
    }

    async function start(initialText) {
      if (recording) return;
      epoch += 1;
      workletRegistered = false;
      chunks = [];
      sampleCount = 0;
      smoothedLevel = 0;
      lastLevelAt = 0;
      notifyLevel(null, true);
      uploadQueue = Promise.resolve();
      baseText = String(initialText || "").trim();
      sessionText = "";
      notifyState("starting", "Odpiram mikrofon …");
      try {
        var runtimePromise = health();
        var microphonePromise = requestMicrophone(microphoneConstraints());
        audioContext = createSpeechAudioContext();
        var resumePromise = audioContext.resume();
        runtimePromise.catch(function () {});
        resumePromise.catch(function () {});
        mediaStream = await microphonePromise;
        await resumePromise;
        var runtime = await runtimePromise;
        var recommendedFeedSamples = Number(runtime.directFeedSamples);
        streamFeedSamples = Number.isInteger(recommendedFeedSamples) && recommendedFeedSamples >= 1280 && recommendedFeedSamples <= 17920
          ? recommendedFeedSamples
          : 17920;
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        downsampler = createDownsampler(audioContext.sampleRate);
        processorNode = await createProcessor(audioContext);
        silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        sessionAccessToken = await getAccessToken();
        var started = await api("/session/start", { method: "POST" });
        sessionId = String(started.sessionId || "");
        if (!sessionId) throw new Error("Nemotron ni vrnil varne snemalne seje.");
        recording = true;
        sourceNode.connect(processorNode);
        processorNode.connect(silentGain);
        silentGain.connect(audioContext.destination);
        startCaptureWatchdog();
        watchMicrophoneTracks(mediaStream);
        notifyState("recording", "Poslušam …");
      } catch (error) {
        recording = false;
        stopping = false;
        clearCaptureWatchdog();
        if (sessionId) await api("/session/stop", { method: "POST" }).catch(function () {});
        mediaStream && mediaStream.getTracks().forEach(function (track) { track.stop(); });
        await (audioContext && audioContext.close ? audioContext.close().catch(function () {}) : Promise.resolve());
        mediaStream = null;
        audioContext = null;
        sourceNode = null;
        processorNode = null;
        silentGain = null;
        downsampler = null;
        workletRegistered = false;
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
      clearCaptureWatchdog();
      notifyState("stopping", "Zaključujem prepis …");
      try {
        if (processorNode && processorNode.port && typeof processorNode.port.postMessage === "function") processorNode.port.postMessage({ command: "flush" });
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
        lastCaptureAt = 0;
        captureRecoveryFailures = 0;
        workletRegistered = false;
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

    function stopForPageExit() {
      if (!recording || !API || !sessionId) return;
      clearCaptureWatchdog();
      recording = false;
      epoch += 1;
      sourceNode && sourceNode.disconnect();
      mediaStream && mediaStream.getTracks().forEach(function (track) { track.stop(); });
      var headers = { "X-UJ-Prepis-Session": sessionId };
      if (sessionAccessToken) headers.Authorization = "Bearer " + sessionAccessToken;
      fetch(API + "/session/stop", { method: "POST", headers: headers, keepalive: true }).catch(function () {});
    }

    if (root.addEventListener) root.addEventListener("pagehide", stopForPageExit);

    return { start: start, stop: stop, cancel: cancel, health: health, isRecording: function () { return recording; } };
  }

  root.UJHandyCanary = { create: create, API: API, EXPECTED_ENGINE: EXPECTED_ENGINE, _test: { appendText: appendText, sanitizeTranscript: sanitizeTranscript, createDownsampler: createDownsampler, createSpeechAudioContext: createSpeechAudioContext, requestMicrophone: requestMicrophone, microphoneConstraints: microphoneConstraints, audioLevel: audioLevel } };
})(typeof window !== "undefined" ? window : globalThis);
