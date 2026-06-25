import { NextRequest, NextResponse } from "next/server";
import {
  DOSEN_SESSION_COOKIE,
  DOSEN_SESSION_MAX_AGE_SECONDS,
  createDosenSessionCookie,
} from "@/lib/auth/dosen-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ success: false, message: "Token login tidak ditemukan." }, { status: 400 });
    }

    const sessionCookie = await createDosenSessionCookie(idToken);
    const response = NextResponse.json({ success: true, message: "Login dosen berhasil." });

    response.cookies.set({
      name: DOSEN_SESSION_COOKIE,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DOSEN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Login dosen gagal." },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logout berhasil." });
  response.cookies.set({
    name: DOSEN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
