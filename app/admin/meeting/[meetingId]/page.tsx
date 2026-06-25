import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/admin-session";
import AdminMeetingRunClient from "@/components/AdminMeetingRunClient";
import { getMeeting, getRegisteredFaces } from "@/lib/firebase/db";
import type { RegisteredFace } from "@/lib/firebase/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ meetingId: string }>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

function toFaceOptions(faces: RegisteredFace[]) {
  return faces
    .filter((face) => Boolean(face.name?.trim()))
    .map((face) => ({
      name: face.name,
      nameKey: face.nameKey || face.faceId || face.name,
      jabatan: face.jabatan || "",
      prodi: face.prodiName || face.prodi || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

export default async function AdminMeetingDetailPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const meetingId = decodeURIComponent(resolvedParams.meetingId || "");
  await requireAdminSession(`/admin/meeting/${encodeURIComponent(meetingId)}`);
  const [meeting, faces] = await Promise.all([
    getMeeting(meetingId),
    getRegisteredFaces(),
  ]);

  if (!meeting) {
    return (
      <main className="appShell">
        <section className="emptyState modernEmpty">
          <div className="emptyIcon">⚠️</div>
          <h1>Meeting tidak ditemukan</h1>
          <p className="muted">Periksa kembali ID meeting atau buat meeting baru dari menu admin.</p>
          <Link href="/admin/meeting" className="primaryButton">Kembali ke Meeting</Link>
        </section>
      </main>
    );
  }

  return <AdminMeetingRunClient meeting={toJsonSafe(meeting)} faceOptions={toJsonSafe(toFaceOptions(faces))} />;
}
