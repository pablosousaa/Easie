"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  ExternalLink,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
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

function sourceLabel(source: TrendingListResponse["source"]) {
  if (source === "highlights") return "Highlights ML";
  if (source === "search") return "Busca ML";
  if (source === "mock") return "Demo (mock)";
  return "Cache";
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
        if (!cancelled) showToast("Não foi possível carregar a lista", "error");
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
        next.source === "mock" ? "Lista demo atualizada" : "Lista atualizada",
      );
    } catch {
      showToast("Falha ao atualizar", "error");
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
    showToast(hidden ? "Produto visível de novo" : "Produto ocultado");
  }

  async function toggleCategory(mlCategoryId: string, enabled: boolean) {
    const res = await fetch("/api/trending/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlCategoryId, enabled }),
    });
    if (!res.ok) {
      showToast("Não foi possível salvar a categoria", "error");
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
    showToast(enabled ? "Categoria incluída" : "Categoria ocultada");
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
      setClaimError("Cole o seu link de afiliado");
      return;
    }
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) {
        setClaimError("O link precisa começar com http ou https");
        return;
      }
    } catch {
      setClaimError("Link inválido. Cole a URL completa");
      return;
    }
    if (!confirmPrice.trim()) {
      setClaimError("Confirme o preço de referência");
      return;
    }

    const draft: ProductDraft = {
      affiliateLink: link,
      name: claimItem.name,
      price: confirmPrice.trim(),
      originalPrice: "",
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
    showToast("Produto pronto em Gerar");
    setClaimItem(null);
    router.push("/gerar");
  }

  const enabledCats = data?.categories.filter((c) => c.enabled) ?? [];
  const isMock = data?.source === "mock";

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Pegar produtos</h1>
        <p className="page-sub">
          Mais vendidos no ML. Preço é referência — o link de afiliado é o seu
        </p>
      </header>

      {isMock ? (
        <p className="source-banner source-banner--mock" role="status">
          Lista demo (mock) — sem tokens ML nesta sessão. Use só como referência
        </p>
      ) : null}

      {data?.warning && !isMock ? (
        <p className="warn-banner" role="status">
          {data.warning}
          {data.lastUpdatedAt
            ? ` Última lista: ${formatUpdated(data.lastUpdatedAt)}.`
            : null}
        </p>
      ) : null}

      <section className="section" aria-label="Filtros">
        <div className="trending-filters">
          <label className="trending-filters__search">
            <span className="sr-only">Buscar</span>
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Buscar produto"
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

          {enabledCats.length > 0 ? (
            <div
              className="chip-row chip-row--filter"
              role="group"
              aria-label="Categoria"
            >
              <button
                type="button"
                className={`chip${!category ? " is-active" : ""}`}
                aria-pressed={!category}
                onClick={() => {
                  setCategory("");
                  void load({ cat: "" }).then(setData).catch(() => undefined);
                }}
              >
                Todas
              </button>
              {enabledCats.map((c) => {
                const selected = category === c.mlCategoryId;
                return (
                  <button
                    key={c.mlCategoryId}
                    type="button"
                    className={`chip${selected ? " is-active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => {
                      const next = selected ? "" : c.mlCategoryId;
                      setCategory(next);
                      void load({ cat: next }).then(setData).catch(() => undefined);
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="trending-filters__actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowHidden((v) => !v)}
            >
              <EyeOff size={16} strokeWidth={1.5} aria-hidden />
              {showHidden ? "Ocultar ignorados" : "Ignorados"}
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
            <p className="helper trending-filters__meta">
              {sourceLabel(data.source)} ·{" "}
              {data.cadence === "daily" ? "diária" : "semanal"} ·{" "}
              {formatUpdated(data.lastUpdatedAt)}
            </p>
          ) : null}
        </div>
      </section>

      {showCats && data ? (
        <section className="section surface" aria-labelledby="cats-heading">
          <h2 id="cats-heading" className="section-title">
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
          <p className="empty">Carregando produtos…</p>
        ) : visibleItems.length === 0 ? (
          <EmptyState title="Nenhum produto nesta filtragem">
            <p className="helper">Ajuste a busca ou a categoria</p>
          </EmptyState>
        ) : (
          <ul className="feed-list">
            {visibleItems.map((item) => {
              const taken = store.trendingTakenIds.includes(item.mlItemId);
              const hidden = store.trendingHiddenIds.includes(item.mlItemId);
              return (
                <li
                  key={item.id}
                  className={`feed-row${hidden ? " feed-row--muted" : ""}`}
                >
                  <div className="feed-row__media" aria-hidden>
                    {item.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail} alt="" width={64} height={64} />
                    ) : (
                      <Package size={24} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="feed-row__body">
                    <div className="feed-row__meta">
                      <span className="feed-row__rank">#{item.rank}</span>
                      {taken ? <span className="badge badge--muted">Já peguei</span> : null}
                      <span className="helper">{item.categoryName}</span>
                    </div>
                    <h3 className="feed-row__title">{item.name}</h3>
                    <p className="feed-row__price">
                      {formatMoney(item.price, item.currency)}
                    </p>
                  </div>
                  <div className="feed-row__actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openClaim(item)}
                    >
                      Usar
                    </button>
                    <a
                      className="icon-btn"
                      href={item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir no Mercado Livre"
                    >
                      <ExternalLink size={18} strokeWidth={1.5} aria-hidden />
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void toggleHide(item.mlItemId)}
                    >
                      {hidden ? "Mostrar" : "Ignorar"}
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
            <h2 id="claim-title" className="section-title">
              Seu link de afiliado
            </h2>
            <p className="page-sub">
              Abra no ML, copie o link de afiliado, cole aqui e confira o preço
            </p>
            <p className="helper" style={{ marginTop: 12 }}>
              {claimItem.name}
            </p>
            <div className="field" style={{ marginTop: 16 }}>
              <label className="label" htmlFor="claim-link">
                Link de afiliado
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
                Continuar
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
