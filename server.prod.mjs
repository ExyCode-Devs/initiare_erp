import http from "node:http";
import { Readable } from "node:stream";
import worker from "./dist/server/index.js";

const host = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

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
