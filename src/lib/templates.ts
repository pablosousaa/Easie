import type { TextTemplate } from "./types";

export const DEFAULT_TEMPLATE_CONTENT = `🎄 {{nome}} no Mercado Livre 🎄
💰 Por apenas: {{preco}}
🚚 {{frete}} · 📦 {{entrega}}
Veja Aqui 👉 {{link}}`;

/** Stable ISO timestamp for the seeded default template (avoids prerender churn). */
const DEFAULT_TEMPLATE_UPDATED_AT = "2026-01-01T00:00:00.000Z";

export function createDefaultTemplate(): TextTemplate {
  return {
    id: "tpl-default",
    name: "Padrão Mercado Livre",
    content: DEFAULT_TEMPLATE_CONTENT,
    isDefault: true,
    updatedAt: DEFAULT_TEMPLATE_UPDATED_AT,
  };
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
