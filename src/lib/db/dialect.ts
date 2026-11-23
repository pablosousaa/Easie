/** True when DATABASE_URL points at Postgres (Neon, Vercel Postgres, etc.). */
export function usePostgres(): boolean {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  return /^postgres(ql)?:\/\//i.test(url);
}

/** Convert `?` placeholders to `$1..$n` for Postgres. */
export function toPgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    i += 1;
    return `$${i}`;
  });
}
