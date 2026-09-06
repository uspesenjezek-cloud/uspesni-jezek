"use strict";

var catalog = require("../../app/ponudba-moduli-engine");
var lunaPolicy = require("./atena-luna-policy");
var MODEL = lunaPolicy.MODEL;
var MAX_TEXT_LENGTH = lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    profileId: { anyOf: [{ type: "integer" }, { type: "null" }] },
    offerModelIds: { type: "array", items: { type: "integer" }, maxItems: lunaPolicy.MAX_STRUCTURED_ITEMS },
    salesChannelIds: { type: "array", items: { type: "integer" }, maxItems: lunaPolicy.MAX_STRUCTURED_ITEMS },
    moduleIds: { type: "array", items: { type: "integer" }, maxItems: 28 },
    facts: { type: "array", maxItems: lunaPolicy.MAX_STRUCTURED_ITEMS, items: { type: "object", additionalProperties: false, properties: {
      fieldId: { type: "integer" }, value: { type: "string", maxLength: 500 }, evidence: { type: "string", maxLength: 180 }
    }, required: ["fieldId", "value", "evidence"] } }
  }, required: ["profileId", "offerModelIds", "salesChannelIds", "moduleIds", "facts"]
};
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);
function contract() {
  return {
    model: MODEL,
    contractVersion: catalog.contractVersion,
    instructions: [
      lunaPolicy.reasoningMethodInstructions(),
      "Razvrsti slovenski ali nemški opis ponudbe izključno v priložene numerične ID-je.",
      "Panoga ponudnika in prodajni kanal sta ločena. Telemarketing je profil samo, kadar je predmet ponudbe telemarketing; hladen klic je kanal 3005.",
      "Izberi vse module, ki jih podpira celoten uporabnikov kontekst; števila modulov ne omejuj z lokalno hevristiko.",
      "Vsaj en znani moduleId je obvezen. Neznan, podvojen ali nezdružljiv ID oziroma dejstvo razveljavi celoten odgovor; ničesar ne dodajaj za vsak primer.",
      "Vrni samo dejstva z dobesednim neprekinjenim izsekom evidence iz uporabnikovega opisa.",
      "Ne izmišljaj zneskov, rokov, pravnih pogojev ali identitete. Vsa dejstva zahtevajo človeško potrditev."
    ],
    catalog: catalog.lunaContract(),
    responseSchema: RESPONSE_SCHEMA
  };
}
function materialize(proposal, sourceText) {
  var source=String(sourceText||"").trim();
  if(!source||source.length>MAX_TEXT_LENGTH)return null;
  var safe=catalog.validateLunaProposal(proposal,source);
  return safe ? { proposal:safe, schema:catalog.sestavi(safe), model:MODEL, engineVersion:catalog.version, contractVersion:catalog.contractVersion } : null;
}
module.exports={MODEL:MODEL,MAX_TEXT_LENGTH:MAX_TEXT_LENGTH,RESPONSE_SCHEMA:RESPONSE_SCHEMA,contract:contract,materialize:materialize};
