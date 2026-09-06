"use strict";

var z = require("zod");
var providerJson = require("./provider-json");

var ENDPOINT = "https://api.openai.com/v1/responses";
var BRAVE_ENDPOINT = "https://search.brave.com/search";
var MODEL = "gpt-5.6-luna";
var TIMEOUT_MS = 12000;
var DIRECTORY_TIMEOUT_MS = 6500;
var MAX_DIRECTORY_BYTES = 384 * 1024;
var MAX_RESPONSE_BYTES = 192 * 1024;
var POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
var NEGATIVE_TTL_MS = 10 * 60 * 1000;
var cache = globalThis.__ujOfficialSiteDiscoveryCache ||
  (globalThis.__ujOfficialSiteDiscoveryCache = new Map());

var CandidateResponse = z.object({
  urls: z.array(z.string().url()).max(12),
}).strict();

function text(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 300);
}

function outputText(payload) {
  return (Array.isArray(payload && payload.output) ? payload.output : []).reduce(function (parts, item) {
    return parts.concat(item && item.type === "message" && Array.isArray(item.content) ? item.content : []);
  }, []).map(function (part) {
    return part && part.type === "output_text" ? String(part.text || "") : "";
  }).filter(Boolean).join("").trim();
}

function uniqueHttpUrls(values) {
  var seen = new Set();
  return (Array.isArray(values) ? values : []).map(function (value) {
    try {
      var url = new URL(String(value || ""));
      if (!/^https?:$/.test(url.protocol)) return "";
      url.hash = "";
      return url.toString();
    } catch (_) { return ""; }
  }).filter(function (value) {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, 12);
}

function htmlText(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function phoneDigits(value) {
  var raw = String(value || "").trim();
  var digits = raw.replace(/\D/g, "");
  if (digits.indexOf("49") === 0) digits = "0" + digits.slice(2);
  // Nekateri javni imeniki nemško stacionarno številko izpišejo brez +49 in
  // brez začetne ničle (npr. 2117308892). Za natančno povratno iskanje mora
  // ostati lokalna nemška oblika 02117308892.
  else if (digits && digits.charAt(0) !== "0" && digits.length >= 9 && digits.length <= 11) digits = "0" + digits;
  return digits;
}

function braveUrls(html, phone) {
  var source = htmlText(html);
  var digits = phoneDigits(phone);
  var resultUrls = [];
  var bareDomains = [];
  var match;
  var anchorPattern = /<a\b[^>]*>/gi;
  while ((match = anchorPattern.exec(source)) && resultUrls.length < 20) {
    var tag = match[0];
    var href = (tag.match(/\bhref=["'](https?:\/\/[^"']+)["']/i) || [null, ""])[1];
    var classes = (tag.match(/\bclass=["']([^"']+)["']/i) || [null, ""])[1];
    if (href && /(?:^|\s)l1(?:\s|$)|result[^\s"']*/i.test(classes)) resultUrls.push(href);
  }

  // Iskalni izrezki pogosto izpišejo uradno domeno samo kot besedilo. Beremo
  // zgolj bližino točne telefonske številke; vsak kandidat nato še vedno prestane
  // lokalno preverbo telefona, poštne številke in nosilca iz Impressuma.
  var body = (source.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [null, source])[1];
  var compact = body.replace(/[\s().+\-/]/g, "");
  var compactIndex = digits ? compact.indexOf(digits) : -1;
  var windows = [];
  if (compactIndex >= 0) {
    var originalDigits = new RegExp(digits.split("").join("\\D{0,3}"), "g");
    var digitMatch;
    while ((digitMatch = originalDigits.exec(body)) && windows.length < 8) {
      windows.push(body.slice(Math.max(0, digitMatch.index - 1000), digitMatch.index + 1800));
    }
  }
  windows.forEach(function (snippet) {
    var domainPattern = /(?:^|[^@\w.-])((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[^\w.-]|$)/gi;
    var domainMatch;
    while ((domainMatch = domainPattern.exec(snippet)) && bareDomains.length < 20) {
      var domain = domainMatch[1].toLowerCase();
      if (!/(?:brave\.com|imgs\.search\.brave\.com|schema\.org|w3\.org)$/.test(domain) &&
          !/\.(?:css|js|png|jpe?g|gif|svg|ico|webmanifest|woff2?)$/i.test(domain)) {
        bareDomains.push("https://" + domain + "/");
      }
    }
  });
  return uniqueHttpUrls(bareDomains.concat(resultUrls));
}

async function readTextLimited(response, maxBytes) {
  var length = Number(response && response.headers && response.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("directory_response_too_large");
  var value = await response.text();
  if (Buffer.byteLength(value, "utf8") > maxBytes) throw new Error("directory_response_too_large");
  return value;
}

async function findPublicCandidates(signals, options) {
  var digits = phoneDigits(signals && signals.phone);
  if (digits.length < 7) return [];
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, DIRECTORY_TIMEOUT_MS);
  try {
    var fetchImpl = options.fetch || global.fetch;
    var lokalnaOblika = digits.length >= 8 ? digits.slice(0, 4) + " " + digits.slice(4) : digits;
    var mednarodnaOblika = digits.charAt(0) === "0" ? "+49 " + digits.slice(1, 4) + " " + digits.slice(4) : digits;
    var query = ['"' + lokalnaOblika + '"', '"' + digits + '"', '"' + mednarodnaOblika + '"'].join(" OR ");
    var response = await fetchImpl(BRAVE_ENDPOINT + "?q=" + encodeURIComponent(query) + "&count=20", {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UspesniJezek/1.0; public-business-verification)" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return braveUrls(await readTextLimited(response, MAX_DIRECTORY_BYTES), signals.phone);
  } catch (_) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function requestBody(signals) {
  var prompt = [
    "Use the exact phone number as the primary web-search key and find candidate website URLs for this German business.",
    "Inspect exact matching business-directory results for an outbound official website when useful.",
    "Return the official website or official Impressum first, followed by exact-signal directory pages.",
    "Do not decide legal identity; local code independently validates every candidate.",
    "Business name: " + text(signals.name, 180) + ".",
    "Phone: " + text(signals.phone, 80) + ".",
    "Postal code and city: " + text(signals.postalCode, 10) + " " + text(signals.city, 100) + ".",
  ].join(" ");
  return {
    model: MODEL,
    store: false,
    reasoning: { effort: "none" },
    tools: [{ type: "web_search", search_context_size: "low", user_location: { type: "approximate", country: "DE" } }],
    input: prompt,
    text: { format: {
      type: "json_schema",
      name: "business_site_candidates",
      strict: true,
      schema: {
        type: "object",
        properties: { urls: { type: "array", maxItems: 6, items: { type: "string" } } },
        required: ["urls"],
        additionalProperties: false,
      },
    } },
    max_output_tokens: 600,
  };
}

async function findCandidates(signals, options) {
  options = options || {};
  var key = [signals && signals.name, signals && signals.phone, signals && signals.postalCode, signals && signals.city]
    .map(function (value) { return text(value, 180).toLowerCase(); }).join("|");
  if (!signals || !signals.name || !signals.phone || !/^\d{5}$/.test(String(signals.postalCode || ""))) {
    return { status: "insufficient_signals", urls: [] };
  }
  var cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Object.assign({ cached: true }, cached.value);
  if (cached) cache.delete(key);
  var publicUrls = await findPublicCandidates(signals, options);
  if (publicUrls.length) {
    var publicResult = { status: "found", urls: publicUrls };
    cache.set(key, { value: publicResult, expiresAt: Date.now() + POSITIVE_TTL_MS });
    return publicResult;
  }
  var apiKey = text(options.apiKey != null ? options.apiKey : process.env.OPENAI_API_KEY, 5000);
  if (!apiKey) return { status: "not_configured", urls: [] };
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var fetchImpl = options.fetch || global.fetch;
    var response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(signals)),
      signal: controller.signal,
    });
    var payload = await providerJson.readJson(response, {
      maxBytes: MAX_RESPONSE_BYTES,
      code: "OFFICIAL_SITE_DISCOVERY_INVALID_RESPONSE",
      message: "Iskanje uradne strani je vrnilo neveljaven odgovor.",
    });
    if (!response.ok) return { status: "unavailable", reason: "http_" + response.status, urls: [] };
    var parsed;
    try { parsed = CandidateResponse.parse(JSON.parse(outputText(payload))); } catch (_) {
      return { status: "invalid_output", urls: [] };
    }
    var urls = uniqueHttpUrls(parsed.urls);
    var result = { status: urls.length ? "found" : "not_found", urls: urls };
    cache.set(key, { value: result, expiresAt: Date.now() + (urls.length ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
    return result;
  } catch (error) {
    return { status: "unavailable", reason: error && error.name === "AbortError" ? "timeout" : "network_error", urls: [] };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  findCandidates: findCandidates,
  _test: {
    CandidateResponse: CandidateResponse,
    outputText: outputText,
    requestBody: requestBody,
    braveUrls: braveUrls,
    findPublicCandidates: findPublicCandidates,
    uniqueHttpUrls: uniqueHttpUrls,
    reset: function () { cache.clear(); },
  },
};
