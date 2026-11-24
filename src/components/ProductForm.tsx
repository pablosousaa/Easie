"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { ProductDraft } from "@/lib/types";
import { useToast } from "./ToastProvider";

type Errors = Partial<Record<"affiliateLink" | "name" | "price", string>>;

type Props = {
  initial: ProductDraft;
  onGenerate: (product: ProductDraft) => void | Promise<void>;
  generating?: boolean;
};

type LookupResponse = {
  name?: string;
  price?: string;
  originalPrice?: string;
  freeShipping?: boolean;
  warning?: string | null;
  error?: string;
};

function validate(product: ProductDraft): Errors {
  const errors: Errors = {};
  if (!product.affiliateLink.trim()) {
    errors.affiliateLink = "Informe o link de afiliado";
  } else {
    try {
      const url = new URL(product.affiliateLink.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.affiliateLink = "O link precisa começar com http ou https";
      }
    } catch {
      errors.affiliateLink = "Link inválido. Cole a URL completa";
    }
  }
  if (!product.name.trim()) errors.name = "Informe o nome do produto";
  if (!product.price.trim()) errors.price = "Informe o preço";
  return errors;
}

function looksLikeMlAffiliateLink(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "meli.la" ||
      host.endsWith("mercadolivre.com") ||
      host.endsWith("mercadolivre.com.br") ||
      host.endsWith("mercadolibre.com")
    );
  } catch {
    return false;
  }
}

export function ProductForm({ initial, onGenerate, generating = false }: Props) {
  const { showToast } = useToast();
  const [product, setProduct] = useState<ProductDraft>({
    ...initial,
    originalPrice: initial.originalPrice ?? "",
    category: initial.category ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [lookingUp, setLookingUp] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(initial.name.trim() || initial.price.trim()),
  );
  const lookupInFlight = useRef(false);
  const busy = lookingUp || generating;
  const hasLink = Boolean(product.affiliateLink.trim());

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

  async function runAutofill(linkOverride?: string) {
    const link = (linkOverride ?? product.affiliateLink).trim();
    if (!link) {
      setErrors((e) => ({ ...e, affiliateLink: "Cole o link antes de preencher" }));
      return;
    }
    if (lookupInFlight.current) return;
    lookupInFlight.current = true;
    setLookingUp(true);
    try {
      const res = await fetch("/api/ml/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = (await res.json()) as LookupResponse;
      if (!res.ok) {
        showToast(data.error || "Não foi possível preencher", "error");
        setDetailsOpen(true);
        return;
      }

      const nextName = data.name?.trim() || "";
      const nextPrice = data.price?.trim() || "";
      const nextOriginal =
        data.originalPrice !== undefined ? data.originalPrice.trim() : undefined;

      setProduct((prev) => ({
        ...prev,
        affiliateLink: link,
        name: nextName || prev.name,
        price: nextPrice || prev.price,
        originalPrice:
          nextOriginal !== undefined ? nextOriginal : prev.originalPrice,
        freeShipping: data.freeShipping ?? prev.freeShipping,
      }));
      setDetailsOpen(true);

      if (data.warning) {
        showToast(data.warning, nextPrice ? "success" : "error");
      } else if (nextName && nextPrice) {
        showToast(
          nextOriginal ? "Nome e preços preenchidos" : "Nome e preço preenchidos",
        );
      } else if (nextName) {
        showToast("Nome ok — informe o preço", "error");
      } else {
        showToast("Complete os campos manualmente", "error");
      }
    } catch {
      showToast("Falha ao consultar o link", "error");
      setDetailsOpen(true);
    } finally {
      lookupInFlight.current = false;
      setLookingUp(false);
    }
  }

  function handleLinkPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted || !looksLikeMlAffiliateLink(pasted)) return;
    window.setTimeout(() => {
      update("affiliateLink", pasted);
      void runAutofill(pasted);
    }, 0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(product);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setDetailsOpen(true);
      return;
    }
    void onGenerate(product);
  }

  return (
    <form className="surface product-form" onSubmit={handleSubmit} noValidate>
      <div className="field field--hero">
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
          placeholder="Cole o link do Mercado Livre"
          value={product.affiliateLink}
          onChange={(e) => update("affiliateLink", e.target.value)}
          onPaste={handleLinkPaste}
          aria-invalid={Boolean(errors.affiliateLink)}
          aria-describedby={errors.affiliateLink ? "err-link" : "hint-autofill"}
        />
        {errors.affiliateLink ? (
          <p id="err-link" className="field__error">
            {errors.affiliateLink}
          </p>
        ) : (
          <p id="hint-autofill" className="helper">
            Cole o link → Preencher (nome, preço e % OFF)
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block field-action"
          onClick={() => void runAutofill()}
          disabled={busy || !hasLink}
        >
          {lookingUp ? (
            <Loader2 size={16} strokeWidth={1.5} className="spin" aria-hidden />
          ) : (
            <Wand2 size={16} strokeWidth={1.5} aria-hidden />
          )}
          {lookingUp ? "Buscando…" : "Preencher"}
        </button>
      </div>

      <button
        type="button"
        className="product-form__toggle"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? (
          <ChevronUp size={16} strokeWidth={1.5} aria-hidden />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden />
        )}
        {detailsOpen ? "Ocultar detalhes" : "Nome, preço e benefícios"}
        {!detailsOpen && (product.name || product.price) ? (
          <span className="product-form__toggle-meta">
            {[product.name, product.price].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </button>

      {detailsOpen ? (
        <div className="product-form__details">
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

          <div className="field-row">
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
              <label className="label" htmlFor="originalPrice">
                Preço original
              </label>
              <input
                id="originalPrice"
                className="input"
                type="text"
                inputMode="decimal"
                placeholder="Opcional"
                value={product.originalPrice ?? ""}
                onChange={(e) => update("originalPrice", e.target.value)}
              />
            </div>
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
        </div>
      ) : null}

      <div className="actions">
        <button
          type="submit"
          className={`btn btn-block ${
            product.name.trim() && product.price.trim()
              ? "btn-primary"
              : "btn-secondary"
          }`}
          disabled={busy}
          aria-busy={generating}
        >
          {generating ? (
            <Loader2 size={18} strokeWidth={1.5} className="spin" aria-hidden />
          ) : (
            <Sparkles size={18} strokeWidth={2} aria-hidden />
          )}
          {generating ? "Gerando…" : "Gerar textos"}
        </button>
      </div>
    </form>
  );
}
