#!/usr/bin/env node
// ============================================================
// scripts/dev_server.js
// ------------------------------------------------------------
// Локалды дамыту сервері. Статикалық файлдарды көрсетеді және
// POST /api/chat сұрауын api/chat.js serverless функциясына
// (Vercel-дегідей) тікелей жібереді — деплой жасамай-ақ жергілікті
// тексеруге мүмкіндік береді.
//
// .env.local файлы болса, одан OPENAI_API_KEY (т.б. айнымалылар)
// оқылады. Бұл файл .gitignore-де — репозиторийге ешқашан қосылмайды.
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  });
}

loadEnvLocal();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(ROOT, decodeURIComponent(pathname));
  if (pathname === "/" || pathname === "") filePath = path.join(ROOT, "index.html");
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function handleApiChat(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let parsed = {};
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch {
      parsed = {};
    }
    const vercelReq = { method: req.method, body: parsed };
    const vercelRes = {
      _status: 200,
      status(code) {
        this._status = code;
        return this;
      },
      json(obj) {
        res.writeHead(this._status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(obj));
      },
    };
    try {
      delete require.cache[require.resolve(path.join(ROOT, "api", "chat.js"))];
      const handler = require(path.join(ROOT, "api", "chat.js"));
      await handler(vercelReq, vercelRes);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Жергілікті сервер қатесі", detail: String(err) }));
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  if (req.method === "POST" && parsedUrl.pathname === "/api/chat") {
    handleApiChat(req, res);
    return;
  }
  serveStatic(req, res, parsedUrl.pathname);
});

const port = Number(process.argv[2]) || 8743;
server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
  console.log(
    process.env.OPENAI_API_KEY
      ? "OPENAI_API_KEY: жүктелді ✓"
      : "OPENAI_API_KEY: ЖОҚ — .env.local файлын тексеріңіз"
  );
});
