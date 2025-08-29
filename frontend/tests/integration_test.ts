import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("middleware stack works (healthz)", async () => {
  const res = await h(req("/healthz"));

  // Check tracing header
  const requestId = res.headers.get("x-request-id");
  assertEquals(typeof requestId, "string");
  assertEquals(requestId?.length, 36); // UUID length

  // Check security headers
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
});
