"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const serverPath = path.join(root, "tools/slovenski-live-prepis/canary-progressive-server.js");
const server = read("tools/slovenski-live-prepis/canary-progressive-server.js");
const worker = read("tools/slovenski-live-prepis/canary-live-worker.ps1");
const start = read("tools/slovenski-live-prepis/start.ps1");
const setup = read("tools/slovenski-live-prepis/setup.ps1");
const readme = read("tools/slovenski-live-prepis/README.md");
const ui = read("app/slovenski-prepis.js");
const html = read("app/slovenski-prepis.html");
const { stableWordPrefix, stableSnapshotTail, wholeWordPreview, trimOuterSilence, findRolloverCut } = require(serverPath);

assert.match(start, /canary-progressive-server\.js/);
assert.match(start, /canary-1b-v2-Q5_K_M\.gguf/);
assert.doesNotMatch(start, /streaming-server\.js|asr_sl_v3\.gguf/);
assert.match(server, /const HOST = "127\.0\.0\.1"/);
assert.match(server, /canary-live-worker\.ps1/);
assert.match(server, /MODEL_NAME = process\.env\.UJ_PREPIS_MODEL_NAME \|\| "canary-1b-v2-Q5_K_M\.gguf"/);
assert.match(server, /segmentAudio = Buffer\.concat\(\[segmentAudio, audio\]\)/, "Vsak paket se mora dodati rastočemu segmentu");
assert.match(server, /transcribeSnapshot\(segmentAudio\)/, "Vsak vmesni prepis mora dobiti ves trenutni segment");
assert.match(server, /streamingMode: "progressive-full-context-3s-word-stable"/);
assert.match(server, /activeSessionId = crypto\.randomUUID\(\)/);
assert.match(server, /sessionId !== activeSessionId/, "Tuja ali stara seja ne sme mešati zvoka v aktivni prepis");
assert.match(server, /Content-Type, X-UJ-Prepis-Session/);
assert.match(server, /committedText = appendText\(finalizedPrefix, stableSegmentText\)/, "Potrjena predpona se ne sme umakniti");
assert.match(server, /text = appendText\(committedText, wholeWordPreview\(tentativeText\)\)/, "Vidni tekst mora vedno ohraniti potrjeno predpono in skriti mejno besedo");
assert.match(server, /if \(segmentAudio\.length\) \{[\s\S]*?transcribeSnapshot\(segmentAudio\)/, "Final mora prepisati celoten trenutni segment, tudi kratek rep");
assert.match(server, /if \(require\.main === module\)/, "Uvoz helperjev ne sme zagnati strežnika");
assert.doesNotMatch(server, /WINDOW_OVERLAP|novelWindowText|rpc\("feed"/, "Progressive tok ne sme prepisovati izoliranih oken");

assert.deepEqual(stableWordPrefix("", "Hvala. Poglejte"), {
  count: 0,
  text: "",
  tentative: "Hvala. Poglejte",
}, "Prvi snapshot mora biti v celoti začasen");
assert.deepEqual(stableWordPrefix("Hvala. Poglejte, drugi", "Hvala Poglejte drugi ocenov"), {
  count: 3,
  text: "Hvala Poglejte drugi",
  tentative: "ocenov",
}, "Ločila ne smejo preprečiti stabilizacije celih besed");
assert.deepEqual(stableWordPrefix("To je nedokon", "To je nedokončana beseda"), {
  count: 2,
  text: "To je",
  tentative: "nedokončana beseda",
}, "Spremenjena zadnja beseda ne sme biti potrjena kot delna beseda");
assert.equal(
  stableSnapshotTail("drugi ocenov je Fursu", "Hvala. Poglejte, drugi ocenov je Fursu poplačal"),
  "poplačal",
  "Stabilno predpono je treba poravnati tudi, če Canary pozneje obnovi uvodne besede",
);
assert.equal(stableSnapshotTail("potrjena predpona", "povsem drugačen snapshot"), "");
assert.equal(wholeWordPreview("Cela beseda nedokon"), "Cela beseda", "Mejna beseda se pokaže šele v naslednjem snapshotu");
assert.equal(wholeWordPreview("ena"), "");
const paddedSpeech = pcm(2, 0);
const paddedSamples = new Float32Array(paddedSpeech.buffer, paddedSpeech.byteOffset, paddedSpeech.byteLength / 4);
paddedSamples.fill(0.05, 16000, 17600);
const trimmedSpeech = trimOuterSilence(paddedSpeech);
assert.equal(trimmedSpeech.length / 4, 14400, "Obrezovanje mora ohraniti 0,4 s tišine na obeh robovih govora");

function pcm(seconds, level = 0.05) {
  const samples = new Float32Array(Math.round(16000 * seconds));
  samples.fill(level);
  return Buffer.from(samples.buffer);
}

const shortAudio = pcm(29);
assert.equal(findRolloverCut(shortAudio), 0, "Pred 30 sekundami segment ne sme preiti naprej");
const uninterrupted = pcm(31);
assert.equal(findRolloverCut(uninterrupted), 0, "Brez naravne tišine dolgega segmenta ne smemo rezati");
const withNaturalPause = pcm(31);
new Float32Array(withNaturalPause.buffer, withNaturalPause.byteOffset, withNaturalPause.byteLength / 4)
  .fill(0, Math.round(16000 * 25), Math.round(16000 * 25.5));
const cut = findRolloverCut(withNaturalPause);
assert.ok(cut >= 16000 * 25.3 && cut <= 16000 * 25.6, `Rollover mora pasti v naravno tišino, dobil ${cut / 16000}s`);

assert.match(worker, /transcribe_run/);
assert.match(worker, /transcribe_model_load_file/);
assert.match(worker, /transcribe_session_init/);
assert.match(worker, /ModelFree\(\$model\)/);
assert.match(worker, /SessionFree\(\$session\)/, "Vsak snapshot mora dobiti svežo sejo na enkrat naloženem modelu");
assert.match(worker, /ConvertTo-NativeUtf8 "sl"/);
assert.match(worker, /request\.command -ne "transcribe"/);

assert.match(ui, /bufferedSamples < 48000/, "Brskalnik mora pošiljati približno trisekundne pakete");
assert.match(ui, /sendBufferedAudio\(true\);\s*await uploadQueue;/, "Pred zaključkom je treba poslati zadnji nepopolni paket");
assert.match(ui, /result\.committedText/);
assert.match(ui, /result\.tentativeText/);
assert.match(ui, /X-UJ-Prepis-Session/);
assert.match(ui, /started\.sessionId/);
assert.match(ui, /EXPECTED_ENGINE = "handy-canary-progressive"/);
assert.match(ui, /EXPECTED_MODEL = "canary-1b-v2-Q5_K_M\.gguf"/);
assert.match(ui, /Canary · sproti/);
assert.match(ui, /navigator\.mediaDevices\.getUserMedia/);
assert.match(ui, /navigator\.mediaDevices\.getDisplayMedia/);
assert.match(ui, /channelCount: 1/);
assert.doesNotMatch(ui, /sampleRate: \{ ideal: 16000 \}/, "Brskalnik ne sme zvoka najprej prevesti na 16 kHz in ga nato znova dvigniti na AudioContext frekvenco");
assert.match(ui, /function createStreamingDownsampler\(sourceRate\)/);
assert.match(ui, /const radius = 64/);
assert.match(ui, /sinc\(2 \* cutoff \* distance\)/);
assert.match(ui, /streamingDownsampler\.process/);
assert.doesNotMatch(ui, /Math\.round\(input\.length \/ ratio\)/, "Vsak audio callback ne sme na novo zaokrožiti faze vzorčenja");
assert.match(ui, /new AudioWorkletNode/);
assert.match(ui, /registerProcessor\("uj-capture-processor"/);
assert.match(ui, /await flushCaptureProcessor\(\);/, "Ob ustavitvi je treba poslati tudi rep AudioWorklet medpomnilnika");
assert.match(ui, /echoCancellation: false/);
assert.match(ui, /noiseSuppression: false/);
assert.match(ui, /autoGainControl: false/);

assert.match(setup, /handy-computer\/transcribe\.cpp/);
assert.match(setup, /transcribe-native-0\.1\.3-windows-x86_64-cpu-vulkan\.tar\.gz/);
assert.match(setup, /handy-computer\/canary-1b-v2-gguf/);
assert.match(setup, /canary-1b-v2-Q5_K_M\.gguf/);
assert.match(setup, /Security\.Cryptography\.SHA256/);
assert.match(setup, /asset\.digest/);
assert.match(setup, /modelFile\.lfs\.sha256/);
assert.match(readme, /vsake tri sekunde znova prepiše ves rastoči trenutni segment/);
assert.match(readme, /skupno predpono celih besed/);
assert.match(readme, /naravno tišino/);
assert.match(html, /PREPIS V ŽIVO/);
assert.match(html, /canary-progressive-v17/);
assert.match(html, /Zvok ostaja na tem računalniku/);
assert.doesNotMatch(ui, /mock|testni prepis/i);

console.log("Slovenski progressive Canary prepis: ciljni strukturni in regresijski testi uspešni");
