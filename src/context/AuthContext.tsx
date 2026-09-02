import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { authApi } from "../lib/resources";
import { ApiError } from "../lib/apiClient";
import type { DashboardUser } from "../types/api";

type AuthStatus = "loading" | "signed-out" | "unauthorized" | "authorized";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: DashboardUser | null;
  unauthorizedReason: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DashboardUser | null>(null);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null);

  async function resolveProfile(nextSession: Session | null) {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setStatus("signed-out");
      return;
    }
    try {
      const { data } = await authApi.me();
      setProfile(data);
      setStatus("authorized");
    } catch (err) {
      setProfile(null);
      setUnauthorizedReason(err instanceof ApiError ? err.message : "This account can't access the dashboard");
      setStatus("unauthorized");
    }
  }

  useEffect(() => {
    // Without the catch, a rejected getSession() leaves status at "loading"
    // forever — the user sees a permanent spinner instead of the login page.
    supabase.auth
      .getSession()
      .then(({ data }) => resolveProfile(data.session))
      .catch(() => resolveProfile(null));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      resolveProfile(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, session, profile, unauthorizedReason, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
