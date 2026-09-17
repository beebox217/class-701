import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, firebaseCollections, firebaseReady, firebaseStorage, storageReady } from "@/lib/firebase";

export type TransactionKind = "in" | "out";

export type PaymentItem = {
  id: string;
  title: string;
  amount: number;
};

export type ClassTransaction = {
  id: string;
  title: string;
  meta: string;
  amount: number;
  type: TransactionKind;
  createdAt?: number;
  images?: string[];
};

export type ClassStudent = {
  id: string;
  no: string;
  name: string;
  paid: boolean;
  payments: Record<string, boolean>;
  note: string;
};

export function getStudentPaymentPaid(student: Pick<ClassStudent, "paid" | "payments">, paymentId: string): boolean {
  if (student.payments && typeof student.payments === "object" && paymentId in student.payments) {
    return Boolean(student.payments[paymentId]);
  }
  return Boolean(student.paid);
}

export function summarizePaymentsStatus(
  student: Pick<ClassStudent, "paid" | "payments">,
  paymentItems: Array<Pick<PaymentItem, "id" | "title">>
): { paid: number; total: number; labels: string[] } {
  const list = paymentItems.length ? paymentItems : [{ id: "default", title: "繳費" }];
  let paid = 0;
  const labels: string[] = [];
  for (const p of list) {
    if (getStudentPaymentPaid(student, p.id)) {
      paid += 1;
      labels.push(p.title);
    }
  }
  return { paid, total: list.length, labels };
}

function requireFirestore() {
  if (!firebaseReady || !db) throw new Error("系統尚未連線，請先設定資料庫連線。");
  return db;
}
function requireStorage() {
  if (!storageReady || !firebaseStorage) throw new Error("尚未設定 Storage，圖片無法跨裝置同步。請至 Firebase 開啟 Cloud Storage 並填入 VITE_FIREBASE_STORAGE_BUCKET。");
  return firebaseStorage;
}

function timestampToNumber(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return typeof value === "number" ? value : Date.now();
}

function normalizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter((v) => typeof v === "string" && (v.startsWith("https://") || v.startsWith("gs://") || v.startsWith("data:image/"))).slice(0, 3);
}

export async function listTransactions(): Promise<ClassTransaction[]> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(query(collection(firestore, firebaseCollections.transactions), orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => {
    const data = item.data();
    const type = data.type === "out" ? "out" : "in";
    const amount = Math.abs(Number(data.amount) || 0);
    return {
      id: item.id,
      title: String(data.title ?? "未命名紀錄"),
      meta: String(data.meta ?? "701 班費管理"),
      amount: type === "out" ? -amount : amount,
      type,
      createdAt: timestampToNumber(data.createdAt),
      images: normalizeImages(data.images),
    };
  });
}

export async function addTransaction(input: { title: string; amount: number; type: TransactionKind; meta?: string; images?: string[] }) {
  const firestore = requireFirestore();
  const payload: Record<string, unknown> = {
    title: input.title,
    amount: Math.abs(input.amount),
    type: input.type,
    meta: input.meta ?? "701 班費管理",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const norm = normalizeImages(input.images);
  if (norm.length) payload.images = norm;
  const snapshot = await addDoc(collection(firestore, firebaseCollections.transactions), payload);
  return snapshot.id;
}

export async function updateTransaction(id: string, patch: { title?: string; amount?: number; type?: TransactionKind; meta?: string; images?: string[] }) {
  if (!id) throw new Error("缺少編號");
  const firestore = requireFirestore();
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if ("title" in patch) payload.title = String(patch.title ?? "").trim();
  if ("amount" in patch) payload.amount = Math.max(1, Math.floor(Math.abs(Number(patch.amount) || 0)));
  if ("type" in patch) payload.type = patch.type;
  if ("meta" in patch) payload.meta = patch.meta;
  if ("images" in patch) {
    const norm = normalizeImages(patch.images);
    payload.images = norm;
  }
  await updateDoc(doc(firestore, firebaseCollections.transactions, id), payload as any);
}

export async function removeTransaction(id: string) {
  if (!id) throw new Error("缺少編號");
  const firestore = requireFirestore();
  await deleteDoc(doc(firestore, firebaseCollections.transactions, id));
}

function legacyPaidToPayments(legacyPaid: boolean, settingsPaymentUnknown?: unknown): Record<string, boolean> {
  const payments: Record<string, boolean> = {};
  if (Array.isArray(settingsPaymentUnknown) && settingsPaymentUnknown.length) {
    const first = settingsPaymentUnknown[0];
    if (first && typeof first === "object" && "id" in first && typeof (first as any).id === "string") {
      payments[(first as any).id] = Boolean(legacyPaid);
      return payments;
    }
  }
  if (settingsPaymentUnknown && typeof settingsPaymentUnknown === "object" && !Array.isArray(settingsPaymentUnknown)) {
    const maybeId = (settingsPaymentUnknown as any).id;
    if (typeof maybeId === "string") {
      payments[maybeId] = Boolean(legacyPaid);
      return payments;
    }
  }
  payments["default"] = Boolean(legacyPaid);
  return payments;
}

export async function listStudents(options?: { settingsPayment?: unknown }): Promise<ClassStudent[]> {
  const firestore = requireFirestore();
  const snapshot = await getDocs(collection(firestore, firebaseCollections.students));
  const settingsPayment = options?.settingsPayment;
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const legacyPaid = Boolean(data.paid);
      let payments: Record<string, boolean>;
      if (data.payments && typeof data.payments === "object" && !Array.isArray(data.payments)) {
        payments = Object.fromEntries(Object.entries(data.payments as Record<string, unknown>).map(([k, v]) => [k, Boolean(v)]));
      } else {
        payments = legacyPaidToPayments(legacyPaid, settingsPayment);
      }
      const anyPaid = Object.values(payments).some(Boolean) || legacyPaid;
      const anyPending = Object.keys(payments).length > 0 ? Object.values(payments).some((v) => !v) : !legacyPaid;
      const effectivePaid = Object.keys(payments).length > 0
        ? (Object.values(payments).every(Boolean) || (Object.values(payments).some(Boolean) && !Object.values(payments).every(Boolean)))
        : legacyPaid;
      const noteFallback = (() => {
        if (Object.keys(payments).length > 0) {
          if (Object.values(payments).every(Boolean)) return `已繳 ${Object.keys(payments).length} 項`;
          const paidTitles: string[] = [];
          if (Array.isArray(settingsPayment) && settingsPayment.length) {
            for (const p of settingsPayment) {
              if (p && typeof p === "object" && "id" in p && "title" in p && Boolean(payments[(p as any).id])) paidTitles.push(String((p as any).title));
            }
          }
          if (paidTitles.length) return `已繳 ${paidTitles.join("、")}`;
          return "待補繳";
        }
        return legacyPaid ? "已繳 10月" : "待補繳";
      })();
      return {
        id: item.id,
        no: String(data.no ?? ""),
        name: String(data.name ?? "未命名同學"),
        paid: anyPaid && !anyPending ? true : Object.keys(payments).length > 0 ? Boolean(effectivePaid) : legacyPaid,
        payments,
        note: String(data.note ?? noteFallback),
      };
    })
    .sort((a, b) => a.no.localeCompare(b.no, "zh-Hant", { numeric: true }));
}

export async function updateStudentPaid(id: string, next: boolean | { paymentId: string; paid: boolean }) {
  const firestore = requireFirestore();
  const docRef = doc(firestore, firebaseCollections.students, id);
  const currentSnap = await getDoc(docRef);
  const current = currentSnap.exists() ? currentSnap.data() : {};
  const legacyPaid = Boolean(current?.paid);
  const basePayments: Record<string, boolean> =
    current?.payments && typeof current.payments === "object" && !Array.isArray(current.payments)
      ? Object.fromEntries(Object.entries(current.payments as Record<string, unknown>).map(([k, v]) => [k, Boolean(v)]))
      : {};
  if (typeof next === "boolean") {
    const payments = { ...basePayments };
    if (Object.keys(payments).length === 0) {
      payments["default"] = next;
    } else {
      for (const k of Object.keys(payments)) payments[k] = next;
    }
    const anyPending = Object.values(payments).some((v) => !v);
    await updateDoc(docRef, {
      paid: !anyPending,
      payments,
      note: anyPending ? "待補繳" : `已繳 ${Object.keys(payments).length} 項`,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const payments = { ...basePayments };
  payments[next.paymentId] = next.paid;
  const anyPending = Object.values(payments).some((v) => !v);
  const allPaid = Object.values(payments).every(Boolean);
  await updateDoc(docRef, {
    paid: allPaid || (legacyPaid && !anyPending ? true : allPaid),
    payments,
    note: anyPending ? "待補繳" : `已繳 ${Object.keys(payments).length} 項`,
    updatedAt: serverTimestamp(),
  });
}

export async function addStudent(input: { no: string; name: string; paid?: boolean; note?: string; payments?: Record<string, boolean> }) {
  const firestore = requireFirestore();
  const no = String(input.no ?? "").trim();
  const name = String(input.name ?? "").trim();
  if (!no || !name) throw new Error("姓名與座號皆為必填");
  const legacyPaid = Boolean(input.paid);
  const paymentsBase: Record<string, boolean> =
    input.payments && typeof input.payments === "object" ? Object.fromEntries(Object.entries(input.payments).map(([k, v]) => [k, Boolean(v)])) : {};
  const payments = Object.keys(paymentsBase).length ? paymentsBase : { default: legacyPaid };
  const allPaid = Object.values(payments).every(Boolean);
  const anyPending = Object.values(payments).some((v) => !v);
  const snapshot = await addDoc(collection(firestore, firebaseCollections.students), {
    no,
    name,
    paid: allPaid,
    payments,
    note: String(input.note ?? (anyPending ? "待補繳" : `已繳 ${Object.keys(payments).length} 項`)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return snapshot.id;
}

export async function updateStudent(id: string, patch: Partial<{ no: string; name: string; paid: boolean; note: string; payments: Record<string, boolean> }>) {
  const firestore = requireFirestore();
  const payload: { [field: string]: unknown } = { updatedAt: serverTimestamp() };
  if (patch.no !== undefined) payload.no = String(patch.no).trim();
  if (patch.name !== undefined) payload.name = String(patch.name).trim();
  if (patch.payments !== undefined) {
    const payments = Object.fromEntries(Object.entries(patch.payments).map(([k, v]) => [k, Boolean(v)]));
    payload.payments = payments;
    const anyPending = Object.values(payments).some((v) => !v);
    payload.paid = !anyPending;
    if (patch.note === undefined) payload.note = anyPending ? "待補繳" : `已繳 ${Object.keys(payments).length} 項`;
  }
  if (patch.paid !== undefined && patch.payments === undefined) {
    const next = Boolean(patch.paid);
    payload.paid = next;
    if (patch.note === undefined) payload.note = next ? "已繳 10月" : "待補繳";
  }
  if (patch.note !== undefined) payload.note = String(patch.note);
  if (payload.no === "" || payload.name === "") throw new Error("姓名與座號不可空白");
  await updateDoc(doc(firestore, firebaseCollections.students, id), payload as any);
}

export async function removeStudent(id: string) {
  const firestore = requireFirestore();
  const docRef = doc(firestore, firebaseCollections.students, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("找不到此學生");
  await deleteDoc(docRef);
}

export async function listSettings() {
  const firestore = requireFirestore();
  const snapshot = await getDocs(collection(firestore, firebaseCollections.settings));
  const raw = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data().value ?? item.data()]));
  if (typeof raw.admins === "object" && raw.admins !== null && "value" in raw.admins && typeof (raw.admins as any).value === "object") {
    raw.admins = (raw.admins as any).value;
  }
  if (typeof raw.className === "object" && raw.className !== null && "value" in raw.className) {
    raw.className = (raw.className as any).value;
  }
  if (typeof raw.payment === "object" && raw.payment !== null && "value" in raw.payment && typeof (raw.payment as any).value === "object") {
    raw.payment = (raw.payment as any).value;
  }
  return raw;
}

export async function setSettingValue(id: string, value: unknown) {
  const firestore = requireFirestore();
  await setDoc(doc(firestore, firebaseCollections.settings, id), { value }, { merge: true });
  const snapshot = await getDoc(doc(firestore, firebaseCollections.settings, id));
  if (!snapshot.exists()) throw new Error("寫入後無法讀取設定，請檢查寫入權限");
  const written = snapshot.data()?.value;
  if (JSON.stringify(written) !== JSON.stringify(value)) {
    throw new Error("寫入內容與預期不符，請檢查寫入權限");
  }
  return written;
}

const TX_IMAGES_KEY = "class701_tx_images";

function loadTxImagesIndex(): Record<string, string[]> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(TX_IMAGES_KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj;
  } catch {
  }
  return {};
}

function saveTxImagesIndex(index: Record<string, string[]>) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(TX_IMAGES_KEY, JSON.stringify(index));
  } catch {
  }
}

export async function compressImageFile(file: File, maxEdge = 1280, quality = 0.7): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("圖片讀取失敗"));
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.readAsDataURL(file);
  });
  if (!dataUrl.startsWith("data:image/")) throw new Error("檔案格式不支援");
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("圖片解析失敗"));
    image.onload = () => resolve(image);
    image.src = dataUrl;
  });
  const { naturalWidth: w, naturalHeight: h } = img;
  const ratio = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立圖片壓縮環境");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("壓縮失敗"))),
      "image/jpeg",
      quality
    );
  });
  const url = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl: url, blob };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  // data:image/jpeg;base64,XXXX
  const [head, body] = String(dataUrl).split(",", 2);
  const mimeMatch = /data:(image\/[a-z0-9.+-]+);base64/i.exec(head || "");
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(body || "");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadTxImagesGetUrls(txId: string, dataUrls: string[]): Promise<string[]> {
  if (!Array.isArray(dataUrls) || !dataUrls.length) return [];
  const filtered = dataUrls.filter((v) => typeof v === "string");
  if (!filtered.length) return [];
  const storage = requireStorage();
  const results: string[] = [];
  for (let i = 0; i < filtered.length; i += 1) {
    const d = filtered[i];
    let blob: Blob;
    if (d.startsWith("data:image/")) blob = dataUrlToBlob(d);
    else continue; // 已上傳過的 https:// 跳過（維持原樣）
    const path = `txs/${txId}/img_${i}.jpg`;
    const r = ref(storage, path);
    const snapshot = await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000,immutable" });
    const url = await getDownloadURL(snapshot.ref);
    results.push(url);
  }
  // 把非 data:image 的（既存 URL）接回來維持順序
  const final: string[] = [];
  let uploadedIdx = 0;
  for (let i = 0; i < dataUrls.length; i += 1) {
    const d = dataUrls[i];
    if (typeof d === "string" && d.startsWith("data:image/")) {
      if (uploadedIdx < results.length) { final.push(results[uploadedIdx]); uploadedIdx += 1; }
    } else if (typeof d === "string" && (d.startsWith("https://") || d.startsWith("gs://"))) {
      final.push(d);
    }
  }
  return final.slice(0, 3);
}

// 跨裝置優先：傳入 tx 物件（從 Firestore 來），優先用 tx.images；本機當快取雙寫
const txImageFirestoreCache: Record<string, string[]> = {};
export function registerTransactionImagesFromFirestore(txs: Array<Pick<ClassTransaction, "id" | "images">>) {
  if (!Array.isArray(txs)) return;
  txs.forEach((t) => {
    if (!t || !t.id) return;
    const imgs = Array.isArray(t.images) ? t.images.filter((v) => typeof v === "string") : [];
    if (imgs.length) txImageFirestoreCache[t.id] = imgs;
  });
}
export function getTransactionImages(txId: string): string[] {
  const fromFirestore = txImageFirestoreCache[txId];
  if (fromFirestore && fromFirestore.length) return fromFirestore.slice();
  const index = loadTxImagesIndex();
  return Array.isArray(index[txId]) ? index[txId].filter((v) => typeof v === "string") : [];
}

export function setTransactionImages(txId: string, images: string[]): string[] {
  const index = loadTxImagesIndex();
  const next = images.filter((v) => typeof v === "string").slice(0, 3);
  if (next.length) index[txId] = next.filter((v) => v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("gs://")); else delete index[txId];
  // 同步快取
  if (next.length) txImageFirestoreCache[txId] = next.slice(); else delete txImageFirestoreCache[txId];
  saveTxImagesIndex(index);
  return next;
}

export async function createAuthUser(params: { email: string; password: string; displayName?: string }): Promise<{ uid: string; email: string | null; displayName?: string | null }> {
  if (!firebaseReady) throw new Error("系統尚未初始化");
  const raw = import.meta.env;
  const apiKey = String(
    raw.VITE_FIREBASE_API_KEY ||
    raw.VITE_FIREBASE_APIKEY ||
    raw.VITE_apiKey ||
    (typeof window !== "undefined" && (window as any).__FIREBASE_API_KEY__) ||
    ""
  );
  if (!apiKey) throw new Error("找不到連線金鑰，請設定環境變數");
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email.trim(),
      password: params.password,
      returnSecureToken: false,
      displayName: params.displayName || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data?.error?.message || "auth-user-create-failed");
    if (msg.includes("EMAIL_EXISTS")) throw new Error("此電子信箱已存在，請直接編輯既有管理者");
    if (msg.includes("INVALID_EMAIL")) throw new Error("請輸入有效的電子信箱");
    if (msg.includes("WEAK_PASSWORD")) throw new Error("密碼強度不足，請至少 6 字元");
    throw new Error(`新增帳號失敗：${msg}`);
  }
  return { uid: String(data.localId), email: data.email ?? params.email, displayName: data.displayName ?? params.displayName ?? null };
}
