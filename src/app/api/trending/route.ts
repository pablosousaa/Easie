import { NextResponse } from "next/server";
import { getTrendingList } from "@/lib/trending";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const force = url.searchParams.get("refresh") === "1";

  try {
    const data = await getTrendingList({
      categoryId,
      q,
      forceRefresh: force,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[trending]", err);
    return NextResponse.json(
      { error: "Não foi possível carregar produtos em alta." },
      { status: 500 },
    );
  }
}
