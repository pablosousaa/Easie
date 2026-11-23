import type { FacebookGroup } from "./types";
import { createId, nowIso } from "./ids";

export type ImportedGroupDraft = {
  name: string;
  link: string;
  theme: string;
  rules: string;
};

export type GroupsImportResult =
  | { ok: true; groups: ImportedGroupDraft[]; skipped: number }
  | { ok: false; error: string };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === "," || ch === ";" || ch === "\t") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    if (ch === "|" && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function nameFromUrl(link: string): string {
  try {
    const u = new URL(link);
    const last = u.pathname.split("/").filter(Boolean).pop() || "Grupo";
    return decodeURIComponent(last).replace(/[-_]/g, " ").slice(0, 80) || "Grupo importado";
  } catch {
    return "Grupo importado";
  }
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/**
 * Accepts:
 * - CSV/TSV with headers name,link,theme,rules (pt aliases: nome, tema, regras)
 * - Pipe lines: Nome | https://... | tema | regras
 * - One Facebook group URL per line
 * - name - https://...
 */
export function parseGroupsImport(raw: string): GroupsImportResult {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { ok: false, error: "Cole texto ou CSV com os grupos." };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) {
    return { ok: false, error: "Nenhuma linha válida encontrada." };
  }

  const drafts: ImportedGroupDraft[] = [];
  let skipped = 0;

  const firstCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const headerMap: Partial<Record<"name" | "link" | "theme" | "rules", number>> = {};
  const hasHeader =
    firstCells.some((c) => ["nome", "name", "grupo"].includes(c)) &&
    firstCells.some((c) => ["link", "url", "endereco"].includes(c));

  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (["nome", "name", "grupo"].includes(c)) headerMap.name = i;
      if (["link", "url", "endereco"].includes(c)) headerMap.link = i;
      if (["tema", "theme", "categoria"].includes(c)) headerMap.theme = i;
      if (["regras", "rules", "regra"].includes(c)) headerMap.rules = i;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    let name = "";
    let link = "";
    let theme = "";
    let rules = "";

    if (hasHeader) {
      const cells = splitCsvLine(line);
      name = headerMap.name != null ? cells[headerMap.name] ?? "" : "";
      link = headerMap.link != null ? cells[headerMap.link] ?? "" : "";
      theme = headerMap.theme != null ? cells[headerMap.theme] ?? "" : "";
      rules = headerMap.rules != null ? cells[headerMap.rules] ?? "" : "";
    } else if (looksLikeUrl(line)) {
      link = line;
      name = nameFromUrl(line);
    } else if (line.includes("|")) {
      const cells = splitCsvLine(line);
      name = cells[0] ?? "";
      link = cells[1] ?? "";
      theme = cells[2] ?? "";
      rules = cells[3] ?? "";
    } else if (/\s[-–—]\shttps?:\/\//i.test(line)) {
      const m = line.match(/^(.*?)\s[-–—]\s(https?:\/\/\S+)/i);
      name = m?.[1]?.trim() ?? "";
      link = m?.[2]?.trim() ?? "";
    } else {
      const cells = splitCsvLine(line);
      if (cells.length >= 2 && looksLikeUrl(cells[1])) {
        name = cells[0];
        link = cells[1];
        theme = cells[2] ?? "";
        rules = cells[3] ?? "";
      } else if (cells.length >= 2 && looksLikeUrl(cells[0])) {
        link = cells[0];
        name = cells[1] || nameFromUrl(cells[0]);
      } else {
        skipped++;
        continue;
      }
    }

    link = link.trim();
    name = name.trim();
    if (!looksLikeUrl(link)) {
      skipped++;
      continue;
    }
    if (!name) name = nameFromUrl(link);

    drafts.push({
      name,
      link,
      theme: theme.trim(),
      rules: rules.trim(),
    });
  }

  if (drafts.length === 0) {
    return {
      ok: false,
      error:
        "Nenhum grupo válido. Use CSV (nome,link,tema,regras), linhas com | ou um link por linha.",
    };
  }

  return { ok: true, groups: drafts, skipped };
}

export function draftsToGroups(drafts: ImportedGroupDraft[]): FacebookGroup[] {
  const now = nowIso();
  return drafts.map((d) => ({
    id: createId("grp"),
    name: d.name,
    link: d.link,
    theme: d.theme,
    rules: d.rules,
    active: true,
    createdAt: now,
  }));
}
