import { NextRequest, NextResponse } from "next/server";
import {
  DOSEN_SESSION_COOKIE,
  DOSEN_SESSION_MAX_AGE_SECONDS,
  createDosenSessionCookieFromFace,
} from "@/lib/auth/dosen-session";
import { getRegisteredFaces } from "@/lib/firebase/db";
import { matchFaceDescriptorDistance, sanitizeFaceRecord } from "@/lib/face/matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function rounded(value: number) {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(6));
}

function faceKey(face: Record<string, unknown>) {
  const key = String(face.nameKey || face.faceId || face.id || face.key || "").trim();
  return key;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const descriptor = numberArray(body.descriptor || body.faceDescriptor || body.faceApiDescriptor || body.matrix);

    if (descriptor.length !== 128) {
      return NextResponse.json(
        { success: false, matched: false, message: "Descriptor face-api.js harus berisi 128 angka." },
        { status: 400 }
      );
    }

    const faces = await getRegisteredFaces();
    const threshold = Number(process.env.FACE_API_DISTANCE_THRESHOLD ?? "0.6");
    const match = matchFaceDescriptorDistance(descriptor, faces, { threshold, descriptorSize: 128, topK: 5 });

    if (!match.bestMatch) {
      return NextResponse.json(
        {
          success: false,
          matched: false,
          message: "Belum ada data wajah dosen yang bisa dibandingkan di Firestore.",
          comparedCount: match.comparedCount,
          threshold,
        },
        { status: 401 }
      );
    }

    if (!match.matched) {
      return NextResponse.json(
        {
          success: false,
          matched: false,
          message: "Wajah tidak dikenali sebagai dosen terdaftar.",
          distance: rounded(match.distance),
          threshold,
          comparedCount: match.comparedCount,
        },
        { status: 401 }
      );
    }

    const matchedKey = faceKey(match.bestMatch);
    const matchedFace = faces.find((face) => face.nameKey === matchedKey || face.nodeKey === matchedKey || face.faceId === matchedKey);

    if (!matchedFace) {
      return NextResponse.json(
        { success: false, matched: false, message: "Data wajah dosen tidak ditemukan setelah pencocokan." },
        { status: 401 }
      );
    }

    const score = 1 / (1 + match.distance);
    const sessionCookie = createDosenSessionCookieFromFace(matchedFace, { distance: match.distance, score });
    const response = NextResponse.json({
      success: true,
      matched: true,
      message: `Login dosen berhasil. Selamat datang, ${matchedFace.name}.`,
      face: sanitizeFaceRecord(match.bestMatch),
      name: matchedFace.name,
      nameKey: matchedFace.nameKey,
      distance: rounded(match.distance),
      score: rounded(score),
      threshold,
    });

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
      { success: false, matched: false, message: error instanceof Error ? error.message : "Login dosen gagal." },
      { status: 500 }
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
