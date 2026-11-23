export type ProductDraft = {
  affiliateLink: string;
  name: string;
  price: string;
  freeShipping: boolean;
  fastDelivery: boolean;
};

export type ProductStatus = "draft" | "queued" | "active" | "done" | "archived";

export type Product = ProductDraft & {
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
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  repostWindowDays: number;
};

export type MigratePayload = {
  products?: Product[];
  templates?: TextTemplate[];
  groups?: FacebookGroup[];
  postings?: Posting[];
  lastProduct?: ProductDraft | null;
  settings?: UserSettings;
};

export const TEMPLATE_VARIABLES = [
  { key: "{{nome}}", label: "Nome do produto" },
  { key: "{{preco}}", label: "Preço" },
  { key: "{{link}}", label: "Link de afiliado" },
  { key: "{{frete}}", label: "Frete (grátis ou vazio)" },
  { key: "{{entrega}}", label: "Entrega rápida (ou vazio)" },
] as const;

/** Phase 2 key; Phase 1 key is still read once for migration. */
export const STORAGE_KEY = "easie-fase2-v1";
export const STORAGE_KEY_V1 = "easie-fase1-v1";
