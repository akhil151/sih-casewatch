import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export interface AuthProfile {
  id: string;
  displayName: string;
  email: string;
  role: string;
  approvalStatus: string;
  region?: string;
  bureau?: string;
}

export interface AuthContextValue {
  mode: "setup" | "signed-in" | "demo";
  isLoading: boolean;
  profile: AuthProfile | null;
  supabaseConfigured: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  leaveDemoMode: () => void;
}

const demoStorageKey = "nexus.simulated-demo-mode";
const AuthContext = createContext<AuthContextValue | null>(null);

function formatAuthError(error: unknown) {
  return error instanceof Error ? error.message : "Authentication failed.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthContextValue["mode"]>(() =>
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(demoStorageKey) === "true"
      ? "demo"
      : "setup",
  );
  const [isLoading, setIsLoading] = useState(
    () => supabaseConfigured && typeof window !== "undefined" &&
      window.sessionStorage.getItem(demoStorageKey) !== "true",
  );
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user || !supabase) {
      setProfile(null);
      setMode("setup");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, email, role, approval_status, region, bureau")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setAuthError(
        `Signed in, but the account profile could not be loaded: ${error.message}`,
      );
      setMode("signed-in");
      setIsLoading(false);
      return;
    }

    if (!data) {
      setProfile(null);
      setAuthError(
        "Your account profile is not provisioned yet. Ask an administrator to check the Supabase signup trigger.",
      );
      setMode("signed-in");
      setIsLoading(false);
      return;
    }

    setProfile({
      id: data.id,
      displayName: data.display_name || user.user_metadata?.full_name || "Officer",
      email: data.email || user.email || "",
      role: data.role,
      approvalStatus: data.approval_status,
      region: data.region || undefined,
      bureau: data.bureau || undefined,
    });
    setAuthError(null);
    setMode("signed-in");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || window.sessionStorage.getItem(demoStorageKey) === "true") {
      setIsLoading(false);
      return;
    }

    let active = true;
    const initialize = async () => {
      const { data, error } = await client.auth.getSession();
      if (!active) return;
      if (error) setAuthError(error.message);
      await loadProfile(data.session?.user ?? null);
    };
    void initialize().catch((error: unknown) => {
      if (!active) return;
      setAuthError(formatAuthError(error));
      setIsLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!active) return;
      if (window.sessionStorage.getItem(demoStorageKey) === "true") return;
      setIsLoading(Boolean(session));
      void Promise.resolve().then(() => loadProfile(session?.user ?? null));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setAuthError("Connect Supabase before signing in with Google.");
      return;
    }

    setAuthError(null);
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const redirectTo = new URL(
      `${basePath}/auth/callback`,
      window.location.origin,
    ).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (mode === "demo") {
      window.sessionStorage.removeItem(demoStorageKey);
      setMode("setup");
      setProfile(null);
      return;
    }

    if (!supabase) {
      setMode("setup");
      setProfile(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    setProfile(null);
    setMode("setup");
  }, [mode]);

  const enterDemoMode = useCallback(() => {
    window.sessionStorage.setItem(demoStorageKey, "true");
    setAuthError(null);
    setProfile(null);
    setMode("demo");
  }, []);

  const leaveDemoMode = useCallback(() => {
    window.sessionStorage.removeItem(demoStorageKey);
    setMode("setup");
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isLoading,
      profile,
      supabaseConfigured,
      authError,
      signInWithGoogle,
      signOut,
      enterDemoMode,
      leaveDemoMode,
    }),
    [
      mode,
      isLoading,
      profile,
      authError,
      signInWithGoogle,
      signOut,
      enterDemoMode,
      leaveDemoMode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
