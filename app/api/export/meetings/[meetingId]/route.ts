import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { getMeeting, getPresenceList, getRegisteredFaces } from "@/lib/firebase/db";
import { buildMeetingPdf } from "@/lib/pdf/documents";
import { makeSafeDocId } from "@/lib/utils/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ meetingId: string }> | { meetingId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const meetingId = decodeURIComponent(params.meetingId || "").trim();
    const meeting = await getMeeting(meetingId);

    if (!meeting) {
      return NextResponse.json({ success: false, message: "Meeting tidak ditemukan." }, { status: 404 });
    }

    const [presences, registeredFaces] = await Promise.all([getPresenceList(meetingId), getRegisteredFaces()]);
    const pdf = await buildMeetingPdf(meeting, presences, registeredFaces);
    const filename = `meeting-${makeSafeDocId(meeting.meetingName || meetingId)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF meeting gagal dibuat.";
    const status = message.includes("Sesi admin") ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
