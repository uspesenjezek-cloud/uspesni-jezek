import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "app", "ui-ikone-inventura.json");
const outputPath = path.join(root, "app", "ui-ikone-druzine.json");
const args = new Set(process.argv.slice(2));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const included = inventory.items.filter((item) => ["canonical", "active"].includes(item.scope));

function count(markup, tag) {
  return (markup.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
}

function pathSignatures(markup) {
  return [...markup.matchAll(/<path\b[^>]*\bd=["']([^"']+)["']/gi)].map((match) => {
    const d = match[1];
    const commands = (d.match(/[a-z]/gi) || []).join("").toLowerCase();
    const numbers = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    const signs = numbers.slice(0, 24).map((number) => number === 0 ? "0" : number > 0 ? "+" : "-").join("");
    return `${commands}:${numbers.length}:${signs}`;
  }).sort();
}

function glyphMotif(preview) {
  const glyph = String(preview || "").replace(/<[^>]+>/g, "").replace(/&(?:#x([0-9a-f]+)|#(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10))).trim();
  if (/^[✓✔√]$/.test(glyph)) return "kljukica";
  if (/^[✕✖×]$/.test(glyph)) return "križec";
  if (/^[›❯→➜]$/.test(glyph)) return "puščica-desno";
  if (/^[‹❮←]$/.test(glyph)) return "puščica-levo";
  if (/^[⌄⌃▼▲]$/.test(glyph)) return "razpiranje";
  if (/^[●•·]$/.test(glyph)) return "pika";
  if (/^[★☆]$/.test(glyph)) return "zvezda";
  if (/^[⚠]$/.test(glyph)) return "opozorilo";
  return glyph ? `znak-${[...glyph].map((char) => char.codePointAt(0).toString(16)).join("-")}` : "prazen-znak";
}

function svgMotif(markup) {
  const compact = markup.toLowerCase().replace(/[\s,]+/g, " ");
  const hasCircle = /<(?:circle|ellipse)\b/.test(compact) || compact.includes("a10 10") || compact.includes("v12a10");
  const check = /(?:m| )20 6 9 17l?-?5-? ?-?5|(?:m| )5 12(?:l| )?4 4(?:l| )?10-? ?10|(?:m| )4 12(?:l| )?5 5(?:l| )?11-? ?11|12 14\.01l?-?3-? ?-?3/i.test(compact);
  if (check) return hasCircle ? "kljukica-v-krogu" : "kljukica";
  if (/m?18 6l?-?12 12|m?6 6l?12 12|m?18 18l?-?12-? ?12/i.test(compact)) return hasCircle ? "križec-v-krogu" : "križec";
  if (/m?9 18 6-? ?6-? ?6-? ?6/i.test(compact)) return "puščica-desno";
  if (/m?15 18-? ?6-? ?6 6-? ?6/i.test(compact)) return "puščica-levo";
  if (/m?6 9 6 6 6-? ?6/i.test(compact)) return "razpiranje-dol";
  if (/m?18 15-? ?6-? ?6-? ?6 6/i.test(compact)) return "razpiranje-gor";
  if (/<line\b[^>]*x1=["']12["'][^>]*y1=["']5["'][^>]*x2=["']12["'][^>]*y2=["']19["']|m?12 5v14/i.test(compact)) return "plus";
  return "";
}

function visualDescriptor(item) {
  if (["symbol", "pseudo"].includes(item.kind)) {
    const motif = glyphMotif(item.preview);
    const knownMotif = ["kljukica", "križec", "puščica-desno", "puščica-levo", "razpiranje", "pika", "zvezda", "opozorilo"].includes(motif);
    return { key: `${knownMotif ? "motif" : "glyph"}:${motif}`, label: motif.replaceAll("-", " "), evidence: `dejanski znak · ${motif}` };
  }
  if (item.kind === "image") return { key: `image:${item.fingerprint}`, label: "slikovna grafika", evidence: "slikovna datoteka" };
  const markup = String(item.preview || "");
  const motif = svgMotif(markup);
  if (motif) return { key: `motif:${motif}`, label: motif.replaceAll("-", " "), evidence: `prepoznana geometrija · ${motif}` };
  const elements = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"].map((tag) => `${tag}:${count(markup, tag)}`).join("|");
  const paths = pathSignatures(markup).join("|");
  const paint = `${item.geometry.fill === "none" ? "line" : "fill"}:${item.geometry.strokeWidth || "-"}`;
  const key = `svg:${paint}:${elements}:${paths}`;
  const visibleElements = elements.split("|").filter((part) => !part.endsWith(":0")).join(", ");
  return { key, label: visibleElements || "SVG oblika", evidence: `${paint} · ${visibleElements || "brez standardnih elementov"} · smeri poti ${paths || "—"}` };
}

function candidateScore(item) {
  let score = 0;
  if (item.status === "canonical") score += 5000;
  if (item.kind === "svg") score += 700;
  if (item.geometry.viewBox === "0 0 24 24") score += 350;
  if (String(item.geometry.strokeWidth) === "2") score += 220;
  if (item.geometry.fill === "none") score += 180;
  if (item.geometry.stroke === "currentColor") score += 160;
  score += Math.min(150, item.occurrences.length * 3);
  if (["symbol", "pseudo", "image"].includes(item.kind)) score -= 900;
  return score;
}

const grouped = new Map();
for (const item of included) {
  const visual = visualDescriptor(item);
  if (!grouped.has(visual.key)) grouped.set(visual.key, { visualKey: visual.key, visualLabel: visual.label, visualEvidence: visual.evidence, members: [] });
  grouped.get(visual.key).members.push(item.id);
}

const itemById = new Map(included.map((item) => [item.id, item]));
const rawFamilies = [...grouped.values()].map((family) => {
  family.members.sort((left, right) => candidateScore(itemById.get(right)) - candidateScore(itemById.get(left)));
  return { ...family, recommendedId: family.members[0], occurrences: family.members.reduce((sum, id) => sum + itemById.get(id).occurrences.length, 0) };
}).sort((a, b) => b.members.length - a.members.length || b.occurrences - a.occurrences || a.visualKey.localeCompare(b.visualKey));

const outputFamilies = rawFamilies.map((family, index) => ({
  id: `grafika-${String(index + 1).padStart(3, "0")}`,
  number: index + 1,
  label: `Grafična skupina ${String(index + 1).padStart(3, "0")} · ${family.visualLabel}`,
  recommendation: "Skupina je določena samo iz izrisane geometrije, elementov poti ter načina fill/stroke; imena in besede niso uporabljeni.",
  ...family,
}));

const output = {
  schemaVersion: 2,
  sourceInventorySchemaVersion: inventory.schemaVersion,
  summary: { icons: included.length, families: outputFamilies.length, multiVariantFamilies: outputFamilies.filter((family) => family.members.length > 1).length, singletonFamilies: outputFamilies.filter((family) => family.members.length === 1).length },
  rules: "Izključno grafična geometrija: dejanski znak, SVG elementi, poti, smeri koordinat ter fill/stroke. Imena, selectorji in besedilni pomen ne vplivajo na razvrščanje.",
  families: outputFamilies,
};

const rendered = JSON.stringify(output, null, 2) + "\n";
if (args.has("--write")) {
  fs.writeFileSync(outputPath, rendered);
  console.log(`Grafične skupine ikon zapisane: ${path.relative(root, outputPath)} (${output.summary.families} skupin, ${output.summary.icons} ikon).`);
} else if (args.has("--check")) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== rendered) {
    console.error("Generirane grafične skupine ikon niso usklajene. Zaženi npm run icons:inventory in preglej diff.");
    process.exit(1);
  }
  const assigned = new Set(outputFamilies.flatMap((family) => family.members));
  if (assigned.size !== included.length) {
    console.error(`Grafične skupine niso popolne: ${assigned.size}/${included.length} ikon.`);
    process.exit(1);
  }
  console.log(`UI icon graphic families OK: ${output.summary.icons} ikon v ${output.summary.families} grafičnih skupinah.`);
} else console.log(JSON.stringify(output.summary, null, 2));
