import { z } from "npm:zod@3.23.8";

export const Env = z.object({
  PORT: z.string().default("8000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Enable Deno's OpenTelemetry auto-instrumentation by default.
  // Can be overridden via actual environment.
  OTEL_DENO: z.enum(["true", "false"]).default("true"),
  // Add required secrets as needed:
  // STRIPE_SECRET_KEY: z.string().min(1),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(
  source: Record<string, string | undefined> = Deno.env.toObject(),
): Env {
  // Cast to unknown to satisfy zod input type
  return Env.parse(source as unknown as Record<string, unknown>);
}

export const env: Env = loadEnv();

//
// Extended, type-safe application configuration (multi-source)
// Inspired by config example; kept alongside Env for compatibility.
//

// Base configuration schema that all apps will have
const BaseConfig = z.object({
  app: z.object({
    name: z.string().default("Fresh App"),
    version: z.string().default("1.0.0"),
    environment: z.enum(["development", "staging", "production"]).default(
      "development",
    ),
  }),
  server: z.object({
    port: z.string().default("8000"),
    host: z.string().default("0.0.0.0"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
  security: z.object({
    enableCSP: z.boolean().default(true),
    enableRateLimit: z.boolean().default(true),
    rateLimitMax: z.number().default(60),
    rateLimitWindowMs: z.number().default(60_000),
  }),
  observability: z.object({
    enableOtel: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    serviceName: z.string().optional(),
  }),
});

// Extend this for app-specific configuration
export const AppConfigSchema = BaseConfig.extend({
  // App-specific feature flags
  features: z.object({
    enableAuth: z.boolean().default(false),
    enableAnalytics: z.boolean().default(false),
  }).optional(),
  // External services
  services: z.object({
    database: z.object({
      url: z.string().optional(),
      poolSize: z.number().default(10),
    }).optional(),
    redis: z.object({
      url: z.string().optional(),
    }).optional(),
  }).optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// Helper to remove undefined values
function removeUndefined(obj: unknown): unknown {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const cleaned = removeUndefined(value);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return !!item && typeof item === "object" && !Array.isArray(item);
}

// Simple deep merge for plain objects
function deepMerge(
  target: Record<string, unknown>,
  ...sources: unknown[]
): Record<string, unknown> {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      const sVal = source[key];
      if (isObject(sVal)) {
        if (!target[key] || !isObject(target[key])) target[key] = {};
        deepMerge(target[key] as Record<string, unknown>, sVal);
      } else {
        target[key] = sVal as unknown;
      }
    }
  }
  return deepMerge(target, ...sources);
}

// Configuration loader with multiple sources
export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const get = (k: string) => Deno.env.get(k);

  // Priority order: overrides > env vars > defaults
  const envSource = {
    app: {
      name: get("APP_NAME"),
      version: get("APP_VERSION"),
      environment: get("APP_ENV"),
    },
    server: {
      port: get("PORT"),
      host: get("HOST"),
      logLevel: get("LOG_LEVEL"),
    },
    security: {
      enableCSP: get("ENABLE_CSP") === "true"
        ? true
        : get("ENABLE_CSP") === "false"
        ? false
        : undefined,
      enableRateLimit: get("ENABLE_RATE_LIMIT") === "true"
        ? true
        : get("ENABLE_RATE_LIMIT") === "false"
        ? false
        : undefined,
      rateLimitMax: get("RATE_LIMIT_MAX")
        ? Number(get("RATE_LIMIT_MAX"))
        : undefined,
      rateLimitWindowMs: get("RATE_LIMIT_WINDOW_MS")
        ? Number(get("RATE_LIMIT_WINDOW_MS"))
        : undefined,
    },
    observability: {
      enableOtel: get("OTEL_DENO") === "true"
        ? true
        : get("OTEL_DENO") === "false"
        ? false
        : undefined,
      enableMetrics: get("ENABLE_METRICS") === "true"
        ? true
        : get("ENABLE_METRICS") === "false"
        ? false
        : undefined,
      serviceName: get("OTEL_SERVICE_NAME"),
    },
    services: {
      database: {
        url: get("DATABASE_URL"),
        poolSize: get("DATABASE_POOL_SIZE")
          ? Number(get("DATABASE_POOL_SIZE"))
          : undefined,
      },
      redis: {
        url: get("REDIS_URL"),
      },
    },
    features: {
      enableAuth: get("FEATURE_ENABLE_AUTH") === "true"
        ? true
        : get("FEATURE_ENABLE_AUTH") === "false"
        ? false
        : undefined,
      enableAnalytics: get("FEATURE_ENABLE_ANALYTICS") === "true"
        ? true
        : get("FEATURE_ENABLE_ANALYTICS") === "false"
        ? false
        : undefined,
    },
  } as const;

  const merged = deepMerge(
    { app: {}, server: {}, security: {}, observability: {} } as Record<
      string,
      unknown
    >,
    removeUndefined(envSource) as Record<string, unknown>,
    overrides || {},
  );

  return AppConfigSchema.parse(merged);
}

// Export singleton config
export const config: AppConfig = loadConfig();
