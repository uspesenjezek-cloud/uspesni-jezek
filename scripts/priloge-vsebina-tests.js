/**
 * Enotni testi za priloge-vsebina (brez brskalnika).
 * Zaženi: node scripts/priloge-vsebina-tests.js
 */
const path = require("path");
const fs = require("fs");

function loadScripts() {
  const root = path.join(__dirname, "..", "app");
  global.window = global;
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(root, "priloge-konstante.js"), "utf8"));
  eval(fs.readFileSync(path.join(root, "priloge-vsebina.js"), "utf8"));
  return { K: global.UJPrilogeKonstante, PV: global.UJPrilogeVsebina };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const { K, PV } = loadScripts();
let ok = 0;

function test(name, fn) {
  try {
    fn();
    ok += 1;
    console.log("ok -", name);
  } catch (e) {
    console.error("FAIL -", name, e.message);
    process.exitCode = 1;
  }
}

test("konstante obstajajo", () => {
  assert(K.MAX_ATTACHMENTS_PER_STEP === 10);
  assert(K.MAX_FILE_SIZE_BYTES === 10 * 1024 * 1024);
  assert(K.MAX_TOTAL_ATTACHMENT_BYTES === 25 * 1024 * 1024);
});

test("števec ready ne šteje uploading", () => {
  const n = PV.stevecReady([
    { status: "ready" },
    { status: "uploading" },
    { status: "error" },
  ]);
  assert(n === 1);
});

test("višina seznama 1 / 2+", () => {
  assert(PV.visinaSeznama(1) === 68);
  assert(PV.visinaSeznama(2) === 102);
  assert(PV.visinaSeznama(5) === 102);
});

test("SMS povezava samo če je SMS kanal", () => {
  assert(PV.smsDodatekPovezave([{ status: "ready", deliveryChannels: { email: true } }]) === "");
  const d = PV.smsDodatekPovezave([
    { status: "ready", deliveryChannels: { sms: true } },
  ], "abc");
  assert(d.indexOf("uj.link/r/abc") >= 0);
  assert(d.indexOf("Račune lahko varno pregledate") >= 0);
});

test("ena SMS povezava za več računov", () => {
  const priloge = [
    { status: "ready", deliveryChannels: { sms: true } },
    { status: "ready", deliveryChannels: { sms: true, email: true } },
  ];
  const t = PV.sestaviSmsZPrilogami("Pozdravljeni", priloge, "xyz");
  assert((t.match(/uj\.link\/r\/xyz/g) || []).length === 1);
});

test("validacija mime", () => {
  assert(K.jeMimeDovoljen("application/pdf", "a.pdf"));
  assert(K.jeMimeDovoljen("image/jpeg", "a.jpg"));
  assert(!K.jeMimeDovoljen("application/zip", "a.zip"));
});

test("validirajDatoteko limit števila", () => {
  const obstojeci = Array.from({ length: 10 }, (_, i) => ({
    status: "ready",
    sizeBytes: 100,
  }));
  const r = PV.validirajDatoteko(
    { name: "x.pdf", type: "application/pdf", size: 100 },
    obstojeci
  );
  assert(r.napaka && r.napaka.indexOf("10") >= 0);
});

test("privzeti kanali glede na kontakt", () => {
  const a = PV.privzetiKanaliZaNovoPrilogo({
    imaTelefon: true,
    imaEmail: false,
    korakSms: true,
    korakEmail: true,
  });
  assert(a.sms === true && a.email === false);
  const b = PV.privzetiKanaliZaNovoPrilogo({
    imaTelefon: true,
    imaEmail: true,
    korakSms: true,
    korakEmail: true,
  });
  assert(b.sms && b.email);
});

test("potrditev zahteva kanal", () => {
  const r = PV.vsePrilogeVeljavneZaPotrditev(
    [{ status: "ready", deliveryChannels: { sms: false, email: false } }],
    true,
    true
  );
  assert(!r.ok);
});

test("sejo roundtrip", () => {
  const priloge = [
    {
      id: "a1",
      originalFileName: "racun.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      storagePath: "u/x.pdf",
      status: "ready",
      deliveryChannels: { sms: true, email: false },
      origin: "manual_attachment",
    },
  ];
  const seja = PV.prilogeVSejo(priloge);
  assert(seja.racunDatotekePoti[0] === "u/x.pdf");
  assert(seja.attachmentKanali[0].sms === true);
  const nazaj = PV.izSejeVPriloge(seja);
  assert(nazaj.length === 1);
  assert(nazaj[0].deliveryChannels.sms === true);
});

console.log("\n" + ok + " testov OK");
