import { redirect } from "next/navigation";
import { requireDosenSession } from "@/lib/auth/dosen-session";
import RegisterFaceClient from "@/components/RegisterFaceClient";
import { getActiveMasterProdi, getRegisteredFace } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default async function DosenProfilePage() {
  const dosen = await requireDosenSession("/dosen/ganti-profil");
  const [face, prodi] = await Promise.all([
    getRegisteredFace(dosen.nameKey),
    getActiveMasterProdi(),
  ]);

  if (!face) {
    redirect("/dosen/login");
  }

  return (
    <RegisterFaceClient
      initialFaces={toJsonSafe([face])}
      prodiOptions={toJsonSafe(prodi)}
      mode="dosen"
      allowDelete={false}
    />
  );
}
