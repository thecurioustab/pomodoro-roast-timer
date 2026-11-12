// Zero-dependency static server: `node serve.js` then open http://localhost:8080
//
// Only the app's own files are served. Hidden files (.env with your API key,
// .claude, .gitignore), the tools/ folder and this server file are never sent,
// so it's safe to open from your phone or share through a tunnel.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
};
const PRIVATE_DIRS = new Set(["tools", "node_modules"]);
const PRIVATE_FILES = new Set(["serve.js"]);

function isPublic(rel) {
  const parts = rel.split(/[\\/]/).filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((p) => p.startsWith("."))) return false;   // .env, .claude, .gitignore…
  if (PRIVATE_DIRS.has(parts[0])) return false;
  if (parts.length === 1 && PRIVATE_FILES.has(parts[0])) return false;
  return Object.prototype.hasOwnProperty.call(TYPES, path.extname(rel).toLowerCase());
}

http.createServer((req, res) => {
  // One line per request, to see what a phone actually loads (no IPs logged).
  const via = req.headers["cf-connecting-ip"] ? "tunnel" : "local";
  const ua = /iPhone|iPad/.test(req.headers["user-agent"] || "") ? "iOS"
    : /Android/.test(req.headers["user-agent"] || "") ? "Android" : "desktop";
  res.on("finish", () => console.log(`${new Date().toISOString().slice(11, 19)} ${via} ${ua} ${res.statusCode} ${req.url}`));
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); return res.end(); }
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !isPublic(path.relative(ROOT, file))) {
    res.writeHead(404); return res.end("Not found");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()],
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Roast Timer running at http://localhost:${PORT}`));
