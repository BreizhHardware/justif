import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL, TEST_DB_FILE, TEST_UPLOAD_DIR } from "./test-env.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function removeDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = TEST_DB_FILE + suffix;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
}

export default function setup() {
  removeDbFiles();
  fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });

  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  return () => {
    removeDbFiles();
    fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  };
}
