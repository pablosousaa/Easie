"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  SkipForward,
  Users,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { EmptyState } from "./EmptyState";
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const product = store.products.find((p) => p.id === productId);

  const prepared = useMemo(() => {
    if (!product) return store;
    const variations =
      store.variations.length > 0
        ? store.variations
        : generateVariations(product);
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
        <EmptyState
          title="Produto não encontrado"
          action={
            <Link href="/fila" className="btn btn-secondary">
              Voltar à fila
            </Link>
          }
        >
          <p className="helper">Ele pode ter sido concluído ou removido.</p>
        </EmptyState>
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
      showToast("Texto copiado");
      return true;
    } catch {
      showToast("Não foi possível copiar", "error");
      return false;
    }
  }

  /** One tap: copy variation, then open the Facebook group. */
  async function copyAndOpen(text: string, link: string, postingId: string) {
    setBusyId(postingId);
    const ok = await copyText(text);
    setBusyId(null);
    if (!ok) return;
    window.open(link, "_blank", "noopener,noreferrer");
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
    if (status === "posted") showToast("Marcado como postado");
    if (status === "ignored") showToast("Grupo ignorado");

    const updated = next.products.find((p) => p.id === current.id);
    if (updated?.status === "done") {
      showToast("Produto concluído — foi para o histórico");
      router.push("/historico");
    }
  }

  return (
    <div className="page page--checklist">
      <header className="page-header">
        <p className="page-eyebrow">Checklist</p>
        <h1 className="page-title">{product.name}</h1>
        <p className="page-sub">
          Copie e abra o grupo, cole no Facebook, marque postado
        </p>
        <div className="progress-panel progress-panel--sticky">
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
            {progress.done} de {progress.total} grupos
          </p>
        </div>
      </header>

      <section className="section">
        {active.length === 0 ? (
          <EmptyState
            title="Nenhum grupo ativo"
            action={
              <Link href="/grupos" className="btn btn-primary">
                <Users size={18} aria-hidden />
                Cadastrar grupos
              </Link>
            }
          >
            <p className="helper">
              Ative grupos em Grupos para montar este checklist
            </p>
          </EmptyState>
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
              const done =
                posting.status === "posted" || posting.status === "ignored";

              return (
                <li
                  key={group.id}
                  className={`checklist-card${done ? " checklist-card--done" : ""}`}
                >
                  <div className="checklist-card__head">
                    <div>
                      <h3 className="entity-card__title">{group.name}</h3>
                      {group.theme ? (
                        <p className="helper">Categoria: {group.theme}</p>
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

                  {!done ? (
                    <>
                      <label className="label" htmlFor={`var-${posting.id}`}>
                        Texto sugerido (variação {(posting.variationIndex % 5) + 1})
                      </label>
                      <textarea
                        id={`var-${posting.id}`}
                        className="textarea textarea--compact"
                        rows={4}
                        value={posting.variationText}
                        onChange={(e) => {
                          const text = e.target.value;
                          const next = {
                            ...prepared,
                            postings: prepared.postings.map((p) =>
                              p.id === posting.id
                                ? { ...p, variationText: text }
                                : p,
                            ),
                          };
                          void persist(next);
                        }}
                      />
                    </>
                  ) : posting.postedAt ? (
                    <p className="helper">
                      Postado em {formatDateTimePt(posting.postedAt)}
                    </p>
                  ) : null}

                  <div className="checklist-actions">
                    {!done ? (
                      <button
                        type="button"
                        className="btn btn-primary checklist-actions__primary"
                        disabled={busyId === posting.id}
                        aria-busy={busyId === posting.id}
                        onClick={() =>
                          void copyAndOpen(
                            posting.variationText,
                            group.link,
                            posting.id,
                          )
                        }
                      >
                        <ExternalLink size={16} aria-hidden />
                        Copiar e abrir
                      </button>
                    ) : (
                      <a
                        className="btn btn-secondary checklist-actions__primary"
                        href={group.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={16} aria-hidden />
                        Abrir grupo
                      </a>
                    )}

                    <div className="checklist-actions__row">
                      {!done ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void copyText(posting.variationText)}
                        >
                          <Copy size={16} aria-hidden />
                          Copiar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
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
