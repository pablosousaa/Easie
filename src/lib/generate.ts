import type { ProductDraft, TextVariation } from "./types";
import { computeDiscountPercent, discountCallouts } from "./discount";
import { formatPriceBRL } from "./format";
import { createId } from "./ids";
import { AD_TEMPLATE_DEFS } from "./templates";

type Vars = {
  nome: string;
  preco: string;
  link: string;
  frete: string;
  entrega: string;
  desconto: string;
};

function productVars(product: ProductDraft, desconto: string): Vars {
  return {
    nome: product.name.trim(),
    preco: formatPriceBRL(product.price),
    link: product.affiliateLink.trim(),
    frete: product.freeShipping ? "Frete grátis" : "",
    entrega: product.fastDelivery ? "Entrega rápida" : "",
    desconto,
  };
}

/** Apply {{nome}}/{{preco}}/{{desconto}}/… and bracket aliases. */
export function applyTemplate(template: string, vars: Vars): string {
  let out = template
    .replaceAll("{{nome}}", vars.nome)
    .replaceAll("{{preco}}", vars.preco)
    .replaceAll("{{link}}", vars.link)
    .replaceAll("{{frete}}", vars.frete)
    .replaceAll("{{entrega}}", vars.entrega)
    .replaceAll("{{desconto}}", vars.desconto)
    .replaceAll("[PRODUTO]", vars.nome)
    .replaceAll("[PREÇO]", vars.preco)
    .replaceAll("[PRECO]", vars.preco)
    .replaceAll("[LINK]", vars.link)
    .replaceAll("[FRETE]", vars.frete)
    .replaceAll("[ENTREGA]", vars.entrega)
    .replaceAll("[DESCONTO]", vars.desconto);

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
 * Always the five ads from templates-anuncios.txt.
 * Ignores cloud/local store templates so Natal/sazonal (etc.) never override Gerar.
 * When originalPrice > price, each variation gets a distinct % OFF callout.
 */
export function generateVariations(product: ProductDraft): TextVariation[] {
  const percent = computeDiscountPercent(
    product.price,
    product.originalPrice ?? "",
  );
  const hooks = discountCallouts(product.name, percent);
  const hasDiscount = percent != null;

  return AD_TEMPLATE_DEFS.map((src, index) => {
    const template = hasDiscount ? src.content : src.contentNoDiscount;
    const vars = productVars(product, hooks[index] ?? "");
    return {
      id: createId("var"),
      text: applyTemplate(template, vars),
      label: src.name,
    };
  });
}
