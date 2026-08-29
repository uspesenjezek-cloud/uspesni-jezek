const { test, expect } = require("@playwright/test");
const runAudit = require("./audit-boniteta-100-gmbh-playwright.js");

test("100 različnih GmbH ne sme zamešati insolvenčnih podatkov ali dokaznih posnetkov", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("http://localhost:8001/app/bonitetna-preverba.html?app-preview=1&audit=100");
  const summary = await runAudit(page);
  expect(summary.total).toBe(100);
  expect(summary.wildcardCases).toBeGreaterThanOrEqual(30);
  expect(summary.screenshots).toBe(100);
  expect(summary.firstFailure).toBeNull();
  expect(summary.failures).toBe(0);
});
