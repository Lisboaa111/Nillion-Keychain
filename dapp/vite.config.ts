import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [
      "@xmtp/wasm-bindings",
      "@xmtp/browser-sdk",
      "lucide-react",
      "@nillion/nuc",
      "@nillion/secretvaults",
    ],
    include: ["@xmtp/proto"],
  },
});
