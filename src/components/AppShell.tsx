"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
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
  { href: "/modelos", label: "Modelos", icon: FileText },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="saas-app">
      <aside className="saas-sidebar" aria-label="Navegação do aplicativo">
        <div className="saas-sidebar__brand">
          <Link href="/" className="saas-logo">
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
          {user ? (
            <p className="saas-sidebar__user">
              <span className="saas-sidebar__user-name">{user.name}</span>
              <span className="saas-sidebar__user-email">{user.email}</span>
            </p>
          ) : (
            <Link href="/conta" className="btn btn-secondary btn-block btn-sm">
              Entrar
            </Link>
          )}
        </div>
      </aside>

      <div className="saas-main">
        <header className="saas-topbar">
          <Link href="/" className="saas-logo saas-logo--compact">
            Easie<span>.</span>
          </Link>
          <div className="saas-topbar__actions">
            <Link href="/conta" className="btn btn-ghost btn-sm">
              {user ? user.name.split(" ")[0] : "Conta"}
            </Link>
          </div>
        </header>
        <main className="saas-content">{children}</main>
      </div>

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
    </div>
  );
}
