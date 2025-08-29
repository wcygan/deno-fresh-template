import { assert, assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("metrics endpoint reports after a request", async () => {
  // Trigger a request that records metrics
  const r1 = await h(req("/api2/jane"));
  assertEquals(r1.status, 200);

  // Now fetch metrics
  const res = await h(req("/metrics"));
  assertEquals(res.status, 200);
  const ct = res.headers.get("content-type") ?? "";
  assert(ct.includes("text/plain"));
  const body = await res.text();
  assert(body.length > 0);
  // Spot-check presence of our metric keys
  assert(body.includes("http_requests_total"));
  assert(body.includes("/api2/:name"));
});
