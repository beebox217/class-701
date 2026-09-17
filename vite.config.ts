import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      react: path.resolve(import.meta.dirname, "node_modules", "react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules", "react-dom"),
      "react-dom/client": path.resolve(import.meta.dirname, "node_modules", "react-dom", "client.js"),
    },
    dedupe: ["react", "react-dom", "react-dom/client"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "next-themes", "sonner"],
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname),
    emptyOutDir: false,
  },
  server: {
    host: true,
    port: 3000,
    strictPort: false,
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Surrogate-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  },
});
