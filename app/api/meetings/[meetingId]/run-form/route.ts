import { NextRequest, NextResponse } from "next/server";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { saveMeetingRunForm } from "@/lib/firebase/db";
import type { MeetingRunForm } from "@/lib/firebase/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ meetingId: string }>;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireMeetingReadRequest(request);
    const params = await Promise.resolve(context.params);
    const meetingId = decodeURIComponent(params.meetingId || "").trim();
    const body = (await request.json()) as Record<string, unknown>;

    if (!meetingId) {
      return NextResponse.json({ success: false, message: "meetingId wajib diisi." }, { status: 400 });
    }

    const payload: MeetingRunForm = {
      status: stringValue(body.status) === "closed" ? "closed" : "active",
      finishedAt: numberOrNull(body.finishedAt),
    };

    if (hasOwn(body, "agendaRapat")) payload.agendaRapat = stringValue(body.agendaRapat);
    if (hasOwn(body, "pembahasan")) payload.pembahasan = stringValue(body.pembahasan);
    if (hasOwn(body, "hasilRapat")) payload.hasilRapat = stringValue(body.hasilRapat);
    if (hasOwn(body, "catatan")) payload.catatan = stringValue(body.catatan);
    if (hasOwn(body, "catatanTambahan")) payload.catatanTambahan = stringValue(body.catatanTambahan);
    if (hasOwn(body, "tindakLanjut")) payload.tindakLanjut = stringValue(body.tindakLanjut);
    if (hasOwn(body, "pemimpinRapat")) payload.pemimpinRapat = stringValue(body.pemimpinRapat);
    if (hasOwn(body, "notulis")) payload.notulis = stringValue(body.notulis);

    const meeting = await saveMeetingRunForm(meetingId, payload);

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form meeting gagal disimpan.";
    const status = message.includes("Sesi") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
