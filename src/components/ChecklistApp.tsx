"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, SkipForward } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import {
  ensureChecklist,
  markPostingStatus,
  maybeCompleteProduct,
  progressForProduct,
} from "@/lib/checklist";
import { formatDateTimePt } from "@/lib/format";
import { generateVariations } from "@/lib/generate";
import { checkRepostWindow } from "@/lib/repost";
import {
  getDefaultTemplate,
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

type Props = { productId: string };

export function ChecklistApp({ productId }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const product = store.products.find((p) => p.id === productId);

  const prepared = useMemo(() => {
    if (!product) return store;
    const variations =
      store.variations.length > 0
        ? store.variations
        : generateVariations(product, getDefaultTemplate(store.templates).content, 4);
    return ensureChecklist(store, product, variations);
  }, [product, store]);

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  useEffect(() => {
    if (!product) return;
    const currentIds = new Set(
      store.postings.filter((p) => p.productId === product.id).map((p) => p.groupId),
    );
    const activeIds = store.groups.filter((g) => g.active).map((g) => g.id);
    const missing = activeIds.some((id) => !currentIds.has(id));
    if (missing || prepared.postings.length !== store.postings.length) {
      void persist(prepared);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed when checklist gaps appear
  }, [productId, product?.id, store.groups.length]);

  if (!product) {
    return (
      <div className="page">
        <div className="surface empty">
          Produto não encontrado. Volte para a <Link href="/fila">fila</Link>.
        </div>
      </div>
    );
  }

  const progress = progressForProduct(prepared, product.id);
  const active = prepared.groups.filter((g) => g.active);
  const byGroup = new Map(
    prepared.postings
      .filter((p) => p.productId === product.id)
      .map((p) => [p.groupId, p]),
  );

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Texto copiado.");
    } catch {
      showToast("Não foi possível copiar.", "error");
    }
  }

  async function setStatus(postingId: string, status: "posted" | "ignored") {
    if (!product) return;
    const current = product;
    const posting = prepared.postings.find((p) => p.id === postingId);
    if (!posting) return;

    if (status === "posted") {
      const guard = checkRepostWindow(
        prepared.postings,
        current.id,
        posting.groupId,
        prepared.settings.repostWindowDays,
      );
      if (guard.blocked && posting.status !== "posted") {
        const ok = window.confirm(
          `Atenção: este produto já foi postado neste grupo há menos de ${prepared.settings.repostWindowDays} dias (faltam ~${guard.daysLeft} dia(s)). Deseja marcar mesmo assim?`,
        );
        if (!ok) return;
      }
    }

    let next = markPostingStatus(prepared, postingId, status);
    next = maybeCompleteProduct(next, current.id);
    await persist(next);
    if (status === "posted") showToast("Marcado como postado.");
    if (status === "ignored") showToast("Grupo ignorado.");

    const updated = next.products.find((p) => p.id === current.id);
    if (updated?.status === "done") {
      showToast("Produto concluído — foi para o histórico.");
      router.push("/historico");
    }
  }

  return (
    <div className="page">
      <header>
        <p className="brand">
          Easie<span>.</span>
        </p>
        <h1 className="page-title">{product.name}</h1>
        <p className="page-sub">
          Abra o grupo, copie o texto sugerido e marque postado. Sem automação — envio
          manual.
        </p>
        <div className="progress-panel">
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
          <p className="helper" role="status">
            {progress.done} de {progress.total} grupos concluídos
          </p>
        </div>
      </header>

      <section className="section">
        {active.length === 0 ? (
          <div className="surface empty">
            Cadastre grupos ativos em <Link href="/grupos">Grupos</Link> para montar o
            checklist.
          </div>
        ) : (
          <ul className="entity-list">
            {active.map((group) => {
              const posting = byGroup.get(group.id);
              if (!posting) return null;
              const guard = checkRepostWindow(
                prepared.postings,
                product.id,
                group.id,
                prepared.settings.repostWindowDays,
              );
              const statusLabel =
                posting.status === "posted"
                  ? "Postado"
                  : posting.status === "ignored"
                    ? "Ignorado"
                    : "Pendente";

              return (
                <li key={group.id} className="checklist-card">
                  <div className="checklist-card__head">
                    <div>
                      <h3 className="entity-card__title">{group.name}</h3>
                      {group.theme ? (
                        <p className="helper">Tema: {group.theme}</p>
                      ) : null}
                    </div>
                    <span className={`status-pill status-pill--${posting.status}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {group.rules ? (
                    <p className="helper clamp-2">Regras: {group.rules}</p>
                  ) : null}

                  {guard.blocked && posting.status === "pending" ? (
                    <p className="warn-banner" role="status">
                      Já postado neste grupo em {formatDateTimePt(guard.lastPostedAt)}.
                      Janela: {prepared.settings.repostWindowDays} dias (~
                      {guard.daysLeft} restantes).
                    </p>
                  ) : null}

                  <label className="label" htmlFor={`var-${posting.id}`}>
                    Texto sugerido (variação {(posting.variationIndex % 5) + 1})
                  </label>
                  <textarea
                    id={`var-${posting.id}`}
                    className="textarea"
                    rows={5}
                    value={posting.variationText}
                    onChange={(e) => {
                      const text = e.target.value;
                      const next = {
                        ...prepared,
                        postings: prepared.postings.map((p) =>
                          p.id === posting.id ? { ...p, variationText: text } : p,
                        ),
                      };
                      void persist(next);
                    }}
                  />

                  {posting.postedAt ? (
                    <p className="helper">
                      Postado em {formatDateTimePt(posting.postedAt)}
                    </p>
                  ) : null}

                  <div className="checklist-actions">
                    <a
                      className="btn btn-secondary btn-sm"
                      href={group.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={16} aria-hidden />
                      Abrir grupo
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void copyText(posting.variationText)}
                    >
                      <Copy size={16} aria-hidden />
                      Copiar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void setStatus(posting.id, "posted")}
                      disabled={posting.status === "posted"}
                    >
                      <Check size={16} aria-hidden />
                      Postado
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void setStatus(posting.id, "ignored")}
                      disabled={posting.status === "ignored"}
                    >
                      <SkipForward size={16} aria-hidden />
                      Ignorar
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
