import MeetingDetailClient from "@/components/MeetingDetailClient";
import { requireDosenSession } from "@/lib/auth/dosen-session";
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

export default async function DosenMeetingDetailPage({ params }: PageProps) {
  await requireDosenSession("/dosen/meeting");
  const resolvedParams = await params;
  const meetingId = decodeURIComponent(resolvedParams.meetingId);

  const [meeting, presences] = await Promise.all([
    getMeeting(meetingId),
    getPresenceList(meetingId),
  ]);

  return (
    <MeetingDetailClient
      meetingId={meetingId}
      initialMeeting={toJsonSafe(meeting)}
      initialPresences={toJsonSafe(presences)}
      backHref="/dosen/meeting"
    />
  );
}
