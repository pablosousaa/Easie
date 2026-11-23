"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, History } from "lucide-react";
import {
  getServerSnapshot,
  getStoreSnapshot,
  subscribeStore,
} from "@/lib/storage";
import { progressForProduct } from "@/lib/checklist";
import { formatDatePt } from "@/lib/format";

export function QueueApp() {
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const queue = store.products
    .filter((p) => p.status === "queued" || p.status === "active")
    .sort((a, b) => a.queueOrder - b.queueOrder || a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="page">
      <header>
        <p className="brand">
          Easie<span>.</span>
        </p>
        <h1 className="page-title">Fila de produtos</h1>
        <p className="page-sub">
          Produtos prontos para divulgar. Abra o checklist e marque grupo a grupo.
        </p>
      </header>

      <section className="section">
        <div className="section-head">
          <h2 className="page-title" style={{ fontSize: "1.125rem" }}>
            Na fila ({queue.length})
          </h2>
          <Link href="/historico" className="btn btn-ghost btn-sm">
            <History size={16} aria-hidden />
            Histórico
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="surface empty">
            Nenhum produto na fila. Gere textos na aba <strong>Gerar</strong> para
            adicionar.
          </div>
        ) : (
          <ul className="entity-list">
            {queue.map((product) => {
              const progress = progressForProduct(store, product.id);
              return (
                <li key={product.id} className="entity-card">
                  <div className="entity-card__body">
                    <h3 className="entity-card__title">{product.name}</h3>
                    <p className="helper">
                      {product.price} · {formatDatePt(product.createdAt)}
                    </p>
                    <div className="progress-bar" aria-hidden>
                      <div
                        className="progress-bar__fill"
                        style={{
                          width:
                            progress.total === 0
                              ? "0%"
                              : `${(progress.done / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="helper">
                      {progress.done} de {progress.total} grupos
                    </p>
                  </div>
                  <Link
                    href={`/checklist/${product.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    Abrir
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
