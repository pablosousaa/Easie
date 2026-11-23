"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { EasieStore, MigratePayload, PublicUser } from "@/lib/types";
import { exportMigratePayload, hydrateStore, getStoreSnapshot } from "@/lib/storage";

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  cloud: boolean;
  authMode: "dev" | "secure" | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (
    name: string,
    email: string,
    password: string,
    migrateLocal: boolean,
  ) => Promise<string | null>;
  logout: () => Promise<void>;
  pushStore: (store?: EasieStore) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return { user: null as PublicUser | null, authMode: null as "dev" | "secure" | null };
  return (await res.json()) as {
    user: PublicUser | null;
    authMode: "dev" | "secure";
  };
}

async function fetchCloudStore(): Promise<EasieStore | null> {
  const res = await fetch("/api/store", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { store: EasieStore };
  return data.store;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"dev" | "secure" | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me.user);
    setAuthMode(me.authMode);
    if (me.user) {
      const store = await fetchCloudStore();
      if (store) {
        const local = getStoreSnapshot();
        hydrateStore({
          ...store,
          lastProduct: local.lastProduct ?? store.lastProduct,
          variations: local.variations.length ? local.variations : store.variations,
        });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pushStore = useCallback(
    async (store?: EasieStore) => {
      if (!user) return;
      const payload = store ?? getStoreSnapshot();
      await fetch("/api/store", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [user],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { error?: string; user?: PublicUser };
    if (!res.ok) return data.error ?? "Falha no login.";
    setUser(data.user ?? null);
    const store = await fetchCloudStore();
    if (store) hydrateStore(store);
    return null;
  }, []);

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      migrateLocal: boolean,
    ) => {
      const migrate: MigratePayload | undefined = migrateLocal
        ? exportMigratePayload(getStoreSnapshot())
        : undefined;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, migrate }),
      });
      const data = (await res.json()) as { error?: string; user?: PublicUser };
      if (!res.ok) return data.error ?? "Falha ao criar conta.";
      setUser(data.user ?? null);
      const store = await fetchCloudStore();
      if (store) hydrateStore(store);
      return null;
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        cloud: Boolean(user),
        authMode,
        refresh,
        login,
        signup,
        logout,
        pushStore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
