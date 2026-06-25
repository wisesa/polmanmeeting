import { requireDosenSession } from "@/lib/auth/dosen-session";
import RegisterFaceClient from "@/components/RegisterFaceClient";
import { getActiveMasterProdi, getRegisteredFaces } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default async function DosenRegisterFacePage() {
  await requireDosenSession("/dosen/register-wajah");
  const [faces, prodi] = await Promise.all([
    getRegisteredFaces(),
    getActiveMasterProdi(),
  ]);

  return (
    <RegisterFaceClient
      initialFaces={toJsonSafe(faces)}
      prodiOptions={toJsonSafe(prodi)}
      mode="dosen"
      allowDelete={false}
    />
  );
}
