// ============================================================
// build.mjs — produce self-contained index.html + portfolio.html.
//
// Double-clicking a file:// page cannot load root-absolute paths,
// ES modules or an import map. This build reads the editable source
// (index.src.html), inlines every stylesheet and bundles all modules
// (including Three.js) into one classic <script>, so the output runs
// with no server and no setup.
//
//   index.src.html  → editable template (modules, for `npm run dev`)
//   index.html      → self-contained build (double-click to open)
//   portfolio.html  → identical shareable copy
// ============================================================

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFile(resolve(ROOT, p), "utf8");

// ---- 1. bundle JS (IIFE, no modules) -------------------------
const result = await build({
  entryPoints: [resolve(ROOT, "src/main.js")],
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: true,
  write: false,
  legalComments: "none",
  alias: { three: resolve(ROOT, "vendor/three.module.js") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning"
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, () => "<\\/script");

// ---- 2. inline stylesheets -----------------------------------
const cssFiles = [
  "styles/tokens.css",
  "styles/layout.css",
  "styles/components.css",
  "styles/visuals.css"
];
let css = "";
for (const f of cssFiles) css += `\n/* ===== ${f} ===== */\n${await read(f)}`;
css = css.replace(/<\/style/gi, () => "<\\/style");

// ---- 3. transform the source html ----------------------------
let html = await read("index.src.html");

html = html.replace(/[ \t]*<link rel="stylesheet" href="[^"]*"\s*\/?>\n?/g, "");
html = html.replace(/[ \t]*<script type="importmap">[\s\S]*?<\/script>\n?/g, "");
html = html.replace(/[ \t]*<script type="module"[^>]*><\/script>\n?/g, "");

// function replacers: content may contain "$&"-style patterns
html = html.replace("</head>", () => `<style>\n${css}\n</style>\n</head>`);
html = html.replace("</body>", () => `<script>\n${js}\n</script>\n</body>`);

// ---- 4. write the self-contained outputs ---------------------
await writeFile(resolve(ROOT, "index.html"), html);
await writeFile(resolve(ROOT, "portfolio.html"), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✓ wrote index.html + portfolio.html (${kb} KB, self-contained)`);
