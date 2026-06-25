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

function statusFromError(message: string) {
  if (message.includes("Sesi")) return 401;
  if (message.includes("tidak ditemukan")) return 404;
  return 400;
}

function hasOwnValue(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireFaceRegisterRequest(request);
    const params = await Promise.resolve(context.params);
    const nameKey = decodeURIComponent(params.nameKey || "").trim();
    const body = (await request.json()) as Record<string, unknown>;

    const updateSignature = hasOwnValue(body, "signatureBase64") || hasOwnValue(body, "signatureMimeType") || body.clearSignature === true;

    const face = await updateRegisteredFace(nameKey, {
      name: stringValue(body.name || body.nama),
      jabatan: stringValue(body.jabatan),
      prodi: stringValue(body.prodiName || body.prodi),
      prodiId: stringValue(body.prodiId),
      prodiName: stringValue(body.prodiName || body.prodi),
      signatureBase64: stringValue(body.signatureBase64),
      signatureMimeType: stringValue(body.signatureMimeType),
      updateSignature,
      clearSignature: body.clearSignature === true,
    });

    return NextResponse.json({
      success: true,
      message: "Data wajah berhasil diperbarui.",
      face: {
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
      },
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
