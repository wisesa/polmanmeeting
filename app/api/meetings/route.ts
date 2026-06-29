import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { createMeetingDirect, getMeetings, setMeetingImageMeta } from "@/lib/firebase/db";
import { getMeetingDateKey, isValidDateKey, todayDateKey } from "@/lib/utils/date";
import { deletePublicMeetingImage, saveCompressedMeetingImage, validateMeetingImageFile } from "@/lib/utils/meeting-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item)).filter(Boolean);
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function readMeetingPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const body: Record<string, unknown> = Object.fromEntries(formData.entries());
    body.prodiIds = formData.getAll("prodiIds").map((item) => stringValue(item)).filter(Boolean);
    body.prodiNames = formData.getAll("prodiNames").map((item) => stringValue(item)).filter(Boolean);
    const imageFile = formFile(formData, "meetingImage");
    validateMeetingImageFile(imageFile);
    return { body, imageFile };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return { body, imageFile: null as File | null };
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
        meetingImageUrl: meeting.meetingImageUrl || "",
        meetingImagePath: meeting.meetingImagePath || "",
        meetingImageFileName: meeting.meetingImageFileName || "",
        meetingImageMimeType: meeting.meetingImageMimeType || "",
        meetingImageSize: meeting.meetingImageSize || 0,
        meetingImageUpdatedAt: meeting.meetingImageUpdatedAt || 0,
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
    const { body, imageFile } = await readMeetingPayload(request);
    let meeting = await createMeetingDirect({
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

    if (imageFile) {
      const savedImage = await saveCompressedMeetingImage(imageFile, meeting.meetingId);
      if (savedImage) {
        try {
          meeting = await setMeetingImageMeta(meeting.meetingId, savedImage);
        } catch (error) {
          await deletePublicMeetingImage(savedImage.meetingImagePath);
          throw error;
        }
      }
    }

    return NextResponse.json({ success: true, meeting }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal disimpan.";
    const status = message.includes("Sesi admin") ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
