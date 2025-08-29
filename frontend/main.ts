import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { renderProm, observe } from "./utils/metrics.ts";
import { allow } from "./utils/rate_limit.ts";

export const app = new App<State>();

app.use(staticFiles());

// Pass a shared value from a middleware (example)
app.use(async (ctx) => {
  ctx.state.shared = "hello";
  return await ctx.next();
});

// Request context: id + start time
app.use(define.middleware(async (ctx) => {
  ctx.state.requestId = crypto.randomUUID();
  ctx.state.start = performance.now();
  const res = await ctx.next();
  res.headers.set("X-Request-ID", ctx.state.requestId);
  return res;
}));

// Security headers
app.use(define.middleware(async (ctx) => {
  const res = await ctx.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "geolocation=()");
  // Set CSP narrowly on HTML only if desired; example:
  if ((res.headers.get("content-type") || "").includes("text/html")) {
    res.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'",
    );
  }
  return res;
}));

// Timing + structured logging + error wrapping
app.use(define.middleware(async (ctx) => {
  try {
    const res = await ctx.next();
    const durMs = Math.round(performance.now() - ctx.state.start);
    const headers = new Headers(res.headers);
    headers.set("Server-Timing", `app;dur=${durMs}`);
    headers.set("X-Response-Time", `${durMs}ms`);
    headers.set("X-Request-ID", ctx.state.requestId);

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        lvl: "info",
        msg: "request",
        requestId: ctx.state.requestId,
        method: ctx.req.method,
        path: new URL(ctx.req.url).pathname,
        status: res.status,
        durMs,
      }),
    );
    return new Response(res.body, { status: res.status, headers });
  } catch (err) {
    // Preserve framework-provided HTTP errors (e.g., 404) without converting to 500
    const status = (err as { status?: number } | null)?.status;
    if (typeof status === "number" && status >= 400 && status < 600) {
      throw err;
    }
    const durMs = Math.round(performance.now() - ctx.state.start);
    const problem = {
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: (err as Error)?.message ?? "unexpected error",
      "request-id": ctx.state.requestId,
    };
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        lvl: "error",
        msg: "unhandled",
        requestId: ctx.state.requestId,
        method: ctx.req.method,
        path: new URL(ctx.req.url).pathname,
        durMs,
        err: String(err),
      }),
    );
    return new Response(JSON.stringify(problem), {
      status: 500,
      headers: {
        "content-type": "application/problem+json",
        "X-Request-ID": ctx.state.requestId,
        "Server-Timing": `app;dur=${durMs}`,
      },
    });
  }
}));

// Health endpoints and readiness
let ready = false;
app.get("/healthz", () => new Response("ok"));
app.get("/livez", () => new Response("ok"));
app.get("/readyz", () => new Response(ready ? "ready" : "not-ready", { status: ready ? 200 : 503 }));
globalThis.addEventListener("load", () => { ready = true; });

// Metrics endpoint
app.get(
  "/metrics",
  () => new Response(renderProm(), { headers: { "content-type": "text/plain; version=0.0.4" } }),
);

// Scoped rate limiter for /api
app.use("/api", define.middleware((ctx) => {
  const ip = ctx.req.headers.get("x-forwarded-for") ??
    ctx.req.headers.get("cf-connecting-ip") ??
    "unknown";
  const key = `${ip}:${new URL(ctx.req.url).pathname}`;
  if (!allow(key)) return new Response("rate limited", { status: 429 });
  return ctx.next();
}));

// Example programmatic route used in tests (with metrics observation)
app.get("/api2/:name", async (ctx) => {
  const t0 = performance.now();
  const name = ctx.params.name;
  const res = new Response(
    `Hello, ${name.charAt(0).toUpperCase() + name.slice(1)}!`,
  );
  observe({
    route: "/api2/:name",
    method: ctx.req.method,
    status: res.status,
    durMs: Math.round(performance.now() - t0),
  });
  return res;
});

// Health check endpoint retained for tests
app.get("/api/health", () => new Response("ok"));

// Include file-system based routes here
app.fsRoutes();
