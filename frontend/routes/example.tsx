import { define } from "../utils.ts";

export const handler = define.handlers({
  GET() {
    return { data: { message: "Hello from handler", n: 42 } };
  },
});

export default define.page<typeof handler>((props) => (
  <main class="min-h-screen flex items-center justify-center p-8">
    <div class="max-w-screen-md text-center">
      <h1 class="text-2xl font-bold mb-2">Typed Handler + Page</h1>
      <p class="text-gray-700">{props.data.message} (n={props.data.n})</p>
    </div>
  </main>
));
