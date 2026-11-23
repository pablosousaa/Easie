/**
 * Shared Facebook (FC) group catalog — seeded into every account.
 * Source: docs/grupos-fc.txt (Project store). Re-runs match by normalized link.
 */

export type FcGroupDef = {
  name: string;
  link: string;
  theme: string;
};

/** Stable seed timestamp (avoids churn across deploys). */
export const FC_GROUPS_CREATED_AT = "2026-03-23T00:00:00.000Z";

/**
 * Canonical links from grupos_fc (query/share junk stripped).
 * 12 /groups/… + 6 /share/g/… = 18.
 */
export const FC_GROUP_DEFS: readonly FcGroupDef[] = [
  {
    name: "promoela",
    link: "https://www.facebook.com/groups/promoela",
    theme: "FC",
  },
  {
    name: "572069607067931",
    link: "https://www.facebook.com/groups/572069607067931",
    theme: "FC",
  },
  {
    name: "392504605445448",
    link: "https://www.facebook.com/groups/392504605445448",
    theme: "FC",
  },
  {
    name: "3885835001543448",
    link: "https://www.facebook.com/groups/3885835001543448",
    theme: "FC",
  },
  {
    name: "1561757468025026",
    link: "https://www.facebook.com/groups/1561757468025026",
    theme: "FC",
  },
  {
    name: "1784689826261468",
    link: "https://www.facebook.com/groups/1784689826261468",
    theme: "FC",
  },
  {
    name: "849740553304995",
    link: "https://www.facebook.com/groups/849740553304995",
    theme: "FC",
  },
  {
    name: "1056547333109665",
    link: "https://www.facebook.com/groups/1056547333109665",
    theme: "FC",
  },
  {
    name: "2875826839408792",
    link: "https://www.facebook.com/groups/2875826839408792",
    theme: "FC",
  },
  {
    name: "26443437675252848",
    link: "https://www.facebook.com/groups/26443437675252848",
    theme: "FC",
  },
  {
    name: "308659827229692",
    link: "https://www.facebook.com/groups/308659827229692",
    theme: "FC",
  },
  {
    name: "1439081967330329",
    link: "https://www.facebook.com/groups/1439081967330329",
    theme: "FC",
  },
  {
    name: "14vYBLt9q6s",
    link: "https://www.facebook.com/share/g/14vYBLt9q6s",
    theme: "FC",
  },
  {
    name: "1AAiUqxWET",
    link: "https://www.facebook.com/share/g/1AAiUqxWET",
    theme: "FC",
  },
  {
    name: "1E9AJ6j1sp",
    link: "https://www.facebook.com/share/g/1E9AJ6j1sp",
    theme: "FC",
  },
  {
    name: "1AQtwotQ25",
    link: "https://www.facebook.com/share/g/1AQtwotQ25",
    theme: "FC",
  },
  {
    name: "1HWbo55xjw",
    link: "https://www.facebook.com/share/g/1HWbo55xjw",
    theme: "FC",
  },
  {
    name: "1FT3pJ9hL8",
    link: "https://www.facebook.com/share/g/1FT3pJ9hL8",
    theme: "FC",
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
