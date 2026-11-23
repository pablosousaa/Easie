export type Product = {
  affiliateLink: string;
  name: string;
  price: string;
  freeShipping: boolean;
  fastDelivery: boolean;
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

export type EasieStore = {
  products: Product[];
  lastProduct: Product | null;
  templates: TextTemplate[];
  variations: TextVariation[];
};

export const TEMPLATE_VARIABLES = [
  { key: "{{nome}}", label: "Nome do produto" },
  { key: "{{preco}}", label: "Preço" },
  { key: "{{link}}", label: "Link de afiliado" },
  { key: "{{frete}}", label: "Frete (grátis ou vazio)" },
  { key: "{{entrega}}", label: "Entrega rápida (ou vazio)" },
] as const;

export const STORAGE_KEY = "easie-fase1-v1";
