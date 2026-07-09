import path from "node:path";
import os from "node:os";

// The test database lives outside the repo (tmpdir): if the project folder is
// synced (OneDrive, ownCloud...), Prisma/SQLite can deadlock by locking
// the file mid-write during tests.
export const TEST_DB_FILE = path.join(os.tmpdir(), "justif-backend-tests.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_FILE.replace(/\\/g, "/")}`;
export const TEST_UPLOAD_DIR = path.join(os.tmpdir(), "justif-backend-tests-uploads");
export const TEST_JWT_SECRET = "test_secret_min_32_characters_long_ok";
