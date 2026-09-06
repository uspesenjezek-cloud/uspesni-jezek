"use strict";

var fs = require("node:fs");
var path = require("node:path");
var lunaPolicy = require("../api/_lib/atena-luna-policy");

var reportPath = path.resolve(process.argv[2] || "luna-goal-multistep-diagnostic-round5-report.json");
if (!process.env.OPENAI_API_KEY) {
  var envPath = path.join(__dirname, "..", ".env.local");
  var localEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  var apiKeyMatch = localEnv.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
  if (apiKeyMatch) process.env.OPENAI_API_KEY = apiKeyMatch[1].trim();
}

async function ask(input) {
  var body = Object.assign(lunaPolicy.requestDefaults(), {
    reasoning: { effort: "medium" },
    max_output_tokens: 3000,
    instructions: "You are Luna in a diagnostic conversation about Atena goal-fact-v18. Analyze semantic and contract failures, not Slovenian keywords. Luna remains the sole semantic interpreter. The local adapter may only validate schema/catalog/evidence, map closed IDs, and perform deterministic arithmetic from already structured fields/context. Give general AVOID/CORRECT rules and explicitly distinguish prompt responsibility from safe deterministic adapter responsibility.",
    input: input,
  });
  var transport = await lunaPolicy.requestOpenAi({
    apiKey: process.env.OPENAI_API_KEY,
    body: JSON.stringify(body),
    maxAttempts: 2,
    timeoutMs: lunaPolicy.MODEL_TIMEOUT_MAX_MS,
  });
  return {
    id: transport.payload && transport.payload.id || null,
    text: lunaPolicy.responseText(transport.payload),
    usage: transport.payload && transport.payload.usage || null,
    attempts: transport.attempts,
    elapsedMs: transport.elapsedMs,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  var cases = [
    {
      source: "danes naj nakaže 161 evrov pa ostalo na obroke pa do 22. septembra pa podpiše priznanje dolga",
      actual: "partial_payment_now received remainingDeadline=2026-09-22 while payment_security debt_acknowledgment omitted securityDeadline",
      expected: "the date governs signing the debt acknowledgment, so payment_security.securityDeadline=2026-09-22 and partial remainingDeadline is absent",
    },
    {
      source: "lej nejprej 2 plačil po 769 za vseh 1538, sicer primer predam odvetniku v presojo .. tko bi",
      actual: "two installment cards had correct evidence ranges for total, per-installment amount and count, but all three field values were null; legal fallback was correct",
      expected: "both installment cards contain targetAmount=1538, installmentAmount=769, installmentCount=2, followed by legal_route_review",
    },
    {
      source: "če 5 obroki po 814 odpovejo, naj pravnik oceni najboljšo pot; dolg je 4070",
      actual: "provider call completed but yielded no usable compact goal object; adapter rejected goal_top_shape",
      expected: "five installment cards with 4070/814/5 followed by legal_route_review",
    },
  ];
  var firstPrompt = "Diagnose these three confirmed synthetic seed6 failures. For each, explain the semantic/contract cause, the correct output ownership/cardinality, and whether the failure can be prevented by prompt audit, deterministic adapter derivation, bounded retry, or must remain fail-closed. Do not propose raw-text rereading in the adapter. CASES:\n" + JSON.stringify(cases, null, 2);
  var first = await ask(firstPrompt);
  var secondPrompt = "Continue the diagnostic conversation. Here is your prior diagnosis:\n---\n" + first.text + "\n---\nNow produce the strongest generalized AVOID/CORRECT lessons and a minimal test matrix. Resolve these edge questions explicitly: (1) how clause attachment works for 'do DATE pa ACTION'; (2) whether non-null evidence with v/o null is ever valid for a materially explicit scalar; (3) how to distinguish model output exhaustion/empty output from a semantic error; (4) which already-structured installment values the adapter may deterministically derive without becoming a second semantic interpreter. Prefer the smallest safe change.";
  var second = await ask(secondPrompt);
  var report = { generatedAt: new Date().toISOString(), model: lunaPolicy.MODEL, family: "goal-multi-step-round5", cases: cases, turns: [first, second] };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log("Poročilo: " + reportPath);
  console.log(first.text);
  console.log("\n--- FOLLOW-UP ---\n");
  console.log(second.text);
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
