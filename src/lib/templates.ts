import type { TextTemplate } from "./types";

/** Stable ISO timestamp for seeded templates (avoids prerender churn). */
const DEFAULT_TEMPLATE_UPDATED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Five announcement models from docs/templates-anuncios.txt.
 * Placeholders: {{nome}} / {{preco}} / {{link}} / {{desconto}}
 * (also [PRODUTO] / [PREÇO] / [LINK] / [DESCONTO]).
 * Frete / entrega follow product toggles via {{frete}} / {{entrega}}.
 * {{desconto}} is filled per variation with a distinct % OFF line (empty when none).
 */
export const AD_TEMPLATE_DEFS = [
  {
    name: "OFERTA IMPERDÍVEL",
    content: `🔥 ACHEI! {{desconto}}

💰 Por apenas: {{preco}} 🚚 {{frete}} · 📦 {{entrega}} ⚠️ Só enquanto durar!

🛒 Veja aqui 👉 {{link}}`,
    /** Fallback first line when there is no discount %. */
    contentNoDiscount: `🔥 ACHEI! {{nome}} por um preço ABSURDO!

💰 Por apenas: {{preco}} 🚚 {{frete}} · 📦 {{entrega}} ⚠️ Só enquanto durar!

🛒 Veja aqui 👉 {{link}}`,
  },
  {
    name: "ACHADINHO DO DIA",
    content: `🤯 OLHA O QUE EU ENCONTREI!

{{desconto}}

{{nome}} por apenas {{preco}}! 😍

🔥 É aquela oportunidade que não dá pra perder! 🚚 {{frete}} · 📦 {{entrega}}

👇 Confira aqui 👉 {{link}}`,
    contentNoDiscount: `🤯 OLHA O QUE EU ENCONTREI!

{{nome}} por apenas {{preco}}! 😍

🔥 É aquela oportunidade que não dá pra perder! 🚚 {{frete}} · 📦 {{entrega}}

👇 Confira aqui 👉 {{link}}`,
  },
  {
    name: "ALERTA DE OFERTA",
    content: `🚨 ATENÇÃO! OFERTA ENCONTRADA!

🔥 {{nome}} por apenas {{preco}}!

💥 {{desconto}}! 🚚 {{frete}} · 📦 {{entrega}}
⏳ Corre antes que acabe!

🛍️ Compre aqui 👉 {{link}}`,
    contentNoDiscount: `🚨 ATENÇÃO! OFERTA ENCONTRADA!

🔥 {{nome}} por apenas {{preco}}!

💥 Aproveite esse precinho especial! 🚚 {{frete}} · 📦 {{entrega}}
⏳ Corre antes que acabe!

🛍️ Compre aqui 👉 {{link}}`,
  },
  {
    name: "OPORTUNIDADE ENCONTRADA",
    content: `😍 VOCÊ PRECISA VER ISSO!

{{nome}} com um preço de cair o queixo!

💰 Apenas: {{preco}} ✨ {{desconto}}! 🚚 {{frete}} · 📦 {{entrega}}

👉 Confira agora: {{link}}`,
    contentNoDiscount: `😍 VOCÊ PRECISA VER ISSO!

{{nome}} com um preço de cair o queixo!

💰 Apenas: {{preco}} ✨ Uma oportunidade que vale a pena aproveitar! 🚚 {{frete}} · 📦 {{entrega}}

👉 Confira agora: {{link}}`,
  },
  {
    name: "PREÇO ABSURDO",
    content: `💥 QUE PREÇO É ESSE?!

🔥 {{nome}} por apenas {{preco}}!

🤩 {{desconto}}! 📦 {{entrega}} · 🚚 {{frete}}

⚠️ Aproveite enquanto está disponível!

👇 GARANTA O SEU 👉 {{link}}`,
    contentNoDiscount: `💥 QUE PREÇO É ESSE?!

🔥 {{nome}} por apenas {{preco}}!

🤩 Achadinho que merece sua atenção! 📦 {{entrega}} · 🚚 {{frete}}

⚠️ Aproveite enquanto está disponível!

👇 GARANTA O SEU 👉 {{link}}`,
  },
] as const;

/** True when store already has the five canonical ads (by exact name). */
export function hasCanonicalAdTemplates(templates: TextTemplate[]): boolean {
  if (templates.length < AD_TEMPLATE_DEFS.length) return false;
  const names = new Set(templates.map((t) => t.name.trim()));
  return AD_TEMPLATE_DEFS.every((d) => names.has(d.name));
}

export const DEFAULT_TEMPLATE_CONTENT = AD_TEMPLATE_DEFS[0].contentNoDiscount;

export function createAdTemplates(
  idForIndex?: (index: number) => string,
): TextTemplate[] {
  return AD_TEMPLATE_DEFS.map((def, index) => ({
    id: idForIndex?.(index) ?? `tpl-ad-${index + 1}`,
    name: def.name,
    // Modelos editor shows the no-discount baseline; Gerar picks discount branch at runtime.
    content: def.contentNoDiscount,
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
