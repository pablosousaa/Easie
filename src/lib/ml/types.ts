export type ResolvedMlItem = {
  mlItemId: string;
  name: string;
  thumbnail: string;
  price: number;
  currency: string;
  categoryId: string;
  categoryName: string;
  rank: number;
  permalink: string;
  freeShipping: boolean;
};

export type TrendingSource = "highlights" | "search" | "mock" | "cache";

export type TrendingListResponse = {
  items: Array<{
    id: string;
    mlItemId: string;
    name: string;
    thumbnail: string;
    price: number;
    currency: string;
    categoryId: string;
    categoryName: string;
    rank: number;
    permalink: string;
    freeShipping: boolean;
    weekKey: string;
  }>;
  categories: Array<{
    id: string;
    mlCategoryId: string;
    name: string;
    enabled: boolean;
    sortOrder: number;
  }>;
  lastUpdatedAt: string | null;
  nextRefreshAt: string | null;
  cadence: "weekly" | "daily";
  source: TrendingSource;
  stale: boolean;
  warning: string | null;
};
