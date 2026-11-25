"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FileUp, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import type { FacebookGroup } from "@/lib/types";
import { createId, nowIso } from "@/lib/ids";
import { draftsToGroups, parseGroupsImport } from "@/lib/groups-import";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

const emptyForm = {
  name: "",
  link: "",
  theme: "",
  rules: "",
};

function categoryKey(theme: string | undefined): string {
  return (theme ?? "").trim();
}

function categoryLabel(key: string): string {
  return key || "Sem categoria";
}

export function GroupsApp() {
  const { showToast } = useToast();
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({});
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  const categories = useMemo(() => {
    const keys = new Set<string>();
    for (const g of store.groups) keys.add(categoryKey(g.theme));
    return [...keys].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b), "pt-BR"),
    );
  }, [store.groups]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.groups.filter((g) => {
      if (selectedCategory != null && categoryKey(g.theme) !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        categoryLabel(categoryKey(g.theme)).toLowerCase().includes(q) ||
        g.rules.toLowerCase().includes(q)
      );
    });
  }, [store.groups, query, selectedCategory]);

  function startEdit(group: FacebookGroup) {
    setEditingId(group.id);
    setForm({
      name: group.name,
      link: group.link,
      theme: group.theme,
      rules: group.rules,
    });
    setErrors({});
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Partial<typeof emptyForm> = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome do grupo";
    if (!form.link.trim()) nextErrors.link = "Informe o link do grupo";
    else {
      try {
        const url = new URL(form.link.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.link = "O link precisa começar com http ou https";
        }
      } catch {
        nextErrors.link = "Link inválido";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (editingId) {
      const next = {
        ...store,
        groups: store.groups.map((g) =>
          g.id === editingId
            ? {
                ...g,
                name: form.name.trim(),
                link: form.link.trim(),
                theme: form.theme.trim(),
                rules: form.rules.trim(),
              }
            : g,
        ),
      };
      await persist(next);
      showToast("Grupo atualizado");
    } else {
      const group: FacebookGroup = {
        id: createId("grp"),
        name: form.name.trim(),
        link: form.link.trim(),
        theme: form.theme.trim(),
        rules: form.rules.trim(),
        active: true,
        createdAt: nowIso(),
      };
      await persist({ ...store, groups: [...store.groups, group] });
      showToast("Grupo cadastrado");
    }
    resetForm();
  }

  async function toggleActive(id: string) {
    const group = store.groups.find((g) => g.id === id);
    const next = {
      ...store,
      groups: store.groups.map((g) =>
        g.id === id ? { ...g, active: !g.active } : g,
      ),
    };
    await persist(next);
    showToast(group?.active ? "Grupo desativado" : "Grupo ativado");
  }

  async function removeGroup(id: string) {
    if (!window.confirm("Excluir este grupo? Postagens ligadas a ele também saem.")) {
      return;
    }
    const next = {
      ...store,
      groups: store.groups.filter((g) => g.id !== id),
      postings: store.postings.filter((p) => p.groupId !== id),
    };
    await persist(next);
    if (editingId === id) resetForm();
    showToast("Grupo removido");
  }

  async function runImport(raw: string) {
    const parsed = parseGroupsImport(raw);
    if (!parsed.ok) {
      showToast(parsed.error, "error");
      return;
    }
    const existingLinks = new Set(store.groups.map((g) => g.link.trim().toLowerCase()));
    const fresh = parsed.groups.filter(
      (g) => !existingLinks.has(g.link.trim().toLowerCase()),
    );
    if (fresh.length === 0) {
      showToast("Nenhum grupo novo", "error");
      return;
    }
    const added = draftsToGroups(fresh);
    await persist({ ...store, groups: [...store.groups, ...added] });
    setImportText("");
    setShowImport(false);
    showToast(`${added.length} grupo(s) importado(s)`);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      void runImport(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Grupos do Facebook</h1>
        <p className="page-sub">
          Cadastre, filtre e ative/desative sem apagar o histórico
        </p>
      </header>

      <section className="section" aria-labelledby="lista-grupos">
        <div className="section-head">
          <h2 id="lista-grupos" className="section-title">
            Seus grupos ({store.groups.length})
          </h2>
        </div>

        {store.groups.length === 0 ? (
          <EmptyState title="Nenhum grupo ainda">
            <p className="helper">Cadastre o primeiro abaixo para montar o checklist</p>
          </EmptyState>
        ) : (
          <>
            <div className="groups-toolbar">
              <label className="groups-toolbar__search">
                <span className="sr-only">Buscar grupos</span>
                <Search size={16} strokeWidth={1.5} aria-hidden />
                <input
                  className="input"
                  type="search"
                  placeholder="Buscar grupo"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {categories.length > 1 ? (
                <div
                  className="chip-row chip-row--filter"
                  role="group"
                  aria-label="Filtrar por categoria"
                >
                  <button
                    type="button"
                    className={`chip${selectedCategory == null ? " is-active" : ""}`}
                    aria-pressed={selectedCategory == null}
                    onClick={() => setSelectedCategory(null)}
                  >
                    Todas
                  </button>
                  {categories.map((key) => {
                    const selected = selectedCategory === key;
                    return (
                      <button
                        key={key || "sem-categoria"}
                        type="button"
                        className={`chip${selected ? " is-active" : ""}`}
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedCategory(selected ? null : key)
                        }
                      >
                        {categoryLabel(key)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {filteredGroups.length === 0 ? (
              <EmptyState
                title="Nenhum grupo neste filtro"
                action={
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setQuery("");
                      setSelectedCategory(null);
                    }}
                  >
                    Limpar filtro
                  </button>
                }
              >
                <p className="helper">Tente outra busca ou categoria</p>
              </EmptyState>
            ) : (
              <ul className="entity-list">
                {filteredGroups.map((group) => (
                  <li
                    key={group.id}
                    className={`entity-card entity-card--stack${group.active ? "" : " entity-card--muted"}`}
                  >
                    <div className="entity-card__body">
                      <div className="entity-card__title-row">
                        <h3 className="entity-card__title">{group.name}</h3>
                        <span className={`badge${group.active ? "" : " badge--muted"}`}>
                          {group.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      {group.theme ? (
                        <p className="helper">{group.theme}</p>
                      ) : null}
                      {group.rules ? (
                        <p className="helper clamp-2">{group.rules}</p>
                      ) : null}
                      <a
                        className="entity-card__link"
                        href={group.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir no Facebook
                      </a>
                    </div>
                    <div className="entity-card__actions entity-card__actions--wrap">
                      <button
                        type="button"
                        className={`btn btn-sm ${group.active ? "btn-secondary" : "btn-primary"}`}
                        onClick={() => void toggleActive(group.id)}
                      >
                        <Power size={16} aria-hidden />
                        {group.active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Editar grupo"
                        onClick={() => startEdit(group)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        aria-label="Excluir grupo"
                        onClick={() => void removeGroup(group.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="section" aria-labelledby="import-grupos">
        <div className="section-head">
          <h2 id="import-grupos" className="section-title">
            Importar lista
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? "Fechar" : "Abrir"}
          </button>
        </div>
        {showImport ? (
          <div className="surface">
            <p className="helper">
              CSV com cabeçalho <code>nome,link,categoria,regras</code>, linhas{" "}
              <code>Nome | https://… | categoria | regras</code>, ou um link por linha
            </p>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="label" htmlFor="groups-import">
                Colar texto ou CSV
              </label>
              <textarea
                id="groups-import"
                className="textarea"
                rows={6}
                placeholder={"nome,link,categoria,regras\nOfertas Casa,https://facebook.com/groups/123,Natal,"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runImport(importText)}
              >
                Importar colagem
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp size={16} strokeWidth={1.5} aria-hidden />
                Arquivo CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={onFile}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="section" aria-labelledby="form-grupo">
        <h2 id="form-grupo" className="section-title">
          {editingId ? "Editar grupo" : "Novo grupo"}
        </h2>
        <form className="surface" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="group-name">
              Nome
              <span className="label__required" aria-hidden>
                *
              </span>
            </label>
            <input
              id="group-name"
              className={`input${errors.name ? " input--error" : ""}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {errors.name ? <p className="field__error">{errors.name}</p> : null}
          </div>
          <div className="field">
            <label className="label" htmlFor="group-link">
              Link
              <span className="label__required" aria-hidden>
                *
              </span>
            </label>
            <input
              id="group-link"
              className={`input${errors.link ? " input--error" : ""}`}
              type="url"
              inputMode="url"
              placeholder="https://facebook.com/groups/..."
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            />
            {errors.link ? <p className="field__error">{errors.link}</p> : null}
          </div>
          <div className="field">
            <label className="label" htmlFor="group-theme">
              Categoria
            </label>
            <input
              id="group-theme"
              className="input"
              placeholder="Ex.: Beleza Feminina, Natal, Geral"
              value={form.theme}
              onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="group-rules">
              Regras
            </label>
            <textarea
              id="group-rules"
              className="textarea"
              placeholder="Ex.: permite links, máx. 2 posts/dia, horário 8h–22h"
              value={form.rules}
              onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary btn-block">
              <Plus size={18} aria-hidden />
              {editingId ? "Salvar alterações" : "Adicionar grupo"}
            </button>
            {editingId ? (
              <button type="button" className="btn btn-ghost btn-block" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
