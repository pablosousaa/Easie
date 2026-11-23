export type ProductDraft = {
  affiliateLink: string;
  name: string;
  price: string;
  freeShipping: boolean;
  fastDelivery: boolean;
  /** Product category id (RF04 / RF12), empty = Geral. */
  category: string;
};

export type ProductStatus = "draft" | "queued" | "active" | "done" | "archived";

export type ProductResults = {
  clicks: number;
  sales: number;
  /** Commission amount as typed by the user (e.g. "12,50"). */
  commission: string;
};

export type Product = ProductDraft &
  ProductResults & {
    id: string;
    status: ProductStatus;
    queueOrder: number;
    createdAt: string;
    completedAt: string | null;
  };

export type TextTemplate = {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  updatedAt: string;
  /** Empty = applies to all (Geral). Seasonal e.g. "natal" (RF12). */
  category: string;
};

export type TextVariation = {
  id: string;
  text: string;
};

export type FacebookGroup = {
  id: string;
  name: string;
  link: string;
  theme: string;
  rules: string;
  active: boolean;
  createdAt: string;
};

export type PostingStatus = "pending" | "posted" | "ignored";

export type Posting = {
  id: string;
  productId: string;
  groupId: string;
  status: PostingStatus;
  variationText: string;
  variationIndex: number;
  postedAt: string | null;
  createdAt: string;
};

export type UserSettings = {
  repostWindowDays: number;
};

export type EasieStore = {
  products: Product[];
  lastProduct: ProductDraft | null;
  templates: TextTemplate[];
  variations: TextVariation[];
  groups: FacebookGroup[];
  postings: Posting[];
  settings: UserSettings;
  /** Mercado Livre item ids the user already claimed from Pegar produtos (RF44). */
  trendingTakenIds: string[];
  /** Mercado Livre item ids the user hid from the list (RF44). */
  trendingHiddenIds: string[];
};

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  repostWindowDays: number;
};

export type MigratePayload = {
  products?: Product[];
  templates?: TextTemplate[];
  groups?: FacebookGroup[];
  postings?: Posting[];
  lastProduct?: ProductDraft | null;
  settings?: UserSettings;
  trendingTakenIds?: string[];
  trendingHiddenIds?: string[];
};

export const TEMPLATE_VARIABLES = [
  { key: "{{nome}}", label: "Nome do produto" },
  { key: "{{preco}}", label: "Preço" },
  { key: "{{link}}", label: "Link de afiliado" },
  { key: "{{frete}}", label: "Frete (grátis ou vazio)" },
  { key: "{{entrega}}", label: "Entrega rápida (ou vazio)" },
] as const;

/** Phase 2+ key; Phase 1 key is still read once for migration. */
export const STORAGE_KEY = "easie-fase2-v1";
export const STORAGE_KEY_V1 = "easie-fase1-v1";

export const EMPTY_RESULTS: ProductResults = {
  clicks: 0,
  sales: 0,
  commission: "",
};
