import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@lavanderia/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "vendor_react";
            if (id.includes("axios")) return "vendor_axios";
            if (id.includes("lodash")) return "vendor_lodash";
            return "vendor";
          }
        },
      },
    },
  },
});
