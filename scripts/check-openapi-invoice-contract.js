"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sandboxEvidenceVerifier = require("../api/_lib/pos-openapi-sandbox-evidence");

const OAS_URL = "https://console.openapi.com/oas/en/invoice.openapi.json";
const MAX_OAS_BYTES = 8 * 1024 * 1024;
const SANDBOX_EVIDENCE_PATH = path.join(__dirname, "fixtures", "openapi-de-381-sandbox-evidence.json");

function includesAll(values, required) {
  const set = new Set(Array.isArray(values) ? values : []);
  return required.every((value) => set.has(value));
}

function typeConditionMatches(schema, type) {
  const declared = schema && schema.properties && schema.properties.type || {};
  return String(declared.const || "") === type
    || (Array.isArray(declared.enum) && declared.enum.length === 1 && String(declared.enum[0]) === type);
}

function conditionalSchemas(invoice, type) {
  const matches = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (typeConditionMatches(node.if, type) && node.then) matches.push(node.then);
    if (typeConditionMatches(node, type)) matches.push(node);
    ["allOf", "anyOf", "oneOf"].forEach((key) => {
      if (Array.isArray(node[key])) node[key].forEach(visit);
    });
  }
  visit(invoice);
  return matches;
}

function propertySchemas(nodes, propertyName) {
  const matches = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.properties && node.properties[propertyName]) matches.push(node.properties[propertyName]);
    ["allOf", "anyOf", "oneOf", "items"].forEach((key) => {
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    });
  }
  (nodes || []).forEach(visit);
  return matches;
}

function signConstraint(schema, direction) {
  const description = String(schema && schema.description || "");
  if (direction === "strictNegative") {
    return schema && schema.maximum !== undefined && Number(schema.maximum) < 0
      || schema && schema.maximum === 0 && schema.exclusiveMaximum === true
      || typeof (schema && schema.exclusiveMaximum) === "number" && schema.exclusiveMaximum <= 0
      || /(?:negative|less\s+than\s+0|<\s*0)/i.test(description);
  }
  if (direction === "nonPositive") {
    return Number(schema && schema.maximum) <= 0 && schema && schema.maximum !== undefined
      || typeof (schema && schema.exclusiveMaximum) === "number" && schema.exclusiveMaximum <= 0
      || /(?:negative|non.?positive|less\s+than\s+or\s+equal\s+to\s+0|<=?\s*0)/i.test(description);
  }
  if (direction === "strictPositive") {
    return schema && schema.minimum !== undefined && Number(schema.minimum) > 0
      || schema && schema.minimum === 0 && schema.exclusiveMinimum === true
      || typeof (schema && schema.exclusiveMinimum) === "number" && schema.exclusiveMinimum >= 0
      || /(?:positive|greater\s+than\s+0|>\s*0)/i.test(description);
  }
  return Number(schema && schema.minimum) >= 0 && schema && schema.minimum !== undefined
    || typeof (schema && schema.exclusiveMinimum) === "number" && schema.exclusiveMinimum >= 0
    || /(?:positive|non.?negative|greater\s+than\s+or\s+equal\s+to\s+0|>=?\s*0)/i.test(description);
}

function fieldsHaveSign(nodes, fields, direction) {
  return fields.every((field) => propertySchemas(nodes, field).some((schema) => signConstraint(schema, direction)));
}

function requiredInSchemas(nodes, field) {
  return (nodes || []).some((schema) => Array.isArray(schema && schema.required) && schema.required.includes(field));
}

function resolveLocalRefs(value, schemas, trail) {
  if (Array.isArray(value)) return value.map((item) => resolveLocalRefs(item, schemas, trail));
  if (!value || typeof value !== "object") return value;
  const ref = String(value.$ref || "");
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (match) {
    const name = decodeURIComponent(match[1].replace(/~1/g, "/").replace(/~0/g, "~"));
    const seen = trail || new Set();
    if (seen.has(name)) return {};
    const next = new Set(seen);
    next.add(name);
    const resolved = resolveLocalRefs(schemas[name] || {}, schemas, next);
    const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$ref"));
    return Object.assign({}, resolved, resolveLocalRefs(siblings, schemas, seen));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveLocalRefs(item, schemas, trail)]));
}

function declaredTypes(nodes) {
  const values = [];
  propertySchemas(nodes, "type").forEach((schema) => {
    if (schema && schema.const !== undefined) values.push(String(schema.const));
    if (Array.isArray(schema && schema.enum)) schema.enum.forEach((value) => values.push(String(value)));
  });
  return Array.from(new Set(values)).sort();
}

function unconditionalRequired(schema) {
  const values = Array.isArray(schema && schema.required) ? schema.required.slice() : [];
  if (Array.isArray(schema && schema.allOf)) {
    schema.allOf.forEach((part) => values.push(...unconditionalRequired(part)));
  }
  return Array.from(new Set(values)).sort();
}

const controlledSandboxEvidence = sandboxEvidenceVerifier.controlledSandboxEvidence;

function extractContract(oas, evidence) {
  const paths = oas && oas.paths || {};
  const schemas = oas && oas.components && oas.components.schemas || {};
  const invoice = resolveLocalRefs(schemas["DE-Invoice"] || {}, schemas);
  const configuration = resolveLocalRefs(schemas["DE-configuration"] || {}, schemas);
  const invoiceProps = invoice.properties || {};
  const invoicePropertyNames = Object.keys(invoiceProps);
  const type380Schemas = conditionalSchemas(invoice, "380");
  const type381Schemas = conditionalSchemas(invoice, "381");
  const billingReference = invoiceProps.billing_reference || propertySchemas(type381Schemas, "billing_reference")[0] || null;
  const billingReferenceProps = billingReference && billingReference.properties || {};
  const apiConfigurations = propertySchemas([configuration], "api_configurations")[0] || {};
  const callbackEvent = apiConfigurations.items && apiConfigurations.items.properties
    && apiConfigurations.items.properties.event || {};
  const type381Evidence = type381Schemas.length > 0;
  const type380RootPositive = fieldsHaveSign(type380Schemas, ["total_amount_including_tax", "total_amount_excluding_tax"], "strictPositive")
    && fieldsHaveSign(type380Schemas, ["total_tax_amount"], "nonNegative");
  const type381RootNegative = fieldsHaveSign(type381Schemas, ["total_amount_including_tax", "total_amount_excluding_tax"], "strictNegative")
    && fieldsHaveSign(type381Schemas, ["total_tax_amount"], "nonPositive");
  const type381LineQuantityPositive = fieldsHaveSign(propertySchemas(type381Schemas, "invoice_lines"), ["quantity"], "strictPositive");
  const type381LineAmountsNegative = fieldsHaveSign(propertySchemas(type381Schemas, "invoice_lines"), ["unit_price", "total_net_amount"], "strictNegative");
  const type381TaxSubtotalsNegative = fieldsHaveSign(propertySchemas(type381Schemas, "tax_subtotals"), ["taxable_amount"], "strictNegative")
    && fieldsHaveSign(propertySchemas(type381Schemas, "tax_subtotals"), ["tax_amount"], "nonPositive");
  const type381BillingReferenceRequired = requiredInSchemas(type381Schemas, "billing_reference");
  const type381BillingReferenceShape = Boolean(billingReferenceProps.document_number && billingReferenceProps.issue_date);
  const completeConditionalAdjustmentContract = type380RootPositive && type381RootNegative
    && type381LineQuantityPositive && type381LineAmountsNegative && type381TaxSubtotalsNegative
    && type381BillingReferenceRequired && type381BillingReferenceShape;
  const sandboxEvidence = controlledSandboxEvidence(evidence);
  const providerUnlockBlockers = [];
  if (!completeConditionalAdjustmentContract) providerUnlockBlockers.push("published_conditional_381_contract_not_detected");
  if (!sandboxEvidence.successful) providerUnlockBlockers.push("controlled_sandbox_381_final_states_missing");
  return {
    openapi: String(oas && oas.openapi || ""),
    version: String(oas && oas.info && oas.info.version || ""),
    operations: {
      listInvoices: Boolean(paths["/DE-invoices"] && paths["/DE-invoices"].get),
      createInvoice: Boolean(paths["/DE-invoices"] && paths["/DE-invoices"].post),
      getInvoice: Boolean(paths["/DE-invoices/{id}"] && paths["/DE-invoices/{id}"].get),
      createConfiguration: Boolean(paths["/DE-configurations"] && paths["/DE-configurations"].post),
      getConfiguration: Boolean(paths["/DE-configurations/{fiscal_id}"] && paths["/DE-configurations/{fiscal_id}"].get),
      patchConfiguration: Boolean(paths["/DE-configurations/{fiscal_id}"] && paths["/DE-configurations/{fiscal_id}"].patch),
    },
    invoiceRequired: unconditionalRequired(invoice),
    invoiceTypes: declaredTypes([invoice]),
    b2g: {
      leitwegId: propertySchemas([invoice], "leitweg_id").length > 0,
      buyerReference: propertySchemas([invoice], "buyer_reference").length > 0,
    },
    financialAdjustments: {
      positiveTotalDocumented: /must\s+be\s*>\s*0/i.test(String(invoiceProps.total_amount_including_tax && invoiceProps.total_amount_including_tax.description || "")),
      originalInvoiceReferenceFields: Array.from(new Set(invoicePropertyNames.concat(billingReference ? ["billing_reference"] : []))).filter((name) => name === "billing_reference" || /(?:original|preceding|referenced).*(?:invoice|document)|(?:invoice|document).*(?:reference|id)/i.test(name)).sort(),
      billingReference: {
        documented: Boolean(billingReference),
        documentNumber: Boolean(billingReferenceProps.document_number),
        issueDate: Boolean(billingReferenceProps.issue_date),
        requiredAtRoot: Array.isArray(invoice.required) && invoice.required.includes("billing_reference"),
        requiredFor381: type381BillingReferenceRequired,
        requiredFields: Array.isArray(billingReference && billingReference.required) ? billingReference.required.slice().sort() : [],
        contractStatus: billingReference ? "documented" : "support_only_undocumented",
      },
      conditionalAmountContract: {
        type380RootPositive,
        type381RootNegative,
        type381LineQuantityPositive,
        type381LineAmountsNegative,
        type381TaxSubtotalsNegative,
        evidenceFound: type381Evidence,
        complete: completeConditionalAdjustmentContract,
        status: completeConditionalAdjustmentContract ? "conditional_380_381_documented" : type381Evidence ? "conditional_contract_incomplete" : "legacy_or_undocumented",
      },
      controlledSandboxEvidence: sandboxEvidence,
      providerUnlockEligible: false,
      providerUnlockBlockers,
    },
    callbackEvents: Array.isArray(callbackEvent.enum) ? callbackEvent.enum.slice().sort() : [],
  };
}

function assessContract(contract) {
  const failures = [];
  if (!/^3\./.test(contract.openapi)) failures.push("OpenAPI 3.x document is required");
  Object.entries(contract.operations).forEach(([name, present]) => { if (!present) failures.push("missing operation: " + name); });
  if (!includesAll(contract.invoiceRequired, ["document_number", "issue_date", "total_amount_including_tax", "sender", "recipient", "invoice_lines"])) {
    failures.push("DE-Invoice required fields changed");
  }
  if (!includesAll(contract.invoiceTypes, ["380", "381"])) failures.push("DE invoice types 380/381 are no longer both declared");
  if (!contract.b2g || !contract.b2g.leitwegId || !contract.b2g.buyerReference) failures.push("DE B2G routing fields changed");
  const billingReference = contract.financialAdjustments && contract.financialAdjustments.billingReference;
  if (billingReference && billingReference.documented && (!billingReference.documentNumber || !billingReference.issueDate)) {
    failures.push("DE billing_reference shape changed");
  }
  const amountContract = contract.financialAdjustments && contract.financialAdjustments.conditionalAmountContract;
  if (amountContract && amountContract.evidenceFound && !amountContract.complete) {
    failures.push("DE type 381 conditional adjustment contract is incomplete");
  }
  if (!contract.callbackEvents.includes("customer-invoice")) failures.push("customer-invoice callback is missing");
  return { ok: failures.length === 0, failures };
}

async function fetchOas(fetchFn) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await (fetchFn || fetch)(OAS_URL, {
        headers: { Accept: "application/json" },
        signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const length = Number(response.headers && response.headers.get("content-length") || 0);
      if (length > MAX_OAS_BYTES) throw new Error("OAS response is too large");
      const raw = await response.text();
      if (Buffer.byteLength(raw) > MAX_OAS_BYTES) throw new Error("OAS response is too large");
      return JSON.parse(raw);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function main() {
  const oas = await fetchOas();
  const evidence = JSON.parse(fs.readFileSync(SANDBOX_EVIDENCE_PATH, "utf8"));
  const contract = extractContract(oas, evidence);
  const result = assessContract(contract);
  if (!result.ok) {
    console.error("Openapi Invoice contract FAIL", JSON.stringify({ contract, failures: result.failures }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log("Openapi Invoice contract PASS", JSON.stringify(contract));
}

if (require.main === module) main().catch((error) => {
  console.error("Openapi Invoice contract check unavailable:", error && error.message || error);
  process.exitCode = 1;
});

module.exports = { MAX_OAS_BYTES, OAS_URL, SANDBOX_EVIDENCE_PATH, assessContract, controlledSandboxEvidence, extractContract, fetchOas };
