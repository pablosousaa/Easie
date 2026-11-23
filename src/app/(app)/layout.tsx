import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="saas-app-loading">Carregando…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
