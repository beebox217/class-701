# 明德國中 701 班費管理系統

手機優先、分頁式的班費管理系統，使用 React + Vite + Tailwind CSS，前端輸出為可部署到 GitHub Pages 的靜態 HTML/CSS/JavaScript，資料與登入使用 Firebase Authentication、Cloud Firestore。

## 功能

- **總覽**：目前結餘、本月收入／支出、最近收支、繳費進度
- **收支**：Firestore 收支紀錄、收入／支出篩選、新增收支
- **同學**：Firestore 學生名單、繳費率、已繳／待繳狀態更新
- **報表**：學期現金流、支出分類、匯出報表入口
- **設定**：Firebase 連線狀態、班級設定、通知與權限
- **登入保護**：Firebase Email/Password Authentication；未登入只能看到登入頁
- **GitHub Pages HTML**：使用 Vite 產生 `dist/` 靜態網站，GitHub Actions 自動部署
- **PWA**：manifest、Service Worker、應用程式圖示與手機主畫面安裝支援

## Firebase 設定

在專案根目錄建立 `.env.local`，填入 Firebase Web App 設定：

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

在 Firebase Console：

1. 建立或選擇 Firebase 專案與 Web App。
2. 啟用 **Authentication → Sign-in method → Email/Password**。
3. 建立管理者帳號，例如 `teacher@mingde.edu.tw`。
4. 建立 Cloud Firestore Database。
5. 建立下列集合：`class701_transactions`、`class701_students`、`class701_settings`。
6. 將 Firestore Web App 設定填入 GitHub Repository 的 **Settings → Secrets and variables → Actions → Variables**，名稱使用上述 `VITE_FIREBASE_*`。
7. 建議正式上線前設定 Firestore Security Rules，只允許已登入使用者讀寫；管理者角色可再以自訂 claims 或管理者 UID 白名單控管。

Firestore 文件欄位建議：

- `class701_transactions`：`title`、`amount`、`type`（`in` 或 `out`）、`meta`、`createdAt`
- `class701_students`：`no`、`name`、`paid`、`note`、`updatedAt`
- `class701_settings`：文件 ID 可使用設定名稱，欄位可放 `value`

未填 Firebase 環境變數時，系統會進入示範模式，登入帳號為 `teacher@mingde.edu.tw`，密碼為 `701demo`；正式部署時請改用 Firebase 帳號。

## GitHub Pages 部署

GitHub Actions 工作流程位於 `.github/workflows/deploy-pages.yml`，會執行：

```bash
pnpm install --frozen-lockfile
pnpm build
```

建置輸出為 `dist/`，並使用 GitHub Pages Artifact 部署。Vite 使用相對資源路徑，並採用雜湊路由（例如 `/#/transactions`），可避免 GitHub Pages 重新整理子頁面時出現 404。

請在 Repository 的 **Settings → Pages** 將 Source 設為 **GitHub Actions**。

## PWA 安裝

網站必須透過 HTTPS 才能安裝。Android Chrome 可在登入頁開啟瀏覽器選單，選擇「安裝應用程式」或「加入主畫面」；iPhone/iPad Safari 請點選分享，再選擇「加入主畫面」。

## 本地執行與建置

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

建置完成後，靜態檔案位於 `dist/`，可直接由任何靜態網站主機提供服務。
