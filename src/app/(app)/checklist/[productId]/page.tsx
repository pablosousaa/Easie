import { Suspense } from "react";
import { ChecklistApp } from "@/components/ChecklistApp";

export const instant = false;

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return (
    <Suspense
      fallback={
        <div className="page">
          <div className="surface empty">Carregando checklist…</div>
        </div>
      }
    >
      <ChecklistApp productId={productId} />
    </Suspense>
  );
}
