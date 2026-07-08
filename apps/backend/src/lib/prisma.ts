import { config } from "dotenv";
config({ path: "../../.env" });
import { PrismaClient } from "../generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./db/justif.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;

const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });
