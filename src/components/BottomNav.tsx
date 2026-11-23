"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  ListOrdered,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";

const TABS = [
  { href: "/", label: "Gerar", icon: Sparkles },
  { href: "/fila", label: "Fila", icon: ListOrdered },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/modelos", label: "Modelos", icon: FileText },
  { href: "/conta", label: "Conta", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        {TABS.map(({ href, label, icon: Icon }) => {
          const current =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="tab"
              aria-current={current ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={current ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
