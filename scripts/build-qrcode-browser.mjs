import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(root, "app", "qrcode-entry.js")],
  outfile: path.join(root, "app", "qrcode.bundle.js"),
  bundle: true,
  minify: true,
  sourcemap: false,
  legalComments: "none",
  format: "iife",
  platform: "browser",
  target: ["es2020"],
});

console.log("app/qrcode.bundle.js ustvarjen iz pripete npm različice QRCode.");
