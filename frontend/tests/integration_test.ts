import { app } from "../main.ts";
import { assertEquals } from "jsr:@std/assert";

const testApp = app.handler();

Deno.test("middleware stack works (healthz)", async () => {
  const res = await testApp(new Request("http://x/healthz"));

  // Check tracing header
  const requestId = res.headers.get("x-request-id");
  assertEquals(typeof requestId, "string");
  assertEquals(requestId?.length, 36); // UUID length

  // Check security headers
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
});
