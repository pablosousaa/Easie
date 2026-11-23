/** Format a raw price string as Brazilian Real when possible. */
export function formatPriceBRL(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Already looks like currency
  if (/R\$\s*/i.test(trimmed)) return trimmed.replace(/\s+/g, " ");

  const normalized = trimmed
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return trimmed;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function emptyProduct() {
  return {
    affiliateLink: "",
    name: "",
    price: "",
    freeShipping: true,
    fastDelivery: true,
  };
}
