"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import type { ProductDraft } from "@/lib/types";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { useToast } from "./ToastProvider";

type Errors = Partial<Record<"affiliateLink" | "name" | "price", string>>;

type Props = {
  initial: ProductDraft;
  onGenerate: (product: ProductDraft) => void;
};

function validate(product: ProductDraft): Errors {
  const errors: Errors = {};
  if (!product.affiliateLink.trim()) {
    errors.affiliateLink = "Informe o link de afiliado.";
  } else {
    try {
      const url = new URL(product.affiliateLink.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.affiliateLink = "O link precisa começar com http ou https.";
      }
    } catch {
      errors.affiliateLink = "Link inválido. Cole a URL completa.";
    }
  }
  if (!product.name.trim()) errors.name = "Informe o nome do produto.";
  if (!product.price.trim()) errors.price = "Informe o preço.";
  return errors;
}

export function ProductForm({ initial, onGenerate }: Props) {
  const { showToast } = useToast();
  const [product, setProduct] = useState<ProductDraft>({
    ...initial,
    category: initial.category ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [lookingUp, setLookingUp] = useState(false);

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setProduct((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof Errors];
        return next;
      });
    }
  }

  async function handleAutofill() {
    const link = product.affiliateLink.trim();
    if (!link) {
      setErrors((e) => ({ ...e, affiliateLink: "Cole o link antes de preencher." }));
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch("/api/ml/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = (await res.json()) as {
        name?: string;
        price?: string;
        freeShipping?: boolean;
        category?: string;
        warning?: string | null;
        error?: string;
      };
      if (!res.ok) {
        showToast(data.error || "Não foi possível preencher.", "error");
        return;
      }
      setProduct((prev) => ({
        ...prev,
        name: data.name?.trim() || prev.name,
        price: data.price?.trim() || prev.price,
        freeShipping: data.freeShipping ?? prev.freeShipping,
        category:
          data.category !== undefined && data.category !== ""
            ? data.category
            : prev.category,
      }));
      if (data.warning) showToast(data.warning);
      else if (data.name) showToast("Campos preenchidos a partir do link.");
      else showToast("Não deu para preencher. Complete manualmente.", "error");
    } catch {
      showToast("Falha ao consultar o link.", "error");
    } finally {
      setLookingUp(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(product);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onGenerate(product);
  }

  return (
    <form className="surface" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="label" htmlFor="affiliateLink">
          Link de afiliado
          <span className="label__required" aria-hidden>
            *
          </span>
        </label>
        <input
          id="affiliateLink"
          className={`input${errors.affiliateLink ? " input--error" : ""}`}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://mercadolivre.com/sec/..."
          value={product.affiliateLink}
          onChange={(e) => update("affiliateLink", e.target.value)}
          aria-invalid={Boolean(errors.affiliateLink)}
          aria-describedby={errors.affiliateLink ? "err-link" : "hint-autofill"}
        />
        {errors.affiliateLink ? (
          <p id="err-link" className="field__error">
            {errors.affiliateLink}
          </p>
        ) : (
          <p id="hint-autofill" className="helper">
            Cole o link e toque em preencher para tentar nome e preço (RF05).
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 8 }}
          onClick={() => void handleAutofill()}
          disabled={lookingUp}
        >
          {lookingUp ? (
            <Loader2 size={16} strokeWidth={1.5} className="spin" aria-hidden />
          ) : (
            <Wand2 size={16} strokeWidth={1.5} aria-hidden />
          )}
          {lookingUp ? "Buscando…" : "Preencher a partir do link"}
        </button>
      </div>

      <div className="field">
        <label className="label" htmlFor="name">
          Nome do produto
          <span className="label__required" aria-hidden>
            *
          </span>
        </label>
        <input
          id="name"
          className={`input${errors.name ? " input--error" : ""}`}
          type="text"
          autoComplete="off"
          placeholder="Ex.: Cascata Natal 400 Leds"
          value={product.name}
          onChange={(e) => update("name", e.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "err-name" : undefined}
        />
        {errors.name ? (
          <p id="err-name" className="field__error">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="price">
          Preço
          <span className="label__required" aria-hidden>
            *
          </span>
        </label>
        <input
          id="price"
          className={`input${errors.price ? " input--error" : ""}`}
          type="text"
          inputMode="decimal"
          placeholder="72,90"
          value={product.price}
          onChange={(e) => update("price", e.target.value)}
          aria-invalid={Boolean(errors.price)}
          aria-describedby={errors.price ? "err-price" : undefined}
        />
        {errors.price ? (
          <p id="err-price" className="field__error">
            {errors.price}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="category">
          Categoria
        </label>
        <select
          id="category"
          className="input"
          value={product.category ?? ""}
          onChange={(e) => update("category", e.target.value)}
        >
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.id || "geral"} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="helper">Usada para escolher o modelo de texto (RF12).</p>
      </div>

      <div className="toggle-row" role="group" aria-label="Benefícios do produto">
        <label className="toggle">
          <input
            type="checkbox"
            checked={product.freeShipping}
            onChange={(e) => update("freeShipping", e.target.checked)}
          />
          <span className="toggle-control" aria-hidden />
          <span className="toggle-text">Frete grátis</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={product.fastDelivery}
            onChange={(e) => update("fastDelivery", e.target.checked)}
          />
          <span className="toggle-control" aria-hidden />
          <span className="toggle-text">Entrega rápida</span>
        </label>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-primary btn-block">
          <Sparkles size={18} strokeWidth={2} aria-hidden />
          Gerar textos
        </button>
      </div>
    </form>
  );
}
