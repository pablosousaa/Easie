"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  ExternalLink,
  EyeOff,
  Filter,
  Package,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import type { TrendingListResponse } from "@/lib/ml/types";
import type { ProductDraft } from "@/lib/types";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
  upsertLastProduct,
} from "@/lib/storage";

type Item = TrendingListResponse["items"][number];

function formatMoney(price: number, currency: string) {
  try {
    return price.toLocaleString("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    });
  } catch {
    return `R$ ${price.toFixed(2)}`;
  }
}

function formatUpdated(iso: string | null) {
  if (!iso) return "ainda não atualizada";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TrendingApp() {
  const router = useRouter();
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const [data, setData] = useState<TrendingListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [claimItem, setClaimItem] = useState<Item | null>(null);
  const [affiliateLink, setAffiliateLink] = useState("");
  const [confirmPrice, setConfirmPrice] = useState("");
  const [claimError, setClaimError] = useState("");

  const load = useCallback(async (opts?: { refresh?: boolean; cat?: string; q?: string }) => {
    const params = new URLSearchParams();
    const cat = opts?.cat ?? category;
    const q = opts?.q ?? query;
    if (cat) params.set("category", cat);
    if (q.trim()) params.set("q", q.trim());
    if (opts?.refresh) params.set("refresh", "1");
    const res = await fetch(`/api/trending?${params.toString()}`);
    if (!res.ok) throw new Error("fail");
    return (await res.json()) as TrendingListResponse;
  }, [category, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await load();
        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) showToast("Não foi possível carregar a lista.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, showToast]);

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  const visibleItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => {
      const hidden = store.trendingHiddenIds.includes(item.mlItemId);
      if (hidden && !showHidden) return false;
      return true;
    });
  }, [data, store.trendingHiddenIds, showHidden]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const next = await load({ refresh: true });
      setData(next);
      showToast(
        next.source === "mock"
          ? "Lista atualizada (modo demo)."
          : "Lista atualizada com dados do Mercado Livre.",
      );
    } catch {
      showToast("Falha ao atualizar. Mantendo a última lista salva.", "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleHide(mlItemId: string) {
    const hidden = store.trendingHiddenIds.includes(mlItemId);
    const trendingHiddenIds = hidden
      ? store.trendingHiddenIds.filter((id) => id !== mlItemId)
      : [...store.trendingHiddenIds, mlItemId];
    await persist({ ...store, trendingHiddenIds });
  }

  async function toggleCategory(mlCategoryId: string, enabled: boolean) {
    const res = await fetch("/api/trending/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlCategoryId, enabled }),
    });
    if (!res.ok) {
      showToast("Não foi possível salvar a categoria.", "error");
      return;
    }
    const body = (await res.json()) as {
      categories: TrendingListResponse["categories"];
      warning?: string;
    };
    setData((prev) =>
      prev
        ? { ...prev, categories: body.categories, warning: body.warning ?? prev.warning }
        : prev,
    );
    const next = await load({ refresh: true });
    setData(next);
    showToast(enabled ? "Categoria incluída. Lista atualizada." : "Categoria ocultada.");
  }

  function openClaim(item: Item) {
    setClaimItem(item);
    setAffiliateLink("");
    setConfirmPrice(
      item.price.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
    setClaimError("");
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimItem) return;
    const link = affiliateLink.trim();
    if (!link) {
      setClaimError("Cole o seu link de afiliado.");
      return;
    }
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) {
        setClaimError("O link precisa começar com http ou https.");
        return;
      }
    } catch {
      setClaimError("Link inválido. Cole a URL completa.");
      return;
    }
    if (!confirmPrice.trim()) {
      setClaimError("Confirme o preço de referência.");
      return;
    }

    const draft: ProductDraft = {
      affiliateLink: link,
      name: claimItem.name,
      price: confirmPrice.trim(),
      freeShipping: claimItem.freeShipping,
      fastDelivery: false,
      category: "",
    };

    const trendingTakenIds = store.trendingTakenIds.includes(claimItem.mlItemId)
      ? store.trendingTakenIds
      : [...store.trendingTakenIds, claimItem.mlItemId];

    let next = upsertLastProduct(store, draft);
    next = { ...next, trendingTakenIds };
    await persist(next);
    showToast("Produto preenchido. Gere o texto na próxima tela.");
    setClaimItem(null);
    router.push("/gerar");
  }

  const enabledCats = data?.categories.filter((c) => c.enabled) ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Pegar produtos</h1>
        <p className="page-sub">
          Sugestões dos mais vendidos no Mercado Livre. O preço é de referência — confira
          antes de postar. O link de afiliado é o seu.
        </p>
      </header>

      {data?.warning ? (
        <p className="warn-banner" role="status">
          {data.warning}
          {data.lastUpdatedAt
            ? ` Última lista salva: ${formatUpdated(data.lastUpdatedAt)}.`
            : null}
        </p>
      ) : null}

      <section className="section surface" aria-label="Filtros">
        <div className="trending-toolbar">
          <label className="field trending-toolbar__search">
            <span className="label">
              <Search size={14} strokeWidth={1.5} aria-hidden /> Buscar
            </span>
            <input
              className="input"
              type="search"
              placeholder="Nome do produto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void load({ q: query }).then(setData).catch(() => undefined);
                }
              }}
            />
          </label>
          <label className="field">
            <span className="label">
              <Filter size={14} strokeWidth={1.5} aria-hidden /> Categoria
            </span>
            <select
              className="input"
              value={category}
              onChange={(e) => {
                const v = e.target.value;
                setCategory(v);
                void load({ cat: v }).then(setData).catch(() => undefined);
              }}
            >
              <option value="">Todas</option>
              {enabledCats.map((c) => (
                <option key={c.mlCategoryId} value={c.mlCategoryId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="trending-toolbar__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void load({ q: query, cat: category }).then(setData)}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
            {refreshing ? "Atualizando…" : "Atualizar lista"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHidden((v) => !v)}
          >
            <EyeOff size={16} strokeWidth={1.5} aria-hidden />
            {showHidden ? "Ocultar ignorados" : "Ver ignorados"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowCats((v) => !v)}
          >
            <Settings2 size={16} strokeWidth={1.5} aria-hidden />
            Categorias
          </button>
        </div>
        {data ? (
          <p className="helper" style={{ marginTop: 12 }}>
            Atualização {data.cadence === "daily" ? "diária" : "semanal"} · fonte{" "}
            {data.source === "highlights"
              ? "Highlights ML"
              : data.source === "search"
                ? "busca ML"
                : data.source === "mock"
                  ? "demo"
                  : "cache"}{" "}
            · {formatUpdated(data.lastUpdatedAt)}
          </p>
        ) : null}
      </section>

      {showCats && data ? (
        <section className="section surface" aria-labelledby="cats-heading">
          <h2 id="cats-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
            Categorias na lista
          </h2>
          <ul className="entity-list" style={{ marginTop: 16 }}>
            {data.categories.map((c) => (
              <li key={c.id} className="entity-card">
                <div className="entity-card__body">
                  <p className="entity-card__title">{c.name}</p>
                  <p className="helper">{c.mlCategoryId}</p>
                </div>
                <label className="toggle" style={{ margin: 0, minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => void toggleCategory(c.mlCategoryId, e.target.checked)}
                  />
                  <span className="toggle-control" aria-hidden />
                  <span className="toggle-text">{c.enabled ? "Ativa" : "Off"}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section" aria-live="polite">
        {loading ? (
          <p className="empty">Carregando produtos em alta…</p>
        ) : visibleItems.length === 0 ? (
          <p className="empty">Nenhum produto nesta filtragem.</p>
        ) : (
          <ul className="entity-list trending-list">
            {visibleItems.map((item) => {
              const taken = store.trendingTakenIds.includes(item.mlItemId);
              const hidden = store.trendingHiddenIds.includes(item.mlItemId);
              return (
                <li
                  key={item.id}
                  className={`entity-card entity-card--stack trending-card${hidden ? " entity-card--muted" : ""}`}
                >
                  <div className="trending-card__top">
                    <div className="trending-card__media" aria-hidden>
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt="" width={72} height={72} />
                      ) : (
                        <Package size={28} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="entity-card__body">
                      <div className="entity-card__title-row">
                        <span className="badge">#{item.rank}</span>
                        {taken ? <span className="badge badge--muted">Já peguei</span> : null}
                        <span className="badge badge--muted">{item.categoryName}</span>
                      </div>
                      <h3 className="entity-card__title">{item.name}</h3>
                      <p className="trending-card__price">
                        {formatMoney(item.price, item.currency)}
                        <span className="helper"> · referência — confira no ML</span>
                      </p>
                    </div>
                  </div>
                  <div className="trending-card__actions">
                    <a
                      className="btn btn-secondary btn-sm"
                      href={item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir no ML
                      <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
                    </a>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openClaim(item)}
                    >
                      Usar este
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void toggleHide(item.mlItemId)}
                    >
                      {hidden ? "Mostrar de novo" : "Não interessa"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {claimItem ? (
        <div className="trending-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
          <button
            type="button"
            className="trending-modal__backdrop"
            aria-label="Fechar"
            onClick={() => setClaimItem(null)}
          />
          <form className="trending-modal__panel surface" onSubmit={submitClaim}>
            <h2 id="claim-title" className="page-title" style={{ fontSize: "1.25rem" }}>
              Gerar seu link de afiliado
            </h2>
            <p className="page-sub">
              Abra o produto no Mercado Livre, copie o seu link de afiliado, cole aqui e
              confira o preço.
            </p>
            <p className="helper" style={{ marginTop: 12 }}>
              {claimItem.name}
            </p>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label" htmlFor="claim-link">
                Seu link de afiliado
                <span className="label__required" aria-hidden>
                  *
                </span>
              </label>
              <input
                id="claim-link"
                className={`input${claimError && !affiliateLink.trim() ? " input--error" : ""}`}
                type="url"
                inputMode="url"
                placeholder="https://mercadolivre.com/sec/..."
                value={affiliateLink}
                onChange={(e) => {
                  setAffiliateLink(e.target.value);
                  setClaimError("");
                }}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="claim-price">
                Preço (confira no anúncio)
                <span className="label__required" aria-hidden>
                  *
                </span>
              </label>
              <input
                id="claim-price"
                className="input"
                inputMode="decimal"
                value={confirmPrice}
                onChange={(e) => setConfirmPrice(e.target.value)}
              />
            </div>
            {claimError ? <p className="field__error">{claimError}</p> : null}
            <div className="actions">
              <a
                className="btn btn-secondary"
                href={claimItem.permalink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no ML
              </a>
              <button type="submit" className="btn btn-primary">
                Continuar para gerar texto
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8 }}
              onClick={() => setClaimItem(null)}
            >
              Cancelar
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
