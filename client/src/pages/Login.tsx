import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Smartphone } from "lucide-react";
import { useAuth, demoCredentials, firebaseReady } from "@/contexts/AuthContext";
import { useClassData } from "@/contexts/ClassDataContext";

export default function Login() {
  const { signIn } = useAuth();
  const { settings } = useClassData();
  const className = String(settings.className ?? "701 班");
  const [email, setEmail] = useState(firebaseReady ? "" : demoCredentials.email);
  const [password, setPassword] = useState(firebaseReady ? "" : demoCredentials.password);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") document.title = `班費管理`;
  }, [className]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success(`登入成功，歡迎回到班費管理`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登入失敗，請檢查帳號密碼");
    } finally {
      setBusy(false);
    }
  }

  return <div className="login-page">
    <div className="login-orb orb-one" /><div className="login-orb orb-two" />
    <main className="login-panel">
      <div className="login-brand"><div className="brand-mark"><img src="./pwa-icon.svg" alt="LOGO" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></div><div><p className="eyebrow">CLASS FUND SYSTEM</p><h1>{className} 班費管理</h1></div></div>
      <div className="login-intro"><span className="login-kicker"><LockKeyhole size={13}/> 管理者登入</span><p>登入後即可管理班級收支、繳費名單與學期報表。</p></div>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>電子信箱<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@mingde.edu.tw" autoComplete="email" required /></label>
        <label>登入密碼<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="請輸入密碼" autoComplete="current-password" required /><button type="button" aria-label="顯示密碼" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        <div className="login-options"><label className="remember"><input type="checkbox" defaultChecked /> <span>記住此裝置</span></label><button type="button" onClick={() => toast("請聯絡班級管理者重設密碼")}>忘記密碼？</button></div>
        <button className="login-submit" disabled={busy}>{busy ? "登入中…" : <>登入系統 <ArrowRight size={17}/></>}</button>
      </form>
      {!firebaseReady && <div className="demo-login"><strong>示範模式</strong><span>已預填測試帳號：teacher@mingde.edu.tw</span><small>密碼：701demo</small></div>}
      <div className="install-tip"><Smartphone size={17}/><div><strong>可安裝到手機</strong><span>登入後點選瀏覽器選單中的「加入主畫面」即可像 App 一樣使用。</span></div></div>
    </main>
    <footer className="login-footer">{className} 班級自治會 · 2026 學年度</footer>
  </div>;
}
