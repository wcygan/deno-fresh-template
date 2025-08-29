import { define } from "../../utils.ts";
import { middlewares } from "../../middleware/index.ts";

// Apply CORS to only /api/* routes via folder-scoped middleware
const cors = middlewares.cors();

export default define.middleware((ctx) => cors(ctx));
