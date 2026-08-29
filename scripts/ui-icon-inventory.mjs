import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "app");
const outputFile = path.join(appDir, "ui-ikone-inventura.json");
const allowlistFile = path.join(root, "scripts", "ui-icon-audit-allowlist.json");
const args = new Set(process.argv.slice(2));

const excludedNames = new Set([
  "qrcode.bundle.js",
  "sentry.bundle.js",
  "supabase.bundle.js",
  "ui-katalog.css",
  "ui-katalog.html",
  "ui-katalog.js",
  "ui-ikone-druzine.json",
  "ui-ikone-inventura.json",
  "ui-ikone-uskladitev.json",
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "company-index") return [];
      return walk(full);
    }
    if (!/\.(?:html|js|css|json)$/i.test(entry.name) || excludedNames.has(entry.name)) return [];
    return [full];
  });
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function hash(value, length = 12) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function lineText(text, line) {
  return (text.split(/\r?\n/)[line - 1] || "").trim().replace(/\s+/g, " ").slice(0, 180);
}

function attr(svg, name) {
  const match = svg.match(new RegExp("(?:^|\\s)" + name + "\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']", "i"));
  return match ? match[1] : "";
}

function decodeCssContent(value) {
  return value.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)));
}

function normalizeSvg(svg) {
  return svg
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\s(?:width|height|class|id|aria-[\w-]+|role|xmlns)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*\/?>/g, (m) => m.trimStart())
    .trim()
    .toLowerCase();
}

function isIllustration(item) {
  if (item.kind !== "svg") return false;
  const numbers = String(item.geometry.viewBox || "").trim().split(/\s+/).map(Number);
  const width = numbers.length === 4 ? numbers[2] : 0;
  const height = numbers.length === 4 ? numbers[3] : 0;
  return width > 64 || height > 64 || /grafika|chart|diagram/i.test(item.name);
}

function inferSvgName(text, index, file, line) {
  const before = text.slice(Math.max(0, index - 260), index);
  const variable = before.match(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*['"`]\s*$/);
  if (variable) return variable[1];
  const property = before.match(/(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*:\s*['"`]\s*$/);
  if (property) return property[1];
  return `inline-${path.basename(file, path.extname(file))}-${line}`;
}

function htmlDependencies(files) {
  const pagesByAsset = new Map();
  for (const file of files.filter((item) => item.endsWith(".html"))) {
    const text = fs.readFileSync(file, "utf8");
    const page = rel(file);
    const assets = [...text.matchAll(/(?:src|href)\s*=\s*["']([^"'?]+\.(?:js|css))[?^"']*/gi)]
      .map((match) => path.basename(match[1]));
    for (const asset of assets) {
      if (!pagesByAsset.has(asset)) pagesByAsset.set(asset, new Set());
      pagesByAsset.get(asset).add(page);
    }
  }
  return pagesByAsset;
}

function pagesFor(source, pagesByAsset) {
  if (source.endsWith(".html")) return [source];
  return [...(pagesByAsset.get(path.basename(source)) || [])].sort();
}

const files = walk(appDir).sort();
const texts = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));
const pagesByAsset = htmlDependencies(files);
const detections = [];
const symbolRegistry = new Map();

for (const [file, text] of texts) {
  const source = rel(file);
  const symbolPattern = /<symbol\b([^>]*)\bid\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/symbol>/gi;
  let symbolMatch;
  while ((symbolMatch = symbolPattern.exec(text))) {
    const attributes = symbolMatch[1] + symbolMatch[3];
    const viewBox = attr(`<symbol ${attributes}>`, "viewBox") || "0 0 24 24";
    const markup = `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${symbolMatch[4]}</svg>`;
    const line = lineAt(text, symbolMatch.index);
    const definition = { id: symbolMatch[2], markup, source, line, context: lineText(text, line) };
    if (!symbolRegistry.has(definition.id)) symbolRegistry.set(definition.id, definition);
    detections.push({
      kind: "svg",
      name: definition.id.replace(/^i-/, ""),
      source,
      line,
      context: definition.context,
      preview: markup,
      fingerprint: `svg:${hash(normalizeSvg(markup), 20)}`,
      canonical: false,
      geometry: { viewBox, width: "CSS", height: "CSS", stroke: "currentColor", strokeWidth: "2", fill: "none" },
    });
  }
}

for (const file of files) {
  const text = texts.get(file);
  const source = rel(file);
  let match;

  const svgPattern = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
  while ((match = svgPattern.exec(text))) {
    let markup = match[0].replace(/\\(['"`])/g, "$1");
    if (/<symbol\b/i.test(markup)) continue;
    const line = lineAt(text, match.index);
    let name = inferSvgName(text, match.index, file, line);
    const useId = markup.match(/<use\b[^>]*\bhref\s*=\s*["']#([^"']+)["']/i)?.[1];
    if (useId && symbolRegistry.has(useId)) {
      markup = symbolRegistry.get(useId).markup;
      name = useId.replace(/^i-/, "");
    } else if (/<use\b/i.test(markup)) {
      continue;
    }
    const normalized = normalizeSvg(markup);
    const canonical = source === "app/izvedba-komponente.js" && !name.startsWith("inline-");
    detections.push({
      kind: "svg",
      name,
      source,
      line,
      context: lineText(text, line),
      preview: markup,
      fingerprint: `svg:${hash(normalized, 20)}`,
      canonical,
      geometry: {
        viewBox: attr(markup, "viewBox") || "ni navedeno",
        width: attr(markup, "width") || "CSS",
        height: attr(markup, "height") || "CSS",
        stroke: attr(markup, "stroke") || "podedovano/ni navedeno",
        strokeWidth: attr(markup, "stroke-width") || "ni navedeno",
        fill: attr(markup, "fill") || "ni navedeno",
      },
    });
  }

  const imgPattern = /<(?:img|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+\.(?:svg|png|jpe?g|webp|gif|ico))["'][^>]*>/gi;
  while ((match = imgPattern.exec(text))) {
    const line = lineAt(text, match.index);
    detections.push({
      kind: "image",
      name: path.basename(match[1]).replace(/\.[^.]+$/, ""),
      source,
      line,
      context: lineText(text, line),
      preview: match[1],
      fingerprint: `image:${hash(match[1], 20)}`,
      canonical: false,
      geometry: { viewBox: "—", width: "iz elementa/CSS", height: "iz elementa/CSS", stroke: "—", strokeWidth: "—", fill: "slika" },
    });
  }

  if (file.endsWith(".json")) {
    const jsonImagePattern = /"src"\s*:\s*"([^"]+\.(?:svg|png|jpe?g|webp|gif|ico))"/gi;
    while ((match = jsonImagePattern.exec(text))) {
      const line = lineAt(text, match.index);
      detections.push({
        kind: "image",
        name: path.basename(match[1]).replace(/\.[^.]+$/, ""),
        source,
        line,
        context: lineText(text, line),
        preview: match[1],
        fingerprint: `image:${hash(match[1], 20)}`,
        canonical: false,
        geometry: { viewBox: "—", width: "iz manifesta", height: "iz manifesta", stroke: "—", strokeWidth: "—", fill: "slika" },
      });
    }
  }

  const urlPattern = /url\(\s*["']?([^"')]+\.(?:svg|png|jpe?g|webp|gif|ico))["']?\s*\)/gi;
  while ((match = urlPattern.exec(text))) {
    const line = lineAt(text, match.index);
    detections.push({
      kind: "image",
      name: path.basename(match[1]).replace(/\.[^.]+$/, ""),
      source,
      line,
      context: lineText(text, line),
      preview: match[1],
      fingerprint: `image:${hash(match[1], 20)}`,
      canonical: false,
      geometry: { viewBox: "—", width: "CSS", height: "CSS", stroke: "—", strokeWidth: "—", fill: "slika" },
    });
  }

  if (file.endsWith(".css")) {
    const pseudoPattern = /([^{}]+::(?:before|after))\s*\{[^{}]*?content\s*:\s*["']([^"']+)["'][^{}]*\}/gi;
    while ((match = pseudoPattern.exec(text))) {
      const line = lineAt(text, match.index);
      const content = decodeCssContent(match[2]);
      detections.push({
        kind: "pseudo",
        name: match[1].trim().replace(/\s+/g, " "),
        source,
        line,
        context: lineText(text, line),
        preview: content,
        fingerprint: `pseudo:${hash(content, 20)}`,
        canonical: false,
        geometry: { viewBox: "—", width: "CSS", height: "CSS", stroke: "—", strokeWidth: "—", fill: "currentColor/CSS" },
      });
    }
  }

  const symbolPattern = /[✓✔✕✖⚠★☆●○◆◇⌄⌃←→↑↓➜➝➞➤➕➖]|\p{Extended_Pictographic}/gu;
  while ((match = symbolPattern.exec(text))) {
    if (match.index > 0 && text.slice(Math.max(0, match.index - 20), match.index).includes("&#")) continue;
    const lineStart = text.lastIndexOf("\n", match.index - 1) + 1;
    const lineEnd = text.indexOf("\n", match.index);
    const currentLine = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
    const offset = match.index - lineStart;
    const before = currentLine.slice(0, offset);
    const after = currentLine.slice(offset + match[0].length);
    const standaloneElement = />\s*$/.test(before) && /^\s*</.test(after);
    const namedIconValue = /(?:ikona|icon|glyph|emoji|symbol)/i.test(currentLine)
      && (currentLine.includes(`'${match[0]}'`) || currentLine.includes(`"${match[0]}"`));
    if (!standaloneElement && !namedIconValue) continue;
    const line = lineAt(text, match.index);
    detections.push({
      kind: "symbol",
      name: `simbol-${match[0].codePointAt(0).toString(16).toUpperCase()}`,
      source,
      line,
      context: lineText(text, line),
      preview: match[0],
      fingerprint: `symbol:${match[0]}`,
      canonical: false,
      geometry: { viewBox: "—", width: "pisava", height: "pisava", stroke: "pisava", strokeWidth: "—", fill: "currentColor" },
    });
  }
}

const registryNames = new Set(
  detections
    .filter((item) => item.canonical && item.kind === "svg")
    .map((item) => item.name)
);
const registryCalls = [];
for (const [file, text] of texts) {
  const callPattern = /(?:\bK|UJIzvedbaKomponente)\.ikona\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = callPattern.exec(text))) {
    registryCalls.push({ name: match[1], source: rel(file), line: lineAt(text, match.index) });
  }
}
const unknownRegistryCalls = [...new Set(registryCalls.filter((call) => !registryNames.has(call.name)).map((call) => call.name))].sort();

function usageLocations(item) {
  const found = [{ source: item.source, line: item.line, context: item.context, role: "definicija" }];
  if (item.kind !== "svg" || (!item.canonical && !/^IKONA_[A-Z0-9_]+$/.test(item.name))) return found;
  for (const [file, text] of texts) {
    const source = rel(file);
    let pattern;
    if (item.canonical) pattern = new RegExp(`(?:\\bK|UJIzvedbaKomponente)\\.ikona\\(\\s*["']${item.name}["']\\s*\\)`, "g");
    else pattern = new RegExp(`\\b${item.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g");
    let match;
    while ((match = pattern.exec(text))) {
      const line = lineAt(text, match.index);
      if (source === item.source && line === item.line) continue;
      found.push({ source, line, context: lineText(text, line), role: "uporaba" });
    }
  }
  return found;
}

const grouped = new Map();
for (const detection of detections) {
  if (!grouped.has(detection.fingerprint)) grouped.set(detection.fingerprint, []);
  grouped.get(detection.fingerprint).push(detection);
}

const items = [...grouped.entries()].map(([fingerprint, variants]) => {
  variants.sort((a, b) => Number(b.canonical) - Number(a.canonical) || a.source.localeCompare(b.source) || a.line - b.line);
  const lead = variants[0];
  const occurrences = [];
  for (const variant of variants) occurrences.push(...usageLocations(variant));
  const uniqueOccurrences = [...new Map(occurrences.map((entry) => [`${entry.source}:${entry.line}:${entry.role}`, entry])).values()]
    .sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line);
  const pages = [...new Set(uniqueOccurrences.flatMap((entry) => pagesFor(entry.source, pagesByAsset)))].sort();
  const scope = variants.some((item) => item.canonical)
    ? "canonical"
    : isIllustration(lead)
      ? "illustration"
      : pages.length
        ? "active"
        : "orphan";
  return {
    id: `ikona-${hash(fingerprint)}`,
    name: lead.name,
    aliases: [...new Set(variants.map((item) => item.name))].sort(),
    kind: lead.kind,
    status: variants.some((item) => item.canonical) ? "canonical" : "review",
    scope,
    preview: lead.preview,
    fingerprint,
    geometry: lead.geometry,
    definitions: variants.map(({ source, line, name, canonical }) => ({ source, line, name, canonical })),
    occurrences: uniqueOccurrences,
    pages,
  };
}).sort((a, b) => {
  const order = { canonical: 0, active: 1, illustration: 2, orphan: 3 };
  return order[a.scope] - order[b.scope] || b.occurrences.length - a.occurrences.length || a.name.localeCompare(b.name);
});

const inventory = {
  schemaVersion: 1,
  source: "app/**/*.{html,js,css,json} brez generiranih bundle/index datotek",
  canonicalRegistry: "app/izvedba-komponente.js#UJIzvedbaKomponente.IKONE",
  designTokens: {
    text: "#2f3736",
    nativeTeal: "#3f9998",
    otherBlueGrey: "#567392",
    lawyerPurple: "#6941b4",
    border: "#e1eae8",
    radii: ["11px", "16px", "18px"],
  },
  summary: {
    uniqueIcons: items.length,
    occurrences: items.reduce((sum, item) => sum + item.occurrences.length, 0),
    svg: items.filter((item) => item.kind === "svg").length,
    symbols: items.filter((item) => item.kind === "symbol").length,
    images: items.filter((item) => item.kind === "image").length,
    pseudo: items.filter((item) => item.kind === "pseudo").length,
    canonical: items.filter((item) => item.status === "canonical").length,
    review: items.filter((item) => item.status === "review").length,
    active: items.filter((item) => item.scope === "active").length,
    illustrations: items.filter((item) => item.scope === "illustration").length,
    orphan: items.filter((item) => item.scope === "orphan").length,
  },
  unknownRegistryCalls,
  items,
};

function exceptionSignature(item, definition) {
  return `${item.kind}:${definition.source}:${definition.name}:${item.fingerprint}`;
}

const currentExceptions = items
  .filter((item) => item.status !== "canonical")
  .flatMap((item) => item.definitions.map((definition) => ({
    signature: exceptionSignature(item, definition),
    source: `${definition.source}:${definition.line}`,
    name: definition.name,
    reason: "Obstoječa uporaba je evidentirana v katalogu in čaka pregled oziroma načrtovano uskladitev.",
  })))
  .sort((a, b) => a.signature.localeCompare(b.signature));

if (args.has("--write")) {
  fs.writeFileSync(outputFile, JSON.stringify(inventory, null, 2) + "\n");
  console.log(`Inventura zapisana: ${rel(outputFile)} (${inventory.summary.uniqueIcons} ikon, ${inventory.summary.occurrences} pojavitev).`);
}

if (args.has("--approve-existing")) {
  fs.writeFileSync(allowlistFile, JSON.stringify({ schemaVersion: 1, exceptions: currentExceptions }, null, 2) + "\n");
  console.log(`Dokumentirane izjeme zapisane: ${rel(allowlistFile)} (${currentExceptions.length}).`);
}

if (args.has("--check")) {
  if (!fs.existsSync(outputFile) || !fs.existsSync(allowlistFile)) {
    console.error("Manjka inventura ali seznam dokumentiranih izjem. Zaženi npm run icons:inventory.");
    process.exit(1);
  }
  const committed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  const allowlist = JSON.parse(fs.readFileSync(allowlistFile, "utf8"));
  const approved = new Set((allowlist.exceptions || []).map((entry) => entry.signature));
  const newExceptions = currentExceptions.filter((entry) => !approved.has(entry.signature));
  const stable = JSON.stringify(committed) === JSON.stringify(inventory);
  if (unknownRegistryCalls.length || newExceptions.length || !stable) {
    if (unknownRegistryCalls.length) console.error(`Neznane kanonične ikone: ${unknownRegistryCalls.join(", ")}`);
    if (newExceptions.length) console.error(`Nove nekanonične ikone/simboli: ${newExceptions.map((entry) => entry.source).join(", ")}`);
    if (!stable) console.error("Generirana inventura ni usklajena. Zaženi npm run icons:inventory in preglej diff.");
    process.exit(1);
  }
  console.log(`UI icon audit OK: ${inventory.summary.uniqueIcons} ikon, ${inventory.summary.occurrences} pojavitev, brez novih nedokumentiranih virov.`);
}

if (!args.size) console.log(JSON.stringify(inventory.summary, null, 2));
