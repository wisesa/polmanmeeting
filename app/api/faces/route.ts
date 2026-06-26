import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { requireFaceRegisterRequest } from "@/lib/auth/face-register-session";
import { getRegisteredFaces, saveFaceApiRegisteredFace } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function numberArray2(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => numberArray(item)).filter((item) => item.length > 0);
}

function faceSummary(face: Awaited<ReturnType<typeof getRegisteredFaces>>[number]) {
  return {
    nodeKey: face.nodeKey,
    name: face.name,
    nameKey: face.nameKey,
    faceId: face.faceId,
    jabatan: face.jabatan,
    prodi: face.prodi,
    prodiId: face.prodiId || "",
    prodiName: face.prodiName || face.prodi || "",
    descriptorModel: face.descriptorModel || "face-api.js",
    descriptorSize: face.descriptorSize || 0,
    matrixRows: face.matrixRows || 0,
    matrixCols: face.matrixCols || 0,
    hasSignature: Boolean(face.hasSignature || face.signatureBase64),
    signatureBase64: face.signatureBase64 || "",
    signatureMimeType: face.signatureMimeType || "",
    signatureUpdatedAt: face.signatureUpdatedAt || null,
    hasFaceThumbnail: Boolean(face.hasFaceThumbnail || face.faceThumbnailBase64),
    faceThumbnailBase64: face.faceThumbnailBase64 || "",
    faceThumbnailMimeType: face.faceThumbnailMimeType || "",
    faceThumbnailUpdatedAt: face.faceThumbnailUpdatedAt || null,
    updatedAt: face.updatedAt || 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireFaceRegisterRequest(request);
    const faces = await getRegisteredFaces();
    const visibleFaces = session.role === "dosen"
      ? faces.filter((face) => face.nameKey === session.user.nameKey || face.nodeKey === session.user.nameKey || face.faceId === session.user.faceId)
      : faces;

    return NextResponse.json({
      success: true,
      count: visibleFaces.length,
      faces: visibleFaces.map(faceSummary),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat data wajah.";
    const status = message.includes("Sesi") ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = (await request.json()) as Record<string, unknown>;

    const face = await saveFaceApiRegisteredFace({
      name: stringValue(body.name || body.nama),
      nameKey: stringValue(body.nameKey),
      faceId: stringValue(body.faceId),
      jabatan: stringValue(body.jabatan),
      prodi: stringValue(body.prodiName || body.prodi),
      prodiId: stringValue(body.prodiId),
      prodiName: stringValue(body.prodiName || body.prodi),
      descriptor: numberArray(body.descriptor || body.faceDescriptor || body.faceApiDescriptor),
      descriptors: numberArray2(body.descriptors),
      matrix: numberArray(body.matrix),
      faceThumbnailBase64: stringValue(body.faceThumbnailBase64),
      faceThumbnailMimeType: stringValue(body.faceThumbnailMimeType),
      signatureBase64: stringValue(body.signatureBase64),
      signatureMimeType: stringValue(body.signatureMimeType),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Data wajah berhasil disimpan.",
        face: faceSummary(face),
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data wajah gagal disimpan.";
    const status = message.includes("Sesi") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
