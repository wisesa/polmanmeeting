import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { createMeetingFromInvitation } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ formId: string }> | { formId: string };
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const formId = decodeURIComponent(params.formId || "").trim();

    if (!formId) {
      return NextResponse.json({ success: false, message: "formId wajib diisi." }, { status: 400 });
    }

    const meeting = await createMeetingFromInvitation(formId);
    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal dibuat dari undangan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
