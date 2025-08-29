import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("unknown route returns 404", async () => {
  const res = await h(req("/this-route-does-not-exist"));
  assertEquals(res.status, 404);
});
