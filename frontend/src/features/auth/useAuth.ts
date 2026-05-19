import { useEffect } from "react";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { apiFetch, ApiRequestError } from "../../lib/api";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

interface AuthState {
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  error: string | null;

  setSession: (session: Session | null) => void;
  refreshProfile: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setError: (error: string | null) => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  error: null,

  setSession: (session) => set({ session, user: session?.user ?? null }),

  refreshProfile: async () => {
    if (!get().session) {
      set({ profile: null });
      return;
    }
    try {
      const data = await apiFetch<{ profile: Profile }>("/me");
      set({ profile: data.profile });
    } catch (err) {
      // /me 401 is expected when session expired; don't blow up.
      if (err instanceof ApiRequestError && err.status === 401) {
        set({ profile: null });
        return;
      }
      // Sonst loggen, aber nicht crashen
      console.error("[useAuth] refreshProfile failed:", err);
      set({ profile: null });
    }
  },

  signInWithPassword: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false, error: "Falsche Email oder Passwort." });
      return;
    }
    set({ session: data.session, user: data.user, loading: false });
    await get().refreshProfile();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  setError: (error) => set({ error }),
}));

// Initialisierung: einmal Session laden + auf Auth-Events lauschen
let authSubscriptionStarted = false;
function startAuthSubscription() {
  if (authSubscriptionStarted) return;
  authSubscriptionStarted = true;

  supabase.auth.getSession().then(async ({ data }) => {
    useAuthStore.setState({ session: data.session, user: data.session?.user ?? null });
    if (data.session) await useAuthStore.getState().refreshProfile();
    useAuthStore.setState({ initialized: true });
  });

  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ session, user: session?.user ?? null });
    if (event === "SIGNED_OUT") {
      useAuthStore.setState({ profile: null });
    }
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      void useAuthStore.getState().refreshProfile();
    }
  });
}

export function useAuth() {
  useEffect(() => {
    startAuthSubscription();
  }, []);
  return useAuthStore();
}
