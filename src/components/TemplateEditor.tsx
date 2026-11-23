"use client";

import { useState } from "react";
import { Check, Plus, Star, Trash2 } from "lucide-react";
import type { TextTemplate } from "@/lib/types";
import { TEMPLATE_VARIABLES } from "@/lib/types";
import { createId } from "@/lib/templates";
import { useToast } from "./ToastProvider";

type Props = {
  templates: TextTemplate[];
  onChange: (templates: TextTemplate[]) => void;
};

export function TemplateEditor({ templates, onChange }: Props) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(
    templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? null,
  );

  const editing = templates.find((t) => t.id === editingId) ?? null;

  function insertVariable(token: string) {
    if (!editing) return;
    const next = {
      ...editing,
      content: `${editing.content}${editing.content.endsWith("\n") || !editing.content ? "" : " "}${token}`,
      updatedAt: new Date().toISOString(),
    };
    onChange(templates.map((t) => (t.id === next.id ? next : t)));
  }

  function updateEditing(patch: Partial<TextTemplate>) {
    if (!editing) return;
    const next = { ...editing, ...patch, updatedAt: new Date().toISOString() };
    onChange(templates.map((t) => (t.id === next.id ? next : t)));
  }

  function addTemplate() {
    const tpl: TextTemplate = {
      id: createId("tpl"),
      name: `Modelo ${templates.length + 1}`,
      content: `✨ {{nome}}\n💰 {{preco}}\n{{frete}} {{entrega}}\n👉 {{link}}`,
      isDefault: templates.length === 0,
      updatedAt: new Date().toISOString(),
      category: "",
    };
    onChange([...templates, tpl]);
    setEditingId(tpl.id);
    showToast("Novo modelo criado.");
  }

  function setDefault(id: string) {
    onChange(
      templates.map((t) => ({
        ...t,
        isDefault: t.id === id,
        updatedAt: t.id === id ? new Date().toISOString() : t.updatedAt,
      })),
    );
    showToast("Modelo padrão atualizado.");
  }

  function removeTemplate(id: string) {
    if (templates.length <= 1) {
      showToast("Mantenha pelo menos um modelo.", "error");
      return;
    }
    const remaining = templates.filter((t) => t.id !== id);
    if (!remaining.some((t) => t.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    onChange(remaining);
    setEditingId(remaining[0]?.id ?? null);
    showToast("Modelo removido.");
  }

  return (
    <div className="section" style={{ marginTop: 0 }}>
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-primary btn-block" onClick={addTemplate}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          Novo modelo
        </button>
      </div>

      <ul className="variation-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <div
              className={`template-card${tpl.isDefault ? " template-card--default" : ""}`}
            >
              <div className="variation-header">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: "0 8px",
                      minWidth: 0,
                      justifyContent: "flex-start",
                      maxWidth: "100%",
                    }}
                    onClick={() => setEditingId(tpl.id)}
                    aria-pressed={editingId === tpl.id}
                  >
                    <strong
                      style={{
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tpl.name}
                    </strong>
                  </button>
                  {tpl.isDefault ? (
                    <span className="badge" style={{ flexShrink: 0 }}>
                      Padrão
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {!tpl.isDefault ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Definir ${tpl.name} como padrão`}
                      onClick={() => setDefault(tpl.id)}
                    >
                      <Star size={16} aria-hidden />
                    </button>
                  ) : (
                    <span className="btn btn-ghost btn-sm" aria-hidden style={{ opacity: 0.7 }}>
                      <Check size={16} />
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`Excluir ${tpl.name}`}
                    onClick={() => removeTemplate(tpl.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </div>

              {editingId === tpl.id ? (
                <>
                  <div className="field" style={{ marginTop: 0 }}>
                    <label className="label" htmlFor={`tpl-name-${tpl.id}`}>
                      Nome do modelo
                    </label>
                    <input
                      id={`tpl-name-${tpl.id}`}
                      className="input"
                      value={tpl.name}
                      onChange={(e) => updateEditing({ name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`tpl-content-${tpl.id}`}>
                      Conteúdo
                    </label>
                    <p className="helper">
                      Use variáveis. Emojis são permitidos no texto do post.
                    </p>
                    <div className="chip-row" style={{ margin: "8px 0" }}>
                      {TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="chip"
                          onClick={() => insertVariable(v.key)}
                          title={v.label}
                        >
                          {v.key}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id={`tpl-content-${tpl.id}`}
                      className="textarea"
                      rows={8}
                      value={tpl.content}
                      onChange={(e) => updateEditing({ content: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <pre
                  className="helper"
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: 0,
                    maxHeight: 96,
                    overflow: "hidden",
                  }}
                >
                  {tpl.content}
                </pre>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
