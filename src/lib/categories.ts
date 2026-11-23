/** Shared product / template categories (RF04 / RF12). */
export const PRODUCT_CATEGORIES = [
  { id: "", label: "Geral" },
  { id: "natal", label: "Natal / sazonal" },
  { id: "casa", label: "Casa e decoração" },
  { id: "eletronicos", label: "Eletrônicos" },
  { id: "beleza", label: "Beleza" },
  { id: "esportes", label: "Esportes" },
  { id: "moda", label: "Moda" },
  { id: "outros", label: "Outros" },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]["id"];

export function categoryLabel(id: string | undefined | null): string {
  const found = PRODUCT_CATEGORIES.find((c) => c.id === (id ?? ""));
  return found?.label ?? "Geral";
}
