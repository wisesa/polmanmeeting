import { NextRequest, NextResponse } from "next/server";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { getMeeting, getPresenceList } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMeetingReadRequest(request);
    const params = await context.params;
    const meetingId = decodeURIComponent(params.meetingId);

    if (!meetingId.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "meetingId kosong.",
        },
        { status: 400 }
      );
    }

    const [meeting, presences] = await Promise.all([
      getMeeting(meetingId),
      getPresenceList(meetingId),
    ]);

    if (!meeting) {
      return NextResponse.json(
        {
          success: false,
          message: "Meeting tidak ditemukan.",
          meetingId,
          meeting: null,
          presences: [],
          updatedAt: Date.now(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        meetingId,
        meeting,
        presences: Array.isArray(presences) ? presences : [],
        updatedAt: Date.now(),
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
    console.error("[api/meetings/[meetingId]/presences]", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data presensi.",
      },
      { status: 500 }
    );
  }
}