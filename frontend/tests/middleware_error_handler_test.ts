import { assertEquals, assertRejects } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";
import { type Context } from "fresh";
import { type State } from "../utils.ts";

Deno.test("errorHandler returns problem+json on unexpected error", async () => {
  const mw = middlewares.errorHandler();
  const ctx = {
    state: { requestId: "req-1", shared: "", start: 0 },
    req: new Request("http://x/test"),
    next: () => {
      throw new Error("boom");
    },
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("content-type"), "application/problem+json");
  const body = await res.json();
  assertEquals(body.status, 500);
  assertEquals(body["request-id"], "req-1");
});

Deno.test("errorHandler rethrows known http errors", async () => {
  const mw = middlewares.errorHandler();
  const ctx = {
    state: { requestId: "req-2", shared: "", start: 0 },
    req: new Request("http://x/test"),
    next: () => {
      const e = new Error("not found") as Error & { status?: number };
      e.status = 404;
      throw e;
    },
  } as unknown as Context<State>;
  await assertRejects(async () => {
    await mw(ctx);
  });
});
