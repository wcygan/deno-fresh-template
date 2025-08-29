#!/usr/bin/env -S deno run -A --watch=static/,routes/
import { tailwind } from "@fresh/plugin-tailwind";

import { Builder } from "fresh/dev";
import { env } from "./env.ts";

const builder = new Builder();
tailwind(builder);
if (Deno.args.includes("build")) {
  await builder.build();
} else {
  // Use validated PORT from env schema
  const port = Number(env.PORT);
  await builder.listen(() => import("./main.ts"), { port });
}
