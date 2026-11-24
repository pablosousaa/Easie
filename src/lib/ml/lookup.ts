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

function accessToken(): string | null {
  return (
    process.env.ML_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim() ||
    null
  );
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

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

async function fetchItem(id: string): Promise<LinkLookupResult | null> {
  const headers: HeadersInit = { Accept: "application/json" };
  const token = accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

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
      warning: null,
      permalink: item.permalink ?? null,
    };
  } catch {
    return null;
  }
}

async function resolveShortLink(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "EasieBot/1.0" },
      next: { revalidate: 0 },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

async function scrapeOg(url: string): Promise<LinkLookupResult | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EasieBot/1.0", Accept: "text/html" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title =
      html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
      html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1];
    const priceRaw =
      html.match(/property="product:price:amount"\s+content="([^"]+)"/i)?.[1] ||
      html.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1];
    const originalRaw =
      html.match(/"original_price"\s*:\s*"?([\d.]+)"?/i)?.[1] ||
      html.match(/"was_price"\s*:\s*"?([\d.]+)"?/i)?.[1] ||
      html.match(/"list_price"\s*:\s*"?([\d.]+)"?/i)?.[1];
    if (!title) return null;
    const decoded = title
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    let price = "";
    let priceNum: number | null = null;
    if (priceRaw) {
      const num = Number.parseFloat(priceRaw.replace(",", "."));
      if (Number.isFinite(num)) {
        price = formatPrice(num);
        priceNum = num;
      }
    }
    let originalPrice = "";
    if (originalRaw) {
      const orig = Number.parseFloat(originalRaw.replace(",", "."));
      if (Number.isFinite(orig) && priceNum != null && orig > priceNum) {
        originalPrice = formatPrice(orig);
      }
    }
    return {
      name: decoded,
      price,
      originalPrice,
      freeShipping: /frete gr[aá]tis/i.test(html),
      category: guessCategoryFromTitle(decoded),
      source: "html",
      warning: "Preenchido a partir da página do anúncio. Confira o preço.",
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

  // Follow short /sec/ redirects when possible
  if (/mercadolivre\.com\/sec\//i.test(url) || /meli\.la\//i.test(url)) {
    url = await resolveShortLink(url);
  }

  let id = extractMlId(url);
  if (!id && url !== rawUrl.trim()) id = extractMlId(url);

  if (id) {
    const fromApi = await fetchItem(id);
    if (fromApi) return fromApi;
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
        "Só foi possível inferir o nome pelo link. Confira o preço no anúncio (API ML indisponível).",
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
