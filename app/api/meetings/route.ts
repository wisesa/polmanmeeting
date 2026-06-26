import { NextRequest, NextResponse } from "next/server";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { createMeetingDirect, getMeetings } from "@/lib/firebase/db";
import { getMeetingDateKey, isValidDateKey, todayDateKey } from "@/lib/utils/date";

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
    await requireMeetingReadRequest(request);
    const dateParam = request.nextUrl.searchParams.get("date");
    const selectedDate = dateParam ? (isValidDateKey(dateParam) ? dateParam : todayDateKey()) : null;
    const allMeetings = await getMeetings("meetings");
    const meetings = selectedDate ? allMeetings.filter((meeting) => getMeetingDateKey(meeting) === selectedDate) : allMeetings;

    return NextResponse.json({
      ok: true,
      selectedDate,
      totalCount: allMeetings.length,
      filteredCount: meetings.length,
      meetings: meetings.map((meeting) => ({
        meetingId: meeting.meetingId,
        meetingName: meeting.meetingName,
        noDokumen: meeting.noDokumen || "",
        tanggal: meeting.tanggal || "",
        hari: meeting.hari || "",
        tempat: meeting.tempat || "",
        waktu: meeting.waktu || "",
        topikRapat: meeting.topikRapat || "",
        agendaRapat: meeting.agendaRapat || "",
        meetingDate: meeting.meetingDate || 0,
        meetingDateKey: getMeetingDateKey(meeting) || meeting.meetingDateKey || "",
        status: meeting.status || "active",
        participantsCount: meeting.participantsCount || 0,
        prodiIds: meeting.prodiIds || [],
        prodiNames: meeting.prodiNames || [],
        prodiText: meeting.prodiText || "",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat meeting.";
    return NextResponse.json({ ok: false, success: false, message }, { status: message.includes("Sesi") ? 401 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const meeting = await createMeetingDirect({
      meetingName: stringValue(body.meetingName),
      noDokumen: stringValue(body.noDokumen),
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
      catatan: stringValue(body.catatan),
      sourceInvitationFormId: stringValue(body.sourceInvitationFormId),
    });

    return NextResponse.json({ success: true, meeting }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal disimpan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
