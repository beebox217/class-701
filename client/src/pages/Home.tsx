import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleDollarSign,
  CirclePlus,
  FileBarChart,
  Filter,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Share2,
  Copy,
  ExternalLink,
  Sparkles,
  Trash2,
  Users,
  X,
  Download,
  Smartphone,
  Share,
} from "lucide-react";
import { deleteUser, updateEmail, updatePassword, type User } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useClassData } from "@/contexts/ClassDataContext";
import { firebaseReady } from "@/lib/firebase";
import { compressImageFile, createAuthUser, getStudentPaymentPaid, getTransactionImages, setSettingValue, setTransactionImages, type ClassTransaction, type PaymentItem, type TransactionKind } from "@/lib/firestore";
import { Camera, Image as ImageIcon, ZoomIn, AlertTriangle } from "lucide-react";

const navItems = [
  { href: "/", label: "總覽", icon: LayoutDashboard },
  { href: "/transactions", label: "收支", icon: ReceiptText },
  { href: "/students", label: "同學", icon: Users },
  { href: "/reports", label: "報表", icon: FileBarChart },
  { href: "/settings", label: "設定", icon: Settings },
];

function ConfirmDialog({ open, title, message, confirmText = "確認刪除", cancelText = "取消", danger = true, onCancel, onConfirm }: { open: boolean; title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean; onCancel: () => void; onConfirm: () => void; }) {
  if (!open) return null;
  return <div className="modal-backdrop" onClick={onCancel}><div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}><div className="confirm-head" style={{display:"flex",gap:12,alignItems:"flex-start"}}><span className="confirm-icon" style={{flex:"0 0 auto",width:46,height:46,borderRadius:14,background: danger ? "#fdece7" : "#e2f0e9",color: danger ? "var(--coral)" : "var(--teal)",display:"grid",placeItems:"center"}}><AlertTriangle size={20}/></span><div style={{flex:1}}><h3 style={{margin:"0 0 6px",fontSize:19,letterSpacing:"-.02em"}}>{title}</h3>{message && <p style={{margin:0,color:"var(--muted)",fontSize:14,lineHeight:1.55}}>{message}</p>}</div></div><div style={{display:"flex",gap:10,marginTop:22}}><button className="secondary-button wide" onClick={onCancel}>{cancelText}</button><button className={"primary-button wide " + (danger ? "danger-button" : "")} style={danger ? {background:"var(--coral)",boxShadow:"0 7px 14px rgba(231,120,98,.22)"} : undefined} onClick={onConfirm}>{confirmText}</button></div></div></div>;
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }>; };
declare global { interface Window { __PWA_INSTALL_PROMPT__?: InstallPromptEvent | null; } }

const PWA_DISMISS_KEY = "class701_pwa_dismiss_until";
const PWA_INSTALLED_KEY = "class701_pwa_installed";
function usePwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && "ontouchend" in document);
    setIsIos(ios);
    const isStandalone = Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone ||
        window.matchMedia?.("(display-mode: standalone)").matches,
    );
    if (isStandalone) return;
    try {
      if (window.localStorage.getItem(PWA_INSTALLED_KEY)) return;
      const raw = window.localStorage.getItem(PWA_DISMISS_KEY);
      if (raw) {
        const until = Number(raw) || 0;
        if (until > Date.now()) return;
      }
    } catch { /* ignore */ }

    const checkAvailable = () => {
      if (window.__PWA_INSTALL_PROMPT__) {
        setVisible(true);
        return;
      }
      if (ios) {
        setVisible(true);
      }
    };
    checkAvailable();
    const onAvailable = () => setVisible(true);
    const onInstalled = () => {
      setVisible(false);
      try { window.localStorage.setItem(PWA_INSTALLED_KEY, String(Date.now())); } catch { /* ignore */ }
    };
    window.addEventListener("pwa-install-available", onAvailable);
    window.addEventListener("pwa-installed", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-available", onAvailable);
      window.removeEventListener("pwa-installed", onInstalled);
    };
  }, []);

  const dismiss = () => {
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    try { window.localStorage.setItem(PWA_DISMISS_KEY, String(until)); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    const evt = (typeof window !== "undefined" ? window.__PWA_INSTALL_PROMPT__ : null) as InstallPromptEvent | null | undefined;
    if (!evt) return;
    try { await evt.prompt(); } catch { /* ignore */ }
    try {
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
    } catch { /* ignore */ }
  };

  return { visible, isIos, dismiss, install };
}

function InstallPrompt({ visible, isIos, dismiss, install }: { visible: boolean; isIos: boolean; dismiss: () => void; install: () => void }) {
  if (!visible) return null;
  if (isIos) {
    return <div className="install-banner" role="status" aria-live="polite">
      <span className="banner-icon"><Smartphone size={20} /></span>
      <div className="banner-copy"><strong>加入主畫面，離線也能查看</strong><span>點擊下方 <Share size={12} style={{ display: "inline-block", verticalAlign: "-2px" }} /> 分享鍵 → 滑到「加入主畫面」</span></div>
      <div className="banner-actions"><button className="dismiss" onClick={dismiss} aria-label="關閉"><X size={15} /></button></div>
    </div>;
  }
  return <div className="install-banner" role="status" aria-live="polite">
    <span className="banner-icon"><Download size={20} /></span>
    <div className="banner-copy"><strong>安裝應用程式</strong><span>加到桌面，開啟更快也可離線檢視，完全不需另外下載。</span></div>
    <div className="banner-actions"><button className="primary-button" style={{ padding: "10px 14px", fontSize: 13 }} onClick={install}><Download size={14} />安裝</button><button className="dismiss" onClick={dismiss} aria-label="稍後再說"><X size={15} /></button></div>
  </div>;
}

function Shell({ children, share }: { children: ReactNode; share?: { onOpen: () => void } }) {
  const [location] = useLocation();
  const { user, isDemo, logout } = useAuth();
  const { usingDemo, settings } = useClassData();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = navItems.find((item) => item.href === location)?.label ?? "總覽";
  const className = String(settings.className ?? "701 班");
  const yearLabel = "2026 學年度";
  const adminsMap = (settings.admins ?? {}) as Record<string, { email?: string; displayName?: string }>;
  const currentAdminDisplay = user?.uid ? adminsMap[user.uid]?.displayName : undefined;
  const displayName =
    ((user as User | null)?.displayName as string | undefined) ??
    (currentAdminDisplay as string | undefined) ??
    "劉老師";
  useEffect(() => {
    if (typeof document !== "undefined") document.title = `${className}班費管理系統`;
  }, [className]);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><BookOpen size={19} strokeWidth={2.5} /></div><div><p className="eyebrow">MINGDE JUNIOR HIGH</p><h1>{className} 班費管理</h1></div></div>
      <div className="header-actions"><button className="icon-button" aria-label="通知" onClick={() => toast("目前沒有新的通知")}><Bell size={19} /></button><button className="avatar" aria-label="使用者選單" onClick={() => setMenuOpen(!menuOpen)}>{displayName[0] || "劉"}</button></div>
      {menuOpen && <div className="profile-popover"><strong>{displayName}</strong><span>{isDemo ? "示範模式管理者" : "系統管理者"}</span><button onClick={() => void logout()}>登出系統</button></div>}
    </header>
    <main className="main-content"><div className="page-heading"><div><p className="eyebrow">{yearLabel} · {className}</p><h2>{active}</h2></div>{share?.onOpen ? <button className="secondary-button tiny" onClick={share.onOpen} title="分享公開唯讀頁面" style={{ flex: "0 0 auto" }}><Share2 size={14} />分享</button> : null}</div>{children}</main>
    <nav className="bottom-nav" aria-label="主要導覽">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={location === href ? "nav-item active" : "nav-item"}><Icon size={19} strokeWidth={location === href ? 2.5 : 2} /><span>{label}</span></Link>)}</nav>
    <footer className="footer"><span>{className} 班級自治會</span><span className="status-dot"><i /> {usingDemo ? "示範模式" : "已連線"}</span></footer>
  </div>;
}

function Overview() {
  const { user } = useAuth();
  const { transactions, students, loading, usingDemo, settings } = useClassData();
  const adminsMap = (settings.admins ?? {}) as Record<string, { email?: string; displayName?: string }>;
  const currentAdminDisplay = user?.uid ? adminsMap[user.uid]?.displayName : undefined;
  const displayName =
    ((user as User | null)?.displayName as string | undefined) ??
    (currentAdminDisplay as string | undefined) ??
    "劉老師";
  const paymentItems = Array.isArray(settings.payment) ? (settings.payment as PaymentItem[]) : [];
  const income = transactions.filter((item) => item.type === "in").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expense = transactions.filter((item) => item.type === "out").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const progressPerPayment = paymentItems.length ? paymentItems.map((item) => {
    const paidCount = students.filter((s) => getStudentPaymentPaid(s, item.id)).length;
    const rate = students.length ? Math.round((paidCount / students.length) * 100) : 0;
    return { ...item, paidCount, rate };
  }) : [];
  const anyProgress = progressPerPayment[0];

  return <>
    <section className="welcome-card"><div><span className="soft-label"><Sparkles size={13} /> 本月摘要</span><h3>早安，{displayName}</h3><p>{loading ? "正在讀取班費資料…" : usingDemo ? "目前為示範模式，連線後即可同步資料。" : "班費帳務資料已同步完成。"}</p></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="mini-orbit"><CircleDollarSign size={28} /></div></div></section>
    <section className="metric-grid"><div className="metric-card accent"><span>目前結餘</span><strong>NT$ {(income - expense).toLocaleString()}</strong><small><ArrowUpRight size={14} />即時資料</small></div><div className="metric-card"><span>本月收入</span><strong>NT$ {income.toLocaleString()}</strong><small className="positive"><ArrowUpRight size={14} />{transactions.filter((item) => item.type === "in").length} 筆收入</small></div><div className="metric-card"><span>本月支出</span><strong>NT$ {expense.toLocaleString()}</strong><small className="negative"><ArrowDownLeft size={14} />{transactions.filter((item) => item.type === "out").length} 筆支出</small></div></section>
    <div className="section-row"><h3>最近收支</h3><Link href="/transactions" className="text-link">查看全部 <ChevronRight size={15} /></Link></div>
    <div className="transaction-list">{transactions.length ? transactions.slice(0, 3).map((item) => <TransactionRow key={item.id} item={item} />) : <div className="empty-state"><ReceiptText size={30} /><strong>尚無資料</strong><span>請至收支頁新增第一筆收支紀錄。</span></div>}</div>
    <div className="section-row upcoming-heading"><h3>繳費進度</h3><Link href="/students" className="text-link">管理名單 <ChevronRight size={15} /></Link></div>
    {anyProgress ? progressPerPayment.map((p) => (
      <div className="progress-card" key={p.id}>
        <div className="progress-top"><div><strong>{p.title}</strong><span>{students.length ? `${students.length} 位學生 · 每位 NT$ ${p.amount.toLocaleString()}` : "尚無學生資料"}</span></div><b>{p.rate}%</b></div>
        <div className="progress-bar"><i style={{ width: `${p.rate}%` }} /></div>
        <p><Check size={14} /> {p.paidCount} 位已完成繳費（NT$ {(p.paidCount * p.amount).toLocaleString()}），還有 {Math.max(students.length - p.paidCount, 0)} 位待處理</p>
      </div>
    )) : (
      <div className="empty-state"><Users size={30} /><strong>尚無繳費項目</strong><span>請至「設定 → 繳費設定」新增第一筆繳費項目。</span></div>
    )}
  </>;
}

const TX_IMG_MAX = 3;
const TX_TITLE_HISTORY_KEY = "class701_tx_title_history";

function loadTxTitleHistory(): string[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(TX_TITLE_HISTORY_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}
function pushTxTitleHistory(title: string): string[] {
  const name = String(title ?? "").trim();
  if (!name) return loadTxTitleHistory();
  const current = loadTxTitleHistory().filter((v) => v !== name);
  const next = [name, ...current].slice(0, 50);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(TX_TITLE_HISTORY_KEY, JSON.stringify(next));
  } catch {
  }
  return next;
}

function TransactionRow({ item, onOpenImages, onMenu }: { item: ClassTransaction; onOpenImages?: (images: string[], title: string) => void; onMenu?: (item: ClassTransaction, anchor: HTMLElement) => void; }) {
  const [images, setImages] = useState<string[]>(() => getTransactionImages(item.id));
  useEffect(() => {
    setImages(getTransactionImages(item.id));
  }, [item.id]);
  const handleView = () => {
    if (!images.length) return;
    if (onOpenImages) onOpenImages(images, item.title);
    else toast("點擊縮圖可查看圖片");
  };
  return <div className="transaction-row"><div className={`tx-icon ${item.type}`}>{item.type === "in" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div><div className="tx-copy"><strong>{item.title}</strong><span>{item.meta}</span>{images.length > 0 && <div className="tx-thumb-row" style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{images.slice(0, 3).map((src, i) => <button key={i} className="tx-thumb" onClick={handleView} aria-label="查看圖片"><img src={src} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:10,display:"block",border:"1px solid #e5ece8"}} /></button>)}</div>}</div><div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,position:"relative"}}><strong className={item.amount > 0 ? "amount in" : "amount out"}>{item.amount > 0 ? "+" : "−"}{Math.abs(item.amount).toLocaleString()}</strong>{typeof onMenu === "function" ? <button className="more-button" onClick={(e) => { e.stopPropagation(); onMenu(item, e.currentTarget); }} aria-label="更多操作"><MoreHorizontal size={18}/></button> : null}</div></div>;
}

function TransactionsPage() {
  const { transactions, addTransaction, updateTransaction, removeTransaction, loading } = useClassData();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<TransactionKind>("in");
  const [filter, setFilter] = useState<"all" | TransactionKind>("all");
  const [titleHistory, setTitleHistory] = useState<string[]>(() => loadTxTitleHistory());
  const [images, setImages] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [preview, setPreview] = useState<{ title: string; images: string[]; index: number } | null>(null);
  const [menuState, setMenuState] = useState<null | { item: ClassTransaction; top: number; left: number }>(null);
  const [editTx, setEditTx] = useState<null | { tx: ClassTransaction; title: string; amount: string; kind: TransactionKind; images: string[] }>(null);
  const [editImageBusy, setEditImageBusy] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<null | { tx: ClassTransaction }>(null);
  const [searchModal, setSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveQuery, setLiveQuery] = useState("");
  const titleListId = "tx-title-suggestions";

  const filteredItems = useMemo(() => {
    const base = filter === "all" ? transactions : transactions.filter((item) => item.type === filter);
    const q = liveQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const kindText = item.type === "in" ? "收入 in" : "支出 out";
      const kindMatch = kindText.includes(q);
      const amt = Math.abs(item.amount);
      const amountMatch = String(amt).includes(q) || amt.toLocaleString().includes(q);
      return titleMatch || kindMatch || amountMatch;
    });
  }, [transactions, filter, liveQuery]);

  function openSearch() {
    setSearchQuery(liveQuery);
    setSearchModal(true);
  }

  function applySearch() {
    setLiveQuery(searchQuery.trim());
    setSearchModal(false);
  }

  function clearSearch() {
    setSearchQuery("");
    setLiveQuery("");
  }

  function resetForm() {
    setTitle(""); setAmount(""); setKind("in"); setImages([]);
  }

  function closeMenu() { setMenuState(null); }

  function openMenu(item: ClassTransaction, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    setMenuState({ item, top: rect.bottom + 6, left: Math.max(10, rect.right - 164) });
  }

  function handleEditOpen(item: ClassTransaction) {
    setMenuState(null);
    setEditTx({
      tx: item,
      title: item.title,
      amount: String(Math.abs(item.amount)),
      kind: item.type,
      images: getTransactionImages(item.id),
    });
  }

  async function handleEditSave() {
    if (!editTx) return;
    const numericAmount = Number(editTx.amount);
    const trimmedTitle = editTx.title.trim();
    if (!trimmedTitle || !Number.isInteger(numericAmount) || numericAmount <= 0) {
      toast.error("請輸入項目名稱與正整數金額");
      return;
    }
    try {
      await updateTransaction(editTx.tx.id, { title: trimmedTitle, amount: numericAmount, type: editTx.kind });
      setTransactionImages(editTx.tx.id, editTx.images);
      const nextHistory = pushTxTitleHistory(trimmedTitle);
      setTitleHistory(nextHistory);
      setEditTx(null);
      toast.success("已更新收支");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "儲存失敗");
    }
  }

  async function handleRemoveConfirm() {
    if (!removeConfirm) return;
    try {
      const id = removeConfirm.tx.id;
      await removeTransaction(id);
      setTransactionImages(id, []);
      setRemoveConfirm(null);
      setMenuState(null);
      toast.success("已刪除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刪除失敗");
    }
  }

  async function handleImageFiles(files: FileList | File[] | null, target: "add" | "edit" = "add") {
    if (!files || !files.length) return;
    const setRef = target === "add" ? setImages : (nextOrUpdater: any) => {
      setEditTx((current) => {
        if (!current) return current;
        const nextImgs = typeof nextOrUpdater === "function" ? nextOrUpdater(current.images) : nextOrUpdater;
        return { ...current, images: nextImgs };
      });
    };
    const currentImgs = target === "add" ? images : (editTx?.images ?? []);
    const slotsLeft = TX_IMG_MAX - currentImgs.length;
    if (slotsLeft <= 0) { toast.error(`最多僅能上傳 ${TX_IMG_MAX} 張圖片`); return; }
    const picked = Array.from(files).slice(0, slotsLeft);
    const setterBusy = target === "add" ? setImageBusy : setEditImageBusy;
    setterBusy(true);
    try {
      const compressed = await Promise.all(picked.map((f) => compressImageFile(f, 1600, 0.78)));
      setRef((current: string[]) => [...current, ...compressed].slice(0, TX_IMG_MAX));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "圖片處理失敗");
    } finally {
      setterBusy(false);
    }
  }

  async function saveTransaction() {
    const numericAmount = Number(amount);
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !Number.isInteger(numericAmount) || numericAmount <= 0) {
      toast.error("請輸入項目名稱與正整數金額");
      return;
    }
    try {
      const txId = await addTransaction({ title: trimmedTitle, amount: numericAmount, type: kind });
      if (images.length) setTransactionImages(txId, images);
      const nextHistory = pushTxTitleHistory(trimmedTitle);
      setTitleHistory(nextHistory);
      resetForm(); setShowForm(false);
      toast.success("已儲存至系統");
    } catch (error) { toast.error(error instanceof Error ? error.message : "儲存失敗"); }
  }

  function removeImageAt(index: number, target: "add" | "edit" = "add") {
    const setter = target === "add" ? setImages : (next: any) => setEditTx((cur) => cur ? { ...cur, images: typeof next === "function" ? next(cur.images) : next } : cur);
    setter((current: string[]) => current.filter((_, i) => i !== index));
  }

  return <><div className="page-toolbar"><div><p className="muted">{loading ? "讀取中…" : (liveQuery ? `找到 ${filteredItems.length} 筆 / 共 ${transactions.length} 筆` : `共 ${transactions.length} 筆紀錄`)}</p><h3>2026 年 10 月</h3></div><div style={{display:"flex",gap:10,alignItems:"center"}}>{liveQuery ? <button className="secondary-button tiny" style={{padding:"0 14px",fontWeight:800}} onClick={clearSearch} title="清除搜尋">「{liveQuery}」 ✕</button> : null}<button className="secondary-button" onClick={openSearch} title="搜尋收支"><Search size={17}/>搜尋</button><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17}/>新增</button></div></div><div className="filter-row"><button className={filter === "all" ? "filter-chip selected" : "filter-chip"} onClick={() => setFilter("all")}>全部</button><button className={filter === "in" ? "filter-chip selected" : "filter-chip"} onClick={() => setFilter("in")}>收入</button><button className={filter === "out" ? "filter-chip selected" : "filter-chip"} onClick={() => setFilter("out")}>支出</button></div><div className="transaction-list full-list" onClick={closeMenu}>{filteredItems.length ? filteredItems.map((item) => <TransactionRow key={item.id} item={item} onOpenImages={(imgs, t) => imgs.length && setPreview({ title: t, images: imgs, index: 0 })} onMenu={(tx, anchor) => openMenu(tx, anchor)} />) : <div className="empty-state"><ReceiptText size={30}/><strong>{liveQuery ? "沒有符合的結果" : "目前尚無收支紀錄"}</strong><span>{liveQuery ? "請更換關鍵字或清除搜尋。" : "新增第一筆資料後會自動保存。"}</span></div>}</div>{searchModal && <div className="modal-backdrop" onClick={() => { setSearchQuery(liveQuery); setSearchModal(false); }}><div className="modal" style={{maxWidth:460}} onClick={(e) => e.stopPropagation()}><div className="modal-head"><div style={{display:"flex",gap:10,alignItems:"flex-start",flex:1}}><span style={{width:42,height:42,borderRadius:12,background:"#e2f0e9",color:"var(--teal)",display:"grid",placeItems:"center",flex:"0 0 auto"}}><Search size={19}/></span><div style={{flex:1}}><h3 style={{margin:"2px 0 4px",fontSize:19,letterSpacing:"-.02em"}}>搜尋收支</h3><p style={{margin:0,color:"var(--muted)",fontSize:13,lineHeight:1.5}}>輸入關鍵字查找項目名稱、類型（收入/支出）或金額，按下「套用」立即顯示結果。</p></div></div><button onClick={() => { setSearchQuery(liveQuery); setSearchModal(false); }} aria-label="關閉"><X size={18}/></button></div><label>關鍵字<input autoFocus placeholder="例如：班費、支出、500" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applySearch(); if (event.key === "Escape") { setSearchQuery(liveQuery); setSearchModal(false); } }} /></label><div style={{display:"flex",gap:10,marginTop:6}}><button className="secondary-button wide" onClick={clearSearch}>清除</button><button className="primary-button wide" onClick={applySearch}>套用</button></div></div></div>}{menuState && <><div className="popover-backdrop" onClick={closeMenu} style={{position:"fixed",inset:0,zIndex:15}}/><div className="popover-menu" style={{position:"fixed",top:menuState.top,left:menuState.left,zIndex:16,minWidth:164,background:"#fff",border:"1px solid var(--line)",borderRadius:14,padding:6,boxShadow:"0 10px 26px rgba(20,60,40,.14)"}}><button className="popover-item" onClick={() => handleEditOpen(menuState.item)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 10px",borderRadius:10,fontSize:14,fontWeight:800,background:"transparent",color:"var(--ink)"}} onMouseOver={(e) => (e.currentTarget.style.background = "#f2f7f4")} onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}><Pencil size={15}/> 編輯</button><button className="popover-item danger" onClick={() => { setRemoveConfirm({ tx: menuState.item }); setMenuState(null); }} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 10px",borderRadius:10,fontSize:14,fontWeight:800,background:"transparent",color:"var(--coral)"}} onMouseOver={(e) => (e.currentTarget.style.background = "#fef1ed")} onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}><Trash2 size={15}/> 刪除</button></div></>}{showForm && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>新增收支</h3><button onClick={() => { resetForm(); setShowForm(false); }}><X size={18}/></button></div><label>類型<select value={kind} onChange={(event) => setKind(event.target.value as TransactionKind)}><option value="in">收入</option><option value="out">支出</option></select></label><label>項目名稱<input list={titleListId} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：11月班費收取" /><datalist id={titleListId}>{titleHistory.map((t) => <option key={t} value={t} />)}</datalist></label><label>金額<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" placeholder="0" /></label><label style={{marginBottom:14}}>附件圖片 <span className="muted" style={{fontWeight:500,fontSize:12,marginLeft:6}}>（最多 {TX_IMG_MAX} 張）</span><div style={{marginTop:8,display:"flex",gap:10,flexWrap:"wrap",alignItems:"stretch"}}>{images.map((src, i) => <div key={i} className="tx-edit-image" style={{position:"relative",width:88,height:88,borderRadius:12,overflow:"hidden",border:"1px solid #e5ece8",background:"#fbfdfb"}}><img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} /><button type="button" onClick={() => removeImageAt(i, "add")} aria-label="移除圖片" style={{position:"absolute",top:3,right:3,width:26,height:26,borderRadius:"50%",background:"rgba(231,120,98,.95)",color:"#fff",display:"grid",placeItems:"center",boxShadow:"0 4px 10px rgba(0,0,0,.12)"}}><X size={13}/></button></div>)}{images.length < TX_IMG_MAX && <><label className="tx-add-image" title="從裝置選擇圖片" style={{width:88,height:88,borderRadius:12,border:"1px dashed #bccfc6",background:"#f6faf8",cursor:imageBusy ? "wait" : "pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:"#78908a",fontSize:12,fontWeight:800}}><ImageIcon size={18}/><span>上傳</span><input type="file" accept="image/*" multiple hidden disabled={imageBusy} onChange={(event) => void handleImageFiles(event.target.files, "add")} /></label><label className="tx-add-image" title="開啟相機拍照" style={{width:88,height:88,borderRadius:12,border:"1px dashed #bccfc6",background:"#f6faf8",cursor:imageBusy ? "wait" : "pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:"#78908a",fontSize:12,fontWeight:800}}><Camera size={18}/><span>拍照</span><input type="file" accept="image/*" capture="environment" hidden disabled={imageBusy} onChange={(event) => void handleImageFiles(event.target.files, "add")} /></label></>}</div></label><button className="primary-button wide" onClick={() => void saveTransaction()}>儲存</button></div></div>}{editTx && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>編輯收支</h3><button onClick={() => setEditTx(null)}><X size={18}/></button></div><label>類型<select value={editTx.kind} onChange={(event) => setEditTx({ ...editTx, kind: event.target.value as TransactionKind })}><option value="in">收入</option><option value="out">支出</option></select></label><label>項目名稱<input list={titleListId} value={editTx.title} onChange={(event) => setEditTx({ ...editTx, title: event.target.value })} placeholder="例如：11月班費收取" /><datalist id={titleListId}>{titleHistory.map((t) => <option key={t} value={t} />)}</datalist></label><label>金額<input value={editTx.amount} onChange={(event) => setEditTx({ ...editTx, amount: event.target.value })} type="number" placeholder="0" /></label><label style={{marginBottom:14}}>附件圖片 <span className="muted" style={{fontWeight:500,fontSize:12,marginLeft:6}}>（最多 {TX_IMG_MAX} 張）</span><div style={{marginTop:8,display:"flex",gap:10,flexWrap:"wrap",alignItems:"stretch"}}>{editTx.images.map((src, i) => <div key={i} className="tx-edit-image" style={{position:"relative",width:88,height:88,borderRadius:12,overflow:"hidden",border:"1px solid #e5ece8",background:"#fbfdfb"}}><img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} /><button type="button" onClick={() => removeImageAt(i, "edit")} aria-label="移除圖片" style={{position:"absolute",top:3,right:3,width:26,height:26,borderRadius:"50%",background:"rgba(231,120,98,.95)",color:"#fff",display:"grid",placeItems:"center",boxShadow:"0 4px 10px rgba(0,0,0,.12)"}}><X size={13}/></button></div>)}{editTx.images.length < TX_IMG_MAX && <><label className="tx-add-image" title="從裝置選擇圖片" style={{width:88,height:88,borderRadius:12,border:"1px dashed #bccfc6",background:"#f6faf8",cursor:editImageBusy ? "wait" : "pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:"#78908a",fontSize:12,fontWeight:800}}><ImageIcon size={18}/><span>上傳</span><input type="file" accept="image/*" multiple hidden disabled={editImageBusy} onChange={(event) => void handleImageFiles(event.target.files, "edit")} /></label><label className="tx-add-image" title="開啟相機拍照" style={{width:88,height:88,borderRadius:12,border:"1px dashed #bccfc6",background:"#f6faf8",cursor:editImageBusy ? "wait" : "pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:"#78908a",fontSize:12,fontWeight:800}}><Camera size={18}/><span>拍照</span><input type="file" accept="image/*" capture="environment" hidden disabled={editImageBusy} onChange={(event) => void handleImageFiles(event.target.files, "edit")} /></label></>}</div></label><button className="primary-button wide" onClick={() => void handleEditSave()}>儲存變更</button></div></div>}{preview && <div className="modal-backdrop" onClick={() => setPreview(null)}><div className="modal tx-preview" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h3 style={{fontSize:16}}>{preview.title}</h3><button onClick={() => setPreview(null)}><X size={18}/></button></div><div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:200,margin:"6px 0 14px",background:"#f4f8f6",borderRadius:14,overflow:"hidden",padding:8}}><img src={preview.images[preview.index]} alt="" style={{width:"100%",maxHeight:"60vh",objectFit:"contain",display:"block"}} /></div><div style={{display:"flex",gap:8,overflowX:"auto",padding:"2px 0 4px"}}>{preview.images.map((src, i) => <button key={i} onClick={() => setPreview({ ...preview, index: i })} style={{flex:"0 0 auto",padding:2,borderRadius:12,border: i === preview.index ? "2px solid var(--teal)" : "2px solid transparent",background:"#fff"}}><img src={src} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:8,display:"block"}} /></button>)}</div><div style={{textAlign:"center",color:"#78908a",fontSize:12,fontWeight:800,marginTop:6}}>{preview.index + 1} / {preview.images.length}</div></div></div>}<ConfirmDialog open={Boolean(removeConfirm)} title="確認刪除這筆收支？" message={"「" + (removeConfirm?.tx.title ?? "") + "」一經刪除，包含附件圖片在內無法復原。"} onCancel={() => setRemoveConfirm(null)} onConfirm={() => void handleRemoveConfirm()} /></>;
}

function StudentsPage() {
  const { students, toggleStudent, addStudent, updateStudent, removeStudent, loading, settings } = useClassData();
  const paymentItems = Array.isArray(settings.payment) ? (settings.payment as PaymentItem[]) : [];
  const [studentModal, setStudentModal] = useState<null | { mode: "add" | "edit"; uid?: string; no?: string; name?: string; paid?: boolean; note?: string; payments?: Record<string, boolean> }>(null);
  const [studentBusy, setStudentBusy] = useState(false);
  const [quickPayModal, setQuickPayModal] = useState<null | { studentId: string; studentName: string; payments: Record<string, boolean> }>(null);
  const [removeStudentConfirm, setRemoveStudentConfirm] = useState<null | { student: typeof students[number] }>(null);

  const summary = paymentItems.length ? (() => {
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidStudentsAll = 0;
    for (const p of paymentItems) {
      const paidFor = students.filter((s) => getStudentPaymentPaid(s, p.id)).length;
      totalPaidStudentsAll += paidFor;
      totalPaidAmount += paidFor * p.amount;
      totalUnpaidAmount += Math.max(students.length - paidFor, 0) * p.amount;
    }
    const first = paymentItems[0];
    const firstPaid = students.filter((s) => getStudentPaymentPaid(s, first.id)).length;
    const firstRate = students.length ? Math.round((firstPaid / students.length) * 100) : 0;
    return {
      title: `${first.title}${paymentItems.length > 1 ? ` 等 ${paymentItems.length} 項` : ""}`,
      rate: firstRate,
      firstPaid,
      firstTotal: students.length || 0,
      totalPaidStudentsAll,
      totalPaidAmount,
      totalUnpaidAmount,
    };
  })() : { title: "繳費", rate: 0, firstPaid: 0, firstTotal: 0, totalPaidStudentsAll: 0, totalPaidAmount: 0, totalUnpaidAmount: 0 };

  function openAddStudent() {
    const nextNo = String(students.length ? Number(students[students.length - 1]?.no ?? "0") + 1 : 1).padStart(2, "0");
    const payments = Object.fromEntries(paymentItems.map((p) => [p.id, false]));
    setStudentModal({ mode: "add", no: nextNo, name: "", paid: false, note: "", payments });
  }

  function openEditStudent(student: typeof students[number]) {
    setStudentModal({ mode: "edit", uid: student.id, no: student.no, name: student.name, paid: student.paid, note: student.note, payments: { ...student.payments } });
  }

  async function saveStudent() {
    if (!studentModal) return;
    const no = String(studentModal.no ?? "").trim();
    const name = String(studentModal.name ?? "").trim();
    if (!no || !name) {
      toast.error("姓名與座號皆為必填");
      return;
    }
    setStudentBusy(true);
    try {
      const payments = studentModal.payments && typeof studentModal.payments === "object"
        ? Object.fromEntries(Object.entries(studentModal.payments).map(([k, v]) => [k, Boolean(v)]))
        : Object.fromEntries(paymentItems.map((p) => [p.id, Boolean(studentModal.paid)]));
      const anyPending = Object.values(payments).some((v) => !v);
      const patch = {
        no,
        name,
        paid: !anyPending,
        note: studentModal.note ?? (anyPending ? "待補繳" : `已繳 ${Object.keys(payments).length} 項`),
        payments,
      };
      if (studentModal.mode === "add") {
        await addStudent(patch);
        toast.success("學生已新增");
      } else if (studentModal.mode === "edit" && studentModal.uid) {
        await updateStudent(studentModal.uid, patch);
        toast.success("學生資料已更新");
      }
      setStudentModal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存失敗";
      if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認資料寫入權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setStudentBusy(false);
    }
  }

  async function handleRemoveStudent(student: typeof students[number]) {
    setRemoveStudentConfirm({ student });
  }

  async function performRemoveStudent() {
    if (!removeStudentConfirm) return;
    const student = removeStudentConfirm.student;
    setStudentBusy(true);
    try {
      await removeStudent(student.id);
      setRemoveStudentConfirm(null);
      toast.success("學生已刪除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "刪除失敗";
      if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("刪除被拒絕：請確認資料刪除權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setStudentBusy(false);
    }
  }

  async function handleTogglePayment(student: typeof students[number], paymentId: string, title: string) {
    try {
      await toggleStudent({ studentId: student.id, paymentId });
      toast(`${student.name} 的「${title}」已更新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失敗");
    }
  }

  function openQuickPay(student: typeof students[number]) {
    if (!paymentItems.length) {
      toast("請先至「設定 → 繳費設定」新增繳費項目");
      return;
    }
    const payments: Record<string, boolean> = {};
    for (const p of paymentItems) payments[p.id] = getStudentPaymentPaid(student, p.id);
    setQuickPayModal({ studentId: student.id, studentName: student.name, payments });
  }

  async function saveQuickPay() {
    if (!quickPayModal) return;
    setStudentBusy(true);
    try {
      const payments = Object.fromEntries(Object.entries(quickPayModal.payments).map(([k, v]) => [k, Boolean(v)]));
      await updateStudent(quickPayModal.studentId, { payments });
      toast.success(`${quickPayModal.studentName} 的繳費項目已更新`);
      setQuickPayModal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存失敗";
      if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認資料寫入權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setStudentBusy(false);
    }
  }

  return <>
    <div className="students-summary">
      <div>
        <span>{summary.title} 繳費率</span>
        <strong>{summary.rate}%</strong>
      </div>
      <div className="summary-side">
        <span>已繳 / 待繳</span>
        <b>
          {summary.firstPaid} / {summary.firstTotal}
          {paymentItems.length > 1 && <span style={{marginLeft:8,fontWeight:600}}> · 累計 {summary.totalPaidStudentsAll} 項次</span>}
          <span style={{marginLeft:8,fontWeight:700}}>待收 NT$ {summary.totalUnpaidAmount.toLocaleString()}</span>
        </b>
      </div>
    </div>
    <div className="section-row"><h3>繳費名單</h3><div className="row-actions"><button className="text-link" onClick={() => toast("名單匯出功能開發中")}>匯出名單 <ChevronRight size={15}/></button><button className="primary-button tiny" disabled={studentBusy} onClick={openAddStudent}><Plus size={14}/> 新增</button></div></div>
    <div className="student-list">
      {loading ? (
        <div className="empty-state"><Users size={30}/><strong>讀取學生名單中…</strong></div>
      ) : students.length ? (
        students.map((student) => {
          const paidSummary = paymentItems.length
            ? (() => {
                const paidList = paymentItems.filter((p) => getStudentPaymentPaid(student, p.id)).map((p) => p.title);
                const pendingList = paymentItems.filter((p) => !getStudentPaymentPaid(student, p.id)).map((p) => p.title);
                return { text: pendingList.length ? `待繳：${pendingList.join("、")}` : (paidList.length ? `已繳 ${paidList.length}/${paymentItems.length}（點擊管理）` : "尚無項目"), allPaid: !pendingList.length };
              })()
            : { text: student.paid ? "已繳" : "待繳", allPaid: student.paid };
          return (
            <div className="student-row student-row-multi" key={student.id}>
              <div className="student-no">{student.no}</div>
              <div className="student-name"><strong>{student.name}</strong><span className="clickable-span" title="點擊管理繳費項目" onClick={() => openQuickPay(student)}>{paidSummary.text}</span></div>
              <span className={`status ${paidSummary.allPaid ? "paid" : "pending"} clickable-span`} title="點擊管理繳費項目" onClick={() => openQuickPay(student)}>{paidSummary.allPaid ? "已繳" : "待繳"}</span>
              <div className="student-actions">
                <button className="icon-inline" aria-label="編輯學生" disabled={studentBusy} onClick={() => openEditStudent(student)}><Pencil size={15}/></button>
                <button className="icon-inline danger" aria-label="刪除學生" disabled={studentBusy} onClick={() => void handleRemoveStudent(student)}><Trash2 size={15}/></button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty-state"><Users size={30}/><strong>目前尚無學生名單</strong><span>請點擊右上方「新增」按鈕建立第一位學生。</span></div>
      )}
    </div>

    {studentModal && <div className="modal-backdrop"><div className="modal">
      <div className="modal-head"><h3>{studentModal.mode === "add" ? "新增學生" : "編輯學生"}</h3><button onClick={() => !studentBusy && setStudentModal(null)} disabled={studentBusy}><X size={18}/></button></div>
      <label>座號<input value={studentModal.no ?? ""} onChange={(e) => setStudentModal({ ...studentModal, no: e.target.value })} placeholder="例如：01" disabled={studentBusy} /></label>
      <label>姓名<input value={studentModal.name ?? ""} onChange={(e) => setStudentModal({ ...studentModal, name: e.target.value })} placeholder="例如：王小明" disabled={studentBusy} /></label>
      {paymentItems.length > 0 && (
        <div className="payments-edit-block">
          <p className="payments-edit-title">繳費項目狀態</p>
          <div className="payments-edit-grid">
            {paymentItems.map((p) => {
              const checked = Boolean((studentModal.payments ?? {})[p.id] ?? false);
              return (
                <label key={p.id} className="payments-edit-item">
                  <span>{p.title}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setStudentModal({
                      ...studentModal,
                      payments: { ...(studentModal.payments ?? {}), [p.id]: e.target.checked },
                      paid: Object.values({ ...(studentModal.payments ?? {}), [p.id]: e.target.checked }).every(Boolean),
                    })}
                  />
                  <small>NT$ {p.amount.toLocaleString()}</small>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {paymentItems.length === 0 && (
        <label>繳費狀態<select value={studentModal.paid ? "paid" : "pending"} onChange={(e) => setStudentModal({ ...studentModal, paid: e.target.value === "paid" })} disabled={studentBusy}><option value="pending">待繳</option><option value="paid">已繳</option></select></label>
      )}
      <label>備註<input value={studentModal.note ?? ""} onChange={(e) => setStudentModal({ ...studentModal, note: e.target.value })} placeholder="例如：已繳 10月 或 待補繳" disabled={studentBusy} /></label>
      <button className="primary-button wide" onClick={() => void saveStudent()} disabled={studentBusy}>{studentBusy ? "處理中…" : (studentModal.mode === "add" ? "新增學生" : "儲存變更")}</button>
    </div></div>}

    {quickPayModal && <div className="modal-backdrop"><div className="sheet">
      <div className="sheet-head"><div><strong>繳費項目 · {quickPayModal.studentName}</strong><span>勾選已繳費的項目後按儲存</span></div><button onClick={() => !studentBusy && setQuickPayModal(null)} disabled={studentBusy}><X size={18}/></button></div>
      <div className="sheet-body">
        <div className="payments-edit-grid">
          {paymentItems.map((p) => {
            const checked = Boolean((quickPayModal.payments ?? {})[p.id] ?? false);
            return (
                <label key={p.id} className="payments-edit-item">
                  <span>{p.title}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setQuickPayModal({
                      ...quickPayModal,
                      payments: { ...(quickPayModal.payments ?? {}), [p.id]: e.target.checked },
                    })}
                  />
                  <small>NT$ {p.amount.toLocaleString()}</small>
                </label>
              );
          })}
        </div>
      </div>
      <div className="sheet-actions">
        <button className="secondary-button wide" disabled={studentBusy} onClick={() => setQuickPayModal(null)}>取消</button>
        <button className="primary-button wide" disabled={studentBusy} onClick={() => void saveQuickPay()}>{studentBusy ? "處理中…" : "儲存"}</button>
      </div>
    </div></div>}

    <ConfirmDialog open={Boolean(removeStudentConfirm)} title={`確認刪除「${removeStudentConfirm?.student.no ?? ""} ${removeStudentConfirm?.student.name ?? ""}」？`} message="刪除學生資料後無法復原，包含繳費狀態會一併移除。" onCancel={() => setRemoveStudentConfirm(null)} onConfirm={() => void performRemoveStudent()} />
  </>;
}

const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const SEMESTER_MONTHS = [5, 6, 7, 8, 9, 10, 11]; // 6月-12月 對應 index 5..11
const DEFAULT_CATEGORIES: Array<{ key: string; label: string; dot: "blue" | "yellow" | "coral"; match: RegExp }> = [
  { key: "activity", label: "班級活動", dot: "blue", match: /(活動|慶生|聯誼|出遊|比賽|運動會|校外)/i },
  { key: "material", label: "教材與用品", dot: "yellow", match: /(教材|用品|文具|書籍|紙張|打掃|清潔|設備|道具|材料)/i },
  { key: "other", label: "其他支出", dot: "coral", match: /()/i },
];

function buildMonthlyTotals(items: ClassTransaction[]) {
  const byMonth = new Map<number, number>();
  for (const idx of SEMESTER_MONTHS) byMonth.set(idx, 0);
  for (const t of items) {
    const d = t.createdAt ? new Date(t.createdAt) : new Date();
    const m = d.getMonth();
    if (SEMESTER_MONTHS.includes(m)) {
      const current = byMonth.get(m) ?? 0;
      byMonth.set(m, current + Math.abs(t.amount));
    }
  }
  return SEMESTER_MONTHS.map((m) => ({ month: m, total: byMonth.get(m) ?? 0 }));
}

function buildExpenseCategories(expenseItems: ClassTransaction[]) {
  const totals: Record<string, number> = { activity: 0, material: 0, other: 0 };
  for (const t of expenseItems) {
    const text = `${t.title} ${t.meta ?? ""}`;
    let matched = false;
    for (const cat of DEFAULT_CATEGORIES) {
      if (cat.key !== "other" && cat.match.test(text)) {
        totals[cat.key] += Math.abs(t.amount);
        matched = true;
        break;
      }
    }
    if (!matched) totals.other += Math.abs(t.amount);
  }
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, amount: totals[c.key] ?? 0 }));
}

function ReportsPage() {
  const { transactions } = useClassData();
  const incomeList = transactions.filter((item) => item.type === "in");
  const expenseList = transactions.filter((item) => item.type === "out");
  const income = incomeList.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expense = expenseList.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const monthly = buildMonthlyTotals(transactions);
  const rawMax = Math.max(1, ...monthly.map((m) => m.total));
  const expenseCats = buildExpenseCategories(expenseList);
  const anyExpense = expenseCats.some((c) => c.amount > 0);
  const net = income - expense;

  const Y_STEP = 1000;
  const unitsNeeded = Math.max(4, Math.ceil(rawMax / Y_STEP) + 1);
  const yMax = Y_STEP * unitsNeeded;
  const yTicks: number[] = [];
  for (let i = unitsNeeded; i >= 0; i -= 1) yTicks.push(Y_STEP * i);

  function formatTick(v: number): string {
    if (v <= 0) return "NT$ 0";
    return `NT$ ${(v / 1000).toLocaleString()}k`;
  }

  return <><div className="report-card"><div className="report-head"><div><span>本學期現金流</span><strong>NT$ {net.toLocaleString()}</strong></div><span className={"trend-badge " + (net >= 0 ? "" : "")}>{net >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>} {net >= 0 ? "結餘" : "超支"}</span></div><div className="chart"><div className="chart-grid">{yTicks.map((t, i) => <span key={i}>{formatTick(t)}</span>)}</div><div className="bars">{monthly.map((row, i) => {
  const heightPct = row.total ? Math.max(6, Math.round((row.total / Math.max(1, yMax)) * 100)) : 0;
  const isHot = i === monthly.length - 2;
  return <div className="bar-wrap" key={row.month}><i style={{height: `${heightPct}%`}} className={isHot ? "hot" : ""} title={`NT$ ${row.total.toLocaleString()}`}/><small>{MONTH_LABELS[row.month]}</small></div>;
})}</div></div></div><div className="section-row"><h3>支出分類</h3></div><div className="category-list">{anyExpense ? expenseCats.map((c) => c.amount > 0 ? <div key={c.key}><span className={`category-dot ${c.dot}`}/><strong>{c.label}</strong><b>NT$ {c.amount.toLocaleString()}</b></div> : null) : <div><span className="category-dot coral"/><strong>尚無支出紀錄</strong><b>NT$ 0</b></div>}</div></>;
}

function SettingsPage() {
  const { settings, refresh: refreshData } = useClassData();
  const { user, firebaseAuth } = useAuth();
  const [notify, setNotify] = useState(true);
  const [className, setClassName] = useState(String(settings.className ?? "701 班"));
  const [editingClassName, setEditingClassName] = useState(false);
  const [classNameDraft, setClassNameDraft] = useState(className);
  const [savingClassName, setSavingClassName] = useState(false);
  const initialPayments = (() => {
    if (Array.isArray(settings.payment)) return settings.payment.filter((p): p is PaymentItem => p && typeof p === "object" && "id" in p && "title" in p && "amount" in p);
    if (settings.payment && typeof settings.payment === "object") {
      const obj = settings.payment as Record<string, unknown>;
      return [{ id: typeof obj.id === "string" && obj.id.length ? obj.id : "default", title: String(obj.title ?? "10月班費"), amount: Number.isFinite(Number(obj.amount)) ? Math.max(1, Math.floor(Number(obj.amount))) : 300 }];
    }
    return [{ id: "default", title: "10月班費", amount: 300 } as PaymentItem];
  })();
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentDraftTitle, setPaymentDraftTitle] = useState("");
  const [paymentDraftAmount, setPaymentDraftAmount] = useState("");
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Array<{ uid: string; email: string; displayName?: string | null; isCurrent?: boolean }>>([]);
  const [adminModal, setAdminModal] = useState<null | { mode: "add" | "edit"; uid?: string; email?: string; password?: string; displayName?: string }>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [removePaymentConfirm, setRemovePaymentConfirm] = useState<null | { item: PaymentItem }>(null);
  const [removeAdminConfirm, setRemoveAdminConfirm] = useState<null | { admin: typeof admins[number] }>(null);

  useEffect(() => {
    setClassName(String(settings.className ?? "701 班"));
  }, [settings.className]);

  useEffect(() => {
    const next = (() => {
      if (Array.isArray(settings.payment)) return settings.payment.filter((p): p is PaymentItem => p && typeof p === "object" && "id" in p && "title" in p && "amount" in p);
      if (settings.payment && typeof settings.payment === "object") {
        const obj = settings.payment as Record<string, unknown>;
        return [{ id: typeof obj.id === "string" && obj.id.length ? obj.id : "default", title: String(obj.title ?? "10月班費"), amount: Number.isFinite(Number(obj.amount)) ? Math.max(1, Math.floor(Number(obj.amount))) : 300 }];
      }
      return null;
    })();
    if (next) setPayments(next);
  }, [settings.payment]);

  async function saveClassName() {
    const name = classNameDraft.trim();
    if (!name) {
      toast.error("班級名稱不可空白");
      return;
    }
    if (!firebaseReady) {
      toast.error("系統未連線，無法儲存");
      return;
    }
    setSavingClassName(true);
    try {
      await setSettingValue("className", name);
      setClassName(name);
      setEditingClassName(false);
      toast.success("班級名稱已更新");
      try {
        await refreshData();
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存失敗";
      toast.error(message.includes("PERMISSION_DENIED") || message.includes("Security Rules")
        ? "寫入被拒絕：請確認班級設定寫入權限已開啟"
        : message);
      setClassNameDraft(className);
    } finally {
      setSavingClassName(false);
    }
  }

  async function savePaymentItem(paymentId: string) {
    const title = paymentDraftTitle.trim();
    const amount = Number(paymentDraftAmount);
    if (!title) {
      toast.error("繳費項目不可空白");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("繳費金額需為正整數");
      return;
    }
    if (!firebaseReady) {
      toast.error("系統未連線，無法儲存");
      return;
    }
    const isNew = paymentId === "new";
    setSavingPaymentId(paymentId);
    try {
      const next: PaymentItem[] = [...payments];
      if (isNew) {
        const newId = `p_${Date.now()}`;
        next.push({ id: newId, title, amount });
      } else {
        const idx = next.findIndex((p) => p.id === paymentId);
        if (idx >= 0) next[idx] = { ...next[idx], title, amount };
      }
      await setSettingValue("payment", next);
      setPayments(next);
      setEditingPaymentId(null);
      setPaymentDraftTitle("");
      setPaymentDraftAmount("");
      toast.success(isNew ? "已新增繳費項目" : "繳費項目已更新");
      try {
        await refreshData();
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存失敗";
      if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認班級設定寫入權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setSavingPaymentId(null);
    }
  }

  function openAddPayment() {
    setEditingPaymentId("new");
    setPaymentDraftTitle("");
    setPaymentDraftAmount("");
  }

  function openEditPayment(item: PaymentItem) {
    setEditingPaymentId(item.id);
    setPaymentDraftTitle(item.title);
    setPaymentDraftAmount(`${item.amount}`);
  }

  function removePayment(item: PaymentItem) {
    setRemovePaymentConfirm({ item });
  }

  async function performRemovePayment() {
    if (!removePaymentConfirm) return;
    const item = removePaymentConfirm.item;
    if (!firebaseReady) {
      toast.error("系統未連線，無法儲存");
      return;
    }
    setSavingPaymentId(item.id);
    try {
      const next = payments.filter((p) => p.id !== item.id);
      if (!next.length) next.push({ id: "default", title: "10月班費", amount: 300 });
      await setSettingValue("payment", next);
      setPayments(next);
      if (editingPaymentId === item.id) {
        setEditingPaymentId(null);
        setPaymentDraftTitle("");
        setPaymentDraftAmount("");
      }
      setRemovePaymentConfirm(null);
      toast.success("繳費項目已刪除");
      try {
        await refreshData();
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "刪除失敗";
      if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認班級設定寫入權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setSavingPaymentId(null);
    }
  }

  useEffect(() => {
    if (!settings || typeof settings.admins !== "object") {
      setAdmins(user ? [{ uid: user.uid, email: user.email ?? "", displayName: (user as User | null)?.displayName ?? null, isCurrent: true }] : []);
      return;
    }
    const adminsMap = settings.admins as Record<string, { email?: string; displayName?: string }>;
    setAdmins(Object.entries(adminsMap).map(([uid, data]) => ({ uid, email: data.email ?? "", displayName: data.displayName, isCurrent: user?.uid === uid })));
  }, [settings, user]);

  async function persistAdmins(nextAdmins: typeof admins) {
    const payload = nextAdmins.reduce<Record<string, { email: string; displayName?: string }>>((acc, item) => {
      acc[item.uid] = { email: item.email, displayName: item.displayName ?? undefined };
      return acc;
    }, {});
    await setSettingValue("admins", payload);
  }

  function openAddAdmin() {
    setAdminModal({ mode: "add", email: "", password: "", displayName: "" });
  }

  function openEditAdmin(admin: typeof admins[number]) {
    setAdminModal({ mode: "edit", uid: admin.uid, email: admin.email, password: "", displayName: admin.displayName ?? "" });
  }

  async function saveAdmin() {
    if (!adminModal || !firebaseAuth || !firebaseReady) {
      toast.error("系統未連線");
      return;
    }
    const email = (adminModal.email ?? "").trim();
    const displayName = (adminModal.displayName ?? "").trim() || undefined;
    const password = adminModal.password ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("請輸入有效電子信箱");
      return;
    }
    setAdminBusy(true);
    try {
      if (adminModal.mode === "add") {
        if (password.length < 6) {
          toast.error("密碼至少 6 字元");
          return;
        }
        const created = await createAuthUser({ email, password, displayName });
        const uid = created.uid;
        const next = [...admins, { uid, email: created.email ?? email, displayName: created.displayName ?? displayName, isCurrent: false }];
        await persistAdmins(next);
        setAdmins(next);
        toast.success("管理者已新增");
      } else if (adminModal.mode === "edit" && adminModal.uid) {
        const existing = admins.find((a) => a.uid === adminModal.uid);
        if (!existing) throw new Error("找不到管理者");
        const target = (firebaseAuth.currentUser?.uid === existing.uid ? firebaseAuth.currentUser : null);
        if (target) {
          if (email !== existing.email) await updateEmail(target, email);
          if (password.length >= 6) await updatePassword(target, password);
        } else if (password.length >= 6) {
          toast.warning("非當前登入者密碼變更需 Cloud Functions 協助；本機僅更新信箱與顯示名稱");
        }
        const next = admins.map((a) => a.uid === adminModal.uid ? { ...a, email, displayName } : a);
        await persistAdmins(next);
        setAdmins(next);
        toast.success("管理者已更新");
      }
      setAdminModal(null);
      try {
        await refreshData();
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存失敗";
      if (typeof window !== "undefined" && error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("[admin-save-error]", error, { code: (error as any).code, status: (error as any).status });
      }
      if (message.includes("requires-recent-login")) {
        toast.error("密碼變更需重新登入後再操作");
      } else if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認管理者帳號寫入權限已開啟");
      } else if (message.includes("找不到 Firebase API Key")) {
        toast.error("連線金鑰遺漏：請確認環境變數已設定");
      } else {
        toast.error(message);
      }
    } finally {
      setAdminBusy(false);
    }
  }

  function removeAdmin(admin: typeof admins[number]) {
    if (admin.isCurrent) {
      toast.error("無法刪除目前登入的管理者帳號");
      return;
    }
    setRemoveAdminConfirm({ admin });
  }

  async function performRemoveAdmin() {
    if (!removeAdminConfirm) return;
    const admin = removeAdminConfirm.admin;
    if (!firebaseAuth || !firebaseReady) {
      toast.error("系統未連線");
      return;
    }
    setAdminBusy(true);
    try {
      if (firebaseAuth.currentUser?.uid === admin.uid) {
        await deleteUser(firebaseAuth.currentUser);
      }
      const next = admins.filter((a) => a.uid !== admin.uid);
      await persistAdmins(next);
      setAdmins(next);
      setRemoveAdminConfirm(null);
      toast.success("管理者已刪除");
      try {
        await refreshData();
      } catch {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "刪除失敗";
      if (typeof window !== "undefined" && error instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("[admin-remove-error]", error, { code: (error as any).code, status: (error as any).status });
      }
      if (message.includes("requires-recent-login")) {
        toast.error("刪除帳號需重新登入後再操作");
      } else if (message.includes("PERMISSION_DENIED") || message.includes("Security Rules")) {
        toast.error("寫入被拒絕：請確認管理者帳號寫入權限已開啟");
      } else {
        toast.error(message);
      }
    } finally {
      setAdminBusy(false);
    }
  }

  return <>
    <div className="settings-group"><p className="group-label">班級設定</p>
      {editingClassName ? (
        <div className="setting-item inline-edit">
          <span>班級名稱</span>
          <div className="inline-edit-actions">
            <input value={classNameDraft} onChange={(e) => setClassNameDraft(e.target.value)} placeholder="例如：701 班" />
            <button className="primary-button tiny" disabled={savingClassName} onClick={() => void saveClassName()}>{savingClassName ? "儲存中…" : "儲存"}</button>
            <button className="secondary-button tiny" disabled={savingClassName} onClick={() => { setClassNameDraft(className); setEditingClassName(false); }}>取消</button>
          </div>
        </div>
      ) : (
        <div className="setting-item clickable" onClick={() => { setClassNameDraft(className); setEditingClassName(true); }}>
          <span>班級名稱</span>
          <b>{className} <Pencil size={14}/></b>
        </div>
      )}
      <div className="setting-item stacked">
        <div className="stacked-head"><span>繳費設定</span><button className="primary-button tiny" disabled={Boolean(savingPaymentId)} onClick={openAddPayment}><Plus size={14}/> 新增</button></div>
        <div className="payment-list">
          {payments.length ? payments.map((p) => editingPaymentId === p.id ? (
            <div className="setting-item inline-edit stacked payment-edit" key={p.id}>
              <span>編輯項目</span>
              <div className="inline-edit-actions stacked-edit">
                <label>項目名稱<input value={paymentDraftTitle} onChange={(e) => setPaymentDraftTitle(e.target.value)} placeholder="例如：11月 運動服" /></label>
                <label>金額（NT$）<input type="number" min={1} value={paymentDraftAmount} onChange={(e) => setPaymentDraftAmount(e.target.value)} placeholder="例如：450" /></label>
                <div className="stacked-actions">
                  <button className="primary-button tiny" disabled={savingPaymentId === p.id} onClick={() => void savePaymentItem(p.id)}>{savingPaymentId === p.id ? "儲存中…" : "儲存"}</button>
                  <button className="secondary-button tiny" disabled={savingPaymentId === p.id} onClick={() => { setEditingPaymentId(null); setPaymentDraftTitle(""); setPaymentDraftAmount(""); }}>取消</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-row payment-row" key={p.id}>
              <div className="admin-meta">
                <strong>{p.title}</strong>
                <span>NT$ {p.amount.toLocaleString()} · 每位學生收費</span>
              </div>
              <div className="admin-actions">
                <button className="icon-inline" aria-label="編輯繳費項目" disabled={Boolean(savingPaymentId)} onClick={() => openEditPayment(p)}><Pencil size={15}/></button>
                <button className="icon-inline danger" aria-label="刪除繳費項目" disabled={savingPaymentId === p.id || (payments.length === 1)} onClick={() => void removePayment(p)}><Trash2 size={15}/></button>
              </div>
            </div>
          )) : <div className="empty-inline">尚無繳費項目，請先新增</div>}
          {editingPaymentId === "new" && (
            <div className="setting-item inline-edit stacked payment-edit" style={{marginTop:10,borderRadius:14}}>
              <span>新增項目</span>
              <div className="inline-edit-actions stacked-edit">
                <label>項目名稱<input value={paymentDraftTitle} onChange={(e) => setPaymentDraftTitle(e.target.value)} placeholder="例如：校外教學費" /></label>
                <label>金額（NT$）<input type="number" min={1} value={paymentDraftAmount} onChange={(e) => setPaymentDraftAmount(e.target.value)} placeholder="例如：800" /></label>
                <div className="stacked-actions">
                  <button className="primary-button tiny" disabled={savingPaymentId === "new"} onClick={() => void savePaymentItem("new")}>{savingPaymentId === "new" ? "儲存中…" : "儲存"}</button>
                  <button className="secondary-button tiny" disabled={savingPaymentId === "new"} onClick={() => { setEditingPaymentId(null); setPaymentDraftTitle(""); setPaymentDraftAmount(""); }}>取消</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    <div className="settings-group"><p className="group-label">通知與權限</p>
      <div className="setting-item"><span>繳費提醒</span><button className={notify ? "toggle on" : "toggle"} onClick={() => setNotify(!notify)}><i/></button></div>
      <div className="setting-item stacked">
        <div className="stacked-head"><span>管理者帳號</span><button className="primary-button tiny" disabled={adminBusy} onClick={openAddAdmin}><Plus size={14}/> 新增</button></div>
        <div className="admin-list">
          {admins.length ? admins.map((admin) => <div className="admin-row" key={admin.uid}>
            <div className="admin-meta">
              <strong>{admin.isCurrent ? ((user as User | null)?.displayName ?? admin.displayName) : (admin.displayName || "未命名管理者")}</strong>
              {!admin.isCurrent && <span>{admin.email}</span>}
            </div>
            <div className="admin-actions">
              <button className="icon-inline" aria-label="編輯" disabled={adminBusy} onClick={() => openEditAdmin(admin)}><Pencil size={15}/></button>
              <button className="icon-inline danger" aria-label="刪除" disabled={adminBusy || admin.isCurrent} onClick={() => void removeAdmin(admin)}><Trash2 size={15}/></button>
            </div>
          </div>) : <div className="empty-inline">尚無管理者，請先新增</div>}
        </div>
      </div>
    </div>
    {adminModal && <div className="modal-backdrop"><div className="modal">
      <div className="modal-head"><h3>{adminModal.mode === "add" ? "新增管理者" : "編輯管理者"}</h3><button onClick={() => !adminBusy && setAdminModal(null)} disabled={adminBusy}><X size={18}/></button></div>
      <label>顯示名稱<input value={adminModal.displayName ?? ""} onChange={(e) => setAdminModal({ ...adminModal, displayName: e.target.value })} placeholder="例如：劉老師" disabled={adminBusy} /></label>
      <label>電子信箱<input type="email" value={adminModal.email ?? ""} onChange={(e) => setAdminModal({ ...adminModal, email: e.target.value })} placeholder="teacher@mingde.edu.tw" disabled={adminBusy} /></label>
      <label>{adminModal.mode === "add" ? "密碼（至少 6 字元）" : "密碼（留空則不變更，至少 6 字元）"}<input type="password" value={adminModal.password ?? ""} onChange={(e) => setAdminModal({ ...adminModal, password: e.target.value })} placeholder={adminModal.mode === "add" ? "請輸入密碼" : "留空表示不變更"} disabled={adminBusy} /></label>
      <button className="primary-button wide" disabled={adminBusy} onClick={() => void saveAdmin()}>{adminBusy ? "處理中…" : (adminModal.mode === "add" ? "新增管理者" : "儲存變更")}</button>
    </div></div>}

    <ConfirmDialog open={Boolean(removePaymentConfirm)} title={`確認刪除繳費項目「${removePaymentConfirm?.item.title ?? ""}」？`} message="刪除後相關學生的繳費勾選狀態會保留，但此項目不再顯示與統計。" onCancel={() => setRemovePaymentConfirm(null)} onConfirm={() => void performRemovePayment()} />
    <ConfirmDialog open={Boolean(removeAdminConfirm)} title={`確認刪除管理者「${removeAdminConfirm?.admin.displayName || removeAdminConfirm?.admin.email || ""}」？`} message="此帳號的登入權限會被移除，僅可於系統重新新增後回復。" onCancel={() => setRemoveAdminConfirm(null)} onConfirm={() => void performRemoveAdmin()} />
  </>;
}

export default function Home() {
  const [location] = useLocation();
  const { transactions, students, settings } = useClassData();
  const paymentItems = Array.isArray(settings.payment) ? (settings.payment as PaymentItem[]) : [];
  const income = transactions.filter((item) => item.type === "in").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expense = transactions.filter((item) => item.type === "out").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const [shareModal, setShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  function buildPublicBundle(): string {
    const safeTx = transactions.map((t) => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      type: t.type,
      meta: t.meta,
      createdAt: t.createdAt,
    }));
    const safePayments = paymentItems.map((p) => ({
      id: p.id,
      title: p.title,
      amount: p.amount,
      paidCount: students.filter((s) => getStudentPaymentPaid(s, p.id)).length,
      studentCount: students.length,
    }));
    const bundle = {
      v: 1,
      className: settings.className ?? "701 班",
      yearLabel: "2026 學年度",
      generatedAt: new Date().toISOString(),
      summary: {
        balance: income - expense,
        income,
        expense,
        incomeCount: transactions.filter((t) => t.type === "in").length,
        expenseCount: transactions.filter((t) => t.type === "out").length,
        txCount: transactions.length,
        studentCount: students.length,
      },
      monthly: buildMonthlyTotals(transactions),
      payments: safePayments,
      transactions: safeTx,
    };
    try {
      const json = JSON.stringify(bundle);
      const bytes = new TextEncoder().encode(json);
      let binary = "";
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return b64;
    } catch (_err) {
      return "";
    }
  }
  function buildShareUrl(): string {
    const b64 = buildPublicBundle();
    const base = (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "./").replace(/[^/]*$/, "");
    return `${base}open.html?d=${b64}`;
  }
  function openShare() {
    setShareUrl(buildShareUrl());
    setShareModal(true);
  }
  function copyShare() {
    const link = shareUrl || buildShareUrl();
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast.success("已複製連結"); }
      catch { toast.error("複製失敗，請手動複製"); }
      finally { document.body.removeChild(ta); }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => toast.success("已複製連結"), fallback);
    } else {
      fallback();
    }
  }
  function openShareTab() {
    const link = shareUrl || buildShareUrl();
    window.open(link, "_blank", "noopener");
  }

  const page = useMemo(() => location === "/transactions" ? <TransactionsPage /> : location === "/students" ? <StudentsPage /> : location === "/reports" ? <ReportsPage /> : location === "/settings" ? <SettingsPage /> : <Overview />, [location]);
  const install = usePwaInstallBanner();
  return <>
    <Shell share={location === "/" ? { onOpen: openShare } : undefined}>{page}</Shell>
    {shareModal && <div className="modal-backdrop" onClick={() => setShareModal(false)}><div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}><div className="modal-head"><div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}><span style={{ width: 42, height: 42, borderRadius: 12, background: "#e2f0e9", color: "var(--teal)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Share2 size={19} /></span><div style={{ flex: 1 }}><h3 style={{ margin: "2px 0 4px", fontSize: 19, letterSpacing: "-.02em" }}>分享公開頁面</h3><p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>任何人拿到下方連結，可在不需登入的情況下「唯讀」查看班費結餘、收入、支出與收支明細；唯無法編輯或刪除任何資料。</p></div></div><button onClick={() => setShareModal(false)} aria-label="關閉"><X size={18} /></button></div><label>公開連結<input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} /></label><div style={{ display: "flex", gap: 10, marginTop: 6 }}><button className="secondary-button wide" onClick={openShareTab}><ExternalLink size={15} /> 預覽</button><button className="primary-button wide" onClick={copyShare}><Copy size={15} /> 複製連結</button></div></div></div>}
    <InstallPrompt visible={install.visible} isIos={install.isIos} dismiss={install.dismiss} install={install.install} />
  </>;
}
