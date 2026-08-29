import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const reviewArg = args.indexOf("--review");
if (reviewArg < 0 || !args[reviewArg + 1]) {
  console.error("Uporaba: node scripts/apply-ui-icon-review.mjs --review <pot-do-json> [--write|--check]");
  process.exit(1);
}
const reviewPath = path.resolve(args[reviewArg + 1]);
const resolutionPath = path.join(root, "app", "ui-ikone-uskladitev.json");
const write = args.includes("--write");
const check = args.includes("--check");
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
if (review.schemaVersion !== 1 || !Array.isArray(review.review)) throw new Error("Nepodprta shema pregleda ikon.");

const selected = review.review.filter((item) => item.decision === "off");
const svgFingerprints = new Set(selected.filter((item) => item.fingerprint.startsWith("svg:")).map((item) => item.fingerprint));
const pseudoFingerprints = new Set(selected.filter((item) => item.fingerprint.startsWith("pseudo:")).map((item) => item.fingerprint));
const symbols = new Set(selected.filter((item) => item.fingerprint.startsWith("symbol:")).map((item) => item.fingerprint.slice(7)));
const sourceFiles = [...new Set(selected.flatMap((item) => item.definitions.map((definition) => definition.source)))];

function hash(value, length = 20) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function normalizeSvg(svg) {
  return svg
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\s(?:width|height|class|id|aria-[\w-]+|role|xmlns)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*\/?>/g, (match) => match.trimStart())
    .trim()
    .toLowerCase();
}

function svgFingerprint(svg) {
  return `svg:${hash(normalizeSvg(svg.replace(/\\(['"`])/g, "$1")))}`;
}

function normalizeRoot(svg) {
  return svg.replace(/<svg\b([^>]*)>/i, (_, rawAttributes) => {
    const attributes = rawAttributes
      .replace(/\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)\s*=\s*("[^"]*"|'[^']*')/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return `<svg${attributes ? " " + attributes : ""} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
  });
}

function isNormalizedRoot(svg) {
  const rootTag = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  return [
    /\bfill\s*=\s*["']none["']/i,
    /\bstroke\s*=\s*["']currentColor["']/i,
    /\bstroke-width\s*=\s*["']2["']/i,
    /\bstroke-linecap\s*=\s*["']round["']/i,
    /\bstroke-linejoin\s*=\s*["']round["']/i,
  ].every((pattern) => pattern.test(rootTag));
}

function activeStringDelimiter(text, index) {
  let delimiter = null;
  let escaped = false;
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  for (let cursor = lineStart; cursor < index; cursor += 1) {
    const character = text[cursor];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && delimiter) {
      escaped = true;
      continue;
    }
    if (delimiter) {
      if (character === delimiter) delimiter = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") delimiter = character;
  }
  return delimiter;
}

const symbolSvgs = {
  "←": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  "→": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  "↑": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  "↓": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  "↗": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>',
  "⌄": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  "✓": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  "✕": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
  "⚠": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></svg>',
  "⚖": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M5 8h14M8 3h8M5 8l-3 6h6L5 8ZM19 8l-3 6h6l-3-6ZM8 21h8"/></svg>',
  "○": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
  "⏳": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h12M6 22h12M7 2c0 5 1 7 5 10-4 3-5 5-5 10M17 2c0 5-1 7-5 10 4 3 5 5 5 10"/></svg>',
  "🖼": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4-4L6 21"/></svg>',
  "🗒": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></svg>',
};

let changedFiles = 0;
let normalizedSvgs = 0;
let replacedSymbols = 0;
let styledPseudo = 0;
let remainingSelectedSvgs = 0;
let remainingStandaloneSymbols = 0;
let remainingUnstyledPseudo = 0;

for (const source of sourceFiles) {
  const file = path.join(root, source);
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, "utf8");
  let next = original;

  next = next.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, (svg) => {
    if (!svgFingerprints.has(svgFingerprint(svg))) return svg;
    if (check && !isNormalizedRoot(svg)) remainingSelectedSvgs += 1;
    if (!write) return svg;
    const normalized = normalizeRoot(svg);
    if (normalized === svg) return svg;
    normalizedSvgs += 1;
    return normalized;
  });

  if (/\.(?:html|js)$/i.test(source)) {
    next = next.replace(/>(\s*)([←→↑↓↗⌄⏳○⚖⚠✓✕🖼🗒])(\s*)</gu, (whole, before, symbol, after, offset) => {
      if (!symbols.has(symbol) || !symbolSvgs[symbol]) return whole;
      if (check) remainingStandaloneSymbols += 1;
      if (!write) return whole;
      replacedSymbols += 1;
      const markup = activeStringDelimiter(next, offset) === '"'
        ? symbolSvgs[symbol].replaceAll('"', '\\"')
        : symbolSvgs[symbol];
      return `>${before}${markup}${after}<`;
    });
  }

  if (source.endsWith(".css")) {
    next = next.replace(/([^{}]+::(?:before|after))\s*\{([^{}]*?content\s*:\s*["']([^"']+)["'][^{}]*?)\}/gi, (whole, selector, body, content) => {
      if (!pseudoFingerprints.has(`pseudo:${hash(content)}`)) return whole;
      const styled = body.includes("--uj-icon-style:1");
      if (check && !styled) remainingUnstyledPseudo += 1;
      if (!write || styled) return whole;
      styledPseudo += 1;
      const separator = body.trimEnd().endsWith(";") ? "" : ";";
      return `${selector} {${body}${separator}--uj-icon-style:1;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-style:normal;font-weight:600;line-height:1;text-rendering:geometricPrecision;}`;
    });
  }

  if (write && next !== original) {
    fs.writeFileSync(file, next);
    changedFiles += 1;
  }
}

if (check) {
  if (remainingSelectedSvgs || remainingStandaloneSymbols || remainingUnstyledPseudo) {
    console.error(`Uskladitev ni zaključena: ${remainingSelectedSvgs} SVG, ${remainingStandaloneSymbols} samostojnih simbolov, ${remainingUnstyledPseudo} pseudo-ikon.`);
    process.exit(1);
  }
  console.log(`UI icon review OK: ${selected.length} odločitev OFF je obdelanih; stari fingerprinti niso več aktivni kot neobdelane ikone.`);
} else if (write) {
  const resolution = {
    schemaVersion: 1,
    source: "Uporabnikov izvoženi pregled ikon",
    reviewedAt: review.exportedAt || null,
    appliedAt: new Date().toISOString(),
    summary: {
      off: selected.length,
      svg: svgFingerprints.size,
      symbols: symbols.size,
      pseudo: pseudoFingerprints.size,
    },
    resolved: selected.map(({ id, name, fingerprint, definitions }) => ({ id, name, fingerprint, definitions })),
  };
  fs.writeFileSync(resolutionPath, JSON.stringify(resolution, null, 2) + "\n");
  console.log(`Uskladitev zapisana v ${changedFiles} datotek: ${normalizedSvgs} SVG, ${replacedSymbols} samostojnih simbolov, ${styledPseudo} pseudo-ikon.`);
  console.log(`Rezultat pregleda zapisan: ${path.relative(root, resolutionPath)} (${selected.length} odločitev).`);
} else {
  console.log(`Pregled pripravljen: ${selected.length} OFF (${svgFingerprints.size} SVG, ${symbols.size} simbolov, ${pseudoFingerprints.size} pseudo-ikon). Dodaj --write za izvedbo.`);
}
