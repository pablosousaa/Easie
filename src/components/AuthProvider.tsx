"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { EasieStore, PublicUser } from "@/lib/types";
import {
  clearPersistedStore,
  getStoreSnapshot,
  hydrateStore,
  resetMemoryStore,
} from "@/lib/storage";

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  cloud: boolean;
  authMode: "dev" | "secure" | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  pushStore: (store?: EasieStore) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    return {
      user: null as PublicUser | null,
      authMode: null as "dev" | "secure" | null,
    };
  }
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
      if (store) hydrateStore(store);
    } else {
      resetMemoryStore();
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
    if (!res.ok) return data.error ?? "Falha no login";
    setUser(data.user ?? null);
    const store = await fetchCloudStore();
    if (store) hydrateStore(store);
    else resetMemoryStore();
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    clearPersistedStore();
  }, []);

  const deleteAccount = useCallback(async () => {
    const res = await fetch("/api/auth/account", {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) return data.error ?? "Não foi possível excluir a conta";
    setUser(null);
    clearPersistedStore();
    return null;
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
        logout,
        deleteAccount,
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
