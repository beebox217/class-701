import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// 將 GitHub Pages 的 Repository secrets / Actions variables 填入下列環境變數。
// 本地開發可建立 client/.env.local；不要把真正的金鑰提交到 Git。
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const storageReady = Boolean(firebaseReady && firebaseConfig.storageBucket);
export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseStorage = storageReady ? getStorage(firebaseApp!) : null;

export const firebaseCollections = {
  transactions: "class701_transactions",
  students: "class701_students",
  settings: "class701_settings",
} as const;
