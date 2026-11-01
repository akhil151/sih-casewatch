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
import { supabase, supabaseConfigured } from "../lib/supabase";
import { clearApplicationCache } from "../lib/queryClient";

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

/**
 * Constructs a fully qualified absolute redirect URL for Google OAuth callback.
 * Ensures the scheme (https:// or http://) is always present to prevent Supabase GoTrue
 * from treating a bare domain as a relative path and redirecting to <supabase-ref>.supabase.co/<domain>.
 */
export function getOAuthRedirectUrl(
  customOrigin?: string,
  customBase?: string,
): string {
  let rawOrigin =
    customOrigin ??
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "");

  if (!rawOrigin || rawOrigin === "null") {
    rawOrigin = "https://sih-casewatch.vercel.app";
  }

  rawOrigin = rawOrigin.trim();

  // If origin lacks http:// or https:// scheme, prepend https://
  const validOrigin =
    rawOrigin.startsWith("http://") || rawOrigin.startsWith("https://")
      ? rawOrigin
      : `https://${rawOrigin}`;

  const rawBase = (
    customBase ??
    (typeof import.meta !== "undefined" && (import.meta as any).env?.BASE_URL
      ? (import.meta as any).env.BASE_URL
      : "/")
  ).trim();

  const basePath = rawBase === "/" ? "" : rawBase.replace(/\/+$/, "");
  const callbackPath = `${basePath}/auth/callback`.replace(/\/+/g, "/");

  return new URL(callbackPath, validOrigin).toString();
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
    if (
      !client ||
      (typeof window !== "undefined" &&
        window.sessionStorage.getItem(demoStorageKey) === "true")
    ) {
      setIsLoading(false);
      return;
    }

    let active = true;

    // 1. Inspect URL parameters and hash for OAuth errors (e.g., user cancellation or access denied)
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "");
      const search = window.location.search.replace(/^\?/, "");
      const hashParams = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(search);

      const rawError =
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error");

      if (rawError) {
        const decoded = decodeURIComponent(rawError.replace(/\+/g, " "));
        setAuthError(decoded);
        setIsLoading(false);
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {
          // ignore
        }
      }
    }

    const cleanUrlTokens = () => {
      if (
        typeof window !== "undefined" &&
        window.location.hash.includes("access_token")
      ) {
        try {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        } catch {
          // ignore
        }
      }
    };

    const initialize = async () => {
      const { data, error } = await client.auth.getSession();
      if (!active) return;
      if (error) setAuthError(error.message);
      await loadProfile(data.session?.user ?? null);
      cleanUrlTokens();
    };

    void initialize().catch((error: unknown) => {
      if (!active) return;
      setAuthError(formatAuthError(error));
      setIsLoading(false);
    });

    const { data } = client.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        if (!active) return;
        if (
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(demoStorageKey) === "true"
        )
          return;
        setIsLoading(Boolean(session));
        void Promise.resolve().then(async () => {
          await loadProfile(session?.user ?? null);
          cleanUrlTokens();
        });
      },
    );

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
    const redirectTo = getOAuthRedirectUrl();
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
    clearApplicationCache();
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
    clearApplicationCache();
    window.sessionStorage.setItem(demoStorageKey, "true");
    setAuthError(null);
    setProfile(null);
    setMode("demo");
  }, []);

  const leaveDemoMode = useCallback(() => {
    clearApplicationCache();
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
