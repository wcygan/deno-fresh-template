import { assert, assertEquals } from "jsr:@std/assert";
import { loadConfig } from "../env.ts";

Deno.test({
  name: "loadConfig reads env and applies defaults",
  permissions: { env: true },
  fn() {
    // Set some env vars
    Deno.env.set("APP_NAME", "MyApp");
    Deno.env.set("APP_VERSION", "9.9.9");
    Deno.env.set("APP_ENV", "production");
    Deno.env.set("PORT", "8123");
    Deno.env.set("HOST", "127.0.0.1");
    Deno.env.set("LOG_LEVEL", "warn");
    Deno.env.set("ENABLE_CSP", "false");
    Deno.env.set("ENABLE_RATE_LIMIT", "true");
    Deno.env.set("RATE_LIMIT_MAX", "5");
    Deno.env.set("RATE_LIMIT_WINDOW_MS", "1234");
    Deno.env.set("OTEL_DENO", "false");
    Deno.env.set("ENABLE_METRICS", "false");
    Deno.env.set("OTEL_SERVICE_NAME", "svc");
    Deno.env.set("DATABASE_URL", "postgres://u:p@h/db");
    Deno.env.set("DATABASE_POOL_SIZE", "42");
    Deno.env.set("REDIS_URL", "redis://h");
    Deno.env.set("FEATURE_ENABLE_AUTH", "true");
    Deno.env.set("FEATURE_ENABLE_ANALYTICS", "false");

    const cfg = loadConfig();
    assertEquals(cfg.app.name, "MyApp");
    assertEquals(cfg.app.version, "9.9.9");
    assertEquals(cfg.app.environment, "production");
    assertEquals(cfg.server.port, "8123");
    assertEquals(cfg.server.host, "127.0.0.1");
    assertEquals(cfg.server.logLevel, "warn");
    assertEquals(cfg.security.enableCSP, false);
    assertEquals(cfg.security.enableRateLimit, true);
    assertEquals(cfg.security.rateLimitMax, 5);
    assertEquals(cfg.security.rateLimitWindowMs, 1234);
    assertEquals(cfg.observability.enableOtel, false);
    assertEquals(cfg.observability.enableMetrics, false);
    assertEquals(cfg.observability.serviceName, "svc");
    assertEquals(cfg.services?.database?.url, "postgres://u:p@h/db");
    assertEquals(cfg.services?.database?.poolSize, 42);
    assertEquals(cfg.services?.redis?.url, "redis://h");
    assertEquals(cfg.features?.enableAuth, true);
    assertEquals(cfg.features?.enableAnalytics, false);

    // Defaults exist when unset
    Deno.env.delete("ENABLE_CSP");
    const cfg2 = loadConfig();
    assert(typeof cfg2.security.enableCSP === "boolean");
  },
});

Deno.test({
  name: "loadConfig allows explicit overrides to win",
  permissions: { env: true },
  fn() {
    Deno.env.set("PORT", "8001");
    const cfg = loadConfig({
      server: { port: "9000", host: "0.0.0.0", logLevel: "info" },
    });
    assertEquals(cfg.server.port, "9000");
  },
});
