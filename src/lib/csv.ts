import type {
  EasieStore,
  FacebookGroup,
  Posting,
  Product,
  ProductStatus,
  PostingStatus,
  TextTemplate,
  UserSettings,
} from "./types";
import { EMPTY_RESULTS } from "./types";
import { createAdTemplates } from "./templates";

const BACKUP_HEADER = "# easie-backup-v1";

function escapeCell(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function row(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(escapeCell).join(",");
}

/** Minimal CSV line parser (handles quoted fields). */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function boolCell(value: boolean): string {
  return value ? "1" : "0";
}

function parseBool(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function parseIntSafe(value: string | undefined, fallback = 0): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export function exportStoreToCsv(store: EasieStore): string {
  const lines: string[] = [
    BACKUP_HEADER,
    "# section:settings",
    row(["key", "value"]),
    row(["repostWindowDays", store.settings.repostWindowDays]),
    "# section:products",
    row([
      "id",
      "affiliateLink",
      "name",
      "price",
      "originalPrice",
      "freeShipping",
      "fastDelivery",
      "status",
      "queueOrder",
      "createdAt",
      "completedAt",
      "clicks",
      "sales",
      "commission",
      "category",
    ]),
  ];

  for (const p of store.products) {
    lines.push(
      row([
        p.id,
        p.affiliateLink,
        p.name,
        p.price,
        p.originalPrice ?? "",
        boolCell(p.freeShipping),
        boolCell(p.fastDelivery),
        p.status,
        p.queueOrder,
        p.createdAt,
        p.completedAt,
        p.clicks ?? 0,
        p.sales ?? 0,
        p.commission ?? "",
        p.category ?? "",
      ]),
    );
  }

  lines.push(
    "# section:groups",
    row(["id", "name", "link", "theme", "rules", "active", "createdAt"]),
  );
  for (const g of store.groups) {
    lines.push(
      row([g.id, g.name, g.link, g.theme, g.rules, boolCell(g.active), g.createdAt]),
    );
  }

  lines.push(
    "# section:templates",
    row(["id", "name", "content", "isDefault", "updatedAt", "category"]),
  );
  for (const t of store.templates) {
    lines.push(
      row([
        t.id,
        t.name,
        t.content,
        boolCell(t.isDefault),
        t.updatedAt,
        t.category ?? "",
      ]),
    );
  }

  lines.push(
    "# section:postings",
    row([
      "id",
      "productId",
      "groupId",
      "status",
      "variationText",
      "variationIndex",
      "postedAt",
      "postedHistory",
      "createdAt",
    ]),
  );
  for (const p of store.postings) {
    lines.push(
      row([
        p.id,
        p.productId,
        p.groupId,
        p.status,
        p.variationText,
        p.variationIndex,
        p.postedAt,
        JSON.stringify(p.postedHistory ?? []),
        p.createdAt,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

type Section = "settings" | "products" | "groups" | "templates" | "postings" | null;

export type CsvImportResult =
  | { ok: true; store: EasieStore }
  | { ok: false; error: string };

export function importStoreFromCsv(raw: string): CsvImportResult {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { ok: false, error: "Arquivo CSV vazio." };

  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith("# easie-backup")) {
    return {
      ok: false,
      error: "Formato inválido. Use um backup gerado pelo Easie (# easie-backup-v1).",
    };
  }

  let section: Section = null;
  let header: string[] | null = null;

  const settings: UserSettings = { repostWindowDays: 7 };
  const products: Product[] = [];
  const groups: FacebookGroup[] = [];
  const templates: TextTemplate[] = [];
  const postings: Posting[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("# section:")) {
      section = line.replace("# section:", "").trim() as Section;
      header = null;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!section) continue;

    const cells = parseCsvLine(line);
    if (!header) {
      header = cells;
      continue;
    }

    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = cells[idx] ?? "";
    });

    if (section === "settings") {
      if (obj.key === "repostWindowDays") {
        settings.repostWindowDays = Math.max(1, parseIntSafe(obj.value, 7));
      }
    } else if (section === "products") {
      products.push({
        id: obj.id,
        affiliateLink: obj.affiliateLink ?? "",
        name: obj.name ?? "",
        price: obj.price ?? "",
        originalPrice: obj.originalPrice ?? "",
        freeShipping: parseBool(obj.freeShipping),
        fastDelivery: parseBool(obj.fastDelivery),
        category: obj.category ?? "",
        status: (obj.status as ProductStatus) || "queued",
        queueOrder: parseIntSafe(obj.queueOrder),
        createdAt: obj.createdAt || new Date().toISOString(),
        completedAt: obj.completedAt || null,
        clicks: parseIntSafe(obj.clicks),
        sales: parseIntSafe(obj.sales),
        commission: obj.commission ?? "",
      });
    } else if (section === "groups") {
      groups.push({
        id: obj.id,
        name: obj.name ?? "",
        link: obj.link ?? "",
        theme: obj.theme ?? "",
        rules: obj.rules ?? "",
        active: obj.active === undefined ? true : parseBool(obj.active),
        createdAt: obj.createdAt || new Date().toISOString(),
      });
    } else if (section === "templates") {
      templates.push({
        id: obj.id,
        name: obj.name ?? "",
        content: obj.content ?? "",
        isDefault: parseBool(obj.isDefault),
        updatedAt: obj.updatedAt || new Date().toISOString(),
        category: obj.category ?? "",
      });
    } else if (section === "postings") {
      let postedHistory: string[] = [];
      if (obj.postedHistory) {
        try {
          const parsed = JSON.parse(obj.postedHistory) as unknown;
          if (Array.isArray(parsed)) {
            postedHistory = parsed.filter(
              (t): t is string => typeof t === "string" && t.length > 0,
            );
          }
        } catch {
          postedHistory = [];
        }
      }
      const status = (obj.status as PostingStatus) || "pending";
      const postedAt = obj.postedAt || null;
      if (status === "posted" && postedAt && !postedHistory.includes(postedAt)) {
        postedHistory = [...postedHistory, postedAt];
      }
      postings.push({
        id: obj.id,
        productId: obj.productId,
        groupId: obj.groupId,
        status,
        variationText: obj.variationText ?? "",
        variationIndex: parseIntSafe(obj.variationIndex),
        postedAt,
        postedHistory,
        createdAt: obj.createdAt || new Date().toISOString(),
      });
    }
  }

  const finalTemplates =
    templates.length > 0 ? templates : createAdTemplates();
  if (!finalTemplates.some((t) => t.isDefault)) {
    finalTemplates[0] = { ...finalTemplates[0], isDefault: true };
  }

  return {
    ok: true,
    store: {
      products: products.map((p) => ({
        ...EMPTY_RESULTS,
        ...p,
        clicks: p.clicks ?? 0,
        sales: p.sales ?? 0,
        commission: p.commission ?? "",
      })),
      lastProduct: null,
      templates: finalTemplates,
      variations: [],
      groups,
      postings,
      settings,
      trendingTakenIds: [],
      trendingHiddenIds: [],
    },
  };
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
