"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, ListOrdered, Sparkles } from "lucide-react";
import { ProductForm } from "./ProductForm";
import { VariationCard } from "./VariationCard";
import { EmptyState } from "./EmptyState";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import type { Product, ProductDraft, TextVariation } from "@/lib/types";
import { EMPTY_RESULTS } from "@/lib/types";
import { emptyProduct } from "@/lib/format";
import { generateVariations } from "@/lib/generate";
import { createId, nowIso } from "@/lib/ids";
import { ensureChecklist } from "@/lib/checklist";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  setVariations,
  subscribeStore,
  upsertLastProduct,
} from "@/lib/storage";
export function GeneratorApp() {
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
  const [generating, setGenerating] = useState(false);
  const [justGeneratedId, setJustGeneratedId] = useState<string | null>(null);

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  async function handleGenerate(draft: ProductDraft) {
    setGenerating(true);
    try {
      // Always the five ads — never cloud/local store templates
      const variations = generateVariations(draft);

      const product: Product = {
        id: createId("prd"),
        ...draft,
        ...EMPTY_RESULTS,
        status: "queued",
        queueOrder: store.products.length,
        createdAt: nowIso(),
        completedAt: null,
      };

      let next = setVariations(upsertLastProduct(store, draft), variations);
      next = {
        ...next,
        products: [...next.products, product],
      };
      next = ensureChecklist(next, product, variations);
      next = {
        ...next,
        products: next.products.map((p) =>
          p.id === product.id ? { ...p, status: "active" as const } : p,
        ),
      };

      await persist(next);
      setJustGeneratedId(product.id);
      showToast("Textos gerados — abra o checklist");
      requestAnimationFrame(() => {
        document.getElementById("variacoes")?.scrollIntoView({ behavior: "smooth" });
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleVariationChange(id: string, text: string) {
    const variations: TextVariation[] = store.variations.map((v) =>
      v.id === id ? { ...v, text } : v,
    );
    await persist(setVariations(store, variations));
  }

  const initial = store.lastProduct ?? emptyProduct();
  const latestActive = [...store.products]
    .reverse()
    .find((p) => p.status === "active" || p.status === "queued");
  const checklistId = justGeneratedId ?? latestActive?.id ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Gerar</h1>
        <p className="page-sub">
          Cadastre o produto e gere as 5 variações (OFERTA IMPERDÍVEL …)
        </p>
      </header>

      <section className="section" aria-labelledby="produto-heading">
        <h2 id="produto-heading" className="section-title">
          Produto
        </h2>
        <ProductForm
          key={`${initial.name}|${initial.affiliateLink}|${initial.price}`}
          initial={initial}
          onGenerate={handleGenerate}
          generating={generating}
        />
      </section>

      <section className="section" id="variacoes" aria-labelledby="variacoes-heading">
        <div className="section-head">
          <h2 id="variacoes-heading" className="section-title">
            Textos gerados
          </h2>
          {checklistId && store.variations.length > 0 ? (
            <Link
              href={`/checklist/${checklistId}`}
              className="btn btn-ghost btn-sm"
            >
              <ListOrdered size={16} aria-hidden />
              Checklist
            </Link>
          ) : null}
        </div>

        {checklistId && store.variations.length > 0 ? (
          <div className="callout callout--next">
            <div className="callout__body">
              <p className="callout__title">Próximo passo</p>
              <p className="helper">
                Abra o checklist e use Copiar e abrir em cada grupo
              </p>
            </div>
            <Link
              href={`/checklist/${checklistId}`}
              className="btn btn-primary"
            >
              Abrir checklist
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        ) : null}

        {store.variations.length === 0 ? (
          <EmptyState title="Nenhum texto ainda">
            <p className="helper">
              Preencha o produto e toque em{" "}
              <strong className="empty-state__em">Gerar textos</strong>
            </p>
            <p className="helper" style={{ marginTop: 8 }}>
              <Sparkles size={14} className="inline-icon" aria-hidden />{" "}
              As 5 variações (OFERTA IMPERDÍVEL, ACHADINHO DO DIA… ) aparecem aqui
            </p>
          </EmptyState>
        ) : (
          <div className="variation-list">
            {store.variations.map((variation, index) => (
              <VariationCard
                key={variation.id}
                index={index}
                variation={variation}
                onChange={handleVariationChange}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
