"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";
import { progressForProduct } from "@/lib/checklist";
import { formatDatePt } from "@/lib/format";

export function QueueApp() {
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const queue = store.products
    .filter((p) => p.status === "queued" || p.status === "active")
    .sort((a, b) => a.queueOrder - b.queueOrder || a.createdAt.localeCompare(b.createdAt));

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  async function removeFromQueue(productId: string, productName: string) {
    if (
      !window.confirm(
        `Remover “${productName}” da fila? O checklist e as postagens deste produto também saem.`,
      )
    ) {
      return;
    }
    const next = {
      ...store,
      products: store.products.filter((p) => p.id !== productId),
      postings: store.postings.filter((p) => p.productId !== productId),
    };
    await persist(next);
    showToast("Produto removido da fila");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Fila de produtos</h1>
        <p className="page-sub">
          Produtos prontos para divulgar. Abra o checklist e marque grupo a grupo.
        </p>
      </header>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Na fila ({queue.length})</h2>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            title="Fila vazia"
            action={
              <Link href="/gerar" className="btn btn-primary">
                <Sparkles size={18} aria-hidden />
                Gerar textos
              </Link>
            }
          >
            <p className="helper">Cadastre um produto para começar a divulgar</p>
          </EmptyState>
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
                  <div className="entity-card__actions">
                    <Link
                      href={`/checklist/${product.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Abrir
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      aria-label={`Remover ${product.name} da fila`}
                      onClick={() => void removeFromQueue(product.id, product.name)}
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
