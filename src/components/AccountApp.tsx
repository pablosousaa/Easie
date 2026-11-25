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
import { AuthStarfield } from "./AuthStarfield";
import { useToast } from "./ToastProvider";
import {
  downloadTextFile,
  exportStoreToCsv,
  importStoreFromCsv,
} from "@/lib/csv";
import { createAdTemplates } from "@/lib/templates";
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

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(username, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    showToast("Login ok");
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
    showToast("Preferência salva");
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
    showToast("Backup baixado");
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

  function historyProducts() {
    return store.products.filter(
      (p) => p.status === "done" || p.status === "archived",
    );
  }

  async function handleClearHistory() {
    const done = historyProducts();
    if (done.length === 0) {
      showToast("Histórico já está vazio", "error");
      return;
    }
    const ok = window.confirm(
      `Limpar o histórico desta conta? Isso remove ${done.length} produto(s) concluído(s) e as postagens ligadas a eles. A fila, grupos e modelos ficam intactos. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    const typed = window.prompt("Digite LIMPAR para confirmar:");
    if (typed !== "LIMPAR") {
      showToast("Limpeza cancelada", "error");
      return;
    }

    const historyIds = new Set(done.map((p) => p.id));
    const next = {
      ...store,
      products: store.products.filter((p) => !historyIds.has(p.id)),
      postings: store.postings.filter((p) => !historyIds.has(p.productId)),
    };

    setBusy(true);
    replaceStore(next);
    if (cloud) await pushStore(next);
    setBusy(false);
    showToast("Histórico limpo");
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
      templates: createAdTemplates(),
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

  const guest = !loading && !user;

  if (guest || loading) {
    return (
      <>
        <AuthStarfield />
        <div className="page page--auth">
          <header className="auth-hero">
            <h1 className="auth-hero__brand" aria-label="Easie">
              Easie<span className="auth-hero__dot">.</span>
            </h1>
          </header>

          <section className="section" aria-labelledby="login-heading">
            {loading ? (
              <div
                className="surface stack-gap"
                aria-busy="true"
                aria-live="polite"
              >
                <div
                  className="skeleton skeleton--line"
                  style={{ width: "40%" }}
                />
                <div
                  className="skeleton skeleton--line"
                  style={{ width: "70%" }}
                />
                <div className="skeleton skeleton--btn" />
                <span className="sr-only">Carregando sessão</span>
              </div>
            ) : (
              <div className="surface auth-card">
                <div
                  className="callout callout--next"
                  style={{ marginBottom: 16 }}
                >
                  <div className="callout__body">
                    <p className="callout__title" id="login-heading">
                      Acesso restrito
                    </p>
                    <p className="helper">
                      Não há cadastro público. Peça uma conta ao administrador
                      do Easie.
                    </p>
                  </div>
                </div>

                <form className="stack-gap auth-form" onSubmit={handleAuth}>
                  <div className="field">
                    <label className="label" htmlFor="acc-username">
                      Usuário
                    </label>
                    <input
                      id="acc-username"
                      className="input"
                      type="text"
                      autoComplete="username"
                      inputMode="text"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={2}
                      maxLength={32}
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
        </div>
      </>
    );
  }

  // guest/loading already returned — user is signed in here
  const account = user!;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Conta</h1>
        <p className="page-sub">
          Sessão, backup e preferências — dados só da sua conta
        </p>
      </header>

      <section className="section" aria-labelledby="session-heading">
        <h2 id="session-heading" className="section-title">
          Sessão
        </h2>
        <div className="surface stack-gap">
          <p className="helper" style={{ margin: 0 }}>
            Conectado como
          </p>
          <p className="entity-card__title" style={{ margin: 0 }}>
            {account.name}
          </p>
          <p className="helper">@{account.username}</p>
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
      </section>

      <section className="section prefs-section" aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className="section-title">
          Preferências
        </h2>
        <div className="surface prefs-panel stack-gap">
          <div className="prefs-panel__block">
            <p className="prefs-panel__label">Backup CSV</p>
            <p className="helper" style={{ margin: 0 }}>
              Exporte para trocar de aparelho. Importe o mesmo arquivo para
              restaurar
            </p>
            <div className="prefs-panel__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExport}
              >
                <Download size={18} aria-hidden />
                Exportar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={18} aria-hidden />
                Importar
              </button>
            </div>
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

          <div className="prefs-panel__block">
            <p className="prefs-panel__label">Re-post</p>
            <div className="field" style={{ marginTop: 0 }}>
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void saveWindow()}
            >
              Salvar
            </button>
          </div>

          <Link href="/relatorios" className="btn btn-ghost">
            <BarChart3 size={18} aria-hidden />
            Ver relatórios
          </Link>
        </div>
      </section>

      <section
        className="section danger-section"
        aria-labelledby="danger-heading"
      >
        <h2 id="danger-heading" className="section-title danger-section__title">
          Zona de risco
        </h2>
        <div className="surface danger-zone">
          <div className="danger-zone__block">
            <p className="helper" style={{ margin: 0 }}>
              Remove só o histórico (produtos concluídos e postagens). Fila,
              grupos e modelos ficam
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={busy || historyProducts().length === 0}
              onClick={() => void handleClearHistory()}
            >
              <Trash2 size={18} aria-hidden />
              Limpar histórico
            </button>
          </div>
          <div className="danger-zone__block danger-zone__block--critical">
            <p className="helper" style={{ margin: 0 }}>
              Apaga a conta na nuvem e todos os dados. Exporte um CSV antes
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
        </div>
      </section>
    </div>
  );
}

export function AccountApp() {
  return (
    <Suspense
      fallback={
        <>
          <AuthStarfield />
          <div className="page page--auth">
            <header className="auth-hero">
              <p className="auth-hero__brand" aria-hidden>
                Easie<span className="auth-hero__dot">.</span>
              </p>
            </header>
            <div className="surface stack-gap" aria-busy="true">
              <div
                className="skeleton skeleton--line"
                style={{ width: "40%" }}
              />
              <div className="skeleton skeleton--btn" />
            </div>
          </div>
        </>
      }
    >
      <AccountAppInner />
    </Suspense>
  );
}
