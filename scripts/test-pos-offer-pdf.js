"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument } = require("pdf-lib");
const generator = require("../api/_lib/pos-offer-pdf");
const endpoint = require("../api/pos-angebot-pdf");
const confirmationEndpoint = require("../api/pos-pogodba-pdf");

const root = path.resolve(__dirname, "..");
const handlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-angebot-pdf.js"), "utf8");
const confirmationHandlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-pogodba-pdf.js"), "utf8");
const dispatcher = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const vercelIgnore = fs.readFileSync(path.join(root, ".vercelignore"), "utf8");
const terminal = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const migrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_offer_documents\.sql$/.test(name)).sort().pop();
assert.ok(migrationName, "Manjka migracija za izvirnike ponudb.");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrationName), "utf8");

function workOrder() {
  const items = [];
  for (let index = 0; index < 42; index += 1) {
    items.push({
      description: "Fachgerechte Elektroinstallationsleistung Abschnitt " + (index + 1), category: "labour",
      quantity_milli: 1000, unit: "Std.", unit_price_cents: 10000, tax_rate_bps: 1900,
      net_cents: 10000, tax_cents: 1900, gross_cents: 11900
    });
  }
  return {
    id: "11111111-1111-4111-8111-111111111111", offer_number: "ANG-2026-0042", status: "offered",
    title: "Elektroinstallation Mehrfamilienhaus", customer_name: "Kunde Bau GmbH", valid_until: "2026-09-15",
    net_cents: 420000, tax_cents: 79800, gross_cents: 499800, offered_at: "2026-08-22T10:00:00.000Z",
    locked_payload: {
      seller: {
        legalName: "Muster Handwerk GmbH", legalForm: "GmbH", representative: "Erika Beispiel, Max Mustermann",
        companySeat: "Berlin", registerCourt: "Amtsgericht Charlottenburg", registerNumber: "HRB 12345 B",
        street: "Musterstraße 1", postalCode: "10115", city: "Berlin", businessEmail: "angebot@muster-handwerk.de", businessPhone: "+49 30 1234567",
        taxNumber: "12/345/67890", vatId: "DE123456789"
      },
      customer_type: "business", consumer_contract_context: "not_applicable", urgent_repair_scope: "",
      customer_street: "Baustraße 5", customer_postal_code: "20095", customer_city: "Hamburg",
      issue_date: "2026-08-22", service_date: "2026-09-20", work_description: "Lieferung, Montage und dokumentierte Funktionsprüfung.",
      tax_mode: "regular", items
    }
  };
}

(async () => {
  const offer = workOrder();
  assert.equal(generator.normalizeOffer(offer).items.length, 42);
  assert.throws(() => generator.normalizeOffer(Object.assign({}, offer, { status: "draft" })), /ni zaklenjena/);
  assert.throws(() => generator.normalizeOffer(Object.assign({}, offer, { locked_payload: Object.assign({}, offer.locked_payload, { seller: {} }) })), /pravnih podatkov/);
  const registeredOffer = workOrder();
  registeredOffer.locked_payload.seller = Object.assign({}, registeredOffer.locked_payload.seller, {
    legalName: "Muster Handwerk OHG", legalForm: "OHG", registerNumber: "HRA 12345 B"
  });
  assert.equal(generator.normalizeOffer(registeredOffer).seller.legalForm, "OHG");
  assert.throws(() => generator.normalizeOffer(Object.assign({}, registeredOffer, {
    locked_payload: Object.assign({}, registeredOffer.locked_payload, {
      seller: Object.assign({}, registeredOffer.locked_payload.seller, { registerNumber: "" })
    })
  })), /registrskih podatkov/);

  const buffer = await generator.ustvariPonudboPdf(offer);
  assert.ok(buffer.length > 5000);
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "%PDF");
  const pdf = await PDFDocument.load(buffer);
  assert.ok(pdf.getPageCount() >= 2, "Dolga ponudba mora pravilno nadaljevati tabelo na novi strani.");
  assert.equal(pdf.getTitle(), "Angebot ANG-2026-0042");
  assert.equal(pdf.getCreator(), "uj-pos-offer-pdf-6");

  const consumerOffer = workOrder();
  consumerOffer.customer_name = "Max Mustermann";
  consumerOffer.locked_payload.customer_type = "private";
  consumerOffer.locked_payload.consumer_contract_context = "distance";
  const consumerBuffer = await generator.ustvariPonudboPdf(consumerOffer);
  const consumerPdf = await PDFDocument.load(consumerBuffer);
  assert.ok(consumerPdf.getPageCount() >= pdf.getPageCount() + 2, "B2C Fernabsatz mora dodati Widerrufsbelehrung in Muster-Widerrufsformular.");
  assert.throws(() => generator.normalizeOffer(Object.assign({}, consumerOffer, { locked_payload: Object.assign({}, consumerOffer.locked_payload, { consumer_contract_context: "unknown" }) })), /načina sklenitve/);
  assert.throws(() => generator.normalizeOffer(Object.assign({}, consumerOffer, { locked_payload: Object.assign({}, consumerOffer.locked_payload, { consumer_contract_context: "urgent_repair", urgent_repair_scope: "" }) })), /nujno popravilo/i);
  consumerOffer.status = "accepted";
  consumerOffer.order_number = "AUF-2026-0042";
  consumerOffer.accepted_on = "2026-08-22";
  const offerSha256 = endpoint._test.sha256(consumerBuffer);
  const confirmationBuffer = await generator.ustvariPogodbenoPotrdiloPdf(consumerOffer, {
    id: "22222222-2222-4222-8222-222222222222",
    accepted_on: "2026-08-22",
    accepted_at: "2026-08-22T11:00:00.000Z",
    recorded_at: "2026-08-22T11:05:00.000Z",
    offer_sha256: offerSha256
  }, consumerBuffer);
  const confirmationPdf = await PDFDocument.load(confirmationBuffer);
  assert.equal(confirmationPdf.getPageCount(), consumerPdf.getPageCount() + 1, "Potrdilo mora imeti naslovnico in nespremenljive strani sprejete ponudbe.");
  assert.equal(confirmationPdf.getTitle(), "Vertragsbestätigung AUF-2026-0042");
  assert.equal(confirmationPdf.getCreator(), "uj-pos-contract-confirmation-pdf-4");
  await assert.rejects(() => generator.ustvariPogodbenoPotrdiloPdf(Object.assign({}, consumerOffer, { status: "offered" }), {}, consumerBuffer), /datum sprejema|dokaz/i);
  const longConsumerOffer = workOrder();
  longConsumerOffer.customer_name = "Maximilian-Alexander von Beispielhausen und Katharina Eleonore Mustermann-Beispiel mit besonders langem gemeinsamem Auftraggebernamen";
  longConsumerOffer.title = "Energetische Gesamtsanierung eines denkmalgeschützten Mehrfamilienhauses einschließlich Elektro-, Steuerungs- und Dokumentationsarbeiten";
  longConsumerOffer.status = "accepted";
  longConsumerOffer.order_number = "AUF-2026-0043";
  longConsumerOffer.accepted_on = "2026-08-22";
  longConsumerOffer.locked_payload.customer_type = "private";
  longConsumerOffer.locked_payload.consumer_contract_context = "distance";
  longConsumerOffer.locked_payload.customer_street = "Professor-Dr.-Maria-Montessori-Straße 123 Hinterhaus Aufgang C";
  longConsumerOffer.locked_payload.customer_city = "Frankfurt am Main - Sachsenhausen";
  longConsumerOffer.locked_payload.seller.legalName = "Musterbetrieb für Elektro-, Gebäudeautomations- und Sicherheitstechnik Max Mustermann GmbH & Co. KG";
  longConsumerOffer.locked_payload.seller.legalForm = "GmbH & Co. KG";
  longConsumerOffer.locked_payload.seller.street = "Friedrich-Wilhelm-von-Steuben-Straße 123 Gewerbehof Gebäude 7";
  longConsumerOffer.locked_payload.seller.representative = "Maximilian Alexander Mustermann, Dr. Katharina Eleonore Beispiel-Mustermann";
  longConsumerOffer.locked_payload.work_description = "Vollständige Bestandsaufnahme, fachgerechte Planung, Lieferung, Montage, Parametrierung, Funktionsprüfung und revisionssichere Dokumentation sämtlicher vereinbarter Elektro- und Gebäudeautomationsarbeiten einschließlich der Abstimmung mit weiteren beteiligten Fachunternehmen.";
  longConsumerOffer.locked_payload.items[0].description = "Fachgerechte Demontage, Leitungsführung, Montage, Parametrierung, Prüfung und vollständige Dokumentation der Gebäudeautomations- und Sicherheitskomponenten im schwer zugänglichen Bestandsbereich einschließlich aller erforderlichen Nebenarbeiten";
  const longOfferBuffer = await generator.ustvariPonudboPdf(longConsumerOffer);
  const longOfferPdf = await PDFDocument.load(longOfferBuffer);
  assert.ok(longOfferPdf.getPageCount() >= consumerPdf.getPageCount(), "Dolga realistična besedila ne smejo zmanjšati ali odrezati vsebine ponudbe.");
  const longOfferSha256 = endpoint._test.sha256(longOfferBuffer);
  const longConfirmationBuffer = await generator.ustvariPogodbenoPotrdiloPdf(longConsumerOffer, {
    id: "33333333-3333-4333-8333-333333333333",
    accepted_on: "2026-08-22",
    accepted_at: "2026-08-22T11:00:00.000Z",
    recorded_at: "2026-08-22T11:05:00.000Z",
    offer_sha256: longOfferSha256
  }, longOfferBuffer);
  const longConfirmationPdf = await PDFDocument.load(longConfirmationBuffer);
  assert.equal(longConfirmationPdf.getPageCount(), longOfferPdf.getPageCount() + 1);
  if (process.env.POS_OFFER_PDF_SAMPLE_OUTPUT) fs.writeFileSync(process.env.POS_OFFER_PDF_SAMPLE_OUTPUT, longOfferBuffer);
  if (process.env.POS_CONTRACT_CONFIRMATION_PDF_SAMPLE_OUTPUT) fs.writeFileSync(process.env.POS_CONTRACT_CONFIRMATION_PDF_SAMPLE_OUTPUT, longConfirmationBuffer);
  const urgentOffer = workOrder();
  urgentOffer.customer_name = "Erika Beispiel";
  urgentOffer.locked_payload.customer_type = "private";
  urgentOffer.locked_payload.consumer_contract_context = "urgent_repair";
  urgentOffer.locked_payload.urgent_repair_scope = "Absperren der akut undichten Leitung und Austausch des zwingend erforderlichen Ventils.";
  const urgentBuffer = await generator.ustvariPonudboPdf(urgentOffer);
  const urgentPdf = await PDFDocument.load(urgentBuffer);
  assert.equal(urgentPdf.getPageCount(), pdf.getPageCount() + 1, "Nujno popravilo mora dodati omejeno izjavo o izrecni zahtevi.");
  if (process.env.POS_URGENT_PDF_SAMPLE_OUTPUT) fs.writeFileSync(process.env.POS_URGENT_PDF_SAMPLE_OUTPUT, urgentBuffer);
  assert.match(fs.readFileSync(path.join(root, "api", "_lib", "pos-offer-pdf.js"), "utf8"), /Widerrufsbelehrung[\s\S]*Muster-Widerrufsformular[\s\S]*Ausdrückliches Verlangen zum vorzeitigen Beginn/);
  const offerSource = fs.readFileSync(path.join(root, "api", "_lib", "pos-offer-pdf.js"), "utf8");
  assert.match(fs.readFileSync(path.join(root, "api", "_lib", "pos-pdf.js"), "utf8"), /function drawHeaderSeller[\s\S]*fitSize\(clean, font, maxWidth, preferred, minimum\)[\s\S]*wrap\(clean, font, size, maxWidth\)/);
  assert.equal((offerSource.match(/drawHeaderSeller\((?:page|cover), seller\.legalName, bold, \{/g) || []).length, 2);
  assert.equal((offerSource.match(/maxWidth: 278,[\s\S]{0,80}minimum: 8\.5/g) || []).length, 2);
  assert.match(offerSource, /flatMap\(\(line\) => wrap\(line, regular, 8\.8, 250\)\)/);
  assert.match(offerSource, /flatMap\(\(line\) => wrap\(line, regular, 9\.5, 250\)\)/);
  assert.match(offerSource, /wrap\(workOrder\.title, bold, 12, PAGE\.width - PAGE\.margin \* 2\)/);
  assert.match(offerSource, /const valueLines = wrap\(value, bold, 9, PAGE\.width - PAGE\.margin - 205\)/);

  assert.equal(endpoint._test.objectPath("u", "w"), "u/w/angebot.pdf");
  assert.equal(endpoint._test.encodedPath("a b/c"), "a%20b/c");
  assert.equal(endpoint._test.uuid("not-a-uuid"), "");
  assert.match(handlerSource, /preveriUporabnika\(req, cfg\)/);
  assert.match(handlerSource, /user_id=eq\." \+ encodeURIComponent\(userId\)/);
  assert.match(handlerSource, /"x-upsert": "false"/);
  assert.match(handlerSource, /providerJson\.readBuffer\(response,[\s\S]*MAX_PDF_BYTES/);
  assert.doesNotMatch(handlerSource, /response\.arrayBuffer\(/);
  assert.match(dispatcher, /"offer-pdf": require\("\.\/_handlers\/pos-angebot-pdf"\)/);
  assert.match(vercel, /"\/api\/pos-angebot-pdf"[\s\S]*handler=offer-pdf/);
  assert.match(vercelIgnore, /^api\/pos-angebot-pdf\.js$/m, "Združeni Angebot handler ne sme šteti kot dodatna Vercel funkcija.");
  assert.match(terminal, /function downloadOfferPdf\(order\)/);
  assert.match(terminal, /Ponudba je zaklenjena in njen PDF original je pripravljen/);
  assert.equal(confirmationEndpoint._test.objectPath("u", "w"), "u/w/vertragsbestaetigung.pdf");
  assert.equal(confirmationEndpoint._test.encodedPath("a b/c"), "a%20b/c");
  assert.equal(confirmationEndpoint._test.uuid("not-a-uuid"), "");
  assert.match(confirmationHandlerSource, /preveriUporabnika\(req, cfg\)/);
  assert.match(confirmationHandlerSource, /pos_work_order_acceptances/);
  assert.match(confirmationHandlerSource, /offerDocument\.sha256 !== acceptance\.offer_sha256/);
  assert.match(confirmationHandlerSource, /sha256\(offerPdf\) !== offerDocument\.sha256/);
  assert.match(confirmationHandlerSource, /"x-upsert": "false"/);
  assert.match(confirmationHandlerSource, /providerJson\.readBuffer\(response,[\s\S]*MAX_PDF_BYTES/);
  assert.doesNotMatch(confirmationHandlerSource, /response\.arrayBuffer\(/);
  assert.match(dispatcher, /"contract-confirmation-pdf": require\("\.\/_handlers\/pos-pogodba-pdf"\)/);
  assert.match(vercel, /"\/api\/pos-pogodba-pdf"[\s\S]*handler=contract-confirmation-pdf/);
  assert.match(vercelIgnore, /^api\/pos-pogodba-pdf\.js$/m, "Združeno pogodbeno potrdilo ne sme šteti kot dodatna Vercel funkcija.");
  const ignoredApiFiles = new Set(vercelIgnore.split(/\r?\n/).filter((line) => /^api\/[^/]+\.js$/.test(line)));
  const deployedFunctionCount = fs.readdirSync(path.join(root, "api"))
    .filter((name) => name.endsWith(".js") && !ignoredApiFiles.has("api/" + name)).length;
  assert.ok(deployedFunctionCount <= 12, "Hobby uvedba presega omejitev 12 Vercel funkcij: " + deployedFunctionCount);
  assert.match(terminal, /function downloadContractConfirmationPdf\(order\)/);

  assert.match(migration, /create table public\.pos_offer_documents/i);
  assert.match(migration, /foreign key \(work_order_id, user_id\)[\s\S]*references public\.pos_work_orders\(id, user_id\)/i);
  assert.match(migration, /alter table public\.pos_offer_documents enable row level security/i);
  assert.match(migration, /revoke all on table public\.pos_offer_documents from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.pos_offer_documents to authenticated/i);
  assert.match(migration, /pos_offer_documents_validate_source[\s\S]*before insert on public\.pos_offer_documents/i);
  assert.match(migration, /pos_offer_documents_immutable[\s\S]*before update or delete on public\.pos_offer_documents/i);
  assert.match(migration, /'pos-offer-originals'[\s\S]*false[\s\S]*array\['application\/pdf'\]/i);

  console.log("POS offer PDF: zaklenjen večstranski Angebot, zasebni original, RLS in API so preverjeni.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
