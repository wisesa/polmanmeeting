import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { saveMeetingRunForm } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ meetingId: string }> | { meetingId: string };
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const meetingId = decodeURIComponent(params.meetingId || "").trim();
    const body = (await request.json()) as Record<string, unknown>;

    if (!meetingId) {
      return NextResponse.json({ success: false, message: "meetingId wajib diisi." }, { status: 400 });
    }

    const meeting = await saveMeetingRunForm(meetingId, {
      agendaRapat: stringValue(body.agendaRapat),
      pembahasan: stringValue(body.pembahasan),
      hasilRapat: stringValue(body.hasilRapat),
      catatanTambahan: stringValue(body.catatanTambahan),
      tindakLanjut: stringValue(body.tindakLanjut),
      pemimpinRapat: stringValue(body.pemimpinRapat),
      notulis: stringValue(body.notulis),
      status: stringValue(body.status) === "closed" ? "closed" : "active",
      finishedAt: numberOrNull(body.finishedAt),
    });

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form meeting gagal disimpan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
