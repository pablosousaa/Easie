"use client";

import { useSyncExternalStore } from "react";
import { ProductForm } from "./ProductForm";
import { VariationCard } from "./VariationCard";
import { useToast } from "./ToastProvider";
import type { Product, TextVariation } from "@/lib/types";
import { emptyProduct } from "@/lib/format";
import { generateVariations } from "@/lib/generate";
import {
  getDefaultTemplate,
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  setVariations,
  subscribeStore,
  upsertLastProduct,
} from "@/lib/storage";

export function GeneratorApp() {
  const { showToast } = useToast();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  function handleGenerate(product: Product) {
    const template = getDefaultTemplate(store.templates);
    const variations = generateVariations(product, template.content, 4);
    replaceStore(setVariations(upsertLastProduct(store, product), variations));
    showToast("4 variações geradas. Edite e copie.");
    requestAnimationFrame(() => {
      document.getElementById("variacoes")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function handleVariationChange(id: string, text: string) {
    const variations: TextVariation[] = store.variations.map((v) =>
      v.id === id ? { ...v, text } : v,
    );
    replaceStore(setVariations(store, variations));
  }

  const initial = store.lastProduct ?? emptyProduct();

  return (
    <div className="page">
      <header>
        <p className="brand">
          Easie<span>.</span>
        </p>
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
        <h2 id="variacoes-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
          Textos gerados
        </h2>
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
