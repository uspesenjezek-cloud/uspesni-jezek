"use strict";

var fs = require("node:fs");
var path = require("node:path");
var envPath = path.join(__dirname, "..", ".env.local");
var source = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
var match = source.match(/^APIFY_API_TOKEN\s*=\s*["']?([^"'\r\n]+)["']?/m);
var token = String(process.env.APIFY_API_TOKEN || match && match[1] || "").trim();

if (!token) {
  console.log("APIFY_TOKEN_MISSING");
  process.exitCode = 2;
} else {
  fetch("https://api.apify.com/v2/users/me", {
    headers: { Authorization: "Bearer " + token },
  }).then(async function (response) {
    var payload = await response.json();
    var username = payload && payload.data && payload.data.username || "UNKNOWN_USER";
    console.log(response.status + " " + username);
    if (!response.ok || username !== "ruly_caviar_jhh") process.exitCode = 3;
  }).catch(function (error) {
    console.error(error && error.name, error && error.message);
    process.exitCode = 4;
  });
}
