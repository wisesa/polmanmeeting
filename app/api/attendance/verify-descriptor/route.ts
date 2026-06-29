import { NextRequest, NextResponse } from "next/server";
import { requireDosenRequest } from "@/lib/auth/dosen-session";
import { getMeeting, getRegisteredFaces, upsertPresence } from "@/lib/firebase/db";
import { matchFaceDescriptorDistance, sanitizeFaceRecord, type FaceCandidate, type FaceRecord } from "@/lib/face/matcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function rounded(value: number) {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(6));
}

function makeFirebaseKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.#$/[\]]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function isMeetingClosed(meeting: unknown) {
  if (!meeting || typeof meeting !== "object") return true;

  const data = meeting as Record<string, unknown>;
  const status = stringValue(data.status).toLowerCase();
  const state = stringValue(data.state).toLowerCase();

  if (data.closed === true) return true;
  if (data.isClosed === true) return true;
  if (data.isActive === false) return true;
  if (data.closedAt) return true;

  return ["closed", "close", "selesai", "ditutup", "inactive"].includes(status || state);
}

function getFaceName(face: FaceRecord) {
  return stringValue(face.name) || stringValue(face.fullName) || stringValue(face.nama) || stringValue(face.displayName) || "Tanpa Nama";
}

function getFaceKey(face: FaceRecord, name: string) {
  return makeFirebaseKey(stringValue(face.nameKey) || stringValue(face.faceId) || stringValue(face.id) || stringValue(face.key) || name);
}

function formatCandidate(candidate: FaceCandidate) {
  return {
    ...candidate,
    score: rounded(candidate.score),
    distance: candidate.distance === undefined ? undefined : rounded(candidate.distance),
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireDosenRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const meetingId = stringValue(body.meetingId || body.meeting_id || request.nextUrl.searchParams.get("meetingId"));
    const descriptor = numberArray(body.descriptor || body.faceDescriptor || body.faceApiDescriptor || body.matrix);

    if (!meetingId) {
      return NextResponse.json({ success: false, matched: false, message: "meetingId wajib diisi." }, { status: 400 });
    }

    if (descriptor.length !== 128) {
      return NextResponse.json({ success: false, matched: false, message: "Data wajah belum terbaca dengan benar. Silakan coba lagi." }, { status: 400 });
    }

    const meeting = await getMeeting(meetingId);
    if (!meeting) {
      return NextResponse.json({ success: false, matched: false, message: "Meeting tidak ditemukan." }, { status: 404 });
    }

    if (isMeetingClosed(meeting)) {
      return NextResponse.json({ success: false, matched: false, message: "Meeting sudah ditutup atau tidak aktif." }, { status: 409 });
    }

    const faces = await getRegisteredFaces();
    const threshold = Number(process.env.FACE_API_DISTANCE_THRESHOLD ?? "0.6");
    const match = matchFaceDescriptorDistance(descriptor, faces, { threshold, descriptorSize: 128, topK: 5 });

    if (!match.bestMatch) {
      return NextResponse.json({
        success: false,
        matched: false,
        message: "Belum ada data wajah yang tersimpan untuk dibandingkan.",
        threshold,
        comparedCount: match.comparedCount,
        candidates: match.candidates.map(formatCandidate),
      });
    }

    if (!match.matched) {
      return NextResponse.json({
        success: false,
        matched: false,
        message: "Wajah belum dikenali.",
        distance: rounded(match.distance),
        threshold,
        comparedCount: match.comparedCount,
        candidates: match.candidates.map(formatCandidate),
      });
    }

    const matchedFace = match.bestMatch;
    const name = getFaceName(matchedFace);
    const nameKey = getFaceKey(matchedFace, name);
    const score = 1 / (1 + match.distance);

    await upsertPresence({
      collectionPath: "meetings",
      meetingId,
      name,
      nameKey,
      faceId: stringValue(matchedFace.faceId) || nameKey,
      faceThumbnailBase64: stringValue(matchedFace.faceThumbnailBase64),
      faceThumbnailMimeType: stringValue(matchedFace.faceThumbnailMimeType) || "image/jpeg",
      jabatan: stringValue(matchedFace.jabatan),
      prodi: stringValue(matchedFace.prodiName) || stringValue(matchedFace.prodi),
      prodiId: stringValue(matchedFace.prodiId),
      prodiName: stringValue(matchedFace.prodiName) || stringValue(matchedFace.prodi),
      matched: true,
      method: "web_face_api_js",
      score,
      lastScore: score,
      distance: match.distance,
      source: "nextjs_face_api_js_attendance",
    });

    return NextResponse.json({
      success: true,
      matched: true,
      recognized: true,
      message: `Absensi berhasil. Selamat datang, ${name}.`,
      meetingId,
      name,
      nameKey,
      distance: rounded(match.distance),
      score: rounded(score),
      threshold,
      face: sanitizeFaceRecord(matchedFace),
      candidates: match.candidates.map(formatCandidate),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        matched: false,
        message: error instanceof Error ? error.message : "Wajah gagal diperiksa.",
      },
      { status: error instanceof Error && error.message.includes("Sesi dosen") ? 401 : 500 }
    );
  }
}
