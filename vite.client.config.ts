import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: ".client-build",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: "src/client/react/main.tsx",
      output: {
        entryFileNames: "client.js",
        assetFileNames: "client.[ext]"
      }
    }
  }
});
