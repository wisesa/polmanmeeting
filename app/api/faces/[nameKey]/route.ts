import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { requireFaceRegisterRequest } from "@/lib/auth/face-register-session";
import { deleteRegisteredFace, updateRegisteredFace } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ nameKey: string }>;
};

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

function statusFromError(message: string) {
  if (message.includes("Sesi")) return 401;
  if (message.includes("tidak boleh")) return 403;
  if (message.includes("tidak ditemukan")) return 404;
  return 400;
}

function hasOwnValue(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function faceSummary(face: Awaited<ReturnType<typeof updateRegisteredFace>>) {
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireFaceRegisterRequest(request);
    const params = await Promise.resolve(context.params);
    const nameKey = decodeURIComponent(params.nameKey || "").trim();
    const body = (await request.json()) as Record<string, unknown>;

    if (session.role === "dosen" && session.user.nameKey !== nameKey) {
      throw new Error("Dosen tidak boleh mengubah data wajah milik akun lain.");
    }

    const descriptor = numberArray(body.descriptor || body.faceDescriptor || body.faceApiDescriptor);
    const descriptors = numberArray2(body.descriptors);
    const matrix = numberArray(body.matrix);
    const updateDescriptor = descriptor.length > 0 || descriptors.length > 0 || matrix.length > 0;
    const updateFaceThumbnail = hasOwnValue(body, "faceThumbnailBase64") || hasOwnValue(body, "faceThumbnailMimeType");
    const updateSignature = hasOwnValue(body, "signatureBase64") || hasOwnValue(body, "signatureMimeType") || body.clearSignature === true;

    const face = await updateRegisteredFace(nameKey, {
      name: stringValue(body.name || body.nama),
      jabatan: stringValue(body.jabatan),
      prodi: stringValue(body.prodiName || body.prodi),
      prodiId: stringValue(body.prodiId),
      prodiName: stringValue(body.prodiName || body.prodi),
      descriptor,
      descriptors,
      matrix,
      updateDescriptor,
      faceThumbnailBase64: stringValue(body.faceThumbnailBase64),
      faceThumbnailMimeType: stringValue(body.faceThumbnailMimeType),
      updateFaceThumbnail,
      signatureBase64: stringValue(body.signatureBase64),
      signatureMimeType: stringValue(body.signatureMimeType),
      updateSignature,
      clearSignature: body.clearSignature === true,
    });

    return NextResponse.json({
      success: true,
      message: "Data wajah berhasil diperbarui.",
      face: faceSummary(face),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data wajah gagal diperbarui.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const nameKey = decodeURIComponent(params.nameKey || "").trim();
    await deleteRegisteredFace(nameKey);
    return NextResponse.json({ success: true, message: "Data wajah berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data wajah gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
