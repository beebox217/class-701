import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseReady } from "@/lib/firebase";
import {
  addStudent as addFirestoreStudent,
  addTransaction as addFirestoreTransaction,
  listSettings as listFirestoreSettings,
  listStudents as listFirestoreStudents,
  listTransactions as listFirestoreTransactions,
  registerTransactionImagesFromFirestore,
  removeStudent as removeFirestoreStudent,
  removeTransaction as removeFirestoreTransaction,
  updateStudent as updateFirestoreStudent,
  updateStudentPaid as updateFirestoreStudentPaid,
  updateTransaction as updateFirestoreTransaction,
  type ClassStudent,
  type ClassTransaction,
  type TransactionKind,
} from "@/lib/firestore";

const demoTransactions: ClassTransaction[] = [];

const demoStudents: ClassStudent[] = [];

type ClassDataContextValue = {
  transactions: ClassTransaction[];
  students: ClassStudent[];
  settings: Record<string, unknown>;
  loading: boolean;
  usingDemo: boolean;
  refresh: () => Promise<void>;
  addTransaction: (input: { title: string; amount: number; type: TransactionKind; images?: string[] }) => Promise<string>;
  updateTransaction: (id: string, patch: { title?: string; amount?: number; type?: TransactionKind; images?: string[] }) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  toggleStudent: (input: { studentId: string; paymentId?: string }) => Promise<void>;
  addStudent: (input: { no: string; name: string; paid?: boolean; note?: string; payments?: Record<string, boolean> }) => Promise<void>;
  updateStudent: (id: string, patch: Partial<Pick<ClassStudent, "no" | "name" | "note"> & { paid?: boolean; payments?: Record<string, boolean> }>) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
};

const ClassDataContext = createContext<ClassDataContextValue | null>(null);

export function ClassDataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const [transactions, setTransactions] = useState<ClassTransaction[]>(firebaseReady ? [] : demoTransactions);
  const [students, setStudents] = useState<ClassStudent[]>(firebaseReady ? [] : demoStudents);
  const [settings, setSettings] = useState<Record<string, unknown>>({
    payment: [
      { id: "default", title: "10月班費", amount: 300 },
    ],
  });
  const [loading, setLoading] = useState(firebaseReady);

  const normalizeSettings = useCallback((raw: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...raw };
    const defaultPaymentItem = { id: "default", title: "10月班費", amount: 300 };
    if (Array.isArray(next.payment)) {
      if (!next.payment.length) {
        next.payment = [defaultPaymentItem];
      } else {
        next.payment = next.payment.map((item, index) => {
          if (item && typeof item === "object" && "title" in item && "amount" in item) {
            const anyItem = item as Record<string, unknown>;
            return {
              id: typeof anyItem.id === "string" && anyItem.id.length ? anyItem.id : (index === 0 ? "default" : `p_${Date.now()}_${index}`),
              title: String(anyItem.title ?? "未命名繳費項目"),
              amount: Number.isFinite(Number(anyItem.amount)) ? Math.max(1, Math.floor(Number(anyItem.amount))) : 100,
            };
          }
          return { ...defaultPaymentItem, id: index === 0 ? "default" : `p_${Date.now()}_${index}` };
        });
      }
    } else if (next.payment && typeof next.payment === "object") {
      const obj = next.payment as Record<string, unknown>;
      next.payment = [
        {
          id: typeof obj.id === "string" && obj.id.length ? obj.id : "default",
          title: String(obj.title ?? "10月班費"),
          amount: Number.isFinite(Number(obj.amount)) ? Math.max(1, Math.floor(Number(obj.amount))) : 300,
        },
      ];
    } else {
      next.payment = [defaultPaymentItem];
    }
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!firebaseReady || !user || isDemo) {
      setTransactions(demoTransactions);
      setStudents(demoStudents);
      setSettings(normalizeSettings({ demo: true }));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextTransactions, nextSettingsRaw] = await Promise.all([
        listFirestoreTransactions(),
        listFirestoreSettings(),
      ]);
      const nextSettings = normalizeSettings(nextSettingsRaw);
      const nextStudents = await listFirestoreStudents({ settingsPayment: nextSettings.payment });
      setTransactions(nextTransactions);
      registerTransactionImagesFromFirestore(nextTransactions);
      setStudents(nextStudents);
      setSettings(nextSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "資料讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [isDemo, normalizeSettings, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<ClassDataContextValue>(() => ({
    transactions,
    students,
    settings,
    loading,
    usingDemo: isDemo || !firebaseReady,
    refresh,
    addTransaction: async (input) => {
      if (!firebaseReady || isDemo) {
        const id = `demo-${Date.now()}`;
        setTransactions((current) => [
          {
            id,
            title: input.title,
            meta: "剛剛 · 示範模式",
            amount: input.type === "out" ? -Math.abs(input.amount) : Math.abs(input.amount),
            type: input.type,
            images: Array.isArray(input.images) ? input.images.filter((v) => typeof v === "string").slice(0, 3) : [],
          },
          ...current,
        ]);
        return id;
      }
      const id = await addFirestoreTransaction(input);
      await refresh();
      return id;
    },
    updateTransaction: async (id, patch) => {
      if (!firebaseReady || isDemo) {
        setTransactions((current) => current.map((t) => {
          if (t.id !== id) return t;
          const nextAmount = "amount" in patch ? Math.abs(Number(patch.amount) || 0) : Math.abs(t.amount);
          const nextType = patch.type ?? t.type;
          const signed = nextType === "out" ? -Math.abs(nextAmount) : Math.abs(nextAmount);
          const nextImages = "images" in patch ? (Array.isArray(patch.images) ? patch.images.filter((v) => typeof v === "string").slice(0, 3) : t.images) : t.images;
          return { ...t, title: patch.title ?? t.title, amount: signed, type: nextType, images: nextImages };
        }));
        return;
      }
      await updateFirestoreTransaction(id, patch);
      await refresh();
    },
    removeTransaction: async (id) => {
      if (!firebaseReady || isDemo) {
        setTransactions((current) => current.filter((t) => t.id !== id));
        return;
      }
      await removeFirestoreTransaction(id);
      await refresh();
    },
    toggleStudent: async (input) => {
      const { studentId, paymentId } = input;
      const current = students.find((student) => student.id === studentId);
      if (!current) return;
      const list = Array.isArray(settings.payment) ? (settings.payment as any[]) : [];
      const effectivePaymentId = paymentId ?? (list.length ? (list[0]?.id as string) : "default");
      if (!firebaseReady || isDemo) {
        setStudents((items) => items.map((student) => {
          if (student.id !== studentId) return student;
          const nextPayments: Record<string, boolean> = { ...(student.payments ?? {}) };
          const prev = Boolean(nextPayments[effectivePaymentId] ?? student.paid);
          nextPayments[effectivePaymentId] = !prev;
          const anyPending = Object.values(nextPayments).some((v) => !v);
          return {
            ...student,
            paid: !anyPending,
            payments: nextPayments,
            note: anyPending ? "待補繳" : `已繳 ${Object.keys(nextPayments).length} 項`,
          };
        }));
        return;
      }
      const currentVal = (() => {
        if (current.payments && typeof current.payments === "object" && effectivePaymentId in current.payments) {
          return Boolean((current.payments as any)[effectivePaymentId]);
        }
        return Boolean(current.paid);
      })();
      await updateFirestoreStudentPaid(studentId, { paymentId: effectivePaymentId, paid: !currentVal });
      await refresh();
    },
    addStudent: async (input) => {
      if (!firebaseReady || isDemo) {
        const list = Array.isArray(settings.payment) ? (settings.payment as any[]) : [];
        const initialPayments: Record<string, boolean> = input.payments && typeof input.payments === "object"
          ? Object.fromEntries(Object.entries(input.payments).map(([k, v]) => [k, Boolean(v)]))
          : Object.fromEntries(list.map((p) => [String(p.id), Boolean(input.paid)]));
        if (!Object.keys(initialPayments).length) initialPayments.default = Boolean(input.paid);
        const anyPending = Object.values(initialPayments).some((v) => !v);
        setStudents((items) => [...items, {
          id: `demo-${Date.now()}`,
          no: String(input.no ?? "").trim(),
          name: String(input.name ?? "").trim(),
          paid: !anyPending,
          payments: initialPayments,
          note: String(input.note ?? (anyPending ? "待補繳" : `已繳 ${Object.keys(initialPayments).length} 項`)),
        }].sort((a, b) => a.no.localeCompare(b.no, "zh-Hant", { numeric: true })));
        return;
      }
      await addFirestoreStudent(input);
      await refresh();
    },
    updateStudent: async (id, patch) => {
      if (!firebaseReady || isDemo) {
        setStudents((items) => items.map((student) => {
          if (student.id !== id) return student;
          const nextPayments: Record<string, boolean> | undefined = patch.payments
            ? Object.fromEntries(Object.entries(patch.payments).map(([k, v]) => [k, Boolean(v)]))
            : undefined;
          const anyPending = nextPayments ? Object.values(nextPayments).some((v) => !v) : undefined;
          return {
            ...student,
            ...patch,
            payments: nextPayments ?? student.payments,
            paid: anyPending !== undefined ? !anyPending : (patch.paid !== undefined ? Boolean(patch.paid) : student.paid),
            note: patch.note ?? (anyPending !== undefined ? (anyPending ? "待補繳" : `已繳 ${Object.keys(nextPayments!).length} 項`) : student.note),
          } as ClassStudent;
        }).sort((a, b) => a.no.localeCompare(b.no, "zh-Hant", { numeric: true })));
        return;
      }
      await updateFirestoreStudent(id, patch);
      await refresh();
    },
    removeStudent: async (id) => {
      if (!firebaseReady || isDemo) {
        setStudents((items) => items.filter((student) => student.id !== id));
        return;
      }
      await removeFirestoreStudent(id);
      await refresh();
    },
  }), [isDemo, loading, refresh, settings, students, transactions, user]);

  return <ClassDataContext.Provider value={value}>{children}</ClassDataContext.Provider>;
}

export function useClassData() {
  const context = useContext(ClassDataContext);
  if (!context) throw new Error("useClassData must be used inside ClassDataProvider");
  return context;
}
