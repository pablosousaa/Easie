import { NextResponse } from "next/server";
import { lookupFromAffiliateLink } from "@/lib/ml/lookup";

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Informe o link." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const result = await lookupFromAffiliateLink(url);
  return NextResponse.json(result);
}
