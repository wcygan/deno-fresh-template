import { type Middleware } from "fresh";
import { type State } from "../utils.ts";
import { config } from "../env.ts";
import { trace } from "npm:@opentelemetry/api@1";

type SecurityOptions = {
  enableCSP: boolean;
  enableRateLimit: boolean;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  frameOptions?: "DENY" | "SAMEORIGIN";
  enableCorp?: boolean;
  enableCoop?: boolean;
  enableCoep?: boolean;
  hstsEnabled?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;
};

type RateLimitOptions =
  & Pick<
    SecurityOptions,
    "enableRateLimit" | "rateLimitMax" | "rateLimitWindowMs"
  >
  & { enableCSP?: boolean };

// Middleware factory functions
export const middlewares = {
  requestId: (): Middleware<State> => {
    return async (ctx) => {
      // Prefer upstream request id if present and a valid UUID
      const upstream = ctx.req.headers.get("x-request-id") ?? undefined;
      const isUuid = (s: string | undefined) =>
        !!s &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(s);
      ctx.state.requestId = isUuid(upstream)
        ? (upstream as string)
        : crypto.randomUUID();
      const res = await ctx.next();
      res.headers.set("X-Request-ID", ctx.state.requestId);
      return res;
    };
  },

  timing: (): Middleware<State> => {
    return async (ctx) => {
      ctx.state.start = performance.now();
      const res = await ctx.next();
      const durMs = Math.round(performance.now() - ctx.state.start);
      res.headers.set("Server-Timing", `app;dur=${durMs}`);
      res.headers.set("X-Response-Time", `${durMs}ms`);

      // Propagate OpenTelemetry trace/span ids if present (tests rely on this)
      const sc = trace.getActiveSpan()?.spanContext();
      if (sc?.traceId) res.headers.set("X-Trace-Id", sc.traceId);
      if (sc?.spanId) res.headers.set("X-Span-Id", sc.spanId);

      return res;
    };
  },

  security: (
    options: SecurityOptions = config.security as SecurityOptions,
  ): Middleware<State> => {
    return async (ctx) => {
      const res = await ctx.next();
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "no-referrer");
      res.headers.set("Permissions-Policy", "geolocation=()");
      // Clickjacking protection (configurable via env.ts if needed)
      res.headers.set("X-Frame-Options", options.frameOptions ?? "DENY");

      // Cross-origin isolation knobs (disabled by default; enable via config)
      if (options.enableCorp) {
        res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
      }
      if (options.enableCoop) {
        res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
      }
      if (options.enableCoep) {
        res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      }

      // HSTS in production only
      if (options.hstsEnabled && config.app.environment === "production") {
        const maxAge = options.hstsMaxAge ?? 31536000; // 1 year
        const includeSub = options.hstsIncludeSubDomains
          ? "; includeSubDomains"
          : "";
        const preload = options.hstsPreload ? "; preload" : "";
        res.headers.set(
          "Strict-Transport-Security",
          `max-age=${maxAge}${includeSub}${preload}`,
        );
      }

      if (
        options.enableCSP &&
        (res.headers.get("content-type") || "").includes("text/html")
      ) {
        res.headers.set(
          "Content-Security-Policy",
          "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        );
      }
      return res;
    };
  },

  rateLimit: (
    options: RateLimitOptions = config.security as SecurityOptions,
  ): Middleware<State> => {
    const buckets = new Map<string, { tokens: number; updated: number }>();
    const CAP = options.rateLimitMax;
    const WINDOW_MS = options.rateLimitWindowMs;

    return (ctx) => {
      if (!options.enableRateLimit) return ctx.next();

      const ip = ctx.req.headers.get("x-forwarded-for") ??
        ctx.req.headers.get("cf-connecting-ip") ??
        "unknown";
      const key = `${ip}:${new URL(ctx.req.url).pathname}`;

      const now = Date.now();
      const bucket = buckets.get(key) ?? { tokens: CAP, updated: now };
      const refill = Math.floor((now - bucket.updated) / WINDOW_MS) * CAP;
      bucket.tokens = Math.min(CAP, bucket.tokens + Math.max(0, refill));
      bucket.updated = now;

      if (bucket.tokens <= 0) {
        buckets.set(key, bucket);
        return new Response("rate limited", { status: 429 });
      }

      bucket.tokens -= 1;
      buckets.set(key, bucket);

      // Periodic pruning to avoid unbounded memory
      if (buckets.size % 50 === 0) {
        const ttl = WINDOW_MS * 10;
        for (const [k, b] of buckets) {
          if (now - b.updated > ttl) buckets.delete(k);
        }
      }
      return ctx.next();
    };
  },

  errorHandler: (): Middleware<State> => {
    return async (ctx) => {
      try {
        return await ctx.next();
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 600) {
          throw err;
        }

        const problem = {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: (err as Error)?.message ?? "unexpected error",
          "request-id": ctx.state.requestId,
        };

        console.error(JSON.stringify({
          ts: new Date().toISOString(),
          lvl: "error",
          msg: "unhandled",
          requestId: ctx.state.requestId,
          method: ctx.req.method,
          path: new URL(ctx.req.url).pathname,
          err: String(err),
        }));

        return new Response(JSON.stringify(problem), {
          status: 500,
          headers: {
            "content-type": "application/problem+json",
            "X-Request-ID": ctx.state.requestId,
          },
        });
      }
    };
  },

  logging: (): Middleware<State> => {
    return async (ctx) => {
      const res = await ctx.next();
      const durMs = Math.round(performance.now() - ctx.state.start);

      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        lvl: "info",
        msg: "request",
        requestId: ctx.state.requestId,
        method: ctx.req.method,
        path: new URL(ctx.req.url).pathname,
        status: res.status,
        durMs,
      }));

      return res;
    };
  },

  cors: (options?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  }): Middleware<State> => {
    const defaults = {
      origins: ["*"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      headers: ["Content-Type", "Authorization"],
      credentials: false,
    } as const;
    const opts = { ...defaults, ...options };

    return async (ctx) => {
      if (ctx.req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": opts.origins.join(", "),
            "Access-Control-Allow-Methods": opts.methods.join(", "),
            "Access-Control-Allow-Headers": opts.headers.join(", "),
            "Access-Control-Allow-Credentials": String(opts.credentials),
          },
        });
      }

      const res = await ctx.next();
      res.headers.set("Access-Control-Allow-Origin", opts.origins.join(", "));
      if (opts.credentials) {
        res.headers.set("Access-Control-Allow-Credentials", "true");
      }
      return res;
    };
  },
};

// Compose middleware stack based on configuration
export function createMiddlewareStack(options?: {
  exclude?: string[];
  include?: string[];
  custom?: Middleware<State>[];
}): Middleware<State>[] {
  const stack: Middleware<State>[] = [];

  // Default middleware order
  const defaultOrder = [
    "requestId",
    "timing",
    "errorHandler",
    "security",
    "logging",
  ];

  const toInclude = options?.include || defaultOrder;
  const toExclude = new Set(options?.exclude || []);

  for (const name of toInclude) {
    if (!toExclude.has(name) && name in middlewares) {
      // deno-lint-ignore no-explicit-any
      stack.push((middlewares as any)[name]());
    }
  }

  // Add custom middleware at the end
  if (options?.custom) {
    stack.push(...options.custom);
  }

  return stack;
}
