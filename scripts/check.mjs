// ============================================================
// check.mjs — lightweight project integrity check.
//
// 1. Every local asset referenced by the source template exists.
// 2. Every JavaScript module parses (node --check).
// 3. All element ids used by main.js exist in the template.
// 4. The self-contained build outputs exist.
// ============================================================

import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const notes = [];

const SOURCE = "index.src.html";
const html = await readFile(join(ROOT, SOURCE), "utf8");

// ---- 1. referenced assets ------------------------------------
const refs = new Set();
for (const m of html.matchAll(/(?:href|src)="([^"#?]+)"/g)) {
  const ref = m[1];
  if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue; // external / protocol-relative
  refs.add(ref);
}
for (const ref of refs) {
  try {
    await access(join(ROOT, ref.replace(/^\.?\//, "")));
  } catch {
    errors.push(`missing referenced asset: ${ref}`);
  }
}

// import map + vendor
const vendor = html.match(/"three":\s*"([^"]+)"/);
if (!vendor) {
  errors.push(`${SOURCE} has no import map entry for "three"`);
} else {
  try {
    await access(join(ROOT, vendor[1].replace(/^\//, "")));
  } catch {
    errors.push(`missing vendored module: ${vendor[1]}`);
  }
}

// ---- 2. syntax check -----------------------------------------
const files = [
  "src/main.js",
  "src/core/machine.js",
  "src/core/pointer.js",
  "src/core/canvas.js",
  "src/core/util.js",
  "src/core/gl.js",
  "src/core/tape.js",
  "src/visuals/tapeBar.js",
  "src/visuals/fsm.js",
  "src/visuals/siteDfa.js",
  "src/visuals/bgStage.js",
  "src/visuals/probability.js",
  "src/visuals/codecMini.js",
  "src/visuals/bitstream.js",
  "src/visuals/codec.js",
  "src/visuals/quality.js",
  "src/visuals/attention.js",
  "src/visuals/collapse.js",
  "server.mjs"
];

for (const f of files) {
  const res = spawnSync(process.execPath, ["--check", join(ROOT, f)], {
    encoding: "utf8"
  });
  if (res.status !== 0) {
    errors.push(`syntax error in ${f}\n${res.stderr.trim()}`);
  }
}

// ---- 3. ids referenced from main.js exist --------------------
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const mainSrc = await readFile(join(ROOT, "src/main.js"), "utf8");
for (const m of mainSrc.matchAll(/getElementById\("([^"]+)"\)/g)) {
  if (!ids.has(m[1])) errors.push(`main.js expects #${m[1]} which is not in ${SOURCE}`);
}

// ---- 4. self-contained build outputs -------------------------
for (const f of ["index.html", "portfolio.html"]) {
  try {
    const built = await readFile(join(ROOT, f), "utf8");
    if (!built.includes("<style>") || !/<script>/.test(built)) {
      errors.push(`${f} does not look like a self-contained build (run: npm run build)`);
    }
  } catch {
    errors.push(`missing build output: ${f} (run: npm run build)`);
  }
}

notes.push(`checked ${files.length} modules, ${refs.size} referenced assets, ${ids.size} ids`);

if (errors.length) {
  console.error("\n✗ check failed:\n");
  for (const e of errors) console.error("  • " + e);
  console.error("");
  process.exit(1);
}

console.log("✓ check passed — " + notes.join("; "));
