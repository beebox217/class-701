import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, browserLocalPersistence, browserSessionPersistence, setPersistence, type User } from "firebase/auth";
import { firebaseAuth, firebaseReady } from "@/lib/firebase";

const DEMO_EMAIL = "teacher@mingde.edu.tw";
const DEMO_PASSWORD = "701demo";
const REMEMBER_CREDS_KEY = "class701_remember_creds";
const DEMO_SESSION_KEY = "mingde701-demo-user";

type AuthContextValue = {
  user: User | { uid: string; email: string | null; displayName: string } | null;
  loading: boolean;
  isDemo: boolean;
  firebaseAuth: ReturnType<typeof getAuth> | null;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  getRememberedCredentials: () => { email: string; password: string } | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function writeRememberedCredentials(email: string, password: string) {
  try {
    localStorage.setItem(REMEMBER_CREDS_KEY, JSON.stringify({ email: email.trim(), password, ts: Date.now() }));
  } catch {
  }
}
function clearRememberedCredentials() {
  try {
    localStorage.removeItem(REMEMBER_CREDS_KEY);
  } catch {
  }
}
function readRememberedCredentials(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === "string" && typeof parsed.password === "string") {
      return { email: parsed.email, password: parsed.password };
    }
  } catch {
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) {
      const sessionStored = sessionStorage.getItem(DEMO_SESSION_KEY);
      const localStored = localStorage.getItem(DEMO_SESSION_KEY);
      if (sessionStored || localStored) {
        setUser({ uid: "demo-teacher", email: DEMO_EMAIL, displayName: "劉老師" });
        setIsDemo(true);
      }
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setIsDemo(false);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isDemo,
    firebaseAuth,
    signIn: async (email, password, rememberMe = true) => {
      if (!firebaseAuth) {
        if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          throw new Error("示範模式帳號或密碼不正確");
        }
        if (rememberMe) {
          localStorage.setItem(DEMO_SESSION_KEY, "1");
          sessionStorage.removeItem(DEMO_SESSION_KEY);
          writeRememberedCredentials(email, password);
        } else {
          sessionStorage.setItem(DEMO_SESSION_KEY, "1");
          localStorage.removeItem(DEMO_SESSION_KEY);
          clearRememberedCredentials();
        }
        setUser({ uid: "demo-teacher", email: DEMO_EMAIL, displayName: "劉老師" });
        setIsDemo(true);
        return;
      }
      await setPersistence(firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (rememberMe) writeRememberedCredentials(email, password);
      else clearRememberedCredentials();
    },
    logout: async () => {
      if (firebaseAuth) await signOut(firebaseAuth);
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      localStorage.removeItem(DEMO_SESSION_KEY);
      clearRememberedCredentials();
      setUser(null);
      setIsDemo(false);
    },
    getRememberedCredentials: readRememberedCredentials,
  }), [user, loading, isDemo]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export const demoCredentials = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
export { firebaseReady };
