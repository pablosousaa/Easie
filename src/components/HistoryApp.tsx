"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getStoreSnapshot,
  subscribeStore,
} from "@/lib/storage";
import { formatDateTimePt } from "@/lib/format";

export function HistoryApp() {
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const done = store.products
    .filter((p) => p.status === "done" || p.status === "archived")
    .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt));

  const groupName = (id: string) =>
    store.groups.find((g) => g.id === id)?.name ?? "Grupo removido";

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
          <div className="surface empty">
            Ainda não há produtos concluídos. Finalize um checklist na{" "}
            <Link href="/fila">fila</Link>.
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
    </div>
  );
}
