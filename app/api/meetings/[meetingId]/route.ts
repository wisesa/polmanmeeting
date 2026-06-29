import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/admin-session";
import { requireMeetingReadRequest } from "@/lib/auth/read-session";
import { deleteMeeting, getMeeting, getPresenceList, setMeetingImageMeta, updateMeetingDirect } from "@/lib/firebase/db";
import { deletePublicMeetingImage, saveCompressedMeetingImage, validateMeetingImageFile } from "@/lib/utils/meeting-image";

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

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "hapus"].includes(value.trim().toLowerCase());
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function optionalString(body: Record<string, unknown>, key: string) {
  return hasOwn(body, key) ? stringValue(body[key]) : undefined;
}

function optionalStringArray(body: Record<string, unknown>, key: string) {
  return hasOwn(body, key) ? stringArray(body[key]) : undefined;
}

function firstOptionalString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (hasOwn(body, key)) return stringValue(body[key]);
  }
  return undefined;
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
    if (formData.has("prodiIds")) {
      body.prodiIds = formData.getAll("prodiIds").map((item) => stringValue(item)).filter(Boolean);
    }
    if (formData.has("prodiNames")) {
      body.prodiNames = formData.getAll("prodiNames").map((item) => stringValue(item)).filter(Boolean);
    }
    if (formData.has("deleteMeetingImage")) {
      body.deleteMeetingImage = formData.get("deleteMeetingImage");
    }
    const imageFile = formFile(formData, "meetingImage");
    validateMeetingImageFile(imageFile);
    return { body, imageFile };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return { body, imageFile: null as File | null };
}

function statusFromError(message: string) {
  if (message.includes("Sesi admin")) return 401;
  if (message.includes("tidak ditemukan") || message.includes("Tidak ditemukan")) return 404;
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
    const { body, imageFile } = await readMeetingPayload(request);
    const deleteImage = boolValue(body.deleteMeetingImage);
    const oldMeeting = imageFile || deleteImage ? await getMeeting(meetingId) : null;

    let meeting = await updateMeetingDirect(meetingId, {
      meetingName: optionalString(body, "meetingName"),
      noDokumen: optionalString(body, "noDokumen"),
      topikRapat: optionalString(body, "topikRapat"),
      agendaRapat: optionalString(body, "agendaRapat"),
      tanggalKey: firstOptionalString(body, ["tanggalKey", "meetingDateKey", "tanggal"]),
      tempat: optionalString(body, "tempat"),
      waktuMulai: optionalString(body, "waktuMulai"),
      waktuSelesai: optionalString(body, "waktuSelesai"),
      pemimpinRapat: optionalString(body, "pemimpinRapat"),
      notulis: optionalString(body, "notulis"),
      prodiIds: optionalStringArray(body, "prodiIds"),
      prodiNames: optionalStringArray(body, "prodiNames"),
      prodiText: optionalString(body, "prodiText"),
      catatan: optionalString(body, "catatan"),
      status: optionalString(body, "status"),
    });

    const oldImagePath = oldMeeting?.meetingImagePath || oldMeeting?.meetingImageUrl || "";

    if (imageFile) {
      const savedImage = await saveCompressedMeetingImage(imageFile, meetingId);
      if (savedImage) {
        try {
          meeting = await setMeetingImageMeta(meetingId, savedImage);
        } catch (error) {
          await deletePublicMeetingImage(savedImage.meetingImagePath);
          throw error;
        }
        if (oldImagePath && oldImagePath !== savedImage.meetingImagePath) {
          await deletePublicMeetingImage(oldImagePath);
        }
      }
    } else if (deleteImage && oldImagePath) {
      meeting = await setMeetingImageMeta(meetingId, null);
      await deletePublicMeetingImage(oldImagePath);
    }

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
    const meeting = await getMeeting(meetingId);
    const imagePath = meeting?.meetingImagePath || meeting?.meetingImageUrl || "";

    await deleteMeeting(meetingId);
    await deletePublicMeetingImage(imagePath);

    return NextResponse.json({ success: true, message: "Meeting berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting gagal dihapus.";
    return NextResponse.json({ success: false, message }, { status: statusFromError(message) });
  }
}
