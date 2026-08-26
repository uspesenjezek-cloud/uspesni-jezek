"use strict";

const assert = require("node:assert/strict");
const contract = require("./check-openapi-invoice-contract");
const sandboxEvidence = require("./fixtures/openapi-de-381-sandbox-evidence.json");

function fixture() {
  return {
    openapi: "3.0.0",
    info: { version: "1.1.0" },
    paths: {
      "/DE-invoices": { get: {}, post: {} },
      "/DE-invoices/{id}": { get: {} },
      "/DE-configurations": { post: {} },
      "/DE-configurations/{fiscal_id}": { get: {}, patch: {} },
    },
    components: { schemas: {
      "DE-Invoice": {
        required: ["document_number", "issue_date", "total_amount_including_tax", "sender", "recipient", "invoice_lines"],
        properties: {
          type: { enum: ["380", "381"] },
          total_amount_including_tax: { description: "Total including VAT. Required, must be > 0." },
          leitweg_id: { type: "string" },
          buyer_reference: { type: "string" },
        },
      },
      "DE-configuration": { properties: { api_configurations: { items: { properties: { event: { enum: ["customer-invoice", "supplier-invoice"] } } } } } },
    } },
  };
}

const extracted = contract.extractContract(fixture());
assert.equal(contract.assessContract(extracted).ok, true);
assert.deepStrictEqual(extracted.b2g, { leitwegId: true, buyerReference: true });
assert.deepStrictEqual(extracted.financialAdjustments, {
  positiveTotalDocumented: true,
  originalInvoiceReferenceFields: [],
  billingReference: {
    documented: false,
    documentNumber: false,
    issueDate: false,
    requiredAtRoot: false,
    requiredFor381: false,
    requiredFields: [],
    contractStatus: "support_only_undocumented",
  },
  conditionalAmountContract: {
    type380RootPositive: false,
    type381RootNegative: false,
    type381LineQuantityPositive: false,
    type381LineAmountsNegative: false,
    type381TaxSubtotalsNegative: false,
    evidenceFound: false,
    complete: false,
    status: "legacy_or_undocumented",
  },
  controlledSandboxEvidence: {
    provided: false,
    complete: false,
    successful: false,
    integrityVerified: false,
    identityVerified: false,
    captureFresh: false,
    cases: [],
  },
  providerUnlockEligible: false,
  providerUnlockBlockers: [
    "published_conditional_381_contract_not_detected",
    "controlled_sandbox_381_final_states_missing",
  ],
});

const documentedBillingReference = fixture();
documentedBillingReference.components.schemas["DE-Invoice"].properties.billing_reference = {
  type: "object",
  required: ["document_number", "issue_date"],
  properties: {
    document_number: { type: "string" },
    issue_date: { type: "string", format: "date" },
  },
};
const documented = contract.extractContract(documentedBillingReference);
assert.equal(contract.assessContract(documented).ok, true);
assert.deepStrictEqual(documented.financialAdjustments.billingReference, {
  documented: true,
  documentNumber: true,
  issueDate: true,
  requiredAtRoot: false,
  requiredFor381: false,
  requiredFields: ["document_number", "issue_date"],
  contractStatus: "documented",
});
assert.deepStrictEqual(documented.financialAdjustments.originalInvoiceReferenceFields, ["billing_reference"]);

const evidencedLegacy = contract.extractContract(fixture(), sandboxEvidence);
assert.equal(evidencedLegacy.financialAdjustments.controlledSandboxEvidence.complete, true);
assert.equal(evidencedLegacy.financialAdjustments.controlledSandboxEvidence.successful, true);
assert.equal(evidencedLegacy.financialAdjustments.providerUnlockEligible, false);
assert.deepStrictEqual(evidencedLegacy.financialAdjustments.providerUnlockBlockers, ["published_conditional_381_contract_not_detected"]);
const invalidEvidence = structuredClone(sandboxEvidence);
invalidEvidence.cases[1].providerReference = invalidEvidence.cases[0].providerReference;
assert.equal(contract.controlledSandboxEvidence(invalidEvidence).successful, false);
assert.ok(contract.extractContract(fixture(), invalidEvidence).financialAdjustments.providerUnlockBlockers.includes("controlled_sandbox_381_final_states_missing"));
const mismatchedBillingReferenceEvidence = structuredClone(sandboxEvidence);
mismatchedBillingReferenceEvidence.cases[0].billingReferenceDocumentNumber = "SBX-does-not-match-the-submitted-original";
assert.equal(contract.controlledSandboxEvidence(mismatchedBillingReferenceEvidence).complete, false);
assert.equal(contract.controlledSandboxEvidence(mismatchedBillingReferenceEvidence).successful, false);
assert.equal(contract.controlledSandboxEvidence(mismatchedBillingReferenceEvidence).integrityVerified, false);
const staleIdentityEvidence = structuredClone(sandboxEvidence);
staleIdentityEvidence.cases[1].documentNumber = staleIdentityEvidence.cases[1].documentNumber.replace(/\d+$/, "1787650000000");
assert.equal(contract.controlledSandboxEvidence(staleIdentityEvidence).captureFresh, false);
assert.equal(contract.controlledSandboxEvidence(staleIdentityEvidence).successful, false);
const forgedSuccessEvidence = structuredClone(sandboxEvidence);
forgedSuccessEvidence.cases[0].providerEventAt = "2026-08-26T12:53:15.000Z";
assert.equal(contract.controlledSandboxEvidence(forgedSuccessEvidence).integrityVerified, false);
assert.equal(contract.controlledSandboxEvidence(forgedSuccessEvidence).successful, false);

const conditionalContract = fixture();
const conditionalInvoice = conditionalContract.components.schemas["DE-Invoice"];
conditionalInvoice.properties.billing_reference = {
  type: "object",
  required: ["document_number", "issue_date"],
  properties: {
    document_number: { type: "string" },
    issue_date: { type: "string", format: "date" },
  },
};
conditionalInvoice.allOf = [{
  if: { properties: { type: { const: "380" } } },
  then: { properties: {
    total_amount_including_tax: { minimum: 0, exclusiveMinimum: true },
    total_amount_excluding_tax: { minimum: 0, exclusiveMinimum: true },
    total_tax_amount: { minimum: 0 },
  } },
}, {
  if: { properties: { type: { const: "381" } } },
  then: {
    required: ["billing_reference"],
    properties: {
      total_amount_including_tax: { maximum: 0, exclusiveMaximum: true },
      total_amount_excluding_tax: { maximum: 0, exclusiveMaximum: true },
      total_tax_amount: { maximum: 0 },
      invoice_lines: { items: { properties: {
        quantity: { minimum: 0, exclusiveMinimum: true },
        unit_price: { maximum: 0, exclusiveMaximum: true },
        total_net_amount: { maximum: 0, exclusiveMaximum: true },
      } } },
      tax_subtotals: { items: { properties: {
        taxable_amount: { maximum: 0, exclusiveMaximum: true },
        tax_amount: { maximum: 0 },
      } } },
    },
  },
}];
const conditional = contract.extractContract(conditionalContract);
assert.equal(contract.assessContract(conditional).ok, true);
assert.deepStrictEqual(conditional.financialAdjustments.conditionalAmountContract, {
  type380RootPositive: true,
  type381RootNegative: true,
  type381LineQuantityPositive: true,
  type381LineAmountsNegative: true,
  type381TaxSubtotalsNegative: true,
  evidenceFound: true,
  complete: true,
  status: "conditional_380_381_documented",
});
assert.equal(conditional.financialAdjustments.billingReference.requiredFor381, true);
assert.equal(conditional.financialAdjustments.providerUnlockEligible, false);
assert.deepStrictEqual(conditional.financialAdjustments.providerUnlockBlockers, ["controlled_sandbox_381_final_states_missing"]);

const referencedContract = structuredClone(conditionalContract);
const referencedInvoice = referencedContract.components.schemas["DE-Invoice"];
delete referencedInvoice.properties.billing_reference;
const type380Variant = referencedInvoice.allOf[0].then;
type380Variant.properties.type = { const: "380" };
const type381Variant = referencedInvoice.allOf[1].then;
type381Variant.properties.type = { const: "381" };
type381Variant.properties.billing_reference = structuredClone(conditionalInvoice.properties.billing_reference);
referencedContract.components.schemas["DE-380-Variant"] = type380Variant;
referencedContract.components.schemas["DE-381-Variant"] = type381Variant;
referencedInvoice.allOf = undefined;
referencedInvoice.oneOf = [
  { $ref: "#/components/schemas/DE-380-Variant" },
  { $ref: "#/components/schemas/DE-381-Variant" },
];
const referenced = contract.extractContract(referencedContract);
assert.equal(contract.assessContract(referenced).ok, true);
assert.equal(referenced.financialAdjustments.conditionalAmountContract.complete, true);
assert.equal(referenced.financialAdjustments.billingReference.documentNumber, true);
assert.equal(referenced.financialAdjustments.billingReference.issueDate, true);
assert.equal(referenced.financialAdjustments.billingReference.requiredFor381, true);
assert.deepStrictEqual(referenced.financialAdjustments.originalInvoiceReferenceFields, ["billing_reference"]);
assert.equal(referenced.financialAdjustments.providerUnlockEligible, false);
assert.deepStrictEqual(referenced.financialAdjustments.providerUnlockBlockers, ["controlled_sandbox_381_final_states_missing"]);

const composedContract = structuredClone(referencedContract);
const composedInvoice = composedContract.components.schemas["DE-Invoice"];
composedContract.components.schemas["DE-Invoice-Base"] = {
  required: composedInvoice.required,
  properties: composedInvoice.properties,
};
composedContract.components.schemas["DE-Invoice"] = {
  allOf: [
    { $ref: "#/components/schemas/DE-Invoice-Base" },
    { oneOf: composedInvoice.oneOf },
  ],
};
const composed = contract.extractContract(composedContract);
assert.equal(contract.assessContract(composed).ok, true);
assert.deepStrictEqual(composed.invoiceTypes, ["380", "381"]);
assert.deepStrictEqual(composed.b2g, { leitwegId: true, buyerReference: true });
assert.ok(composed.invoiceRequired.includes("invoice_lines"));
assert.equal(composed.financialAdjustments.conditionalAmountContract.complete, true);
assert.equal(composed.financialAdjustments.providerUnlockEligible, false);

const incompleteConditionalContract = structuredClone(conditionalContract);
delete incompleteConditionalContract.components.schemas["DE-Invoice"].allOf[1].then.properties.invoice_lines.items.properties.quantity.minimum;
const incompleteConditional = contract.assessContract(contract.extractContract(incompleteConditionalContract));
assert.equal(incompleteConditional.ok, false);
assert.ok(incompleteConditional.failures.includes("DE type 381 conditional adjustment contract is incomplete"));

const zeroInclusiveConditionalContract = structuredClone(conditionalContract);
delete zeroInclusiveConditionalContract.components.schemas["DE-Invoice"].allOf[1].then.properties.total_amount_including_tax.exclusiveMaximum;
const zeroInclusiveConditional = contract.assessContract(contract.extractContract(zeroInclusiveConditionalContract));
assert.equal(zeroInclusiveConditional.ok, false);
assert.ok(zeroInclusiveConditional.failures.includes("DE type 381 conditional adjustment contract is incomplete"));

const incompleteBillingReference = fixture();
incompleteBillingReference.components.schemas["DE-Invoice"].properties.billing_reference = {
  type: "object",
  properties: { document_number: { type: "string" } },
};
const incomplete = contract.assessContract(contract.extractContract(incompleteBillingReference));
assert.equal(incomplete.ok, false);
assert.ok(incomplete.failures.includes("DE billing_reference shape changed"));

const missingGet = fixture();
delete missingGet.paths["/DE-invoices/{id}"].get;
const failed = contract.assessContract(contract.extractContract(missingGet));
assert.equal(failed.ok, false);
assert.ok(failed.failures.some((message) => message.includes("getInvoice")));

const missing381 = fixture();
missing381.components.schemas["DE-Invoice"].properties.type.enum = ["380"];
assert.equal(contract.assessContract(contract.extractContract(missing381)).ok, false);

const missingB2g = fixture();
delete missingB2g.components.schemas["DE-Invoice"].properties.leitweg_id;
assert.equal(contract.assessContract(contract.extractContract(missingB2g)).ok, false);

console.log("POS Openapi contract tests passed.");
