import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";

const ADMIN_APP_NAME = "polman-meeting-admin";

type FirebaseServiceAccountJson = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

function normalizePrivateKey(value?: string) {
  if (!value) return "";

  return value
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parseServiceAccountJson(value: string): ServiceAccount {
  const parsed = JSON.parse(value) as FirebaseServiceAccountJson;

  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credential Firebase Admin tidak lengkap. Pastikan project_id, client_email, dan private_key tersedia."
    );
  }

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY tidak valid. Private key harus berisi BEGIN PRIVATE KEY."
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function readFirebaseAdminCredential(): ServiceAccount {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (base64) {
    const json = Buffer.from(base64.trim(), "base64").toString("utf8");
    return parseServiceAccountJson(json);
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (json) {
    return parseServiceAccountJson(json);
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin ENV belum lengkap. Isi FIREBASE_SERVICE_ACCOUNT_BASE64, atau FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY."
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function adminApp() {
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);

  if (existingApp) {
    return getApp(ADMIN_APP_NAME);
  }

  const serviceAccount = readFirebaseAdminCredential();

  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    ADMIN_APP_NAME
  );
}

export function firestoreDb() {
  return getFirestore(adminApp());
}

export function adminDb() {
  return firestoreDb();
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

export function increment(value: number) {
  return FieldValue.increment(value);
}

export { FieldValue, Timestamp };