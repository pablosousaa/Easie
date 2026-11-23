"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ListOrdered } from "lucide-react";
import { ProductForm } from "./ProductForm";
import { VariationCard } from "./VariationCard";
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
import { pickTemplateForCategory } from "@/lib/templates";

export function GeneratorApp() {
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  async function handleGenerate(draft: ProductDraft) {
    const template = pickTemplateForCategory(store.templates, draft.category);
    const variations = generateVariations(draft, template.content, 4);

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
    showToast("Textos gerados. Produto na fila — abra o checklist.");
    requestAnimationFrame(() => {
      document.getElementById("variacoes")?.scrollIntoView({ behavior: "smooth" });
    });
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

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Gerador de posts</h1>
        <p className="page-sub">
          Cadastre o produto, gere variações e copie com um toque — pronto para colar no
          Facebook.
        </p>
      </header>

      <section className="section" aria-labelledby="produto-heading">
        <h2 id="produto-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
          Produto
        </h2>
        <ProductForm
          key={`${initial.name}|${initial.affiliateLink}|${initial.price}`}
          initial={initial}
          onGenerate={handleGenerate}
        />
      </section>

      <section className="section" id="variacoes" aria-labelledby="variacoes-heading">
        <div className="section-head">
          <h2 id="variacoes-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
            Textos gerados
          </h2>
          {latestActive ? (
            <Link
              href={`/checklist/${latestActive.id}`}
              className="btn btn-secondary btn-sm"
            >
              <ListOrdered size={16} aria-hidden />
              Checklist
            </Link>
          ) : null}
        </div>
        {store.variations.length === 0 ? (
          <div className="surface empty">
            Preencha o produto e toque em <strong>Gerar textos</strong> para ver 3 a 5
            variações aqui.
          </div>
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
