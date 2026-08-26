import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");

async function prostPort() {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function pocakajNaStreznik(url, otrok) {
  for (let poskus = 0; poskus < 50; poskus += 1) {
    if (otrok.exitCode != null) throw new Error("Lokalni strežnik se je predčasno ustavil.");
    try {
      const odgovor = await fetch(url);
      if (odgovor.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("Lokalni strežnik se ni pravočasno zagnal.");
}

const zahteve = [];
const oddaljeni = http.createServer(async (req, res) => {
  const deli = [];
  for await (const del of req) deli.push(del);
  zahteve.push({
    method: req.method,
    url: req.url,
    authorization: req.headers.authorization,
    contentType: req.headers["content-type"],
    body: Buffer.concat(deli).toString("utf8"),
  });
  const telo = Buffer.from(JSON.stringify({ ok: true, source: "mock-remote" }));
  res.writeHead(201, { "Content-Type": "application/json", "Content-Length": telo.length });
  res.end(telo);
});

oddaljeni.listen(0, "127.0.0.1");
await once(oddaljeni, "listening");
const oddaljeniPort = oddaljeni.address().port;
const lokalniPort = await prostPort();
const otrok = spawn(process.execPath, ["scripts/local-server.js", "--port", String(lokalniPort)], {
  cwd: root,
  env: {
    ...process.env,
    LOCAL_IZVEDBA_API_ORIGIN: `http://127.0.0.1:${oddaljeniPort}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await pocakajNaStreznik(`http://127.0.0.1:${lokalniPort}/__app-version`, otrok);

  const payload = { zadevaId: "z-1", actionType: "paid_in_full", settings: { settlementType: "cancelled_invoice" } };
  const post = await fetch(`http://127.0.0.1:${lokalniPort}/api/izvedi-opomin-ukrep?poskus=1`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(post.status, 201);
  assert.deepEqual(await post.json(), { ok: true, source: "mock-remote" });
  assert.equal(zahteve[0].method, "POST");
  assert.equal(zahteve[0].url, "/api/izvedi-opomin-ukrep?poskus=1");
  assert.equal(zahteve[0].authorization, "Bearer test-token");
  assert.equal(zahteve[0].contentType, "application/json");
  assert.deepEqual(JSON.parse(zahteve[0].body), payload);

  const get = await fetch(`http://127.0.0.1:${lokalniPort}/api/pridobi-izvedbo?zadevaId=z-1`, {
    headers: { Authorization: "Bearer test-token" },
  });
  assert.equal(get.status, 201);
  assert.equal(zahteve[1].method, "GET");
  assert.equal(zahteve[1].url, "/api/pridobi-izvedbo?zadevaId=z-1");
  assert.equal(zahteve[1].authorization, "Bearer test-token");

  const zavrnjena = await fetch(`http://127.0.0.1:${lokalniPort}/api/izvedi-opomin-ukrep`, { method: "PUT" });
  assert.equal(zavrnjena.status, 405);
  assert.equal(zahteve.length, 2, "nedovoljena metoda se ne sme posredovati naprej");

  const lokalniApiPort = await prostPort();
  const lokalniApiOtrok = spawn(process.execPath, ["scripts/local-server.js", "--port", String(lokalniApiPort)], {
    cwd: root,
    env: {
      ...process.env,
      LOCAL_IZVEDBA_API_ORIGIN: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await pocakajNaStreznik(`http://127.0.0.1:${lokalniApiPort}/__app-version`, lokalniApiOtrok);
    for (const pot of ["pridobi-izvedbo?zadevaId=z-1", "izvedi-opomin-ukrep"]) {
      const odgovor = await fetch(`http://127.0.0.1:${lokalniApiPort}/api/${pot}`, {
        method: pot === "izvedi-opomin-ukrep" ? "POST" : "GET",
        headers: pot === "izvedi-opomin-ukrep" ? { "Content-Type": "application/json" } : undefined,
        body: pot === "izvedi-opomin-ukrep" ? JSON.stringify({ zadevaId: "z-1" }) : undefined,
      });
      assert.equal(odgovor.status, 401, pot + " mora brez prijave odgovoriti iz aktualnega lokalnega handlerja");
    }
    assert.equal(zahteve.length, 2, "lokalna izvedba se ne sme pomešati z oddaljenim proxyjem");
  } finally {
    lokalniApiOtrok.kill();
  }

  console.log("Lokalni izvedba proxy: 5 preveritev uspešnih.");
} finally {
  otrok.kill();
  await new Promise((resolve) => oddaljeni.close(resolve));
}
