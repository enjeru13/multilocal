import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // App instalable en el teléfono: manifiesto, iconos y un service worker que guarda la
    // interfaz para que abra al instante. Los datos (/api) siempre van al servidor, nunca se guardan.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon-32.png"],
      manifest: {
        name: "Mostrador",
        short_name: "Mostrador",
        description: "Ventas, inventario, caja y reportes de tu negocio.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8f9fb",
        theme_color: "#2563eb",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
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
  },
});
