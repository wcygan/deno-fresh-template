import { app } from "../main.ts";
import { assert } from "jsr:@std/assert";

const h = app.handler();

Deno.test({
  name: "X-Trace-Id is present when OTEL is enabled",
  ignore: Deno.env.get("OTEL_DENO") !== "true",
  permissions: { env: true },
  async fn() {
    const res = await h(new Request("http://x/api2/tester"));
    const traceId = res.headers.get("X-Trace-Id");
    assert(!!traceId && traceId.length === 32);
  },
});
