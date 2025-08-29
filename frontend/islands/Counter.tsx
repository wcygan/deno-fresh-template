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
