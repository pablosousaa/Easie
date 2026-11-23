"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  BarChart3,
  Download,
  LogIn,
  LogOut,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import {
  downloadTextFile,
  exportStoreToCsv,
  importStoreFromCsv,
} from "@/lib/csv";
import { createDefaultTemplate } from "@/lib/templates";
import {
  getServerSnapshot,
  getStoreSnapshot,
  hydrateStore,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

export function AccountApp() {
  const {
    user,
    loading,
    cloud,
    authMode,
    login,
    signup,
    logout,
    deleteAccount,
    pushStore,
  } = useAuth();
  const { showToast } = useToast();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [migrateLocal, setMigrateLocal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err =
      mode === "login"
        ? await login(email, password)
        : await signup(name, email, password, migrateLocal);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    showToast(mode === "login" ? "Login ok. Dados na nuvem." : "Conta criada.");
  }

  async function saveWindow() {
    const days = Math.max(1, store.settings.repostWindowDays || 7);
    const next = {
      ...store,
      settings: { ...store.settings, repostWindowDays: days },
    };
    replaceStore(next);
    if (cloud) await pushStore(next);
    showToast("Janela de re-post salva.");
  }

  async function handleLogout() {
    await logout();
    showToast("Sessão encerrada. Dados locais continuam neste aparelho.");
  }

  function handleExport() {
    const csv = exportStoreToCsv(store);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`easie-backup-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    showToast("Backup CSV baixado.");
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importStoreFromCsv(text);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    const ok = window.confirm(
      "Importar este backup substitui os dados atuais deste aparelho (e da conta, se estiver logado). Continuar?",
    );
    if (!ok) return;
    hydrateStore(result.store);
    if (cloud) await pushStore(result.store);
    showToast("Backup importado.");
  }

  async function handleDeleteAccount() {
    const ok = window.confirm(
      "Excluir permanentemente sua conta e todos os dados na nuvem? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
    const typed = window.prompt('Digite EXCLUIR para confirmar:');
    if (typed !== "EXCLUIR") {
      showToast("Exclusão cancelada.", "error");
      return;
    }
    setBusy(true);
    const err = await deleteAccount();
    setBusy(false);
    if (err) {
      showToast(err, "error");
      return;
    }
    replaceStore({
      products: [],
      lastProduct: null,
      templates: [createDefaultTemplate()],
      variations: [],
      groups: [],
      postings: [],
      settings: { repostWindowDays: 7 },
    });
    showToast("Conta e dados na nuvem excluídos.");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Conta</h1>
        <p className="page-sub">
          Ambiente individual: seus produtos, grupos e histórico ficam só na sua conta.
        </p>
      </header>

      <section className="section">
        {loading ? (
          <div className="surface empty">Carregando sessão…</div>
        ) : user ? (
          <div className="surface stack-gap">
            <p className="helper" style={{ margin: 0 }}>
              Conectado como
            </p>
            <p className="entity-card__title" style={{ margin: 0 }}>
              {user.name}
            </p>
            <p className="helper">{user.email}</p>
            {authMode === "dev" ? (
              <p className="warn-banner">
                AUTH_SECRET não definido — usando segredo de desenvolvimento. Defina
                AUTH_SECRET em produção.
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => void handleLogout()}
            >
              <LogOut size={18} aria-hidden />
              Sair
            </button>
          </div>
        ) : (
          <div className="surface">
            <div className="segmented" role="tablist" aria-label="Tipo de acesso">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "is-active" : undefined}
                onClick={() => setMode("login")}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "is-active" : undefined}
                onClick={() => setMode("signup")}
              >
                Criar conta
              </button>
            </div>

            <form className="stack-gap" style={{ marginTop: 16 }} onSubmit={handleAuth}>
              {mode === "signup" ? (
                <div className="field">
                  <label className="label" htmlFor="acc-name">
                    Nome
                  </label>
                  <input
                    id="acc-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              ) : null}
              <div className="field">
                <label className="label" htmlFor="acc-email">
                  E-mail
                </label>
                <input
                  id="acc-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="acc-password">
                  Senha
                </label>
                <input
                  id="acc-password"
                  className="input"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {mode === "signup" ? (
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={migrateLocal}
                    onChange={(e) => setMigrateLocal(e.target.checked)}
                  />
                  <span className="toggle-control" aria-hidden />
                  <span className="toggle-text">
                    Trazer dados deste aparelho (localStorage) para a conta
                  </span>
                </label>
              ) : null}
              {error ? <p className="field__error">{error}</p> : null}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={busy}
              >
                {mode === "login" ? (
                  <>
                    <LogIn size={18} aria-hidden />
                    Entrar
                  </>
                ) : (
                  <>
                    <UserPlus size={18} aria-hidden />
                    Criar conta
                  </>
                )}
              </button>
              <p className="helper">
                Sem conta, o app continua no navegador. Com conta, os dados ficam na
                nuvem (SQLite no servidor).
              </p>
            </form>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
          Backup CSV
        </h2>
        <div className="surface stack-gap">
          <p className="helper" style={{ margin: 0 }}>
            Exporte tudo (produtos, grupos, modelos, postagens e resultados) para
            trocar de aparelho ou guardar uma cópia. Importe o mesmo arquivo para
            restaurar.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleExport}>
            <Download size={18} aria-hidden />
            Exportar CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={18} aria-hidden />
            Importar CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleImportFile(file);
            }}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
          Re-post
        </h2>
        <div className="surface">
          <div className="field">
            <label className="label" htmlFor="repost-days">
              Janela mínima entre posts do mesmo produto no mesmo grupo (dias)
            </label>
            <input
              id="repost-days"
              className="input"
              type="number"
              min={1}
              max={90}
              value={store.settings.repostWindowDays}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                replaceStore({
                  ...store,
                  settings: {
                    repostWindowDays: Number.isFinite(value) ? value : 7,
                  },
                });
              }}
            />
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => void saveWindow()}
            >
              Salvar preferência
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <Link href="/relatorios" className="btn btn-secondary btn-block">
          <BarChart3 size={18} aria-hidden />
          Ver relatórios
        </Link>
      </section>

      {user ? (
        <section className="section" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="page-title" style={{ fontSize: "1.125rem" }}>
            Zona de risco
          </h2>
          <div className="surface stack-gap">
            <p className="helper" style={{ margin: 0 }}>
              Apaga a conta na nuvem e todos os dados associados. Exporte um CSV antes,
              se quiser guardar.
            </p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={busy}
              onClick={() => void handleDeleteAccount()}
            >
              <Trash2 size={18} aria-hidden />
              Excluir conta
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
