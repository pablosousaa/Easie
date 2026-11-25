"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

type ToastKind = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
  leaving?: boolean;
};

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const EXIT_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t != null) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const removeNow = useCallback((id: string) => {
    clearTimer(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearTimer]);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      const exitTimer = window.setTimeout(() => removeNow(id), EXIT_MS);
      timers.current.set(id, exitTimer);
    },
    [clearTimer, removeNow],
  );

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
      if (kind === "success") {
        const auto = window.setTimeout(() => dismiss(id), 3200);
        timers.current.set(id, auto);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.kind}${toast.leaving ? " toast--out" : ""}`}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <p className="toast__message">{toast.message}</p>
            <button
              type="button"
              className="toast__dismiss"
              aria-label="Fechar aviso"
              onClick={() => dismiss(toast.id)}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
