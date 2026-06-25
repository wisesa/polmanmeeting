import MeetingDetailClient from "@/components/MeetingDetailClient";
import { getMeeting, getPresenceList } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    meetingId: string;
  }>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const meetingId = decodeURIComponent(resolvedParams.meetingId);

  const meeting = await getMeeting(meetingId);
  const presences = await getPresenceList(meetingId);

  return (
    <MeetingDetailClient
      meetingId={meetingId}
      initialMeeting={toJsonSafe(meeting)}
      initialPresences={toJsonSafe(presences)}
    />
  );
}