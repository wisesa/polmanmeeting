import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { createInvitationForm, getInvitationForms } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item)).filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const invitations = await getInvitationForms();
    return NextResponse.json({ success: true, invitations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat undangan.";
    const status = message.includes("Sesi admin") ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const invitation = await createInvitationForm({
      noDokumen: stringValue(body.noDokumen),
      meetingName: stringValue(body.meetingName),
      topikRapat: stringValue(body.topikRapat),
      agendaRapat: stringValue(body.agendaRapat),
      tanggalKey: stringValue(body.tanggalKey || body.meetingDateKey || body.tanggal),
      tempat: stringValue(body.tempat),
      waktuMulai: stringValue(body.waktuMulai),
      waktuSelesai: stringValue(body.waktuSelesai),
      pemimpinRapat: stringValue(body.pemimpinRapat),
      notulis: stringValue(body.notulis),
      prodiIds: stringArray(body.prodiIds),
      prodiNames: stringArray(body.prodiNames),
      prodiText: stringValue(body.prodiText),
      pesertaText: stringValue(body.pesertaText),
      catatan: stringValue(body.catatan),
    });

    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Undangan gagal disimpan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
