import { assert, assertEquals } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";

Deno.test("security middleware sets CSP for HTML content", async () => {
  const mw = middlewares.security();
  const ctx: any = {
    next: () => new Response("<html/>", { headers: { "content-type": "text/html; charset=utf-8" } }),
  };
  const res = await mw(ctx);
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  const csp = res.headers.get("Content-Security-Policy");
  assert(!!csp && csp.includes("default-src 'self'"));
});

Deno.test("timing middleware adds timing headers", async () => {
  const mw = middlewares.timing();
  const ctx: any = {
    state: {},
    next: () => new Response("ok"),
  };
  const res = await mw(ctx);
  assert(!!res.headers.get("Server-Timing"));
  assert(!!res.headers.get("X-Response-Time"));
});
