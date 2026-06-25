import DosenLoginClient from "@/components/DosenLoginClient";
import { getCurrentDosen } from "@/lib/auth/dosen-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ next?: string }> | { next?: string };
};

function safeNextPath(value?: string) {
  if (!value) return "/dosen/register-wajah";
  if (!value.startsWith("/dosen")) return "/dosen/register-wajah";
  if (value.startsWith("/dosen/login")) return "/dosen/register-wajah";
  return value;
}

export default async function DosenLoginPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams || {});
  const nextPath = safeNextPath(params.next);
  const dosen = await getCurrentDosen();

  if (dosen) {
    redirect(nextPath);
  }

  return <DosenLoginClient nextPath={nextPath} />;
}
