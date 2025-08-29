import { stub } from "jsr:@std/testing/mock";
import { assertEquals } from "jsr:@std/assert";

Deno.test("stubs global fetch and restores automatically", async () => {
  const mock = new Response("ok");
  using _s = stub(globalThis, "fetch", () => Promise.resolve(mock));

  const res = await fetch("http://example.test/");
  assertEquals(await res.text(), "ok");
});

