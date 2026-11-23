import type { TextTemplate } from "./types";

export const DEFAULT_TEMPLATE_CONTENT = `🎄 {{nome}} no Mercado Livre 🎄
💰 Por apenas: {{preco}}
🚚 {{frete}} · 📦 {{entrega}}
Veja Aqui 👉 {{link}}`;

/** Stable ISO timestamp for the seeded default template (avoids prerender churn). */
const DEFAULT_TEMPLATE_UPDATED_AT = "2026-01-01T00:00:00.000Z";

export function createDefaultTemplate(id = "tpl-default"): TextTemplate {
  return {
    id,
    name: "Padrão Mercado Livre",
    content: DEFAULT_TEMPLATE_CONTENT,
    isDefault: true,
    updatedAt: DEFAULT_TEMPLATE_UPDATED_AT,
  };
}

export { createId } from "./ids";
