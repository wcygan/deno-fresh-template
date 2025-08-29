import { assert } from "jsr:@std/assert";
import { h, req } from "./_helpers.ts";

Deno.test({
  name: "X-Trace-Id is present when OTEL is enabled",
  ignore: Deno.env.get("OTEL_DENO") !== "true",
  permissions: { env: true },
  async fn() {
    const res = await h(req("/healthz"));
    const traceId = res.headers.get("X-Trace-Id");
    assert(!!traceId && traceId.length === 32);
  },
});
