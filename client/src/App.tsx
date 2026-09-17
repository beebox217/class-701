import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Router, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ClassDataProvider, useClassData } from "./contexts/ClassDataContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { settings } = useClassData();
  const [location] = useLocation();
  const className = String(settings.className ?? "701 班");
  if (loading) return <div className="auth-loading"><div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 20 }}><img src="./pwa-icon.svg" alt="LOGO" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></div><p>正在確認登入狀態…</p></div>;
  if (!user && location !== "/login") return <Redirect to="/login" />;
  if (user && location === "/login") return <Redirect to="/" />;

  return <Switch>
    <Route path="/login" component={Login} />
    <Route path="/" component={Home} />
    <Route path="/transactions" component={Home} />
    <Route path="/students" component={Home} />
    <Route path="/reports" component={Home} />
    <Route path="/settings" component={Home} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light"><TooltipProvider><Toaster /><Router hook={useHashLocation}><AuthProvider><ClassDataProvider><ProtectedApp /></ClassDataProvider></AuthProvider></Router></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
