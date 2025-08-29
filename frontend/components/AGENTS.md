# Components Guide (Fresh 2.x Canary)

Guidance for server-only/shared Preact components. These render on the server
and are not hydrated on the client (no client JS by default).

Reference docs:

- Layouts: https://fresh.deno.dev/docs/canary/advanced/layouts
- Partials: https://fresh.deno.dev/docs/canary/advanced/partials
- Error handling: https://fresh.deno.dev/docs/canary/advanced/error-handling
- Islands (for interactivity):
  https://fresh.deno.dev/docs/canary/concepts/islands

## When to use a component vs island

- Use a component for presentational, reusable UI with no client interactivity.
- If you need `onClick`, timers, or browser APIs, move that piece to an island
  and pass serializable data to it.

## Patterns

- Keep components pure and stateless; derive everything from props.
- Prefer Tailwind utility classes for styling (if configured), avoid large
  global CSS.
- Co-locate tiny components where used; place shared ones under `components/`.
- Components can be nested inside islands, but not vice versa for client logic.

Example (`Button`):

```tsx
// components/Button.tsx
import type { ComponentChildren } from "preact";

export interface ButtonProps {
  id?: string;
  onClick?: () => void; // Only fires if used inside an island
  children?: ComponentChildren;
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  return (
    <button
      {...props}
      class="px-2 py-1 border-gray-500 border-2 rounded-sm bg-white hover:bg-gray-200 transition-colors"
    >
      {props.children}
    </button>
  );
}
```

Usage inside an island:

```tsx
// islands/Counter.tsx
import { Button } from "../components/Button.tsx";
// ... use <Button onClick={...}> within an island
```

## Layouts and partials

- Use `routes/_app.tsx` for the root HTML shell. Include `<Head />` to allow
  Fresh to inject assets and metadata from pages.
- For shared page regions (nav, footers) create server components and compose
  them in layouts.
- Prefer server-rendered partials for dynamic server fragments; elevate to
  islands only when user interaction is required.

## Error handling

- Use try/catch in handlers or middleware to produce structured responses.
- Render error boundaries/pages as server components. Keep client logic in
  islands only when necessary.

## Testing components

- Test small helpers/formatters directly.
- For integration testing, render a route that uses the component and assert the
  response contains expected HTML.

## Checklists

- No browser-only APIs in server components.
- No imports from `env.ts` in any client-executed code.
- Keep components focused; promote to islands only when interactivity is needed.
- Prefer serializable props; avoid functions unless the component is used inside
  an island.
