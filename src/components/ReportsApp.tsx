"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { countPosted, postsPerDay, sumResults } from "@/lib/reports";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";
import { formatDatePt } from "@/lib/format";
import { PostsAreaChart } from "./PostsAreaChart";

type RangeDays = 7 | 30;

export function ReportsApp() {
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
  const [now, setNow] = useState<Date | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const counts = now ? countPosted(store, now) : { today: 0, week: 0, total: 0 };
  const days = now ? postsPerDay(store, rangeDays, now) : [];
  const totals = sumResults(store.products);

  const tracked = [...store.products].sort((a, b) =>
    (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
  );

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  async function updateResult(
    productId: string,
    patch: { clicks?: number; sales?: number; commission?: string },
  ) {
    const next = {
      ...store,
      products: store.products.map((p) =>
        p.id === productId ? { ...p, ...patch } : p,
      ),
    };
    await persist(next);
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-sub">
          Posts por dia e resultados manuais (cliques, vendas, comissão)
        </p>
      </header>

      <section className="section" aria-labelledby="stats-heading">
        <div className="section-head">
          <h2 id="stats-heading" className="section-title">
            Postagens
          </h2>
          {now ? (
            <div
              className="segmented segmented--range"
              role="radiogroup"
              aria-label="Período do gráfico"
            >
              <button
                type="button"
                role="radio"
                aria-checked={rangeDays === 7}
                className={rangeDays === 7 ? "is-active" : undefined}
                onClick={() => setRangeDays(7)}
              >
                7d
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={rangeDays === 30}
                className={rangeDays === 30 ? "is-active" : undefined}
                onClick={() => setRangeDays(30)}
              >
                30d
              </button>
            </div>
          ) : null}
        </div>
        {!now ? (
          <div className="surface stack-gap" aria-busy="true">
            <div className="skeleton skeleton--line" style={{ width: "30%" }} />
            <div className="stat-grid">
              <div className="skeleton skeleton--btn" />
              <div className="skeleton skeleton--btn" />
              <div className="skeleton skeleton--btn" />
            </div>
            <span className="sr-only">Carregando estatísticas</span>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <p className="stat-card__label">Hoje</p>
                <p className="stat-card__value">{counts.today}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card__label">Esta semana</p>
                <p className="stat-card__value">{counts.week}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card__label">Total</p>
                <p className="stat-card__value">{counts.total}</p>
              </div>
            </div>

            <div className="surface posts-chart-surface" style={{ marginTop: 12 }}>
              <PostsAreaChart days={days} rangeDays={rangeDays} />
            </div>
          </>
        )}
      </section>

      <section className="section" aria-labelledby="results-heading">
        <div className="section-head">
          <h2 id="results-heading" className="section-title">
            Resultados manuais
          </h2>
          <p className="helper" style={{ margin: 0 }}>
            {totals.clicks} cliques · {totals.sales} vendas
          </p>
        </div>

        {tracked.length === 0 ? (
          <div className="surface empty-state">
            <p className="empty-state__title">Nenhum resultado ainda</p>
            <p className="helper">
              Gere um produto em <Link href="/gerar">Gerar</Link>
            </p>
          </div>
        ) : (
          <ul className="entity-list">
            {tracked.map((product) => (
              <li key={product.id} className="entity-card entity-card--stack">
                <div className="entity-card__body">
                  <h3 className="entity-card__title">{product.name}</h3>
                  <p className="helper">
                    {product.status} · {formatDatePt(product.createdAt)}
                  </p>
                </div>
                <div className="results-grid">
                  <div className="field">
                    <label className="label" htmlFor={`clicks-${product.id}`}>
                      Cliques
                    </label>
                    <input
                      id={`clicks-${product.id}`}
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={product.clicks}
                      onChange={(e) => {
                        const clicks = Number.parseInt(e.target.value, 10);
                        void updateResult(product.id, {
                          clicks: Number.isFinite(clicks) ? Math.max(0, clicks) : 0,
                        });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`sales-${product.id}`}>
                      Vendas
                    </label>
                    <input
                      id={`sales-${product.id}`}
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={product.sales}
                      onChange={(e) => {
                        const sales = Number.parseInt(e.target.value, 10);
                        void updateResult(product.id, {
                          sales: Number.isFinite(sales) ? Math.max(0, sales) : 0,
                        });
                      }}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label className="label" htmlFor={`comm-${product.id}`}>
                      Comissão
                    </label>
                    <input
                      id={`comm-${product.id}`}
                      className="input"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 24,90"
                      value={product.commission}
                      onChange={(e) => {
                        void updateResult(product.id, {
                          commission: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
