import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { getInvitationForm, getRegisteredFaces } from "@/lib/firebase/db";
import { buildInvitationPdf } from "@/lib/pdf/documents";
import { makeSafeDocId } from "@/lib/utils/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ formId: string }> | { formId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminRequest(request);
    const params = await Promise.resolve(context.params);
    const formId = decodeURIComponent(params.formId || "").trim();
    const invitation = await getInvitationForm(formId);

    if (!invitation) {
      return NextResponse.json({ success: false, message: "Undangan tidak ditemukan." }, { status: 404 });
    }

    const registeredFaces = await getRegisteredFaces();
    const pdf = await buildInvitationPdf(invitation, registeredFaces);
    const filename = `undangan-${makeSafeDocId(invitation.meetingName || formId)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF undangan gagal dibuat.";
    const status = message.includes("Sesi admin") ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
