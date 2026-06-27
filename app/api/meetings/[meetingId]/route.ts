import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { deleteMeeting, getMeeting, getPresenceList, updateMeetingDirect } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ meetingId: string }>;
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

async function readMeetingId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return decodeURIComponent(params.meetingId || "").trim();
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMeetingReadRequest(request);
    const meetingId = await readMeetingId(context);

    if (!meetingId) {
      return NextResponse.json({ success: false, message: "meetingId wajib diisi." }, { status: 400 });
    }

    const meeting = await getMeeting(meetingId);

    if (!meeting) {
      return NextResponse.json({ success: false, message: "Meeting tidak ditemukan.", meetingId }, { status: 404 });
    }

    const presences = await getPresenceList(meetingId);

    return NextResponse.json(
      {
        success: true,
        meetingId,
        meeting,
        presences,
        participantsCount: Array.isArray(presences) ? presences.length : 0,
        serverTime: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("[api/meetings/[meetingId]]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat detail meeting." },
      { status: error instanceof Error && error.message.includes("Sesi") ? 401 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const meetingId = await readMeetingId(context);
    const body = (await request.json()) as Record<string, unknown>;

    const meeting = await updateMeetingDirect(meetingId, {
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
      status: stringValue(body.status),
    });

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal diperbarui.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const meetingId = await readMeetingId(context);
    await deleteMeeting(meetingId);
    return NextResponse.json({ success: true, message: "Meeting berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
