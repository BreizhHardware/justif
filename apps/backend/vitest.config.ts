import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL, TEST_JWT_SECRET, TEST_UPLOAD_DIR } from "./tests/test-env.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      UPLOAD_DIR: TEST_UPLOAD_DIR,
      OCR_PROVIDER: "cloud",
      DEFAULT_CURRENCY: "EUR",
      APP_URL: "http://localhost:3001",
      MISTRAL_API_KEY: "",
      SMTP_HOST: "",
      SMTP_FROM: "",
      OIDC_ISSUER_URL: "",
      OIDC_CLIENT_ID: "",
      OIDC_CLIENT_SECRET: "",
    },
  },
});
