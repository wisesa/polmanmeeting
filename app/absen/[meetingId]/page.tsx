import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ meetingId: string }>;
};

export default async function AbsenPage({ params }: PageProps) {
  const { meetingId } = await params;

  redirect(`/meeting/${encodeURIComponent(meetingId)}`);
}