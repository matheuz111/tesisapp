export function parsePriceCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 && cents <= 9999999 ? cents : null;
}

export function formatPrice(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}
