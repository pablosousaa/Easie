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
    category: "",
  };
}

export const SEASONAL_TEMPLATE_CONTENT = `🎄 Oferta de temporada: {{nome}}
💰 Só {{preco}}
🚚 {{frete}} · 📦 {{entrega}}
Garanta o seu 👉 {{link}}`;

export function createSeasonalTemplate(id = "tpl-natal"): TextTemplate {
  return {
    id,
    name: "Natal / sazonal",
    content: SEASONAL_TEMPLATE_CONTENT,
    isDefault: false,
    updatedAt: DEFAULT_TEMPLATE_UPDATED_AT,
    category: "natal",
  };
}

/** Prefer a template matching the product category; else the default; else first. */
export function pickTemplateForCategory(
  templates: TextTemplate[],
  category: string | undefined,
): TextTemplate {
  const cat = (category ?? "").trim();
  if (cat) {
    const match = templates.find((t) => t.category === cat);
    if (match) return match;
  }
  return templates.find((t) => t.isDefault) ?? templates[0] ?? createDefaultTemplate();
}

export { createId } from "./ids";
