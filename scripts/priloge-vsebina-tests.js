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
  assert(PV.visinaSeznama(1) === 54);
  assert(PV.visinaSeznama(2) === 81);
  assert(PV.visinaSeznama(5) === 81);
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

test("potrditev dovoli prilogo brez kanala", () => {
  const r = PV.vsePrilogeVeljavneZaPotrditev(
    [{ status: "ready", deliveryChannels: { sms: false, email: false } }],
    true,
    true
  );
  assert(r.ok);
});

test("SMS in e-pošta sta neodvisna (samo SMS / samo e-pošta / oba)", () => {
  assert(
    PV.vsePrilogeVeljavneZaPotrditev(
      [{ status: "ready", deliveryChannels: { sms: true, email: false } }],
      true,
      true
    ).ok
  );
  assert(
    PV.vsePrilogeVeljavneZaPotrditev(
      [{ status: "ready", deliveryChannels: { sms: false, email: true } }],
      true,
      true
    ).ok
  );
  assert(
    PV.vsePrilogeVeljavneZaPotrditev(
      [{ status: "ready", deliveryChannels: { sms: true, email: true } }],
      true,
      true
    ).ok
  );
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

test("vprašanje in odgovor priloge preživita sejo", () => {
  const seja = PV.prilogeVSejo([{
    id: "opis-1",
    originalFileName: "slika.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 200,
    storagePath: "u/slika.jpg",
    status: "ready",
    deliveryChannels: { sms: false, email: false },
    descriptionQuestion: "Kdaj je nastala slika?",
    description: "12. avgusta na gradbišču.",
    descriptionRequired: true,
  }]);
  const nazaj = PV.izSejeVPriloge(seja)[0];
  assert(nazaj.descriptionQuestion === "Kdaj je nastala slika?");
  assert(nazaj.description === "12. avgusta na gradbišču.");
  assert(nazaj.descriptionRequired === true);
});

test("obvezen prazen opis blokira potrditev, opcijski pa ne", () => {
  assert(!PV.vsePrilogeVeljavneZaPotrditev([{
    status: "ready",
    descriptionRequired: true,
    description: "",
  }]).ok);
  assert(PV.vsePrilogeVeljavneZaPotrditev([{
    status: "ready",
    descriptionRequired: false,
    description: "",
  }]).ok);
});

test("račun in dokazilo opravljenega dobita različni vrsti", () => {
  const nacrt = PV.prilogeZaNacrt({
    racunDatotekePoti: ["u/racun.pdf"],
    attachmentMeta: [{ id: "r1", originalFileName: "racun.pdf" }],
    opravljenoDatotekePoti: ["u/delo.jpg"],
    opravljenoAttachmentMeta: [{
      id: "d1",
      originalFileName: "delo.jpg",
      description: "Po končanem delu.",
    }],
  });
  assert(nacrt.length === 2);
  assert(nacrt[0].documentType === "invoice");
  assert(nacrt[1].documentType === "work_evidence");
  assert(nacrt[1].description === "Po končanem delu.");
});

test("opis brez slike se prenese kot besedilno dokazilo", () => {
  const nacrt = PV.prilogeZaNacrt({
    opravljenoBrezSlike: [{
      id: "brez-1",
      originalFileName: "Opis prvotnega stanja",
      descriptionQuestion: "Opišite prvotno stanje.",
      description: "Površina je bila razpokana in vlažna.",
      descriptionRequired: true,
      textOnly: true,
    }],
  });
  assert(nacrt.length === 1);
  assert(nacrt[0].documentType === "work_evidence");
  assert(nacrt[0].storagePath === null);
  assert(nacrt[0].textOnly === true);
  assert(nacrt[0].description === "Površina je bila razpokana in vlažna.");
});

test("več slik istega vprašanja ohrani skupino in skupni opis", () => {
  const nacrt = PV.prilogeZaNacrt({
    opravljenoDatotekePoti: ["u/stanje-1.jpg", "u/stanje-2.jpg"],
    opravljenoAttachmentMeta: [
      { id: "s1", groupId: "skupina-1", description: "Prvotno stanje stanovanja." },
      { id: "s2", groupId: "skupina-1", description: "Prvotno stanje stanovanja." },
    ],
  });
  assert(nacrt.length === 2);
  assert(nacrt[0].groupId === "skupina-1");
  assert(nacrt[1].groupId === "skupina-1");
  assert(nacrt[0].description === nacrt[1].description);
});

console.log("\n" + ok + " testov OK");
