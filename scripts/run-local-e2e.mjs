import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);
if (!targets.length) {
  throw new Error("Pass at least one browser-test script to run.");
}

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

async function serveFile(request, response) {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)
      .replace(/^[/\\]+/, "");
    const filename = path.resolve(root, relative);
    if (filename !== root && !filename.startsWith(root + path.sep)) {
      throw new Error("outside_root");
    }
    const info = await stat(filename);
    if (!info.isFile()) throw new Error("not_file");
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filename).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(await readFile(filename));
  } catch (_) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function run(target, gameUrl) {
  const filename = path.resolve(root, target);
  if (filename !== root && !filename.startsWith(root + path.sep)) {
    throw new Error(`Browser-test path escapes the project: ${target}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [filename], {
      cwd: root,
      env: { ...process.env, GAME_URL: gameUrl },
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${target} stopped with signal ${signal}.`));
      else if (code) reject(new Error(`${target} failed with exit code ${code}.`));
      else resolve();
    });
  });
}

let server;
let gameUrl = process.env.GAME_URL;
try {
  if (!gameUrl) {
    server = http.createServer((request, response) => void serveFile(request, response));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    gameUrl = `http://127.0.0.1:${address.port}/`;
  }
  for (const target of targets) await run(target, gameUrl);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
}
