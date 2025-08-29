import { assertEquals } from "jsr:@std/assert";
import { formatPrice } from "./format.ts";

Deno.test("formatPrice formats USD by default", () => {
  assertEquals(formatPrice(1234.5), "$1,234.50");
});

Deno.test("formatPrice supports custom currency and locale", () => {
  const eur = formatPrice(1234.5, "EUR", "de-DE");
  // Accept either common variant, depending on platform's Intl data
  // e.g., "1.234,50 €" or "1.234,50 EUR". Check it contains the number and symbol/code.
  const normalized = eur.replace(/\s/g, "");
  const hasNumber = normalized.includes("1.234,50");
  const hasCurrency = normalized.includes("€") ||
    normalized.toUpperCase().includes("EUR");
  if (!(hasNumber && hasCurrency)) {
    throw new Error(`Unexpected EUR format: ${eur}`);
  }
});
