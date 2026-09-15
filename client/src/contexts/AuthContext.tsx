import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { firebaseAuth, firebaseReady } from "@/lib/firebase";

const DEMO_EMAIL = "teacher@mingde.edu.tw";
const DEMO_PASSWORD = "701demo";

type AuthContextValue = {
  user: User | { uid: string; email: string | null; displayName: string } | null;
  loading: boolean;
  isDemo: boolean;
  firebaseAuth: ReturnType<typeof getAuth> | null;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) {
      const stored = sessionStorage.getItem("mingde701-demo-user");
      if (stored) {
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
    signIn: async (email, password) => {
      if (!firebaseAuth) {
        if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          throw new Error("示範模式帳號或密碼不正確");
        }
        sessionStorage.setItem("mingde701-demo-user", "1");
        setUser({ uid: "demo-teacher", email: DEMO_EMAIL, displayName: "劉老師" });
        setIsDemo(true);
        return;
      }
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    },
    logout: async () => {
      if (firebaseAuth) await signOut(firebaseAuth);
      sessionStorage.removeItem("mingde701-demo-user");
      setUser(null);
      setIsDemo(false);
    },
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
