import { app } from "../main.ts";

// Shared programmatic handler for integration tests
export const h = app.handler();

// Convenience request builder with a consistent base URL
export const req = (path: string, init?: RequestInit) =>
  new Request(`http://x${path}`, init);

// Helpers to read common response bodies
export async function text(res: Response) {
  return await res.text();
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return await res.json();
}

// Header assertions (throwing Errors keeps std asserts optional here)
export function expectHeader(res: Response, name: string, expected: string) {
  const actual = res.headers.get(name);
  if (actual !== expected) {
    throw new Error(`Expected header ${name}=${expected}, got ${actual}`);
  }
}

