import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const ADMIN_SESSION_COOKIE = "polman_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

const DEFAULT_DOSEN_EMAIL = "dosen@polman-babel.ac.id";

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function configuredDosenEmails() {
  return (process.env.DOSEN_EMAILS || DEFAULT_DOSEN_EMAIL)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email?: string) {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (configuredDosenEmails().includes(normalizedEmail)) return false;

  const allowedEmails = configuredAdminEmails();
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(normalizedEmail);
}

export async function createAdminSessionCookie(idToken: string) {
  const decoded = await adminAuth().verifyIdToken(idToken);

  if (!isAllowedAdminEmail(decoded.email)) {
    throw new Error("Akun ini tidak terdaftar sebagai admin.");
  }

  return adminAuth().createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_MS,
  });
}

export async function verifyAdminSessionCookie(sessionCookie?: string): Promise<DecodedIdToken | null> {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    if (!isAllowedAdminEmail(decoded.email)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession(nextPath = "/admin") {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }

  return admin;
}

export async function requireAdminRequest(request: NextRequest) {
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const admin = await verifyAdminSessionCookie(sessionCookie);

  if (!admin) {
    throw new Error("Sesi admin tidak valid. Silakan login ulang.");
  }

  return admin;
}
