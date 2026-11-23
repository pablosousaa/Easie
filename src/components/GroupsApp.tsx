"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { FileUp, Pencil, Plus, Power, Trash2 } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

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
      showToast("Nenhum grupo novo (links já cadastrados).", "error");
      return;
    }
    const added = draftsToGroups(fresh);
    await persist({ ...store, groups: [...store.groups, ...added] });
    setImportText("");
    setShowImport(false);
    const skipNote =
      parsed.skipped > 0 || fresh.length < parsed.groups.length
        ? ` (${parsed.groups.length - fresh.length + parsed.skipped} ignorados)`
        : "";
    showToast(`${added.length} grupo(s) importado(s)${skipNote}.`);
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
          Cadastre nome, link, categoria e regras. Desative grupos bloqueados sem apagar o
          histórico. Importe por colagem ou planilha CSV.
        </p>
      </header>

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
              <code>Nome | https://… | categoria | regras</code>, ou um link por linha.
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

      <section className="section" aria-labelledby="lista-grupos">
        <h2 id="lista-grupos" className="section-title">
          Seus grupos ({store.groups.length})
        </h2>
        {store.groups.length === 0 ? (
          <div className="surface empty-state">
            <p className="empty-state__title">Nenhum grupo ainda</p>
            <p className="helper">Cadastre o primeiro acima para montar o checklist</p>
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
                    <p className="helper">Categoria: {group.theme}</p>
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
