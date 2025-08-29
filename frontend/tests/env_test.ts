import { assertEquals, assertThrows } from "jsr:@std/assert";
import { loadEnv } from "../env.ts";

Deno.test("env defaults are applied when not set", () => {
  const e = loadEnv({});
  assertEquals(e.PORT, "8000");
  assertEquals(e.LOG_LEVEL, "info");
});

Deno.test("env respects overrides from provided source", () => {
  const e = loadEnv({ PORT: "9123", LOG_LEVEL: "error" });
  assertEquals(e.PORT, "9123");
  assertEquals(e.LOG_LEVEL, "error");
});

Deno.test("invalid LOG_LEVEL fails validation", () => {
  assertThrows(() => loadEnv({ LOG_LEVEL: "verbose" }));
});
