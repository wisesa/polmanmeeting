import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { deleteMeetingPresence, getPresenceList } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    meetingId: string;
    presenceId: string;
  }>;
};

function statusFromError(message: string) {
  if (message.includes("Sesi admin")) return 401;
  if (message.includes("tidak ditemukan")) return 404;
  return 400;
}

async function readIds(context: RouteContext) {
  const params = await Promise.resolve(context.params);

  return {
    meetingId: decodeURIComponent(params.meetingId || "").trim(),
    presenceId: decodeURIComponent(params.presenceId || "").trim(),
  };
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const { meetingId, presenceId } = await readIds(context);

    if (!meetingId) {
      return NextResponse.json({ success: false, message: "meetingId wajib diisi." }, { status: 400 });
    }

    if (!presenceId) {
      return NextResponse.json({ success: false, message: "presenceId wajib diisi." }, { status: 400 });
    }

    const result = await deleteMeetingPresence(meetingId, presenceId);
    const presences = await getPresenceList(meetingId);

    return NextResponse.json({
      success: true,
      message: "Presensi peserta berhasil dihapus.",
      participantsCount: result.participantsCount,
      presences,
      updatedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Presensi peserta gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
