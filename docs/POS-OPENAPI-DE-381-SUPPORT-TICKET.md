# Openapi support request: German invoice type 381

## Subject

German `DE-invoices` type 381 cannot satisfy both the published schema and sandbox validation

## Message

Hello Openapi support,

we are integrating the Invoice API `POST /DE-invoices` for a German SaaS POS
platform. Standard outgoing invoices with type `380` are accepted by the
sandbox, but we cannot submit either a full cancellation or a partial credit
note with type `381`.

The published German input schema (OAS version 1.1.0, checked 24 August 2026)
allows `type: "381"` and requires `total_amount_including_tax` to be greater
than zero. We therefore sent positive, internally consistent amounts and
positive invoice lines:

- full cancellation `TEST-ST-2026-0003`, gross amount `1.19 EUR`;
- partial credit note, gross amount `0.60 EUR`.

Both positive type 381 requests returned HTTP 422 saying that the document type
was not allowed for a positive amount. A diagnostic request with a negative
total also returned HTTP 422 because the published schema requires the total to
be greater than zero. No provider-side invoice record was created by any of the
rejected requests.

Could you please provide:

1. a complete accepted JSON example for a German full cancellation;
2. a complete accepted JSON example for a German partial credit note;
3. the required sign convention for line amounts, tax subtotals and totals;
4. the supported field for referencing the original invoice (the current
   `DE-Invoice` input model does not expose a dedicated original-invoice field);
5. confirmation that the same contract and validation apply in production;
6. the expected webhook states after a successful type 381 submission.

Our production flow is fail-closed for type 381 until both cases are accepted in
the sandbox and reach a final successful state. We can rerun a narrowly scoped,
sandbox-only capability probe as soon as you confirm the expected payload.

Best regards,

Bojan Dimic

Uspešni Ježek

## Internal evidence and safety notes

- Accepted sandbox originals: `TEST-2026-0010`, `TEST-2026-0011` (type 380).
- Rejected full cancellation: `TEST-ST-2026-0003` (type 381, `1.19 EUR`).
- Rejected partial credit note: type 381, `0.60 EUR`.
- Rejected requests produced no remote record.
- Never include an OAuth token, webhook secret, customer data or production
  credentials in the support ticket.
- Official schema: <https://console.openapi.com/oas/en/invoice.openapi.json>
- Official documentation: <https://console.openapi.com/apis/invoice/documentation>

## Support response received (25 August 2026)

Openapi support replied that German credit notes and cancellations must keep
root totals, line totals and unit prices positive. According to support, the
earlier positive type `381` requests were rejected because the mandatory
original-invoice reference was missing. They instructed us to send this root
object for both a full cancellation and a partial credit note:

```json
{
  "billing_reference": {
    "document_number": "<original invoice number>",
    "issue_date": "<original invoice date YYYY-MM-DD>"
  }
}
```

The official OAS was version `1.1.1` when directly rechecked on 25 August 2026;
the `DE-Invoice` schema did not contain `billing_reference`. The response is
therefore recorded as provider guidance, not as a documented contract or a
successful sandbox result. Production type `381` remains fail-closed until a
narrow sandbox-only probe accepts both cases and their callback/reconciliation
flows reach final successful states. The support examples used 20% VAT; our
German test mapping remains 19% and was not changed.

Support also said that changing the login email requires registering a new
account. No account, token or configuration was created; that external account
change requires the user's separate explicit approval.

## Follow-up sandbox verification (25 August 2026)

We reran a narrowly scoped sandbox-only probe using the requested root
`billing_reference`, positive root and line amounts, positive unit prices and
the German standard VAT rate of 19%. The matching original type `380` invoice
was accepted with HTTP 200 and later reported `SENT` / `succeeded`.

For the final retry, `billing_reference.document_number` exactly matched the
sandbox `document_number` returned for that accepted original. The full
cancellation type `381` was still rejected with HTTP 422:
`Service error: [:preferredInvoiceType]: cannot send this type for a positive amount`.
No provider-side record was created for the rejected `381`. The probe stopped
fail-closed at that first rejection, so the partial credit-note case was not sent.
This result directly conflicts with the support instruction above and needs a
provider-side contract or validator clarification. Production remains disabled.

The user submitted this follow-up evidence in the existing Openapi support
request `161204` on 25 August 2026. The request remains `IN PROGRESS`; no newer
provider response or successful type `381` result has been recorded yet.

## Provider fix confirmed (26 August 2026)

Openapi support confirmed that the earlier contradiction was a provider-side bug.
Their request schema rejected non-positive totals while the downstream German
validator rejected positive type `381` amounts. They report that the contract is
now conditional by document type:

- type `380`: positive amounts;
- type `381`: negative root totals, line `unit_price`, line `total_net_amount` and
  tax-subtotal amounts;
- line `quantity` remains positive;
- `billing_reference.document_number` and `billing_reference.issue_date` are
  required for type `381`;
- the reference number must match the `document_number` submitted for the original
  invoice;
- sandbox and production use the same application-level contract.

The local adapter and regression fixtures now follow that contract. This support
confirmation does not unlock external delivery. A controlled sandbox-only run must
still prove a full cancellation and a partial credit note through their final
states before production type `381` can be considered ready.

## Controlled sandbox result after the provider fix (26 August 2026)

The controlled sandbox run submitted matching original invoices and then both
negative type `381` cases. The sandbox required `payment_means` on type `381` as
well, so its amount was kept and made negative to match the document total.

Both the full cancellation and the partial credit note were accepted and received
provider-side IDs. A later narrowly scoped read-only status check returned
`state: SENT` with `details.external_status: succeeded` for both documents. OAS
`1.1.1` defines `succeeded` as delivery to the recipient's access point and maps
it to macro state `SENT`; a transition to `DONE` is therefore not required for
this delivery proof. The five approved sandbox records were created. After an
explicit activation decision, the dedicated type `381` provider-conflict lock was
removed from the production code path; type `381` still becomes available only
when every general Openapi production gate is satisfied. No production flag was
enabled and no production deployment or provider request was performed.

After separate explicit approval on 26 August 2026, the single Supabase migration
`20260826131305_pos_openapi_succeeded_delivery_state.sql` was applied and recorded
in remote migration history. Read-only verification confirmed the two updated
function definitions and private execution privileges. Five unrelated pending
migrations were not applied and remain blocked by the deployment guard.

The official OAS was directly rechecked as version `1.1.1` on the same date. It
still declares `payment_means` but does not publish the conditional type `381`
sign rules or `billing_reference`. This new sandbox evidence supersedes the earlier
provider-conflict blocker for request acceptance and sandbox delivery. It does
not by itself authorize production activation.
