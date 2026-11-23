/** Default MLB categories for “produtos em alta” (RF46). Leaf-ish IDs preferred for Highlights. */
export type TrendingCategoryDef = {
  mlCategoryId: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
};

export const DEFAULT_TRENDING_CATEGORIES: TrendingCategoryDef[] = [
  { mlCategoryId: "MLB1055", name: "Celulares e telefones", enabled: true, sortOrder: 1 },
  { mlCategoryId: "MLB1000", name: "Eletrônicos, áudio e vídeo", enabled: true, sortOrder: 2 },
  { mlCategoryId: "MLB1276", name: "Esportes e fitness", enabled: true, sortOrder: 3 },
  { mlCategoryId: "MLB1430", name: "Calçados, roupas e bolsas", enabled: true, sortOrder: 4 },
  { mlCategoryId: "MLB1574", name: "Casa, móveis e decoração", enabled: true, sortOrder: 5 },
  { mlCategoryId: "MLB1246", name: "Beleza e cuidado pessoal", enabled: true, sortOrder: 6 },
  { mlCategoryId: "MLB5726", name: "Eletrodomésticos", enabled: true, sortOrder: 7 },
  { mlCategoryId: "MLB1144", name: "Games", enabled: false, sortOrder: 8 },
];

export function parseCategoriesEnv(): TrendingCategoryDef[] | null {
  const raw = process.env.ML_CATEGORIES?.trim();
  if (!raw) return null;
  // Format: MLB1055:Celulares,MLB1000:Eletrônicos
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.map((part, i) => {
    const [id, ...nameParts] = part.split(":");
    return {
      mlCategoryId: id.trim(),
      name: nameParts.join(":").trim() || id.trim(),
      enabled: true,
      sortOrder: i + 1,
    };
  });
}
