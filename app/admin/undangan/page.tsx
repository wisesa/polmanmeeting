import { requireAdminSession } from "@/lib/auth/admin-session";
import AdminInvitationClient from "@/components/AdminInvitationClient";
import { getActiveMasterProdi, getInvitationFormsPage, getRegisteredFaces } from "@/lib/firebase/db";
import type { MasterProdi, RegisteredFace } from "@/lib/firebase/schema";
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

export default async function AdminUndanganPage({ searchParams }: PageProps) {
  await requireAdminSession("/admin/undangan");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const monthKey = normalizeMonthKey(firstParam(resolvedSearchParams.month), currentMonthKey());
  const page = pageNumber(resolvedSearchParams.page);

  const [pagedInvitations, faces, prodi] = await Promise.all([
    getInvitationFormsPage({ monthKey, page, pageSize: PAGE_SIZE }),
    getRegisteredFaces(),
    getActiveMasterProdi(),
  ]);

  return (
    <AdminInvitationClient
      initialInvitations={toJsonSafe(pagedInvitations.items)}
      todayDateKey={todayDateKey()}
      faceOptions={toJsonSafe(toFaceOptions(faces))}
      prodiOptions={toJsonSafe(toProdiOptions(prodi))}
      listMonth={monthKey}
      currentPage={pagedInvitations.page}
      pageSize={pagedInvitations.pageSize}
      totalCount={pagedInvitations.totalCount}
    />
  );
}
