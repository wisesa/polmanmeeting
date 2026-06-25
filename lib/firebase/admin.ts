import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(value?: string) {
  if (!value) return "";

  return value
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function readFirebaseAdminCredential(): ServiceAccount {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);

    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON tidak lengkap. Pastikan project_id, client_email, dan private_key tersedia."
      );
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin ENV belum lengkap. Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY di Environment Variables."
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function adminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const credential = readFirebaseAdminCredential();

  return initializeApp({
    credential: cert(credential),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminAuth() {
  return getAuth(adminApp());
}