"use client";

import { useState, useSyncExternalStore } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import type { FacebookGroup } from "@/lib/types";
import { createId, nowIso } from "@/lib/ids";
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

  async function persist(next: typeof store) {
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

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
    if (!form.name.trim()) nextErrors.name = "Informe o nome do grupo.";
    if (!form.link.trim()) nextErrors.link = "Informe o link do grupo.";
    else {
      try {
        const url = new URL(form.link.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.link = "O link precisa começar com http ou https.";
        }
      } catch {
        nextErrors.link = "Link inválido.";
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
      showToast("Grupo atualizado.");
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
      showToast("Grupo cadastrado.");
    }
    resetForm();
  }

  async function toggleActive(id: string) {
    const next = {
      ...store,
      groups: store.groups.map((g) =>
        g.id === id ? { ...g, active: !g.active } : g,
      ),
    };
    await persist(next);
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
    showToast("Grupo removido.");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Grupos do Facebook</h1>
        <p className="page-sub">
          Cadastre nome, link, tema e regras. Desative grupos bloqueados sem apagar o
          histórico.
        </p>
      </header>

      <section className="section" aria-labelledby="form-grupo">
        <h2 id="form-grupo" className="page-title" style={{ fontSize: "1.125rem" }}>
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
              Tema
            </label>
            <input
              id="group-theme"
              className="input"
              placeholder="Ex.: natal, casa, eletrônicos"
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

      <section className="section" aria-labelledby="lista-grupos">
        <h2 id="lista-grupos" className="page-title" style={{ fontSize: "1.125rem" }}>
          Seus grupos ({store.groups.length})
        </h2>
        {store.groups.length === 0 ? (
          <div className="surface empty">
            Nenhum grupo ainda. Cadastre o primeiro para montar o checklist de divulgação.
          </div>
        ) : (
          <ul className="entity-list">
            {store.groups.map((group) => (
              <li
                key={group.id}
                className={`entity-card${group.active ? "" : " entity-card--muted"}`}
              >
                <div className="entity-card__body">
                  <div className="entity-card__title-row">
                    <h3 className="entity-card__title">{group.name}</h3>
                    <span className={`badge${group.active ? "" : " badge--muted"}`}>
                      {group.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  {group.theme ? (
                    <p className="helper">Tema: {group.theme}</p>
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
                <div className="entity-card__actions">
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
                    className="icon-btn"
                    aria-label={group.active ? "Desativar grupo" : "Ativar grupo"}
                    onClick={() => void toggleActive(group.id)}
                  >
                    <Power size={18} />
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
      </section>
    </div>
  );
}
