import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { RegisteredFace } from "@/lib/firebase/schema";

export const DOSEN_SESSION_COOKIE = "polman_dosen_session";
// Cookie dibuat persistent supaya dosen tidak perlu login ulang selama belum logout.
// Nilai ini dibuat panjang; browser tertentu dapat tetap menerapkan batas internal sendiri.
export const DOSEN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;
export const DOSEN_SESSION_MAX_AGE_MS = DOSEN_SESSION_MAX_AGE_SECONDS * 1000;

export type DosenFaceSession = {
  role: "dosen";
  nameKey: string;
  faceId: string;
  name: string;
  jabatan?: string;
  prodi?: string;
  prodiId?: string;
  prodiName?: string;
  distance?: number;
  score?: number;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sessionSecret() {
  return (
    process.env.DOSEN_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.FIREBASE_PROJECT_ID ||
    "polman-dosen-face-session-development-secret"
  );
}

function signPayload(payloadBase64: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(payloadBase64)
    .digest("base64url");
}

function timingSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isDosenFaceSession(value: unknown): value is DosenFaceSession {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;

  return (
    data.role === "dosen" &&
    Boolean(stringValue(data.nameKey)) &&
    Boolean(stringValue(data.name)) &&
    typeof data.issuedAt === "number" &&
    typeof data.expiresAt === "number"
  );
}

export function createDosenSessionCookieFromFace(face: RegisteredFace, match?: { distance?: number; score?: number }) {
  const now = Date.now();
  const session: DosenFaceSession = {
    role: "dosen",
    nameKey: face.nameKey || face.nodeKey,
    faceId: face.faceId || face.nameKey || face.nodeKey,
    name: face.name,
    jabatan: face.jabatan || "",
    prodi: face.prodiName || face.prodi || "",
    prodiId: face.prodiId || "",
    prodiName: face.prodiName || face.prodi || "",
    distance: match?.distance,
    score: match?.score,
    issuedAt: now,
    expiresAt: now + DOSEN_SESSION_MAX_AGE_MS,
  };

  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export async function verifyDosenSessionCookie(sessionCookie?: string): Promise<DosenFaceSession | null> {
  if (!sessionCookie) return null;

  try {
    const [payload, signature] = sessionCookie.split(".");
    if (!payload || !signature) return null;

    const expectedSignature = signPayload(payload);
    if (!timingSafeEqual(signature, expectedSignature)) return null;

    const parsed = JSON.parse(base64UrlDecode(payload)) as unknown;
    if (!isDosenFaceSession(parsed)) return null;
    if (parsed.expiresAt <= Date.now()) return null;

    return {
      ...parsed,
      nameKey: stringValue(parsed.nameKey),
      faceId: stringValue(parsed.faceId),
      name: stringValue(parsed.name),
      jabatan: stringValue(parsed.jabatan),
      prodi: stringValue(parsed.prodi),
      prodiId: stringValue(parsed.prodiId),
      prodiName: stringValue(parsed.prodiName),
      distance: numberValue(parsed.distance),
      score: numberValue(parsed.score),
    };
  } catch {
    return null;
  }
}

export async function getCurrentDosen() {
  const cookieStore = await cookies();
  return verifyDosenSessionCookie(cookieStore.get(DOSEN_SESSION_COOKIE)?.value);
}

export async function requireDosenSession(nextPath = "/dosen/meeting") {
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
