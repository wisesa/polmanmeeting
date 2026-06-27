"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";

export const isFirebaseClientConfigured = Boolean(
  apiKey &&
  projectId &&
  appId &&
  !apiKey.includes("isi_") &&
  !appId.includes("isi_")
);

const firebaseClientConfig = {
  apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ""),
  projectId,
  appId,
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseClientApp() {
  if (!isFirebaseClientConfigured) {
    throw new Error("Konfigurasi aplikasi belum lengkap. Hubungi pengelola sistem.");
  }

  if (cachedApp) return cachedApp;
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);
  return cachedApp;
}

export function getFirebaseClientAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseClientApp());
  return cachedAuth;
}
