"use client";

import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Download,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  Upload,
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
  clearPersistedStore,
  getServerSnapshot,
  getStoreSnapshot,
  hydrateStore,
  replaceStore,
  subscribeStore,
} from "@/lib/storage";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/gerar";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
  } catch {
    /* ignore */
  }
  return "/gerar";
}

function AccountAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const {
    user,
    loading,
    cloud,
    authMode,
    login,
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    showToast("Login ok — dados na nuvem");
    router.replace(nextPath);
  }

  async function saveWindow() {
    const days = Math.max(1, store.settings.repostWindowDays || 7);
    const next = {
      ...store,
      settings: { ...store.settings, repostWindowDays: days },
    };
    replaceStore(next);
    if (cloud) await pushStore(next);
    showToast("Janela de re-post salva");
  }

  async function handleLogout() {
    await logout();
    showToast("Sessão encerrada");
    router.replace("/conta");
  }

  function handleExport() {
    const csv = exportStoreToCsv(store);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`easie-backup-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    showToast("Backup CSV baixado");
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importStoreFromCsv(text);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    const ok = window.confirm(
      "Importar este backup substitui os dados atuais da conta. Continuar?",
    );
    if (!ok) return;
    hydrateStore(result.store);
    if (cloud) await pushStore(result.store);
    showToast("Backup importado");
  }

  async function handleDeleteAccount() {
    const ok = window.confirm(
      "Excluir permanentemente sua conta e todos os dados na nuvem? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
    const typed = window.prompt("Digite EXCLUIR para confirmar:");
    if (typed !== "EXCLUIR") {
      showToast("Exclusão cancelada", "error");
      return;
    }
    setBusy(true);
    const err = await deleteAccount();
    setBusy(false);
    if (err) {
      showToast(err, "error");
      return;
    }
    clearPersistedStore();
    replaceStore({
      products: [],
      lastProduct: null,
      templates: [createDefaultTemplate()],
      variations: [],
      groups: [],
      postings: [],
      settings: { repostWindowDays: 7 },
      trendingTakenIds: [],
      trendingHiddenIds: [],
    });
    showToast("Conta e dados na nuvem excluídos");
    router.replace("/conta");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Conta</h1>
        <p className="page-sub">
          {user
            ? "Sessão, backup e preferências — dados só da sua conta"
            : "Entre com a conta criada pelo administrador"}
        </p>
      </header>

      <section className="section" aria-labelledby="session-heading">
        <h2 id="session-heading" className="section-title">
          Sessão
        </h2>
        {loading ? (
          <div className="surface stack-gap" aria-busy="true" aria-live="polite">
            <div className="skeleton skeleton--line" style={{ width: "40%" }} />
            <div className="skeleton skeleton--line" style={{ width: "70%" }} />
            <div className="skeleton skeleton--btn" />
            <span className="sr-only">Carregando sessão</span>
          </div>
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
              <p className="warn-banner" role="status">
                AUTH_SECRET não definido — segredo de desenvolvimento. Defina
                AUTH_SECRET em produção.
              </p>
            ) : null}
            <Link href="/gerar" className="btn btn-primary btn-block">
              Abrir workspace
            </Link>
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
            <div className="callout callout--next" style={{ marginBottom: 16 }}>
              <div className="callout__body">
                <p className="callout__title">Acesso restrito</p>
                <p className="helper">
                  Não há cadastro público. Peça uma conta ao administrador do
                  Easie.
                </p>
              </div>
            </div>

            <form className="stack-gap auth-form" onSubmit={handleAuth}>
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
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="acc-password">
                  Senha
                </label>
                <input
                  id="acc-password"
                  className={`input${error ? " input--error" : ""}`}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={busy}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "acc-error" : "acc-hint"}
                />
              </div>
              {error ? (
                <p id="acc-error" className="field__error" role="alert">
                  {error}
                </p>
              ) : (
                <p id="acc-hint" className="helper">
                  Depois do login você vai para o workspace. Dados ficam na
                  nuvem, só na sua conta.
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <Loader2 size={18} className="spin" aria-hidden />
                ) : (
                  <LogIn size={18} aria-hidden />
                )}
                {busy ? "Aguarde…" : "Entrar"}
              </button>
            </form>
          </div>
        )}
      </section>

      {user ? (
        <>
          <section className="section" aria-labelledby="backup-heading">
            <h2 id="backup-heading" className="section-title">
              Backup CSV
            </h2>
            <div className="surface stack-gap">
              <p className="helper" style={{ margin: 0 }}>
                Exporte para trocar de aparelho. Importe o mesmo arquivo para
                restaurar na conta.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={handleExport}
              >
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
            <h2 id="settings-heading" className="section-title">
              Re-post
            </h2>
            <div className="surface">
              <div className="field">
                <label className="label" htmlFor="repost-days">
                  Dias mínimos entre o mesmo produto no mesmo grupo
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

          <section className="section" aria-labelledby="danger-heading">
            <h2 id="danger-heading" className="section-title">
              Zona de risco
            </h2>
            <div className="surface stack-gap">
              <p className="helper" style={{ margin: 0 }}>
                Apaga a conta na nuvem e todos os dados. Exporte um CSV antes se
                quiser guardar.
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
        </>
      ) : null}
    </div>
  );
}

export function AccountApp() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <div className="surface stack-gap" aria-busy="true">
            <div className="skeleton skeleton--line" style={{ width: "40%" }} />
            <div className="skeleton skeleton--btn" />
          </div>
        </div>
      }
    >
      <AccountAppInner />
    </Suspense>
  );
}
