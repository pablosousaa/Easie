import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Instrument_Sans, Space_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";
import "./auth-starfield.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Easie — Workspace de divulgação para afiliados",
  description:
    "Gere textos, controle grupos do Facebook e acompanhe o checklist de divulgação do Mercado Livre. Acesso por conta individual.",
  applicationName: "Easie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141415",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${instrumentSans.variable} ${cormorant.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
