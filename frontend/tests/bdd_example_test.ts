import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

describe("BDD example", () => {
  it("/healthz responds ok", async () => {
    const res = await h(req("/healthz"));
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "ok");
  });

  it("/healthz includes security header", async () => {
    const res = await h(req("/healthz"));
    assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  });
});

