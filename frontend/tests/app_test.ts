import { app } from "../main.ts";
import { assertEquals } from "jsr:@std/assert";

Deno.test("/api2/:name capitalizes Jessie", async () => {
  const res = await app.handler()(new Request("http://x/api2/jessie"));
  assertEquals(await res.text(), "Hello, Jessie!");
});

Deno.test("/api2/:name capitalizes Taylor", async () => {
  const res = await app.handler()(new Request("http://x/api2/taylor"));
  assertEquals(await res.text(), "Hello, Taylor!");
});
