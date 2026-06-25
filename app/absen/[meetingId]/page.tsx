import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params:
    | Promise<{
        meetingId: string;
      }>
    | {
        meetingId: string;
      };
};

export default async function AbsenPage({ params }: PageProps) {
  const resolvedParams = await params;
  const meetingId = decodeURIComponent(resolvedParams.meetingId);

  redirect(`/meeting/${encodeURIComponent(meetingId)}`);
}
