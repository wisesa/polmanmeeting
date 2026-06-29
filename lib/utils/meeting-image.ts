import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { del, put } from "@vercel/blob";

const LOCAL_UPLOAD_URL_PREFIX = "/uploads/meetings";
const BLOB_UPLOAD_PREFIX = "meetings";
const TARGET_BYTES = 200 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

type MeetingImageStorageMode = "blob" | "local";

export type SavedMeetingImage = {
  meetingImageUrl: string;
  meetingImagePath: string;
  meetingImageFileName: string;
  meetingImageMimeType: string;
  meetingImageSize: number;
  meetingImageUpdatedAt: number;
};

function uploadDir() {
  return path.join(process.cwd(), "public", "uploads", "meetings");
}

function meetingImageStorageMode(): MeetingImageStorageMode {
  const configured = (process.env.MEETING_IMAGE_STORAGE || "").trim().toLowerCase();

  // Vercel runtime file system is read-only except /tmp, so persistent uploads
  // must use object storage in production deployments.
  if (process.env.VERCEL) return "blob";

  if (configured === "local") return "local";
  if (configured === "blob") return "blob";
  return "local";
}

function ensureBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Storage gambar meeting belum siap. Buat Vercel Blob Store lalu pastikan BLOB_READ_WRITE_TOKEN tersedia di Environment Variables Vercel.",
    );
  }
}

function safeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "meeting";
}

async function compressToTarget(buffer: Buffer) {
  let best: Buffer | null = null;
  const widths = [1600, 1280, 1024, 900, 768, 640];
  const qualities = [82, 74, 66, 58, 50, 42, 34, 28, 22];

  for (const width of widths) {
    for (const quality of qualities) {
      const output = await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (!best || output.length < best.length) best = output;
      if (output.length <= TARGET_BYTES) return output;
    }
  }

  return best || buffer;
}

export function validateMeetingImageFile(file: File | null) {
  if (!file || file.size <= 0) return;

  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Ukuran gambar maksimal 10 MB sebelum kompres.");
  }
}

async function saveLocalMeetingImage(outputBuffer: Buffer, fileName: string, now: number): Promise<SavedMeetingImage> {
  const directory = uploadDir();
  const absolutePath = path.join(directory, fileName);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, outputBuffer);

  const publicPath = `${LOCAL_UPLOAD_URL_PREFIX}/${fileName}`;

  return {
    meetingImageUrl: publicPath,
    meetingImagePath: publicPath,
    meetingImageFileName: fileName,
    meetingImageMimeType: "image/jpeg",
    meetingImageSize: outputBuffer.length,
    meetingImageUpdatedAt: now,
  };
}

async function saveBlobMeetingImage(outputBuffer: Buffer, fileName: string, now: number): Promise<SavedMeetingImage> {
  ensureBlobToken();

  const pathname = `${BLOB_UPLOAD_PREFIX}/${fileName}`;
  const blob = await put(pathname, outputBuffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/jpeg",
  });

  return {
    meetingImageUrl: blob.url,
    meetingImagePath: blob.url,
    meetingImageFileName: fileName,
    meetingImageMimeType: "image/jpeg",
    meetingImageSize: outputBuffer.length,
    meetingImageUpdatedAt: now,
  };
}

export async function saveCompressedMeetingImage(file: File, meetingId: string): Promise<SavedMeetingImage | null> {
  if (!file || file.size <= 0) return null;
  validateMeetingImageFile(file);

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await compressToTarget(inputBuffer);
  const now = Date.now();
  const fileName = `${safeFileSegment(meetingId)}-${now}.jpg`;

  if (meetingImageStorageMode() === "blob") {
    return saveBlobMeetingImage(outputBuffer, fileName, now);
  }

  return saveLocalMeetingImage(outputBuffer, fileName, now);
}

async function deleteLocalMeetingImage(publicPath?: string | null) {
  if (!publicPath) return;

  // File lokal tidak dapat dihapus saat runtime Vercel karena deployment bersifat read-only.
  if (process.env.VERCEL) return;

  const cleanPath = publicPath.trim();
  if (!cleanPath.startsWith(`${LOCAL_UPLOAD_URL_PREFIX}/`)) return;

  const fileName = path.basename(cleanPath);
  if (!fileName || fileName.includes("..")) return;

  const absolutePath = path.join(uploadDir(), fileName);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function deleteBlobMeetingImage(blobUrl?: string | null) {
  if (!blobUrl) return;

  const cleanUrl = blobUrl.trim();
  if (!cleanUrl || cleanUrl.startsWith(`${LOCAL_UPLOAD_URL_PREFIX}/`)) return;

  try {
    const parsed = new URL(cleanUrl);
    if (!parsed.pathname.includes(`/${BLOB_UPLOAD_PREFIX}/`)) return;
    ensureBlobToken();
    await del(cleanUrl);
  } catch (error) {
    // Abaikan URL lama/lokal yang bukan URL valid. Error token/blob tetap dilempar.
    if (error instanceof TypeError) return;
    throw error;
  }
}

export async function deletePublicMeetingImage(publicPath?: string | null) {
  if (!publicPath) return;

  const cleanPath = publicPath.trim();
  if (!cleanPath) return;

  if (cleanPath.startsWith(`${LOCAL_UPLOAD_URL_PREFIX}/`)) {
    await deleteLocalMeetingImage(cleanPath);
    return;
  }

  await deleteBlobMeetingImage(cleanPath);
}
