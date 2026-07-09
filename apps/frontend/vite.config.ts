import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  plugins: [
    vinext(),
    // vinext auto-detects app/ and next.config.ts
    // No need for @vitejs/plugin-rsc for Node.js deployment
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
});
