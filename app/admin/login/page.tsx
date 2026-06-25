import AdminLoginClient from "@/components/AdminLoginClient";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ next?: string }> | { next?: string };
};

function safeNextPath(value?: string) {
  if (!value) return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams || {});
  const nextPath = safeNextPath(params.next);
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect(nextPath);
  }

  return <AdminLoginClient nextPath={nextPath} />;
}
