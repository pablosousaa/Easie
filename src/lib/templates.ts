import type { TextTemplate } from "./types";

/** Stable ISO timestamp for seeded templates (avoids prerender churn). */
const DEFAULT_TEMPLATE_UPDATED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Five announcement models from docs/templates-anuncios.txt.
 * Placeholders: {{nome}} / {{preco}} / {{link}} (also [PRODUTO] / [PREÇO] / [LINK]).
 * Frete / entrega follow product toggles via {{frete}} / {{entrega}}.
 */
export const AD_TEMPLATE_DEFS = [
  {
    name: "Oferta imperdível",
    content: `🔥 ACHEI! {{nome}} por um preço ABSURDO!

💰 Por apenas: {{preco}} 🚚 {{frete}} · 📦 {{entrega}} ⚠️ Só enquanto durar!

🛒 Veja aqui 👉 {{link}}`,
  },
  {
    name: "Achadinho do dia",
    content: `🤯 OLHA O QUE EU ENCONTREI!

{{nome}} por apenas {{preco}}! 😍

🔥 É aquela oportunidade que não dá pra perder! 🚚 {{frete}} · 📦 {{entrega}}

👇 Confira aqui 👉 {{link}}`,
  },
  {
    name: "Alerta de oferta",
    content: `🚨 ATENÇÃO! OFERTA ENCONTRADA!

🔥 {{nome}} por apenas {{preco}}!

💥 Aproveite esse precinho especial! 🚚 {{frete}} · 📦 {{entrega}}
⏳ Corre antes que acabe!

🛍️ Compre aqui 👉 {{link}}`,
  },
  {
    name: "Oportunidade encontrada",
    content: `😍 VOCÊ PRECISA VER ISSO!

{{nome}} com um preço de cair o queixo!

💰 Apenas: {{preco}} ✨ Uma oportunidade que vale a pena aproveitar! 🚚 {{frete}} · 📦 {{entrega}}

👉 Confira agora: {{link}}`,
  },
  {
    name: "Preço absurdo",
    content: `💥 QUE PREÇO É ESSE?!

🔥 {{nome}} por apenas {{preco}}!

🤩 Achadinho que merece sua atenção! 📦 {{entrega}} · 🚚 {{frete}}

⚠️ Aproveite enquanto está disponível!

👇 GARANTA O SEU 👉 {{link}}`,
  },
] as const;

export const DEFAULT_TEMPLATE_CONTENT = AD_TEMPLATE_DEFS[0].content;

export function createAdTemplates(
  idForIndex?: (index: number) => string,
): TextTemplate[] {
  return AD_TEMPLATE_DEFS.map((def, index) => ({
    id: idForIndex?.(index) ?? `tpl-ad-${index + 1}`,
    name: def.name,
    content: def.content,
    isDefault: index === 0,
    updatedAt: DEFAULT_TEMPLATE_UPDATED_AT,
    category: "",
  }));
}

export function createDefaultTemplate(id = "tpl-ad-1"): TextTemplate {
  const [first] = createAdTemplates();
  return { ...first, id, isDefault: true };
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

export function findTemplateById(
  templates: TextTemplate[],
  id: string | null | undefined,
): TextTemplate | undefined {
  if (!id) return undefined;
  return templates.find((t) => t.id === id);
}

export { createId } from "./ids";
