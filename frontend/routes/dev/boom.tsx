import { define } from "../../utils.ts";
import { config } from "../../env.ts";

// Intentionally throws in non-production to exercise the _500 page and error path
export const handler = define.handlers({
  GET() {
    if (config.app.environment === "production") {
      return new Response("not found", { status: 404 });
    }
    throw new Error("boom");
  },
});

export default handler;
