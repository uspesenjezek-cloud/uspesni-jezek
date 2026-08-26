import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(root, "app", "supabase-entry.js")],
  outfile: path.join(root, "app", "vendor-data.js"),
  bundle: true,
  minify: true,
  sourcemap: false,
  legalComments: "none",
  format: "iife",
  platform: "browser",
  target: ["es2020"],
});

console.log("app/vendor-data.js ustvarjen iz pripete npm različice Supabase.");
