import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";

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
    res.headers.set("Server-Timing", `app;dur=${durMs}`);
    res.headers.set("X-Response-Time", `${durMs}ms`);

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
    return res;
  } catch (err) {
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

// Include file-system based routes here
app.fsRoutes();
