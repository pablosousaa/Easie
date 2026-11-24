"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { TemplateEditor } from "./TemplateEditor";
import { useAuth } from "./AuthProvider";
import type { TextTemplate } from "@/lib/types";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

type Props = {
  /** Full page (legacy) or sheet body inside Gerar. */
  variant?: "page" | "sheet";
  onClose?: () => void;
};

export function TemplatesApp({ variant = "page", onClose }: Props) {
  const { cloud, pushStore } = useAuth();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

  async function handleChange(templates: TextTemplate[]) {
    const next = { ...store, templates };
    replaceStore(next);
    if (cloud) await pushStore(next);
  }

  const sub =
    "Edite e salve os modelos da conta. Gerar sempre usa os 5 anúncios canônicos (OFERTA IMPERDÍVEL … PREÇO ABSURDO) — edições aqui não sobrescrevem essas variações. Variáveis: {{nome}} / {{preco}} / {{desconto}} / {{link}} ou [PRODUTO] / [PREÇO] / [DESCONTO] / [LINK].";

  const editor = (
    <section
      className={variant === "sheet" ? "templates-sheet__body" : "section"}
      aria-label="Lista de modelos"
    >
      <TemplateEditor templates={store.templates} onChange={handleChange} />
    </section>
  );

  if (variant === "sheet") {
    return (
      <div className="templates-sheet__content">
        <header className="templates-sheet__header">
          <div className="templates-sheet__titles">
            <h2 id="modelos-sheet-title" className="section-title">
              Modelos de texto
            </h2>
            <p className="helper">{sub}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              aria-label="Fechar modelos"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </header>
        {editor}
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Modelos de texto</h1>
        <p className="page-sub">{sub}</p>
      </header>
      {editor}
    </div>
  );
}
