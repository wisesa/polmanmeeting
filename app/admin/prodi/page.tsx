import { requireAdminSession } from "@/lib/auth/admin-session";
import AdminProdiClient from "@/components/AdminProdiClient";
import { getMasterProdi } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default async function AdminProdiPage() {
  await requireAdminSession("/admin/prodi");
  const prodi = await getMasterProdi(true);
  return <AdminProdiClient initialProdi={toJsonSafe(prodi)} />;
}
