import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { deleteInvitationForm, updateInvitationForm } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ formId: string }>;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item)).filter(Boolean);
}

function statusFromError(message: string) {
  if (message.includes("Sesi admin")) return 401;
  if (message.includes("tidak ditemukan")) return 404;
  return 400;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const formId = decodeURIComponent(params.formId || "").trim();
    const body = (await request.json()) as Record<string, unknown>;

    const invitation = await updateInvitationForm(formId, {
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
      status: stringValue(body.status),
    });

    return NextResponse.json({ success: true, invitation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Undangan gagal diperbarui.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const formId = decodeURIComponent(params.formId || "").trim();
    await deleteInvitationForm(formId);
    return NextResponse.json({ success: true, message: "Undangan berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Undangan gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
