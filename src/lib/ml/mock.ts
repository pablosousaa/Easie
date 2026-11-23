import type { ResolvedMlItem } from "./types";

/** Deterministic mock bestsellers when ML credentials/network are unavailable. */
export function mockBestsellers(categoryId: string, categoryName: string): ResolvedMlItem[] {
  const seed = categoryId.replace(/\D/g, "").slice(-4) || "1055";
  const base = Number(seed) % 900;
  return Array.from({ length: 8 }, (_, i) => {
    const rank = i + 1;
    const id = `MLB-MOCK-${categoryId}-${rank}`;
    const price = 49.9 + base + rank * 17.5;
    return {
      mlItemId: id,
      name: `${categoryName} — destaque #${rank} (demo)`,
      thumbnail: "",
      price,
      currency: "BRL",
      categoryId,
      categoryName,
      rank,
      permalink: `https://www.mercadolivre.com.br/p/${id}`,
      freeShipping: rank % 2 === 0,
    };
  });
}
