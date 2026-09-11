import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return join(ROOT, clean);
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

    // In development the root serves the editable module source, so
    // edits show live. Double-clicking index.html on disk uses the
    // self-contained build instead.
    let filePath =
      urlPath === "/" || urlPath === "/index.html"
        ? join(ROOT, "index.src.html")
        : safePath(req.url || "/");
    let info = await stat(filePath).catch(() => null);

    if (info && info.isDirectory()) {
      filePath = join(filePath, "index.html");
      info = await stat(filePath).catch(() => null);
    }

    if (!info) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404 — not found");
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("500 — " + err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  compression as computation\n  http://${HOST}:${PORT}\n`);
});
