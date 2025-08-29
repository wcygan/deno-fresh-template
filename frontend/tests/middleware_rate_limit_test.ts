import { assertEquals } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";
import { FakeTime } from "jsr:@std/testing/time";
import { type Context } from "fresh";
import { type State } from "../utils.ts";

Deno.test("rateLimit disabled bypasses limiting", async () => {
  const mw = middlewares.rateLimit({
    enableRateLimit: false,
    rateLimitMax: 1,
    rateLimitWindowMs: 1000,
    enableCSP: true,
  });
  const ctx = {
    req: new Request("http://x/api/foo"),
    next: () => new Response("ok"),
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("rateLimit enforces cap and refills over window", async () => {
  using _time = new FakeTime(1_000_000);
  const mw = middlewares.rateLimit({
    enableRateLimit: true,
    rateLimitMax: 1,
    rateLimitWindowMs: 10,
    enableCSP: true,
  });
  const ctx = {
    req: new Request("http://x/api/foo", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    }),
    next: () => new Response("ok"),
  } as unknown as Context<State>;

  const res1 = await mw(ctx);
  assertEquals(res1.status, 200);

  const res2 = await mw(ctx);
  assertEquals(res2.status, 429);

  // Advance time past window to refill tokens
  _time.tick(11);
  const res3 = await mw(ctx);
  assertEquals(res3.status, 200);
});
