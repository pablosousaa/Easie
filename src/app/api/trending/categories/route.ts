import { NextResponse } from "next/server";
import { getTrendingList, updateCategoryEnabled } from "@/lib/trending";

export async function GET() {
  const data = await getTrendingList();
  return NextResponse.json({ categories: data.categories });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      mlCategoryId?: string;
      enabled?: boolean;
    };
    if (!body.mlCategoryId || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Informe mlCategoryId e enabled." },
        { status: 400 },
      );
    }
    updateCategoryEnabled(body.mlCategoryId, body.enabled);
    const data = await getTrendingList({ forceRefresh: true });
    return NextResponse.json({
      categories: data.categories,
      refreshed: true,
      warning: data.warning,
    });
  } catch (err) {
    console.error("[trending/categories]", err);
    return NextResponse.json(
      { error: "Não foi possível atualizar categorias." },
      { status: 500 },
    );
  }
}
