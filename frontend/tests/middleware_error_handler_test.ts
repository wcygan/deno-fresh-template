import { assertEquals, assertRejects } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";

Deno.test("errorHandler returns problem+json on unexpected error", async () => {
  const mw = middlewares.errorHandler();
  const ctx: any = {
    state: { requestId: "req-1" },
    req: new Request("http://x/test"),
    next: () => { throw new Error("boom"); },
  };
  const res = await mw(ctx);
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("content-type"), "application/problem+json");
  const body = await res.json();
  assertEquals(body.status, 500);
  assertEquals(body["request-id"], "req-1");
});

Deno.test("errorHandler rethrows known http errors", async () => {
  const mw = middlewares.errorHandler();
  const ctx: any = {
    state: { requestId: "req-2" },
    req: new Request("http://x/test"),
    next: () => { const e: any = new Error("not found"); e.status = 404; throw e; },
  };
  await assertRejects(async () => { await mw(ctx); });
});
