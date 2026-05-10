import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  base: "./",
  clearScreen: false,
  server: {
    host: tauriDevHost || "::",
    port: 8080,
    strictPort: true,
    hmr: tauriDevHost
      ? {
          protocol: "ws",
          host: tauriDevHost,
          port: 8081,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
