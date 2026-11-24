export type LinkLookupResult = {
  name: string;
  price: string;
  /** List/original price when ML reports a sale; empty otherwise. */
  originalPrice: string;
  freeShipping: boolean;
  category: string;
  source: "api" | "html" | "slug" | "none";
  warning: string | null;
  permalink: string | null;
};

/** Browser-like UA — bot strings strip `previous_price` / `current_price` from social HTML. */
const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function accessToken(): string | null {
  return (
    process.env.ML_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim() ||
    null
  );
}

function fetchHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "User-Agent": FETCH_UA,
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    ...extra,
  };
}

/** Extract MLB item / product id from common Mercado Livre URL shapes. */
export function extractMlId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    // /p/MLB123 or /p/MLB-123
    const pMatch = url.pathname.match(/\/p\/(MLB[\w-]+)/i);
    if (pMatch) {
      return pMatch[1].replace(/-/g, "").toUpperCase();
    }

    // MLB-1234567890 or MLB1234567890 in path / query
    const itemMatch = url.href.match(/(MLB-?\d{6,})/i);
    if (itemMatch) return itemMatch[1].replace(/-/g, "").toUpperCase();

    // affiliate short links live under mercadolivre.com/sec — need resolve
    if (host.includes("mercadolivre") || host.includes("mercadolibre")) {
      return null;
    }
  } catch {
    const bare = trimmed.match(/(MLB-?\d{6,})/i);
    if (bare) return bare[1].replace(/-/g, "").toUpperCase();
  }
  return null;
}

/** MLB id embedded in ML CDN image URLs (common on /social/ affiliate pages). */
export function extractMlIdFromHtml(html: string): string | null {
  const fromImage =
    html.match(
      /(?:og:image|twitter:image)[^>]+content="[^"]*?(MLB\d{6,})[^"]*"/i,
    )?.[1] ||
    html.match(
      /content="[^"]*?(MLB\d{6,})[^"]*"[^>]+(?:property|name)="(?:og|twitter):image"/i,
    )?.[1] ||
    html.match(/mlstatic\.com\/[^"'\s]*?(MLB\d{6,})/i)?.[1];
  if (fromImage) return fromImage.toUpperCase();
  return null;
}

export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseLooseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * ML social / product components embed:
 * "previous_price":{"value":59.99...},"current_price":{"value":34...}
 * Prefer the first pair (main share card).
 */
export function parseEmbeddedMlPrices(html: string): {
  price: number | null;
  originalPrice: number | null;
} {
  const block = html.match(
    /"previous_price"\s*:\s*\{\s*"value"\s*:\s*([0-9.]+)[\s\S]{0,240}?"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9.]+)/i,
  );
  if (block) {
    const original = Number.parseFloat(block[1]);
    const current = Number.parseFloat(block[2]);
    return {
      price: Number.isFinite(current) ? current : null,
      originalPrice: Number.isFinite(original) ? original : null,
    };
  }

  const reverse = html.match(
    /"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9.]+)[\s\S]{0,240}?"previous_price"\s*:\s*\{\s*"value"\s*:\s*([0-9.]+)/i,
  );
  if (reverse) {
    const current = Number.parseFloat(reverse[1]);
    const original = Number.parseFloat(reverse[2]);
    return {
      price: Number.isFinite(current) ? current : null,
      originalPrice: Number.isFinite(original) ? original : null,
    };
  }

  const currentOnly = html.match(
    /"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9.]+)/i,
  );
  if (currentOnly) {
    const current = Number.parseFloat(currentOnly[1]);
    return {
      price: Number.isFinite(current) ? current : null,
      originalPrice: null,
    };
  }

  return { price: null, originalPrice: null };
}

/** Strip trailing " - R$ 34" / marketplace suffixes from share titles. */
export function cleanProductName(title: string): string {
  return title
    .replace(/\s+[|–—-]\s*R\$\s*[\d.,]+\s*$/i, "")
    .replace(/\s*[|–—-]\s*Mercado\s*Livre.*$/i, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Pull a BRL amount from titles like "… - R$ 34" or "… R$ 59,99". */
export function priceFromTitle(title: string): number | null {
  const match = title.match(/R\$\s*([\d.,]+)/i);
  if (!match) return null;
  return parseLooseNumber(match[1]);
}

function guessCategoryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/natal|led|pisca|enfeite|arvo(?:r|re)/.test(t)) return "natal";
  if (/fone|celular|tv|notebook|ssd|usb|smart/.test(t)) return "eletronicos";
  if (/sof[aá]|cadeira|mesa|cortina|tapete|organiz/.test(t)) return "casa";
  if (/creme|perfume|maquiagem|shampoo|skincare/.test(t)) return "beleza";
  if (/t[eê]nis|bola|halter|yoga|bike/.test(t)) return "esportes";
  if (/camis[ae]|vestido|cal[cç]a|bolsa|sapato/.test(t)) return "moda";
  return "";
}

function titleFromSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // often .../nome-do-produto-MLB123
    const candidate = [...parts].reverse().find((p) => /[a-z]/i.test(p) && p.length > 8);
    if (!candidate) return null;
    const cleaned = candidate
      .replace(/-?MLB-?\d+$/i, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length < 4) return null;
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

function metaContent(html: string, propertyOrName: string): string | null {
  const prop = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    html.match(
      new RegExp(
        `(?:property|name)="${prop}"\\s+content="([^"]+)"`,
        "i",
      ),
    ) ||
    html.match(
      new RegExp(
        `content="([^"]+)"\\s+(?:property|name)="${prop}"`,
        "i",
      ),
    );
  return match?.[1] ?? null;
}

async function fetchItem(id: string): Promise<LinkLookupResult | null> {
  const headers: HeadersInit = fetchHeaders({ Accept: "application/json" });
  const token = accessToken();
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      headers,
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const item = (await res.json()) as {
      title?: string;
      price?: number;
      original_price?: number | null;
      permalink?: string;
      shipping?: { free_shipping?: boolean };
    };
    if (!item.title) return null;
    const price = typeof item.price === "number" ? item.price : null;
    const original =
      typeof item.original_price === "number" ? item.original_price : null;
    const hasDiscount =
      price != null && original != null && original > price;
    return {
      name: item.title,
      price: price != null ? formatPrice(price) : "",
      originalPrice: hasDiscount ? formatPrice(original) : "",
      freeShipping: Boolean(item.shipping?.free_shipping),
      category: guessCategoryFromTitle(item.title),
      source: "api",
      warning:
        price == null
          ? "Nome preenchido, mas o preço não veio da API. Informe o preço manualmente."
          : null,
      permalink: item.permalink ?? null,
    };
  } catch {
    return null;
  }
}

async function resolveShortLink(
  url: string,
): Promise<{ url: string; html: string | null }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: fetchHeaders({ Accept: "text/html" }),
      next: { revalidate: 0 },
    });
    const finalUrl = res.url || url;
    let html: string | null = null;
    if (res.ok) {
      try {
        html = await res.text();
      } catch {
        html = null;
      }
    }
    return { url: finalUrl, html };
  } catch {
    return { url, html: null };
  }
}

function buildPriceWarning(
  name: string,
  price: string,
  originalPrice: string,
  fromHtml: boolean,
): string | null {
  if (!name && !price) {
    return "Não foi possível preencher automaticamente. Cole o nome e o preço manualmente.";
  }
  if (!price) {
    return "Nome preenchido, mas não deu para ler o preço do anúncio. Informe Preço (e Preço original, se houver) manualmente.";
  }
  if (fromHtml && !originalPrice) {
    return "Preço atual preenchido a partir do anúncio. Se houver preço riscado, confira Preço original.";
  }
  if (fromHtml) {
    return "Preenchido a partir da página do anúncio. Confira nome e preços.";
  }
  return null;
}

async function scrapeOg(url: string): Promise<LinkLookupResult | null> {
  try {
    const res = await fetch(url, {
      headers: fetchHeaders({ Accept: "text/html" }),
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = metaContent(html, "og:title");
    const twitterTitle = metaContent(html, "twitter:title");
    const rawTitle = twitterTitle || ogTitle;
    if (!rawTitle) return null;

    const name = cleanProductName(rawTitle);
    const embedded = parseEmbeddedMlPrices(html);

    let priceNum = embedded.price;
    let originalNum = embedded.originalPrice;

    if (priceNum == null) {
      const ogAmount =
        metaContent(html, "product:price:amount") ||
        html.match(/property="product:price:amount"\s+content="([^"]+)"/i)?.[1];
      if (ogAmount) priceNum = parseLooseNumber(ogAmount);
    }
    if (priceNum == null && ogTitle) {
      priceNum = priceFromTitle(ogTitle);
    }
    if (originalNum == null) {
      const originalRaw =
        html.match(/"original_price"\s*:\s*"?([\d.]+)"?/i)?.[1] ||
        html.match(/"was_price"\s*:\s*"?([\d.]+)"?/i)?.[1] ||
        html.match(/"list_price"\s*:\s*"?([\d.]+)"?/i)?.[1];
      if (originalRaw) originalNum = parseLooseNumber(originalRaw);
    }

    const hasDiscount =
      priceNum != null && originalNum != null && originalNum > priceNum;
    const price = priceNum != null ? formatPrice(priceNum) : "";
    const originalPrice = hasDiscount ? formatPrice(originalNum!) : "";

    return {
      name,
      price,
      originalPrice,
      freeShipping: /frete gr[aá]tis/i.test(html),
      category: guessCategoryFromTitle(name),
      source: "html",
      warning: buildPriceWarning(name, price, originalPrice, true),
      permalink: url,
    };
  } catch {
    return null;
  }
}

export async function lookupFromAffiliateLink(rawUrl: string): Promise<LinkLookupResult> {
  let url = rawUrl.trim();
  if (!url) {
    return {
      name: "",
      price: "",
      originalPrice: "",
      freeShipping: false,
      category: "",
      source: "none",
      warning: "Informe um link.",
      permalink: null,
    };
  }

  // Follow short /sec/ /meli.la redirects; keep HTML when present (social pages).
  let resolvedHtml: string | null = null;
  if (
    /mercadolivre\.com\/sec\//i.test(url) ||
    /meli\.la\//i.test(url) ||
    /mercadolivre\.com\.br\/social\//i.test(url)
  ) {
    const resolved = await resolveShortLink(url);
    url = resolved.url;
    resolvedHtml = resolved.html;
  }

  let id = extractMlId(url);
  if (!id && url !== rawUrl.trim()) id = extractMlId(url);

  // Social share pages often omit MLB in the URL; pull it from og:image.
  if (!id && resolvedHtml) {
    id = extractMlIdFromHtml(resolvedHtml);
  }

  if (id) {
    const fromApi = await fetchItem(id);
    if (fromApi) return fromApi;
  }

  if (resolvedHtml) {
    const ogTitle = metaContent(resolvedHtml, "og:title");
    const twitterTitle = metaContent(resolvedHtml, "twitter:title");
    const rawTitle = twitterTitle || ogTitle;
    if (rawTitle) {
      const name = cleanProductName(rawTitle);
      const embedded = parseEmbeddedMlPrices(resolvedHtml);
      let priceNum = embedded.price;
      let originalNum = embedded.originalPrice;
      if (priceNum == null && ogTitle) priceNum = priceFromTitle(ogTitle);
      const hasDiscount =
        priceNum != null && originalNum != null && originalNum > priceNum;
      const price = priceNum != null ? formatPrice(priceNum) : "";
      const originalPrice = hasDiscount ? formatPrice(originalNum!) : "";
      return {
        name,
        price,
        originalPrice,
        freeShipping: /frete gr[aá]tis/i.test(resolvedHtml),
        category: guessCategoryFromTitle(name),
        source: "html",
        warning: buildPriceWarning(name, price, originalPrice, true),
        permalink: url,
      };
    }
  }

  const fromHtml = await scrapeOg(url);
  if (fromHtml) return fromHtml;

  const slugName = titleFromSlug(url);
  if (slugName) {
    return {
      name: slugName,
      price: "",
      originalPrice: "",
      freeShipping: false,
      category: guessCategoryFromTitle(slugName),
      source: "slug",
      warning:
        "Só foi possível inferir o nome pelo link. Informe Preço e Preço original manualmente.",
      permalink: url,
    };
  }

  return {
    name: "",
    price: "",
    originalPrice: "",
    freeShipping: false,
    category: "",
    source: "none",
    warning:
      "Não foi possível preencher automaticamente. Cole o nome e o preço manualmente.",
    permalink: null,
  };
}
