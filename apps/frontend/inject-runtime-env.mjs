import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLACEHOLDER = "__RUNTIME_NEXT_PUBLIC_API_URL__";
const value = process.env.NEXT_PUBLIC_API_URL;

function replaceInDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      replaceInDir(full);
    } else if (/\.m?js$/.test(entry)) {
      const content = readFileSync(full, "utf8");
      if (content.includes(PLACEHOLDER)) {
        writeFileSync(full, content.split(PLACEHOLDER).join(value));
      }
    }
  }
}

replaceInDir(join(process.cwd(), "dist"));
