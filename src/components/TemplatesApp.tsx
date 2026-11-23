"use client";

import { useSyncExternalStore } from "react";
import { TemplateEditor } from "./TemplateEditor";
import { useAuth } from "./AuthProvider";
import type { TextTemplate } from "@/lib/types";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

export function TemplatesApp() {
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

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Modelos de texto</h1>
        <p className="page-sub">
          Crie modelos com variáveis. O modelo marcado como padrão é usado ao gerar posts.
        </p>
      </header>

      <section className="section" aria-label="Lista de modelos">
        <TemplateEditor templates={store.templates} onChange={handleChange} />
      </section>
    </div>
  );
}
