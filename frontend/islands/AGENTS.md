# Islands Guide (Fresh 2.x Canary)

Practical guidance for writing and maintaining islands in this repo. This aligns
with our project conventions in AGENTS.md and Fresh canary docs.

Reference docs:

- Islands: https://fresh.deno.dev/docs/canary/concepts/islands
- Layouts: https://fresh.deno.dev/docs/canary/advanced/layouts
- Partials: https://fresh.deno.dev/docs/canary/advanced/partials
- Error handling: https://fresh.deno.dev/docs/canary/advanced/error-handling

## When to use an island

- Add client interactivity (clicks, timers, websockets, media, etc.).
- Keep each island small and focused. Prefer multiple small islands over a
  single large one.
- Do not read env/config (`env.ts`) in islands — server-only.

## Props & hydration rules

- Props must be serializable. Do not pass functions, Signals, class instances,
  etc., from the server into an island.
- Prefer primitives, arrays, objects, or server-rendered JSX fragments.
- If you need reactive state, create it inside the island (e.g. `useSignal`) or
  via a client-only context/store.
- Guard client-only APIs with `IS_BROWSER` from `fresh/runtime`.

Example (Counter):

```tsx
// islands/Counter.tsx
import { type Signal, useSignal } from "@preact/signals";
import { Button } from "../components/Button.tsx";

interface CounterProps {
  start?: number;
}

export default function Counter(props: CounterProps) {
  const count: Signal<number> = useSignal(props.start ?? 0);
  return (
    <div class="flex gap-8 py-6">
      <Button id="decrement" onClick={() => count.value -= 1}>-1</Button>
      <p class="text-3xl tabular-nums">{count}</p>
      <Button id="increment" onClick={() => count.value += 1}>+1</Button>
    </div>
  );
}
```

Server page usage:

```tsx
// routes/index.tsx
import { useSignal } from "@preact/signals";
import Counter from "../islands/Counter.tsx";
import { define } from "../utils.ts";

export default define.page(() => {
  const count = useSignal(3); // server-side initial render only
  return <Counter start={count.value} />; // pass serializable value
});
```

## CSP and hydration

- Our middleware sets a CSP. Hydration requires allowing scripts from `self`. If
  using strict CSP, prefer nonces/hashes. The project currently allows
  `'unsafe-inline'` for simplicity. Adjust `frontend/middleware/index.ts` if
  tightening CSP.
- Ensure the root layout includes `<Head />` so Fresh can inject needed assets.

## Patterns

- Keep island boundaries minimal; pass only the data needed.
- Lift server-only work (fetching, validation) into route handlers; pass results
  as props.
- Compose islands with server components: islands can render/contain server
  components, but not vice versa for interactivity.
- For client-only features, guard with `IS_BROWSER` to avoid SSR errors.

## Testing islands

- Prefer testing logic without DOM. Use Signals or pure functions.
- Example skeleton:

```ts
// islands/Counter_logic_test.ts
import { signal } from "@preact/signals";
import { assertEquals } from "jsr:@std/assert";

Deno.test("counter increments", () => {
  const n = signal(0);
  n.value++;
  assertEquals(n.value, 1);
});
```

- For integration, rely on route handler tests to verify the page renders and
  headers are correct. Avoid browser/E2E unless necessary.

## Common pitfalls

- Passing non-serializable props (e.g., a `Signal` from a server route) prevents
  hydration — handlers attach but state won’t sync. Always pass plain data and
  create Signals inside the island.
- Importing `env.ts` (server-only) in an island will fail in the browser.
- Large islands increase client JS. Split into smaller ones when possible.

## Checklists

- Props are serializable (no functions/Signals/classes).
- No server-only imports (env, file system, Deno APIs).
- Minimal state created inside the island.
- Layout includes `<Head />`; CSP allows scripts from `self`.
- Add logic-only tests if the island has non-trivial client logic.
