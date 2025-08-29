import { assert, assertEquals } from "jsr:@std/assert";
import { middlewares } from "../middleware/index.ts";
import { type Context } from "fresh";
import { type State } from "../utils.ts";

Deno.test("cors preflight returns 204 with allow headers", async () => {
  const mw = middlewares.cors({
    origins: ["https://ex.com"],
    headers: ["Content-Type"],
  });
  const ctx = {
    req: new Request("http://x/foo", { method: "OPTIONS" }),
    next: () => new Response("should-not-run"),
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://ex.com",
  );
  assert(res.headers.get("Access-Control-Allow-Methods")?.includes("GET"));
  assertEquals(res.headers.get("Access-Control-Allow-Headers"), "Content-Type");
});

Deno.test("cors sets ACAO and credentials when enabled", async () => {
  const mw = middlewares.cors({ credentials: true });
  const ctx = {
    req: new Request("http://x/foo"),
    next: () => new Response("ok"),
  } as unknown as Context<State>;
  const res = await mw(ctx);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(res.headers.get("Access-Control-Allow-Credentials"), "true");
});
