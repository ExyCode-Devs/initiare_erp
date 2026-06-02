import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import worker from "./dist/server/index.js";

const host = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const clientDir = path.resolve("./dist/client");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

function getContentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function getStaticFilePath(urlPath) {
  const normalizedPath = path
    .normalize(decodeURIComponent(urlPath))
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(clientDir, `.${normalizedPath}`);

  if (!candidate.startsWith(clientDir)) {
    return null;
  }

  return candidate;
}

function shouldServeStatic(urlPath) {
  return urlPath.startsWith("/assets/") || urlPath === "/favicon.ico";
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

  if (!shouldServeStatic(requestUrl.pathname)) {
    return false;
  }

  const filePath = getStaticFilePath(requestUrl.pathname);
  if (!filePath) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Bad request");
    return true;
  }

  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      res.statusCode = 404;
      res.end();
      return true;
    }

    res.statusCode = 200;
    res.setHeader("content-type", getContentType(filePath));
    res.setHeader("content-length", stats.size);
    res.setHeader("cache-control", "public, max-age=31536000, immutable");

    if (req.method === "HEAD") {
      res.end();
      return true;
    }

    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      res.statusCode = 404;
      res.end();
      return true;
    }

    throw error;
  }
}

function getOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const scheme = proto?.split(",")[0]?.trim() || "http";

  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;

  return `${scheme}://${hostHeader ?? `${host}:${port}`}`;
}

async function handleRequest(req, res) {
  try {
    if (req.method && ["GET", "HEAD"].includes(req.method)) {
      const served = await serveStatic(req, res);
      if (served) {
        return;
      }
    }

    const init = {
      method: req.method,
      headers: req.headers,
    };

    if (req.method && !["GET", "HEAD"].includes(req.method)) {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }

    const request = new Request(`${getOrigin(req)}${req.url ?? "/"}`, init);
    const response = await worker.fetch(request, {}, {});

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body || req.method === "HEAD") {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal server error");
  }
}

http.createServer(handleRequest).listen(port, host, () => {
  console.log(`Initiare ERP web listening on http://${host}:${port}`);
});
