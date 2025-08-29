import { assertSnapshot } from "jsr:@std/testing/snapshot";

const writeGranted = (await Deno.permissions.query({ name: "write" })).state ===
  "granted";

Deno.test({
  name: "hero fragment snapshot",
  ignore: !writeGranted,
  permissions: { read: true, write: true },
  async fn(t) {
    const html = "<section class=\"hero\">Welcome</section>";
    await assertSnapshot(t, html);
  },
});
