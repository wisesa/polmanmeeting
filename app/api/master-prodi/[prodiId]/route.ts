import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { deleteMasterProdi, updateMasterProdi } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ prodiId: string }> | { prodiId: string };
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes", "ya", "aktif"].includes(lower)) return true;
    if (["false", "0", "no", "tidak", "nonaktif"].includes(lower)) return false;
  }
  return fallback;
}


function statusFromError(message: string) {
  if (message.includes("Sesi admin")) return 401;
  if (message.includes("tidak ditemukan")) return 404;
  return 400;
}

async function readProdiId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return decodeURIComponent(params.prodiId || "").trim();
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const prodiId = await readProdiId(context);
    const body = (await request.json()) as Record<string, unknown>;
    const item = await updateMasterProdi(prodiId, {
      kode: stringValue(body.kode || body.code),
      nama: stringValue(body.nama || body.name || body.prodiName),
      jenjang: stringValue(body.jenjang),
      jurusan: stringValue(body.jurusan),
      isActive: boolValue(body.isActive, true),
    });

    return NextResponse.json({ success: true, prodi: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Master prodi gagal diperbarui.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const prodiId = await readProdiId(context);
    await deleteMasterProdi(prodiId);
    return NextResponse.json({ success: true, message: "Master prodi berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Master prodi gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
