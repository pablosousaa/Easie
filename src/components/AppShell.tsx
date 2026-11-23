"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  History,
  ListOrdered,
  Package,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/gerar", label: "Gerar", icon: Sparkles },
  { href: "/pegar-produtos", label: "Pegar", icon: Package },
  { href: "/fila", label: "Fila", icon: ListOrdered },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/conta", label: "Conta", icon: UserRound },
] as const;

const MOBILE_TABS = [
  { href: "/gerar", label: "Gerar", icon: Sparkles },
  { href: "/pegar-produtos", label: "Pegar", icon: Package },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/fila", label: "Fila", icon: ListOrdered },
  { href: "/conta", label: "Conta", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/fila" && pathname.startsWith("/checklist/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isConta = pathname === "/conta" || pathname.startsWith("/conta/");

  useEffect(() => {
    if (loading) return;
    if (!user && !isConta) {
      const next = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
      router.replace(`/conta?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, isConta, pathname, router]);

  if (loading) {
    return (
      <div className="saas-app-loading" role="status" aria-live="polite">
        <div className="skeleton skeleton--line" style={{ width: 120 }} />
        <span className="sr-only">Verificando sessão</span>
      </div>
    );
  }

  if (!user && !isConta) {
    return (
      <div className="saas-app-loading" role="status">
        Redirecionando para entrar…
      </div>
    );
  }

  const showNav = Boolean(user);

  return (
    <div className={`saas-app${showNav ? "" : " saas-app--auth"}`}>
      {showNav ? (
        <aside className="saas-sidebar" aria-label="Navegação do aplicativo">
          <div className="saas-sidebar__brand">
            <Link href="/gerar" className="saas-logo">
              Easie<span>.</span>
            </Link>
            <p className="saas-sidebar__tag">Workspace</p>
          </div>
          <nav className="saas-sidebar__nav">
            {NAV.map(({ href, label, icon: Icon }) => {
              const current = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`saas-nav-item${current ? " is-active" : ""}`}
                  aria-current={current ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="saas-sidebar__foot">
            <p className="saas-sidebar__user">
              <span className="saas-sidebar__user-name">{user!.name}</span>
              <span className="saas-sidebar__user-email">@{user!.username}</span>
            </p>
          </div>
        </aside>
      ) : null}

      <div className="saas-main">
        <header className="saas-topbar">
          <Link
            href={user ? "/gerar" : "/"}
            className="saas-logo saas-logo--compact"
          >
            Easie<span>.</span>
          </Link>
          <div className="saas-topbar__actions">
            {user ? (
              <Link href="/conta" className="btn btn-ghost btn-sm">
                {user.name.split(" ")[0]}
              </Link>
            ) : null}
          </div>
        </header>
        <main className="saas-content">{children}</main>
      </div>

      {showNav ? (
        <nav className="saas-bottom-nav" aria-label="Navegação principal">
          <div className="saas-bottom-nav__inner">
            {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
              const current = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`saas-tab${current ? " is-active" : ""}`}
                  aria-current={current ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
