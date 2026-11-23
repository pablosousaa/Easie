"use client";

import { useState, useSyncExternalStore } from "react";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";
import {
  getServerSnapshot,
  getStoreSnapshot,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

export function AccountApp() {
  const { user, loading, cloud, authMode, login, signup, logout, pushStore } =
    useAuth();
  const { showToast } = useToast();
  const store = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );

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

  return (
    <div className="page">
      <header>
        <p className="brand">
          Easie<span>.</span>
        </p>
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
                Sem conta, o app continua no navegador (Fase 1). Com conta, os dados
                ficam na nuvem (SQLite local / arquivo do servidor).
              </p>
            </form>
          </div>
        )}
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
    </div>
  );
}
