"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
async function main() {
  const connectionString = process.env.POS_TEST_DATABASE_URL;
  if (!connectionString) {
    if (process.env.POS_REQUIRE_OPENAPI_DATABASE === "1") throw new Error("POS_TEST_DATABASE_URL is required in database CI.");
    console.log("Openapi terminal/budget/ACL database regression: SKIP (no POS_TEST_DATABASE_URL)");
    return;
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query(fs.readFileSync(path.join(__dirname, "sql", "test-pos-openapi-terminal-budget.sql"), "utf8"));
    await client.query("ROLLBACK");
    console.log("Openapi terminal/budget/ACL database regression: PASS");
  } finally { await client.end(); }
}
main().catch(() => { console.error("Openapi terminal/budget/ACL database regression: FAIL"); process.exitCode = 1; });
