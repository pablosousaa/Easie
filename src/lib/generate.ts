import type { ProductDraft, TextVariation } from "./types";
import { formatPriceBRL } from "./format";
import { createId } from "./ids";

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

  // Drop orphan shipping markers only when that perk is off
  if (!vars.frete) out = out.replace(/\s*🚚\s*/g, " ");
  if (!vars.entrega) out = out.replace(/\s*📦\s*/g, " ");

  return out
    .replace(/\s·\s·+/g, " · ")
    // Orphan middot left when frete/entrega were cleared
    .replace(/\s·\s*(?=⚠️|⏳|🔥|👇|🛒|🛍️|💥|😍|\n|$)/g, " ")
    .replace(/\s·\s(?=\n|$)/g, "")
    .replace(/^\s·\s/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shippingLine(vars: Vars, style: "dot" | "pipe" | "lines"): string {
  const parts = [vars.frete, vars.entrega].filter(Boolean);
  if (parts.length === 0) return "";
  if (style === "lines") return parts.map((p) => `✅ ${p}`).join("\n");
  if (style === "pipe") return `✨ ${parts.join(" | ")}`;
  return `🚚 ${parts.join(" · ")}`;
}

/**
 * Builds 3–5 post variations from the product + optional base template.
 * Always keeps nome, preço and link (RN06); varies emoji, order and CTA.
 */
export function generateVariations(
  product: ProductDraft,
  baseTemplate: string,
  count = 4,
): TextVariation[] {
  const vars = productVars(product);
  const n = Math.min(5, Math.max(3, count));

  const ctas = [
    `Veja Aqui 👉 ${vars.link}`,
    `Confira agora 👇\n${vars.link}`,
    `Link da oferta 🔗 ${vars.link}`,
    `Aproveita! 👉 ${vars.link}`,
    `Clique e veja 👇\n${vars.link}`,
  ];

  const builders: Array<() => string> = [
    () => applyTemplate(baseTemplate, vars),
    () =>
      [
        `🔥 Oferta: ${vars.nome}`,
        `💰 Só ${vars.preco}`,
        shippingLine(vars, "dot"),
        ctas[1],
      ]
        .filter(Boolean)
        .join("\n"),
    () =>
      [
        `✨ ${vars.nome}`,
        shippingLine(vars, "pipe"),
        `Por apenas ${vars.preco} 💸`,
        ctas[2],
      ]
        .filter(Boolean)
        .join("\n"),
    () =>
      [
        `📦 ${vars.nome} no Mercado Livre`,
        `💵 Preço: ${vars.preco}`,
        shippingLine(vars, "lines"),
        ctas[3],
      ]
        .filter(Boolean)
        .join("\n"),
    () =>
      [
        `${vars.nome}`,
        `💰 ${vars.preco}`,
        vars.frete ? `🚚 ${vars.frete}` : "",
        vars.entrega ? `⚡ ${vars.entrega}` : "",
        ctas[4],
      ]
        .filter(Boolean)
        .join("\n"),
  ];

  return builders.slice(0, n).map((build) => ({
    id: createId("var"),
    text: build(),
  }));
}
