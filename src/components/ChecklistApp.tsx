"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  RotateCcw,
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
  maybeReopenProduct,
  progressForProduct,
} from "@/lib/checklist";
import type { PostingStatus } from "@/lib/types";
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

function categoryKey(theme: string | undefined): string {
  return (theme ?? "").trim();
}

function categoryLabel(key: string): string {
  return key || "Sem categoria";
}

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
  /** Empty set = show all categories. Non-empty = OR match. */
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const product = store.products.find((p) => p.id === productId);

  /** Prefer the 5 texts from Gerar (may include edits); else regenerate from templates + product. */
  const variations = useMemo(() => {
    if (!product) return [];
    if (store.variations.length > 0) return store.variations;
    return generateVariations(product);
  }, [product, store.variations]);

  const prepared = useMemo(() => {
    if (!product) return store;
    const list =
      variations.length > 0 ? variations : generateVariations(product);
    return ensureChecklist(store, product, list);
  }, [product, store, variations]);

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

  const active = useMemo(
    () => prepared.groups.filter((g) => g.active),
    [prepared.groups],
  );

  const categories = useMemo(() => {
    const keys = new Set<string>();
    for (const g of active) keys.add(categoryKey(g.theme));
    return [...keys].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b), "pt-BR"),
    );
  }, [active]);

  const filtered = useMemo(() => {
    if (selectedCategories.length === 0) return active;
    const allow = new Set(selectedCategories);
    return active.filter((g) => allow.has(categoryKey(g.theme)));
  }, [active, selectedCategories]);

  const filterActive = selectedCategories.length > 0;

  function toggleCategory(key: string) {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

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

  /** Switch which of the 5 Gerar texts is shown/copied for this queue item. */
  async function selectVariation(postingId: string, index: number) {
    const list =
      variations.length > 0
        ? variations
        : product
          ? generateVariations(product)
          : [];
    const variation = list[index];
    if (!variation) return;
    const posting = prepared.postings.find((p) => p.id === postingId);
    if (
      posting &&
      posting.variationIndex === index &&
      posting.variationText === variation.text
    ) {
      return;
    }
    // Write index + matching text together so preview / Copiar stay in sync.
    const next = {
      ...prepared,
      postings: prepared.postings.map((p) =>
        p.id === postingId
          ? {
              ...p,
              variationIndex: index,
              variationText: variation.text,
            }
          : p,
      ),
    };
    await persist(next);
  }

  /**
   * Text for preview + Copiar.
   * Prefer the selected variation's stock text when stored text is another
   * stock variation (index/text desync). Keep real textarea edits.
   */
  function textForPosting(posting: {
    variationIndex: number;
    variationText: string;
  }): string {
    const n = Math.max(variations.length, 1);
    const idx = ((posting.variationIndex % n) + n) % n;
    const selected = variations[idx]?.text ?? "";
    const stored = posting.variationText;
    if (!stored) return selected;
    if (!selected || stored === selected) return stored;
    const stock = new Set(variations.map((v) => v.text));
    if (stock.has(stored)) return selected;
    return stored;
  }

  /** One tap: copy variation, then open the Facebook group. */
  async function copyAndOpen(text: string, link: string, postingId: string) {
    setBusyId(postingId);
    const ok = await copyText(text);
    setBusyId(null);
    if (!ok) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function setStatus(postingId: string, status: PostingStatus) {
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
    if (status === "pending") {
      next = maybeReopenProduct(next, current.id);
    } else {
      next = maybeCompleteProduct(next, current.id);
    }
    await persist(next);
    if (status === "posted") showToast("Marcado como postado");
    if (status === "ignored") showToast("Grupo ignorado");
    if (status === "pending") showToast("Marcado como não postado");

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

      <section className="section" aria-labelledby="checklist-grupos">
        <div className="section-head">
          <h2 id="checklist-grupos" className="section-title">
            Grupos
            {filterActive
              ? ` (${filtered.length} de ${active.length})`
              : ` (${active.length})`}
          </h2>
        </div>

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
          <>
            {categories.length > 1 ? (
              <div className="filter-panel">
                <div className="filter-panel__head">
                  <p className="label" id="filtro-categoria-label">
                    Filtrar por categoria
                  </p>
                  {filterActive ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedCategories([])}
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>
                <p className="helper">
                  Selecione uma ou mais. Sem filtro, todos os grupos aparecem.
                </p>
                <div
                  className="chip-row chip-row--filter"
                  role="group"
                  aria-labelledby="filtro-categoria-label"
                >
                  {categories.map((key) => {
                    const selected = selectedCategories.includes(key);
                    return (
                      <button
                        key={key || "sem-categoria"}
                        type="button"
                        className={`chip${selected ? " is-active" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleCategory(key)}
                      >
                        {categoryLabel(key)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                title="Nenhum grupo nestas categorias"
                action={
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedCategories([])}
                  >
                    Limpar filtro
                  </button>
                }
              >
                <p className="helper">
                  Tente outras categorias ou limpe o filtro.
                </p>
              </EmptyState>
            ) : (
          <ul className="entity-list">
            {filtered.map((group) => {
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
                      <p className="helper">
                        Categoria: {categoryLabel(categoryKey(group.theme))}
                      </p>
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
                      <div className="variation-switcher">
                        <p
                          className="label"
                          id={`var-pick-${posting.id}`}
                        >
                          Variação
                          {(() => {
                            const idx = posting.variationIndex % Math.max(variations.length, 5);
                            const name = variations[idx]?.label?.trim();
                            return name ? ` · ${name}` : "";
                          })()}
                        </p>
                        <div
                          className="segmented segmented--five"
                          role="radiogroup"
                          aria-labelledby={`var-pick-${posting.id}`}
                        >
                          {[0, 1, 2, 3, 4].map((i) => {
                            const selected =
                              (posting.variationIndex % 5) === i;
                            const label = variations[i]?.label?.trim();
                            return (
                              <button
                                key={i}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={
                                  label
                                    ? `Variação ${i + 1}: ${label}`
                                    : `Variação ${i + 1}`
                                }
                                className={selected ? "is-active" : undefined}
                                disabled={!variations[i]}
                                onClick={() =>
                                  void selectVariation(posting.id, i)
                                }
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <label className="label" htmlFor={`var-${posting.id}`}>
                        Texto sugerido (variação{" "}
                        {(posting.variationIndex % 5) + 1})
                      </label>
                      <textarea
                        id={`var-${posting.id}`}
                        key={`${posting.id}-v${posting.variationIndex % 5}`}
                        className="textarea textarea--compact"
                        rows={4}
                        value={textForPosting(posting)}
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
                            textForPosting(posting),
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
                          onClick={() =>
                            void copyText(textForPosting(posting))
                          }
                        >
                          <Copy size={16} aria-hidden />
                          Copiar
                        </button>
                      ) : null}
                      {posting.status === "posted" ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void setStatus(posting.id, "pending")}
                        >
                          <RotateCcw size={16} aria-hidden />
                          Não postado
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void setStatus(posting.id, "posted")}
                        >
                          <Check size={16} aria-hidden />
                          Postado
                        </button>
                      )}
                      {posting.status === "ignored" ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void setStatus(posting.id, "pending")}
                        >
                          <RotateCcw size={16} aria-hidden />
                          Desfazer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void setStatus(posting.id, "ignored")}
                        >
                          <SkipForward size={16} aria-hidden />
                          Ignorar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
