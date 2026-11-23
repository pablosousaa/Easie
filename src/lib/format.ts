import type { ProductDraft } from "./types";

export function emptyProduct(): ProductDraft {
  return {
    affiliateLink: "",
    name: "",
    price: "",
    freeShipping: false,
    fastDelivery: false,
  };
}

export function formatPriceBRL(raw: string): string {
  const cleaned = raw.replace(/[^\d,.]/g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return raw.trim();
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateTimePt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}
