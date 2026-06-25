import { requireAdminSession } from "@/lib/auth/admin-session";
import AdminMeetingClient from "@/components/AdminMeetingClient";
import { getActiveMasterProdi, getInvitationForms, getMeetingsPage, getRegisteredFaces } from "@/lib/firebase/db";
import type { MasterProdi, MeetingInfoForm, RegisteredFace } from "@/lib/firebase/schema";
import { currentMonthKey, normalizeMonthKey, todayDateKey } from "@/lib/utils/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
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

function toProdiOptions(prodi: MasterProdi[]) {
  return prodi
    .filter((item) => item.isActive && Boolean(item.nama?.trim()))
    .map((item) => ({
      prodiId: item.prodiId,
      kode: item.kode || "",
      nama: item.nama,
      displayName: item.displayName || item.nama,
      jenjang: item.jenjang || "",
      jurusan: item.jurusan || "",
    }));
}

function toInvitationOptions(invitations: MeetingInfoForm[]) {
  return invitations
    .filter((item) => !item.meetingId && item.status !== "cancelled" && Boolean(item.meetingName?.trim()) && (!item.meetingDate || item.meetingDate >= Date.now()))
    .map((item) => ({
      formId: item.formId,
      noDokumen: item.noDokumen || "",
      meetingName: item.meetingName,
      topikRapat: item.topikRapat || "",
      agendaRapat: item.agendaRapat || "",
      meetingDateKey: item.meetingDateKey || "",
      tanggal: item.tanggal || "",
      hari: item.hari || "",
      tempat: item.tempat || "",
      waktuMulai: item.waktuMulai || "",
      waktuSelesai: item.waktuSelesai || "",
      waktu: item.waktu || "",
      pemimpinRapat: item.pemimpinRapat || "",
      notulis: item.notulis || "",
      prodiIds: item.prodiIds || [],
      prodiNames: item.prodiNames || [],
      prodiText: item.prodiText || "",
      pesertaText: item.pesertaText || "",
      catatan: item.catatan || "",
      meetingDate: item.meetingDate || 0,
    }))
    .sort((a, b) => (a.meetingDate || 0) - (b.meetingDate || 0));
}

export default async function AdminMeetingPage({ searchParams }: PageProps) {
  await requireAdminSession("/admin/meeting");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const monthKey = normalizeMonthKey(firstParam(resolvedSearchParams.month), currentMonthKey());
  const page = pageNumber(resolvedSearchParams.page);

  const [pagedMeetings, faces, prodi, invitations] = await Promise.all([
    getMeetingsPage({ monthKey, page, pageSize: PAGE_SIZE }),
    getRegisteredFaces(),
    getActiveMasterProdi(),
    getInvitationForms(),
  ]);

  return (
    <AdminMeetingClient
      initialMeetings={toJsonSafe(pagedMeetings.items)}
      todayDateKey={todayDateKey()}
      faceOptions={toJsonSafe(toFaceOptions(faces))}
      prodiOptions={toJsonSafe(toProdiOptions(prodi))}
      invitationOptions={toJsonSafe(toInvitationOptions(invitations))}
      listMonth={monthKey}
      currentPage={pagedMeetings.page}
      pageSize={pagedMeetings.pageSize}
      totalCount={pagedMeetings.totalCount}
    />
  );
}
