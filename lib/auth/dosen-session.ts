import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const DOSEN_SESSION_COOKIE = "polman_dosen_session";
export const DOSEN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const DOSEN_SESSION_MAX_AGE_MS = DOSEN_SESSION_MAX_AGE_SECONDS * 1000;

const DEFAULT_DOSEN_EMAIL = "dosen@polman-babel.ac.id";

function configuredDosenEmails() {
  return (process.env.DOSEN_EMAILS || DEFAULT_DOSEN_EMAIL)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedDosenEmail(email?: string) {
  const allowedEmails = configuredDosenEmails();
  if (!email) return false;
  return allowedEmails.includes(email.trim().toLowerCase());
}

export async function createDosenSessionCookie(idToken: string) {
  const decoded = await adminAuth().verifyIdToken(idToken);

  if (!isAllowedDosenEmail(decoded.email)) {
    throw new Error("Akun ini tidak terdaftar sebagai dosen register wajah.");
  }

  return adminAuth().createSessionCookie(idToken, {
    expiresIn: DOSEN_SESSION_MAX_AGE_MS,
  });
}

export async function verifyDosenSessionCookie(sessionCookie?: string): Promise<DecodedIdToken | null> {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    if (!isAllowedDosenEmail(decoded.email)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function getCurrentDosen() {
  const cookieStore = await cookies();
  return verifyDosenSessionCookie(cookieStore.get(DOSEN_SESSION_COOKIE)?.value);
}

export async function requireDosenSession(nextPath = "/dosen/register-wajah") {
  const dosen = await getCurrentDosen();

  if (!dosen) {
    redirect(`/dosen/login?next=${encodeURIComponent(nextPath)}`);
  }

  return dosen;
}

export async function requireDosenRequest(request: NextRequest) {
  const sessionCookie = request.cookies.get(DOSEN_SESSION_COOKIE)?.value;
  const dosen = await verifyDosenSessionCookie(sessionCookie);

  if (!dosen) {
    throw new Error("Sesi dosen tidak valid. Silakan login ulang.");
  }

  return dosen;
}
