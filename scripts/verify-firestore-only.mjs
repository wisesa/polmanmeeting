import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);
const ignoredFiles = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const forbidden = [
  ["firebase-admin", "database"].join("/"),
  ["firebase", "database"].join("/"),
  ["@firebase", "database"].join("/"),
  ["get", "Database("].join(""),
  ["FIREBASE", "DATABASE", "URL"].join("_"),
  ["database", "URL"].join(""),
  ["rt", "db", "("].join(""),
  ["Server", "Value"].join(""),
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(root, path);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry)) continue;
      results.push(...walk(path));
      continue;
    }

    if (!stat.isFile()) continue;
    if (ignoredFiles.has(entry)) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|env|example)$/.test(entry)) continue;
    results.push({ path, rel });
  }
  return results;
}

const violations = [];

for (const file of walk(root)) {
  const text = readFileSync(file.path, "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      violations.push(`${file.rel}: contains ${needle}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Realtime Database reference masih ditemukan:\n");
  for (const line of violations) console.error(`- ${line}`);
  process.exit(1);
}

console.log("OK: pemeriksaan selesai. Source hanya memakai Firestore.");
