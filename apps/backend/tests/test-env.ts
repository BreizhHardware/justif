import path from "node:path";
import os from "node:os";

// La base de test vit hors du dépôt (tmpdir) : si le dossier projet est
// synchronisé (OneDrive, ownCloud...), Prisma/SQLite peut bloquer en
// verrouillant le fichier en pleine écriture pendant les tests.
export const TEST_DB_FILE = path.join(os.tmpdir(), "justif-backend-tests.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_FILE.replace(/\\/g, "/")}`;
export const TEST_UPLOAD_DIR = path.join(os.tmpdir(), "justif-backend-tests-uploads");
export const TEST_JWT_SECRET = "test_secret_min_32_characters_long_ok";
