import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error("Gunakan: npm run setup:firebase -- ./service-account.local.json");
  process.exit(1);
}

const absolutePath = resolve(process.cwd(), jsonPath);

if (!existsSync(absolutePath)) {
  console.error(`File tidak ditemukan: ${absolutePath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(absolutePath, "utf8"));
const projectId = String(serviceAccount.project_id || "").trim();
const clientEmail = String(serviceAccount.client_email || "").trim();
const privateKey = String(serviceAccount.private_key || "").trim();

if (!projectId || !clientEmail || !privateKey) {
  console.error("File JSON tidak valid. project_id, client_email, dan private_key wajib ada.");
  process.exit(1);
}

const env = [
  `FIREBASE_SERVICE_ACCOUNT_PATH=${jsonPath}`,
  `FIREBASE_PROJECT_ID=${projectId}`,
  `FIREBASE_CLIENT_EMAIL=${clientEmail}`,
  ``,
  `# Wajib diisi manual dari Firebase Console > Project settings > General > Web app config.`,
  `NEXT_PUBLIC_FIREBASE_API_KEY=`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}`,
  `NEXT_PUBLIC_FIREBASE_APP_ID=`,
  ``,
  `# Opsional. Jika kosong, semua user Firebase Authentication bisa masuk admin.`,
  `ADMIN_EMAILS=`,
  ``,
  `NEXT_PUBLIC_FACE_API_MODEL_URL=https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights`,
  `FACE_API_DISTANCE_THRESHOLD=0.6`,
  `NEXT_PUBLIC_APP_NAME=Polman Meeting Web`,
  "",
].join("\n");

writeFileSync(resolve(process.cwd(), ".env.local"), env, { mode: 0o600 });
console.log(".env.local berhasil dibuat. Isi NEXT_PUBLIC_FIREBASE_API_KEY dan NEXT_PUBLIC_FIREBASE_APP_ID sebelum login admin.");
