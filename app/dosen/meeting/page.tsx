import Link from "next/link";
import { Suspense } from "react";
import { requireDosenSession } from "@/lib/auth/dosen-session";
import { getMeetings } from "@/lib/firebase/db";
import MeetingDateFilter from "@/components/MeetingDateFilter";
import {
  formatDateKeyLong,
  formatDateKeyShort,
  getMeetingDateKey,
  isValidDateKey,
  todayDateKey
} from "@/lib/utils/date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DosenMeetingSearchParams = Promise<{ date?: string | string[] }>;

function pickDateParam(searchParams?: { date?: string | string[] }) {
  const raw = Array.isArray(searchParams?.date) ? searchParams?.date[0] : searchParams?.date;
  return typeof raw === "string" && isValidDateKey(raw) ? raw : todayDateKey();
}

function statusLabel(status?: string) {
  const value = status || "active";
  if (value === "active") return "Aktif";
  if (value === "closed") return "Selesai";
  return value;
}

export default async function DosenMeetingPage(context: { searchParams?: DosenMeetingSearchParams }) {
  await requireDosenSession("/dosen/meeting");
  const searchParams = context.searchParams ? await context.searchParams : undefined;
  const selectedDate = pickDateParam(searchParams);
  const todayDate = todayDateKey();
  const allMeetings = await getMeetings("meetings");
  const meetings = allMeetings.filter((meeting) => getMeetingDateKey(meeting) === selectedDate);

  return (
    <main className="appShell">
      <section className="heroPanel homeHeroPanel dosenHeroPanel">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Dosen Meeting</p>
            <h1 className="heroTitle">Daftar Meeting</h1>
            <p className="heroSubtitle">
              Pilih jadwal rapat, buka detail meeting, lalu lakukan presensi wajah dari akun dosen.
            </p>
          </div>
          <div className="heroMetric">
            <strong>{meetings.length}</strong>
            <span>Meeting terfilter</span>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="filterCard"><p className="muted">Memuat filter tanggal...</p></div>}>
        <MeetingDateFilter
          selectedDate={selectedDate}
          todayDate={todayDate}
          selectedLabel={formatDateKeyLong(selectedDate)}
          filteredCount={meetings.length}
          totalCount={allMeetings.length}
        />
      </Suspense>

      <section className="contentSection">
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">Meeting</p>
            <h2>{formatDateKeyShort(selectedDate)}</h2>
          </div>
          <span className="counterPill">{meetings.length} jadwal</span>
        </div>

        {meetings.length === 0 ? (
          <div className="emptyState modernEmpty">
            <div className="emptyIcon">🗓️</div>
            <h2>Tidak ada meeting pada tanggal ini</h2>
            <p className="muted">Silakan pilih tanggal lain.</p>
          </div>
        ) : (
          <div className="meetingGrid">
            {meetings.map((meeting) => {
              const status = meeting.status || "active";
              const isActive = status === "active";
              const dateKey = getMeetingDateKey(meeting);

              return (
                <article
                  key={meeting.meetingId}
                  className="meetingCard staticCard"
                >
                  <div className="cardTopline">
                    <span className={isActive ? "badge active" : "badge closed"}>{statusLabel(status)}</span>
                    <span className="presenceChip">{meeting.participantsCount || 0} hadir</span>
                  </div>

                  <h3>{meeting.meetingName || meeting.meetingId}</h3>

                  {meeting.topikRapat ? <p className="topic">{meeting.topikRapat}</p> : null}

                  <div className="meetingInfoGrid">
                    <div className="infoTile">
                      <span>Tanggal</span>
                      <strong>{dateKey ? formatDateKeyShort(dateKey) : meeting.tanggal || "-"}</strong>
                    </div>
                    <div className="infoTile">
                      <span>Waktu</span>
                      <strong>{meeting.waktu || "-"}</strong>
                    </div>
                    <div className="infoTile full">
                      <span>Prodi</span>
                      <strong>{meeting.prodiText || meeting.prodiNames?.join(", ") || "-"}</strong>
                    </div>
                    <div className="infoTile full">
                      <span>Tempat</span>
                      <strong>{meeting.tempat || "-"}</strong>
                    </div>
                  </div>

                  <div className="meetingCardActions wrapActions">
                    <Link href={`/dosen/meeting/${encodeURIComponent(meeting.meetingId)}`} className="primaryButton small">Detail dan Absen</Link>
                    <a href={`/api/export/meetings/${encodeURIComponent(meeting.meetingId)}`} className="ghostButton small" target="_blank" rel="noreferrer">Export PDF</a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
