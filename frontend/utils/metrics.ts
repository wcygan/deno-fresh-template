type Ctx = { route: string; method: string; status: number; durMs: number };

const counters = new Map<string, number>();
const hist = new Map<string, number[]>(); // simple buckets later if you want

export function observe(c: Ctx) {
  const key = `http_requests_total{method="${c.method}",route="${c.route}",status="${c.status}"}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  const k2 = `http_request_duration_ms{route="${c.route}",method="${c.method}"}`;
  const arr = hist.get(k2) ?? [];
  arr.push(c.durMs);
  hist.set(k2, arr);
}

export function renderProm(): string {
  const lines: string[] = [];
  for (const [k, v] of counters) lines.push(`${k} ${v}`);
  for (const [k, arr] of hist) {
    if (!arr.length) continue;
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = sum / arr.length;
    lines.push(`${k}_count ${arr.length}`);
    lines.push(`${k}_sum ${sum}`);
    lines.push(`${k}_avg ${avg}`);
  }
  return lines.join("\n") + "\n";
}

