import type { ProductDraft, TextTemplate, TextVariation } from "./types";
import { formatPriceBRL } from "./format";
import { createId } from "./ids";
import { AD_TEMPLATE_DEFS } from "./templates";

type Vars = {
  nome: string;
  preco: string;
  link: string;
  frete: string;
  entrega: string;
};

function productVars(product: ProductDraft): Vars {
  return {
    nome: product.name.trim(),
    preco: formatPriceBRL(product.price),
    link: product.affiliateLink.trim(),
    frete: product.freeShipping ? "Frete grátis" : "",
    entrega: product.fastDelivery ? "Entrega rápida" : "",
  };
}

/** Apply {{nome}}/{{preco}}/… and bracket aliases [PRODUTO]/[PREÇO]/[LINK]. */
export function applyTemplate(template: string, vars: Vars): string {
  let out = template
    .replaceAll("{{nome}}", vars.nome)
    .replaceAll("{{preco}}", vars.preco)
    .replaceAll("{{link}}", vars.link)
    .replaceAll("{{frete}}", vars.frete)
    .replaceAll("{{entrega}}", vars.entrega)
    .replaceAll("[PRODUTO]", vars.nome)
    .replaceAll("[PREÇO]", vars.preco)
    .replaceAll("[PRECO]", vars.preco)
    .replaceAll("[LINK]", vars.link)
    .replaceAll("[FRETE]", vars.frete)
    .replaceAll("[ENTREGA]", vars.entrega);

  if (!vars.frete) out = out.replace(/\s*🚚\s*/g, " ");
  if (!vars.entrega) out = out.replace(/\s*📦\s*/g, " ");

  return out
    .replace(/\s·\s·+/g, " · ")
    .replace(/\s·\s*(?=⚠️|⏳|🔥|👇|🛒|🛍️|💥|😍|\n|$)/g, " ")
    .replace(/\s·\s(?=\n|$)/g, "")
    .replace(/^\s·\s/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Gerar variations = one filled card per ad modelo.
 * Default: the five texts (Oferta imperdível … Preço absurdo).
 * Pass saved Modelos to use/edit those instead (or in addition via store).
 */
export function generateVariations(
  product: ProductDraft,
  templates?: TextTemplate[],
): TextVariation[] {
  const vars = productVars(product);
  const sources =
    templates && templates.length > 0
      ? templates.map((t) => ({ name: t.name, content: t.content }))
      : AD_TEMPLATE_DEFS.map((d) => ({ name: d.name, content: d.content }));

  return sources.map((src) => ({
    id: createId("var"),
    text: applyTemplate(src.content, vars),
    label: src.name,
  }));
}
