"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";

const TABS = [
  { href: "/", label: "Gerar", icon: Sparkles },
  { href: "/modelos", label: "Modelos", icon: FileText },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        {TABS.map(({ href, label, icon: Icon }) => {
          const current =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="tab"
              aria-current={current ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={current ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
