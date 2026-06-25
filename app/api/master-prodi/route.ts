import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { getMasterProdi, saveMasterProdi } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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


export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") !== "false";
    const items = await getMasterProdi(includeInactive);

    return NextResponse.json({ success: true, count: items.length, prodi: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat master prodi.";
    const status = message.includes("Sesi admin") ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const item = await saveMasterProdi({
      prodiId: stringValue(body.prodiId),
      kode: stringValue(body.kode || body.code),
      nama: stringValue(body.nama || body.name || body.prodiName),
      jenjang: stringValue(body.jenjang),
      jurusan: stringValue(body.jurusan),
      isActive: boolValue(body.isActive, true),
    });

    return NextResponse.json({ success: true, prodi: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Master prodi gagal disimpan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
