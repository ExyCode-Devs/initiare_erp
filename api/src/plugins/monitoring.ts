import type { FastifyPluginAsync } from "fastify";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

const REQUEST_DURATION = "api_request_duration_ms";
const REQUEST_COUNT = "api_request_count_total";

const monitoringPlugin: FastifyPluginAsync = async (app) => {
  const register = new Registry();
  collectDefaultMetrics({ register });

  const requestDuration = new Histogram({
    name: REQUEST_DURATION,
    help: "API request duration in milliseconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [5, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [register]
  });

  const requestCount = new Counter({
    name: REQUEST_COUNT,
    help: "API request count",
    labelNames: ["method", "route", "status_code"],
    registers: [register]
  });

  app.decorate("metricsRegistry", register);

  app.addHook("onRequest", async (request) => {
    request.startTime = performance.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const duration = performance.now() - (request.startTime ?? performance.now());
    const route =
      request.routeOptions.url && request.routeOptions.url !== "*"
        ? request.routeOptions.url
        : request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode)
    };
    requestDuration.observe(labels, duration);
    requestCount.inc(labels);
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", register.contentType);
    return register.metrics();
  });
};

export default monitoringPlugin;
