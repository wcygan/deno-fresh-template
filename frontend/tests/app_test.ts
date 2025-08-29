import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test("/api2/:name capitalizes Jessie", async () => {
  const res = await h(req("/api2/jessie"));
  assertEquals(await res.text(), "Hello, Jessie!");
});

Deno.test("/api2/:name capitalizes Taylor", async () => {
  const res = await h(req("/api2/taylor"));
  assertEquals(await res.text(), "Hello, Taylor!");
});
