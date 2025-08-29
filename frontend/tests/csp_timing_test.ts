import { assert, assertEquals } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";
import { type Context } from "fresh";
import { type State } from "../utils.ts";

Deno.test("security middleware sets CSP for HTML content", async () => {
  const mw = middlewares.security();
  const ctx = {
    next: () =>
      new Response("<html/>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  const csp = res.headers.get("Content-Security-Policy");
  assert(!!csp && csp.includes("default-src 'self'"));
});

Deno.test("timing middleware adds timing headers", async () => {
  const mw = middlewares.timing();
  const ctx = {
    state: { shared: "", requestId: "", start: 0 },
    next: () => new Response("ok"),
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assert(!!res.headers.get("Server-Timing"));
  assert(!!res.headers.get("X-Response-Time"));
});
