/**
 * Shared Facebook (FC) group catalog — seeded into every account.
 * Source: docs/grupos-fc.txt. Re-runs match by normalized link and
 * refresh name + category (theme) without duplicating.
 */

export type FcGroupDef = {
  name: string;
  link: string;
  /** Category shown as "Categoria" in Grupos (stored in `theme`). */
  theme: string;
};

/** Stable seed timestamp (avoids churn across deploys). */
export const FC_GROUPS_CREATED_AT = "2026-03-23T00:00:00.000Z";

/**
 * Canonical catalog from grupos_fc (query/share junk stripped).
 * 12 /groups/… + 6 /share/g/… = 18.
 */
export const FC_GROUP_DEFS: readonly FcGroupDef[] = [
  {
    name: "Somente Para Elas",
    link: "https://www.facebook.com/groups/promoela",
    theme: "Beleza Feminina",
  },
  {
    name: "Mamães de primeira viagem",
    link: "https://www.facebook.com/groups/572069607067931",
    theme: "Beleza Feminina",
  },
  {
    name: "Maquiagem para todas",
    link: "https://www.facebook.com/groups/392504605445448",
    theme: "Beleza Feminina",
  },
  {
    name: "Achadinhos das mulheres",
    link: "https://www.facebook.com/groups/3885835001543448",
    theme: "Beleza Feminina",
  },
  {
    name: "Achadinho da Shopee e Mercado livre",
    link: "https://www.facebook.com/groups/1561757468025026",
    theme: "Geral",
  },
  {
    name: "Wepink",
    link: "https://www.facebook.com/groups/1784689826261468",
    theme: "Beleza Feminina",
  },
  {
    name: "ACHEI NA SHOPEE",
    link: "https://www.facebook.com/groups/849740553304995",
    theme: "Geral",
  },
  {
    name: "ACHADOS E OFERTAS BR - SHOPEE",
    link: "https://www.facebook.com/groups/1056547333109665",
    theme: "Geral",
  },
  {
    name: "Mercado livre",
    link: "https://www.facebook.com/groups/2875826839408792",
    theme: "Geral",
  },
  {
    name: "Desapegos wepink",
    link: "https://www.facebook.com/groups/26443437675252848",
    theme: "Beleza Feminina",
  },
  {
    name: "GRUPO DE ROUPAS",
    link: "https://www.facebook.com/groups/308659827229692",
    theme: "Moda Feminina",
  },
  {
    name: "Vendas do mercado livre",
    link: "https://www.facebook.com/groups/1439081967330329",
    theme: "Geral",
  },
  {
    name: "Decoração de Natal",
    link: "https://www.facebook.com/share/g/14vYBLt9q6s",
    theme: "Natal",
  },
  {
    name: "Natal e outras festas",
    link: "https://www.facebook.com/share/g/1AAiUqxWET",
    theme: "Natal",
  },
  {
    name: "Loucos por Natal",
    link: "https://www.facebook.com/share/g/1E9AJ6j1sp",
    theme: "Natal",
  },
  {
    name: "Decoração de natal - serviços - fornecedores",
    link: "https://www.facebook.com/share/g/1AQtwotQ25",
    theme: "Natal",
  },
  {
    name: "A Magia Do Natal",
    link: "https://www.facebook.com/share/g/1HWbo55xjw",
    theme: "Natal",
  },
  {
    name: "Vendas de Enfeites de Natal",
    link: "https://www.facebook.com/share/g/1FT3pJ9hL8",
    theme: "Natal",
  },
] as const;

/**
 * Normalize FB group URLs so query params / trailing slash / host variants
 * do not create duplicates on re-seed.
 */
export function normalizeGroupLink(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("facebook.com") && !host.includes("fb.com")) {
      return raw.trim().toLowerCase();
    }
    // /groups/{slug}/… or /share/g/{id}/…
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "groups" && parts[1]) {
      return `https://www.facebook.com/groups/${decodeURIComponent(parts[1])}`.toLowerCase();
    }
    if (parts[0] === "share" && parts[1] === "g" && parts[2]) {
      return `https://www.facebook.com/share/g/${decodeURIComponent(parts[2])}`.toLowerCase();
    }
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `https://www.facebook.com${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function fcGroupCount(): number {
  return FC_GROUP_DEFS.length;
}
