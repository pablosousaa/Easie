import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadUserStore, replaceUserStore } from "@/lib/user-data";

const storeSchema = z.object({
  products: z.array(z.any()),
  lastProduct: z.any().nullable(),
  templates: z.array(z.any()),
  variations: z.array(z.any()),
  groups: z.array(z.any()),
  postings: z.array(z.any()),
  settings: z.object({
    repostWindowDays: z.number().int().positive(),
  }),
  trendingTakenIds: z.array(z.string()).optional().default([]),
  trendingHiddenIds: z.array(z.string()).optional().default([]),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const store = await loadUserStore(user.id);
  return NextResponse.json({ store });
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = storeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await replaceUserStore(user.id, {
    products: parsed.data.products,
    lastProduct: parsed.data.lastProduct,
    templates: parsed.data.templates,
    variations: parsed.data.variations,
    groups: parsed.data.groups,
    postings: parsed.data.postings,
    settings: parsed.data.settings,
    trendingTakenIds: parsed.data.trendingTakenIds,
    trendingHiddenIds: parsed.data.trendingHiddenIds,
  });

  return NextResponse.json({ store: await loadUserStore(user.id) });
}
