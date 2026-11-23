/** Normalize login username: lowercase, trim, basic charset. */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,31}$/.test(username);
}

/** Derive a username candidate from a legacy email (local-part). */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  let base = normalizeUsername(local);
  if (base.length < 2) base = `user${base}`;
  if (!/^[a-z0-9]/.test(base)) base = `u${base}`;
  return base.slice(0, 32);
}
