"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";
import { formatDateTimePt } from "@/lib/format";

function isHistoryProduct(status: string): boolean {
  return status === "done" || status === "archived";
}

export function HistoryApp() {
  const { cloud, pushStore } = useAuth();
  const { showToast } = useToast();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
  const [busy, setBusy] = useState(false);

  const done = store.products
    .filter((p) => isHistoryProduct(p.status))
    .sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
    );

  const groupName = (id: string) =>
    store.groups.find((g) => g.id === id)?.name ?? "Grupo removido";

  async function handleClearHistory() {
    if (done.length === 0) {
      showToast("Histórico já está vazio", "error");
      return;
    }
    const ok = window.confirm(
      `Limpar o histórico desta conta? Isso remove ${done.length} produto(s) concluído(s) e as postagens ligadas a eles. A fila, grupos e modelos ficam intactos. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    const typed = window.prompt("Digite LIMPAR para confirmar:");
    if (typed !== "LIMPAR") {
      showToast("Limpeza cancelada", "error");
      return;
    }

    const historyIds = new Set(done.map((p) => p.id));
    const next = {
      ...store,
      products: store.products.filter((p) => !historyIds.has(p.id)),
      postings: store.postings.filter((p) => !historyIds.has(p.productId)),
    };

    setBusy(true);
    replaceStore(next);
    if (cloud) await pushStore(next);
    setBusy(false);
    showToast("Histórico limpo");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Histórico</h1>
        <p className="page-sub">
          Produtos já divulgados, com data e grupos em que você marcou postado.
        </p>
        <p className="helper" style={{ marginTop: 8 }}>
          <Link href="/relatorios">Registrar resultados</Link> (cliques, vendas,
          comissão) ou ver posts da semana.
        </p>
      </header>

      <section className="section">
        {done.length === 0 ? (
          <div className="surface empty-state">
            <p className="empty-state__title">Nada no histórico</p>
            <p className="helper">
              Finalize um checklist na <Link href="/fila">fila</Link>
            </p>
          </div>
        ) : (
          <ul className="entity-list">
            {done.map((product) => {
              const posted = store.postings.filter(
                (p) => p.productId === product.id && p.status === "posted",
              );
              return (
                <li key={product.id} className="entity-card entity-card--stack">
                  <div className="entity-card__body">
                    <h3 className="entity-card__title">{product.name}</h3>
                    <p className="helper">
                      Concluído em {formatDateTimePt(product.completedAt)}
                    </p>
                    {posted.length === 0 ? (
                      <p className="helper">Nenhum grupo marcado como postado.</p>
                    ) : (
                      <ul className="history-groups">
                        {posted.map((p) => (
                          <li key={p.id}>
                            <span>{groupName(p.groupId)}</span>
                            <time dateTime={p.postedAt ?? undefined}>
                              {formatDateTimePt(p.postedAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link
                    href={`/checklist/${product.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Ver checklist
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="danger-history-heading">
        <h2 id="danger-history-heading" className="section-title">
          Zona de risco
        </h2>
        <div className="surface stack-gap">
          <p className="helper" style={{ margin: 0 }}>
            Remove só o histórico desta conta (produtos concluídos e postagens
            deles). Não apaga a conta, a fila, grupos nem modelos.
          </p>
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={busy || done.length === 0}
            onClick={() => void handleClearHistory()}
          >
            <Trash2 size={18} aria-hidden />
            Limpar histórico
          </button>
        </div>
      </section>
    </div>
  );
}
