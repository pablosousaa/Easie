import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Easie — Gerador de posts de afiliado",
  description:
    "Monte textos de divulgação para grupos do Facebook a partir do seu produto do Mercado Livre.",
  applicationName: "Easie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>
          <div className="app-shell">
            {children}
            <BottomNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
