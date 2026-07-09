import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  plugins: [
    vinext(),
    // vinext auto-détecte app/ et next.config.ts
    // Pas besoin de @vitejs/plugin-rsc explicite pour déploiement Node.js
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
});
