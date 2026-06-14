// Generates a deterministic business-line logo manifest from the files actually
// present in public/business-lines/, so the dashboard resolves each line's logo
// by slug BEFORE paint (no render-time onError 404 chain / flicker).
//
// Output: src/lib/dashboard/logo-manifest.json — { "<slug>": "/business-lines/<file>" }
// keyed by the file's lowercased base name (which must equal the business-line
// slug). Runs in `prebuild`, so production builds always reflect uploaded assets.
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const DIR = join(process.cwd(), "public", "business-lines");
const OUT = join(process.cwd(), "src", "lib", "dashboard", "logo-manifest.json");

// Resolution order when a slug has more than one file: vector first, then raster.
const PRIORITY = [".svg", ".png", ".webp", ".jpg", ".jpeg"];

const map = {};
if (existsSync(DIR)) {
  for (const file of readdirSync(DIR)) {
    const ext = extname(file).toLowerCase();
    if (!PRIORITY.includes(ext)) continue;
    const slug = basename(file, extname(file)).toLowerCase();
    const current = map[slug];
    if (
      !current ||
      PRIORITY.indexOf(ext) < PRIORITY.indexOf(extname(current).toLowerCase())
    ) {
      map[slug] = `/business-lines/${file}`;
    }
  }
}

const sorted = Object.fromEntries(
  Object.keys(map)
    .sort()
    .map((k) => [k, map[k]]),
);
writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(
  `[logo-manifest] ${Object.keys(sorted).length} entr${Object.keys(sorted).length === 1 ? "y" : "ies"} -> ${OUT}`,
);
