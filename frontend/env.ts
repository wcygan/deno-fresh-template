import { z } from "npm:zod";

export const Env = z.object({
  PORT: z.string().default("8000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
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
