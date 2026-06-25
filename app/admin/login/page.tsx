import AdminLoginClient from "@/components/AdminLoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  const nextParam = resolvedSearchParams?.next;
  const nextPath = Array.isArray(nextParam)
    ? nextParam[0] ?? "/admin"
    : nextParam ?? "/admin";

  return <AdminLoginClient nextPath={nextPath} />;
}