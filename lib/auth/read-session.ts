import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/auth/admin-session";
import { DOSEN_SESSION_COOKIE, verifyDosenSessionCookie, type DosenFaceSession } from "@/lib/auth/dosen-session";

export type MeetingReadSession =
  | { role: "admin"; user: DecodedIdToken }
  | { role: "dosen"; user: DosenFaceSession };

export async function requireMeetingReadRequest(request: NextRequest): Promise<MeetingReadSession> {
  const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const admin = await verifyAdminSessionCookie(adminCookie);

  if (admin) return { role: "admin", user: admin };

  const dosenCookie = request.cookies.get(DOSEN_SESSION_COOKIE)?.value;
  const dosen = await verifyDosenSessionCookie(dosenCookie);

  if (dosen) return { role: "dosen", user: dosen };

  throw new Error("Sesi tidak valid. Silakan login ulang.");
}
