/** Parse BRL-ish price strings ("72,90", "R$ 1.299,00", "72.90") to a number. */
export function parsePriceNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // 1.299,00 → 1299.00
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/**
 * Discount % from original (list) vs current price.
 * Returns a positive integer 1–99, or null when there is no real discount.
 */
export function computeDiscountPercent(
  currentRaw: string,
  originalRaw: string,
): number | null {
  const current = parsePriceNumber(currentRaw);
  const original = parsePriceNumber(originalRaw);
  if (current == null || original == null) return null;
  if (original <= current) return null;

  const pct = Math.round(((original - current) / original) * 100);
  if (pct < 1 || pct > 99) return null;
  return pct;
}

/**
 * Human OFF label. Soft mode may say "quase 70% OFF" when the math is close
 * to the next decade — never "quase 50%" for an exact 50.
 */
export function formatPercentOff(
  percent: number,
  mode: "exact" | "soft" = "exact",
): string {
  if (mode === "exact" || percent % 10 === 0) {
    return `${percent}% OFF`;
  }
  const decade = Math.ceil(percent / 10) * 10;
  if (decade <= 90 && decade - percent <= 5) {
    return `quase ${decade}% OFF`;
  }
  return `${percent}% OFF`;
}

/**
 * Five distinct PT-BR discount callouts (one per Gerar variation).
 * Empty strings when there is no discount — templates stay neutral.
 */
export function discountCallouts(
  nome: string,
  percent: number | null,
): readonly [string, string, string, string, string] {
  const name = nome.trim() || "Produto";
  if (percent == null) {
    return ["", "", "", "", ""];
  }

  const exact = formatPercentOff(percent, "exact");
  const soft = formatPercentOff(percent, "soft");

  return [
    `${name} ${exact}`,
    `PROMOÇÃO DO DIA, ${soft.toUpperCase()}`,
    `${exact} neste achadinho`,
    `Em promoção com ${exact}`,
    `Desconto absurdo: ${soft}`,
  ];
}
