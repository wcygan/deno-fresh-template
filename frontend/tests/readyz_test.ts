import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("/readyz responds ready after load event", async () => {
  // Initial state may be ready or not depending on environment; ensure ready after event
  await h(req("/readyz"));

  globalThis.dispatchEvent(new Event("load"));

  const after = await h(req("/readyz"));
  assertEquals(after.status, 200);
  assertEquals(await after.text(), "ready");
});
