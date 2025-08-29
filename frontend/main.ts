import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { trace } from "npm:@opentelemetry/api@1";
import { observe, renderProm } from "./utils/metrics.ts";
import { createMiddlewareStack, middlewares } from "./middleware/index.ts";

export const app = new App<State>();

app.use(staticFiles());

// Modular middleware stack (config-driven). Add custom shared example.
for (const mw of createMiddlewareStack({
  custom: [
    define.middleware(async (ctx) => {
      ctx.state.shared = "hello";
      return await ctx.next();
    }),
  ],
})) {
  app.use(mw);
}

// Health endpoints and readiness
let ready = false;
app.get("/healthz", () => new Response("ok"));
app.get("/livez", () => new Response("ok"));
app.get(
  "/readyz",
  () =>
    new Response(ready ? "ready" : "not-ready", { status: ready ? 200 : 503 }),
);
globalThis.addEventListener("load", () => {
  ready = true;
});

// Metrics endpoint
app.get(
  "/metrics",
  () =>
    new Response(renderProm(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    }),
);

// Scoped rate limiter for /api using modular middleware
app.use("/api", middlewares.rateLimit());

// Example programmatic route used in tests (with metrics observation)
app.get("/api2/:name", (ctx) => {
  // Optional: decorate the active span for nicer traces
  const span = trace.getActiveSpan();
  span?.setAttribute("http.route", "/api2/:name");
  span?.updateName(`${ctx.req.method} /api2/:name`);
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
