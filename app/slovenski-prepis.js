(() => {
  "use strict";
  const API = "http://127.0.0.1:8765";
  const widget = document.querySelector(".prepis-widget");
  const status = document.getElementById("prepis-status");
  const statusText = status.querySelector("span");
  const toggle = document.getElementById("prepis-toggle");
  const toggleLabel = document.getElementById("prepis-toggle-label");
  const copyButton = document.getElementById("prepis-copy");
  const clearButton = document.getElementById("prepis-clear");
  const finalNode = document.getElementById("prepis-final");
  const partialNode = document.getElementById("prepis-partial");
  const placeholder = document.getElementById("prepis-placeholder");
  const output = document.getElementById("prepis-output");
  const errorNode = document.getElementById("prepis-error");
  const backendNode = document.getElementById("prepis-backend");
  const sourceButtons = [...document.querySelectorAll("[data-audio-source]")];
  const EXPECTED_ENGINE = "handy-canary-progressive";
  const EXPECTED_MODEL = "canary-1b-v2-Q5_K_M.gguf";

  let recording = false;
  let sessionId = "";
  let mediaStream = null;
  let audioContext = null;
  let sourceNode = null;
  let processorNode = null;
  let processorIsWorklet = false;
  let captureFlushResolve = null;
  let silentGain = null;
  let streamingDownsampler = null;
  let uploadQueue = Promise.resolve();
  let audioEpoch = 0;
  let activeAudioRequest = null;
  let bufferedChunks = [];
  let bufferedSamples = 0;
  let sessionParagraphStart = 0;
  let finalParagraphs = [];
  let stableLiveText = "";
  let liveText = "";
  let selectedAudioSource = "microphone";

  function showError(message) {
    errorNode.textContent = message;
    errorNode.hidden = !message;
  }
  function setStatus(state, text) {
    status.dataset.state = state;
    statusText.textContent = text;
  }
  function setSourceButtonsDisabled(disabled) {
    sourceButtons.forEach((button) => { button.disabled = disabled; });
  }
  function selectAudioSource(source) {
    selectedAudioSource = source;
    sourceButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.audioSource === source));
    });
    placeholder.textContent = source === "computer"
      ? "Pritisnite Začni, izberite zaslon ali zavihek in vključite deljenje zvoka."
      : "Ko je model pripravljen, pritisnite Začni in govorite naravno.";
    showError("");
  }
  function appendStableText(left, right) {
    const before = String(left || "").trim();
    const next = String(right || "").trim();
    if (!next) return before;
    if (!before) return next;
    return /^[,.;:!?)]/.test(next) ? `${before}${next}` : `${before} ${next}`;
  }
  function renderTranscript() {
    finalNode.replaceChildren(...finalParagraphs.map((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }));
    partialNode.textContent = liveText;
    placeholder.hidden = Boolean(finalParagraphs.length || liveText);
    output.scrollTop = output.scrollHeight;
  }
  function consumeResult(result, forceFinal = false) {
    if (result) {
      stableLiveText = String(result.committedText || "").trim();
      liveText = String(result.text || appendStableText(stableLiveText, result.tentativeText)).trim();
    }
    if ((forceFinal || result.eou || result.eob) && liveText.trim()) {
      finalParagraphs.push(liveText.trim());
      stableLiveText = "";
      liveText = "";
    }
    renderTranscript();
  }
  async function api(path, options = {}) {
    const requestOptions = { ...options, headers: { ...(options.headers || {}) } };
    if (sessionId && path.startsWith("/session/") && path !== "/session/start") {
      requestOptions.headers["X-UJ-Prepis-Session"] = sessionId;
    }
    const response = await fetch(`${API}${path}`, requestOptions);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || "Lokalni prepis ni dosegljiv.");
    return body;
  }
  function createStreamingDownsampler(sourceRate) {
    if (sourceRate === 16000) return { process: (input) => new Float32Array(input) };
    const ratio = sourceRate / 16000;
    const radius = 64;
    const cutoff = Math.min(0.5, 16000 / (2 * sourceRate) * 0.999);
    let history = new Float32Array(0);
    let processedSamples = 0;
    let nextOutputAt = radius;
    const sinc = (value) => Math.abs(value) < 1e-9 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value);
    return {
      process(input) {
        const combined = new Float32Array(history.length + input.length);
        combined.set(history);
        combined.set(input, history.length);
        const combinedStart = processedSamples - history.length;
        const availableEnd = processedSamples + input.length;
        const output = [];
        while (nextOutputAt + radius < availableEnd) {
          const center = Math.floor(nextOutputAt);
          let sample = 0;
          let weight = 0;
          for (let index = center - radius + 1; index <= center + radius; index += 1) {
            const localIndex = index - combinedStart;
            if (localIndex < 0 || localIndex >= combined.length) continue;
            const distance = index - nextOutputAt;
            const window = 0.5 + 0.5 * Math.cos(Math.PI * distance / radius);
            const kernel = 2 * cutoff * sinc(2 * cutoff * distance) * window;
            sample += combined[localIndex] * kernel;
            weight += kernel;
          }
          output.push(weight ? sample / weight : 0);
          nextOutputAt += ratio;
        }
        processedSamples = availableEnd;
        history = combined.slice(Math.max(0, combined.length - radius * 2 - 2));
        return Float32Array.from(output);
      },
    };
  }
  function mergeChunks(chunks, sampleCount) {
    const merged = new Float32Array(sampleCount);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
    return merged;
  }
  async function getCaptureStream() {
    if (selectedAudioSource === "computer") {
      if (!navigator.mediaDevices.getDisplayMedia) throw new Error("Ta brskalnik ne podpira neposrednega zajema zvoka računalnika.");
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!displayStream.getAudioTracks().length) {
        displayStream.getTracks().forEach((track) => track.stop());
        throw new Error("Pri izbiri zaslona vključite možnost za deljenje zvoka.");
      }
      return displayStream;
    }
    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }
  function createCaptureContext() {
    return new AudioContext({ latencyHint: "interactive" });
  }
  function handleCapturedInput(input) {
    if (!recording) return;
    const chunk = streamingDownsampler.process(input);
    if (!chunk.length) return;
    bufferedChunks.push(chunk);
    bufferedSamples += chunk.length;
    sendBufferedAudio();
  }
  async function createCaptureProcessor(context) {
    if (context.audioWorklet && typeof AudioWorkletNode === "function") {
      const workletSource = `class UJCaptureProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.pending = new Float32Array(4096);
          this.offset = 0;
          this.port.onmessage = (event) => {
            if (event.data?.type !== "flush") return;
            if (this.offset) {
              const chunk = this.pending.slice(0, this.offset);
              this.port.postMessage({ type: "audio", buffer: chunk.buffer }, [chunk.buffer]);
              this.pending = new Float32Array(4096);
              this.offset = 0;
            }
            this.port.postMessage({ type: "flushed" });
          };
        }
        process(inputs) {
          const input = inputs[0]?.[0];
          if (!input) return true;
          let sourceOffset = 0;
          while (sourceOffset < input.length) {
            const count = Math.min(input.length - sourceOffset, this.pending.length - this.offset);
            this.pending.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
            this.offset += count;
            sourceOffset += count;
            if (this.offset === this.pending.length) {
              const chunk = this.pending;
              this.port.postMessage({ type: "audio", buffer: chunk.buffer }, [chunk.buffer]);
              this.pending = new Float32Array(4096);
              this.offset = 0;
            }
          }
          return true;
        }
      }
      registerProcessor("uj-capture-processor", UJCaptureProcessor);`;
      const moduleUrl = URL.createObjectURL(new Blob([workletSource], { type: "text/javascript" }));
      try {
        await context.audioWorklet.addModule(moduleUrl);
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
      processorIsWorklet = true;
      const node = new AudioWorkletNode(context, "uj-capture-processor", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      });
      node.port.onmessage = (event) => {
        if (event.data?.type === "audio") handleCapturedInput(new Float32Array(event.data.buffer));
        if (event.data?.type === "flushed" && captureFlushResolve) {
          const resolve = captureFlushResolve;
          captureFlushResolve = null;
          resolve();
        }
      };
      return node;
    }
    processorIsWorklet = false;
    const node = context.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (event) => handleCapturedInput(event.inputBuffer.getChannelData(0));
    return node;
  }
  async function flushCaptureProcessor() {
    if (!processorIsWorklet || !processorNode?.port) return;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      captureFlushResolve = () => { clearTimeout(timeout); resolve(); };
      processorNode.port.postMessage({ type: "flush" });
    });
  }
  function sendBufferedAudio(force = false) {
    if (!bufferedSamples || (!force && bufferedSamples < 48000)) return;
    const merged = mergeChunks(bufferedChunks, bufferedSamples);
    bufferedChunks = [];
    bufferedSamples = 0;
    const epoch = audioEpoch;
    uploadQueue = uploadQueue.then(async () => {
      if (!recording || epoch !== audioEpoch) return;
      const controller = new AbortController();
      activeAudioRequest = controller;
      try {
        setStatus("recording", "Prepisujem v živo");
        const result = await api("/session/audio", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: merged.buffer,
          signal: controller.signal,
        });
        if (recording && epoch === audioEpoch) consumeResult(result);
      } finally {
        if (activeAudioRequest === controller) activeAudioRequest = null;
        if (recording && epoch === audioEpoch) setStatus("recording", "Poslušam");
      }
    }).catch((error) => {
      if (error.name === "AbortError" || epoch !== audioEpoch || !recording) return;
      showError(error.message);
      setTimeout(() => {
        if (recording) stopRecording(false).catch(() => null);
      }, 0);
    });
  }
  async function startRecording() {
    showError("");
    audioEpoch += 1;
    activeAudioRequest?.abort();
    activeAudioRequest = null;
    uploadQueue = Promise.resolve();
    bufferedChunks = [];
    bufferedSamples = 0;
    sessionParagraphStart = finalParagraphs.length;
    stableLiveText = "";
    const started = await api("/session/start", { method: "POST" });
    sessionId = String(started.sessionId || "");
    if (!sessionId) throw new Error("Lokalni pogon ni vrnil varne snemalne seje.");
    try {
      mediaStream = await getCaptureStream();
      audioContext = createCaptureContext();
      await audioContext.resume();
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      streamingDownsampler = createStreamingDownsampler(audioContext.sampleRate);
      processorNode = await createCaptureProcessor(audioContext);
      silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      recording = true;
      setSourceButtonsDisabled(true);
      mediaStream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (recording) stopRecording(true).catch(() => null);
        }, { once: true });
      });
      sourceNode.connect(processorNode);
      processorNode.connect(silentGain);
      silentGain.connect(audioContext.destination);
      widget.dataset.recording = "true";
      toggleLabel.textContent = "Ustavi prepis";
      setStatus("recording", "Poslušam");
    } catch (error) {
      await api("/session/stop", { method: "POST" }).catch(() => null);
      sessionId = "";
      throw error;
    }
  }
  async function stopRecording(showProblems = true) {
    if (!recording && !mediaStream) return;
    widget.dataset.recording = "false";
    toggle.disabled = true;
    toggleLabel.textContent = "Zaključujem …";
    setStatus("loading", "Zaključujem prepis");
    await flushCaptureProcessor();
    processorNode?.disconnect();
    sourceNode?.disconnect();
    silentGain?.disconnect();
    mediaStream?.getTracks().forEach((track) => track.stop());
    try {
      sendBufferedAudio(true);
      await uploadQueue;
      recording = false;
      audioEpoch += 1;
      activeAudioRequest = null;
      const result = await api("/session/stop", { method: "POST" });
      sessionId = "";
      if (result.finalText && result.finalText.trim()) {
        finalParagraphs.splice(sessionParagraphStart, finalParagraphs.length - sessionParagraphStart, result.finalText.trim());
        stableLiveText = "";
        liveText = "";
        renderTranscript();
      } else {
        consumeResult(result, true);
      }
      showError(result.warning || "");
    } catch (error) {
      if (showProblems) showError(error.message);
    } finally {
      await audioContext?.close().catch(() => null);
      mediaStream = null;
      audioContext = null;
      sourceNode = null;
      processorNode = null;
      processorIsWorklet = false;
      captureFlushResolve = null;
      silentGain = null;
      streamingDownsampler = null;
      bufferedChunks = [];
      bufferedSamples = 0;
      sessionId = "";
      setSourceButtonsDisabled(false);
      toggle.disabled = false;
      toggleLabel.textContent = "Začni prepis";
      setStatus("ready", "Pripravljen");
    }
  }
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      if (recording) await stopRecording();
      else await startRecording();
    } catch (error) {
      showError(error.name === "NotAllowedError"
        ? (selectedAudioSource === "computer" ? "Deljenje zvoka je bilo preklicano." : "Dovoljenje za mikrofon je zavrnjeno.")
        : error.message);
      setStatus("error", "Napaka");
    } finally {
      toggle.disabled = false;
    }
  });
  sourceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!recording) selectAudioSource(button.dataset.audioSource);
    });
  });
  clearButton.addEventListener("click", () => {
    finalParagraphs = [];
    stableLiveText = "";
    liveText = "";
    renderTranscript();
    showError("");
  });
  copyButton.addEventListener("click", async () => {
    const text = [...finalParagraphs, liveText].filter(Boolean).join("\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.setAttribute("aria-label", "Prepis kopiran");
      setTimeout(() => copyButton.setAttribute("aria-label", "Kopiraj prepis"), 1600);
    } catch (_) { showError("Prepisa ni bilo mogoče kopirati v odložišče."); }
  });
  async function pollHealth() {
    try {
      const health = await api("/health");
      if (health.status === "ready") {
        const progressiveReady = health.liveEngine === EXPECTED_ENGINE && health.model === EXPECTED_MODEL;
        if (!progressiveReady) {
          toggle.disabled = true;
          setStatus("error", "Zagnan je star pogon");
          showError("Za kakovosten sprotni prepis znova zaženite “npm run start:slovenski-prepis”.");
          setTimeout(pollHealth, 1400);
          return;
        }
        toggle.disabled = false;
        setStatus("ready", "Pripravljen");
        backendNode.textContent = `${String(health.backend || "").toLowerCase().startsWith("vulkan") ? "Vulkan" : "CPU"} · Canary · sproti`;
        if (health.qualityReady) {
          showError("");
        } else {
          showError("Handyjev Canary Q5 model manjka. Ponovno zaženite “npm run setup:slovenski-prepis”.");
        }
        return;
      }
      setStatus("loading", "Nalaganje modela");
    } catch (error) {
      toggle.disabled = true;
      setStatus("error", "Pogon ni zagnan");
      showError(`${error.message} Zaženite “npm run start:slovenski-prepis”.`);
    }
    setTimeout(pollHealth, 1400);
  }
  renderTranscript();
  selectAudioSource("microphone");
  pollHealth();
  window.addEventListener("beforeunload", () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    if (recording && sessionId) navigator.sendBeacon(`${API}/session/stop?sessionId=${encodeURIComponent(sessionId)}`);
  });
})();
