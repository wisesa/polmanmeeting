import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

type ServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const DEFAULT_LOCAL_SERVICE_ACCOUNT_FILES = [
  "firebase-service-account.local.json",
  "service-account.local.json",
  "polman-635e0-firebase-adminsdk-fbsvc-79d2864d27.json",
];

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function serviceAccountFromJsonText(jsonText: string): ServiceAccountConfig {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const projectId = String(parsed.project_id || "").trim();
  const clientEmail = String(parsed.client_email || "").trim();
  const privateKey = String(parsed.private_key || "").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Service account JSON wajib berisi project_id, client_email, dan private_key."
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function serviceAccountFromFile(jsonPath: string): ServiceAccountConfig {
  const absolutePath = resolve(/* turbopackIgnore: true */ process.cwd(), jsonPath);
  return serviceAccountFromJsonText(readFileSync(absolutePath, "utf8"));
}

function findDefaultLocalServiceAccountPath() {
  for (const fileName of DEFAULT_LOCAL_SERVICE_ACCOUNT_FILES) {
    const absolutePath = resolve(/* turbopackIgnore: true */ process.cwd(), fileName);
    if (existsSync(absolutePath)) return fileName;
  }

  return "";
}

function loadServiceAccount(): ServiceAccountConfig {
  const jsonFromEnv = optionalEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (jsonFromEnv) return serviceAccountFromJsonText(jsonFromEnv);

  const jsonPathFromEnv = optionalEnv("FIREBASE_SERVICE_ACCOUNT_PATH");
  if (jsonPathFromEnv) return serviceAccountFromFile(jsonPathFromEnv);

  const defaultJsonPath = findDefaultLocalServiceAccountPath();
  if (defaultJsonPath) return serviceAccountFromFile(defaultJsonPath);

  return {
    projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: normalizePrivateKey(requiredEnv("FIREBASE_PRIVATE_KEY")),
  };
}

const serviceAccount = loadServiceAccount();

export const firebaseAdminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });

const firestore = getFirestore(firebaseAdminApp);
const auth = getAuth(firebaseAdminApp);

// Jangan panggil firestore.settings() di Next.js dev mode.
// Saat hot reload, Firestore bisa sudah dipakai lebih dulu, lalu settings() akan error.
// Nilai undefined dibersihkan di lib/firebase/db.ts lewat cleanFirestoreData().
export function firestoreDb() {
  return firestore;
}

export function adminAuth() {
  return auth;
}

export const db = firestore;
export const serverTimestamp = FieldValue.serverTimestamp;
export const increment = FieldValue.increment;
export { Timestamp };
