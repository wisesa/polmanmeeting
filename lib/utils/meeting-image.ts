import "server-only";

const MAX_INPUT_BYTES = 700 * 1024;
const RECOMMENDED_MAX_BYTES = 260 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type SavedMeetingImage = {
  meetingImageBase64: string;
  meetingImageUrl: string;
  meetingImagePath: string;
  meetingImageFileName: string;
  meetingImageMimeType: string;
  meetingImageSize: number;
  meetingImageUpdatedAt: number;
  meetingImageStorage: "firestore-base64";
};

function safeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "meeting";
}

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function dataUrlFromBase64(base64: string, mimeType = "image/jpeg") {
  const cleanBase64 = stripDataUrlPrefix(base64).trim();
  return cleanBase64 ? `data:${mimeType || "image/jpeg"};base64,${cleanBase64}` : "";
}

export function validateMeetingImageFile(file: File | null) {
  if (!file || file.size <= 0) return;

  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      "Ukuran gambar setelah kompres masih terlalu besar. Ulangi upload dengan gambar lebih kecil.",
    );
  }
}

export async function saveCompressedMeetingImage(file: File, meetingId: string): Promise<SavedMeetingImage | null> {
  if (!file || file.size <= 0) return null;
  validateMeetingImageFile(file);

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  if (inputBuffer.length > MAX_INPUT_BYTES) {
    throw new Error("Ukuran gambar setelah kompres masih terlalu besar untuk Firestore.");
  }

  const now = Date.now();
  const mimeType = "image/jpeg";
  const fileName = `${safeFileSegment(meetingId)}-${now}.jpg`;
  const base64 = inputBuffer.toString("base64");

  if (!base64) throw new Error("Gambar meeting gagal dikonversi ke base64.");

  return {
    meetingImageBase64: base64,
    meetingImageUrl: dataUrlFromBase64(base64, mimeType),
    meetingImagePath: "",
    meetingImageFileName: fileName,
    meetingImageMimeType: mimeType,
    meetingImageSize: inputBuffer.length,
    meetingImageUpdatedAt: now,
    meetingImageStorage: "firestore-base64",
  };
}

export async function deletePublicMeetingImage(_publicPath?: string | null) {
  // Gambar meeting sekarang disimpan sebagai base64 di dokumen Firestore.
  // Tidak ada file eksternal yang perlu dihapus.
  return;
}

export const MEETING_IMAGE_RECOMMENDED_MAX_BYTES = RECOMMENDED_MAX_BYTES;
