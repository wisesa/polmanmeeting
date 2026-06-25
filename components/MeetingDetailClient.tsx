"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CameraAttendance from "@/components/CameraAttendance";
import { useToast } from "@/components/ToastProvider";

type AnyRecord = Record<string, unknown>;

type MeetingDetailClientProps = {
  meetingId: string;
  initialMeeting: AnyRecord | null;
  initialPresences: AnyRecord[];
};

type ApiResponse = {
  success: boolean;
  message?: string;
  meetingId: string;
  meeting: AnyRecord | null;
  presences: AnyRecord[];
  updatedAt: number;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getMeetingTitle(meeting: AnyRecord | null) {
  if (!meeting) return "Meeting";

  return (
    stringValue(meeting.meetingName) ||
    stringValue(meeting.title) ||
    stringValue(meeting.meetingTitle) ||
    stringValue(meeting.judul) ||
    stringValue(meeting.topic) ||
    stringValue(meeting.topik) ||
    "Meeting"
  );
}

function getMeetingStatus(meeting: AnyRecord | null) {
  if (!meeting) return "unknown";

  return (
    stringValue(meeting.status) ||
    stringValue(meeting.state) ||
    (meeting.closed === true || meeting.isClosed === true ? "closed" : "active")
  );
}

function getMeetingProdi(meeting: AnyRecord | null) {
  if (!meeting) return "-";
  const text = stringValue(meeting.prodiText);
  if (text) return text;
  if (Array.isArray(meeting.prodiNames)) {
    const values = meeting.prodiNames.map((item) => stringValue(item)).filter(Boolean);
    if (values.length > 0) return values.join(", ");
  }
  return stringValue(meeting.prodi, "-");
}

function getMeetingTime(meeting: AnyRecord | null) {
  if (!meeting) return "-";

  const millis =
    numberValue(meeting.meetingDate, 0) ||
    numberValue(meeting.date, 0) ||
    numberValue(meeting.createdAt, 0);

  if (millis > 0) {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(millis));
  }

  const tanggal = stringValue(meeting.tanggal);
  const waktu = stringValue(meeting.waktu);

  if (tanggal && waktu) return `${tanggal}, ${waktu}`;
  if (tanggal) return tanggal;

  return "-";
}

function getPresenceName(presence: AnyRecord) {
  return (
    stringValue(presence.name) ||
    stringValue(presence.nama) ||
    stringValue(presence.fullName) ||
    "Tanpa Nama"
  );
}

function getPresenceRole(presence: AnyRecord) {
  return (
    [stringValue(presence.jabatan), stringValue(presence.prodiName) || stringValue(presence.prodi)].filter(Boolean).join(" • ") ||
    stringValue(presence.role) ||
    "Peserta"
  );
}

function getPresenceMethod(presence: AnyRecord) {
  const method = stringValue(presence.method, "web_face");

  if (method === "web_face") return "Wajah";
  if (method === "manual") return "Manual";

  return method;
}

function getPresenceScore(presence: AnyRecord) {
  const score = numberValue(presence.lastScore, NaN);

  if (Number.isFinite(score)) {
    return score.toFixed(4);
  }

  const fallbackScore = numberValue(presence.score, NaN);

  if (Number.isFinite(fallbackScore)) {
    return fallbackScore.toFixed(4);
  }

  return "";
}

function getPresenceTime(presence: AnyRecord) {
  const millis =
    numberValue(presence.lastCheckInAt, 0) ||
    numberValue(presence.firstCheckInAt, 0) ||
    numberValue(presence.updatedAt, 0) ||
    numberValue(presence.createdAt, 0);

  if (millis <= 0) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(millis));
}

function getInitialLetter(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function sortPresences(presences: AnyRecord[]) {
  return [...presences].sort((a, b) => {
    const timeA =
      numberValue(a.lastCheckInAt, 0) ||
      numberValue(a.updatedAt, 0) ||
      numberValue(a.createdAt, 0);

    const timeB =
      numberValue(b.lastCheckInAt, 0) ||
      numberValue(b.updatedAt, 0) ||
      numberValue(b.createdAt, 0);

    return timeB - timeA;
  });
}

function formatUpdateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default function MeetingDetailClient({
  meetingId,
  initialMeeting,
  initialPresences,
}: MeetingDetailClientProps) {
  const [meeting, setMeeting] = useState<AnyRecord | null>(initialMeeting);
  const [presences, setPresences] = useState<AnyRecord[]>(
    Array.isArray(initialPresences) ? initialPresences : []
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const toast = useToast();
  const lastErrorToastRef = useRef("");

  useEffect(() => {
    if (!errorMessage || errorMessage === lastErrorToastRef.current) return;
    lastErrorToastRef.current = errorMessage;
    toast.error("Gagal memuat presensi", errorMessage);
  }, [errorMessage, toast]);

  const sortedPresences = useMemo(() => sortPresences(presences), [presences]);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsRefreshing(true);
        setErrorMessage("");

        const response = await fetch(
          `/api/meetings/${encodeURIComponent(meetingId)}/presences?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const text = await response.text();

        let data: ApiResponse;

        try {
          data = JSON.parse(text) as ApiResponse;
        } catch {
          throw new Error("Data terbaru belum bisa dimuat. Data terakhir tetap ditampilkan.");
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Gagal memuat data presensi.");
        }

        setMeeting(data.meeting);
        setPresences(Array.isArray(data.presences) ? data.presences : []);
        setLastUpdated(new Date(data.updatedAt || Date.now()));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat data presensi."
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [meetingId]
  );

  useEffect(() => {
    loadData(true);

    const interval = window.setInterval(() => {
      loadData(true);
    }, 3000);

    function handleFocus() {
      loadData(true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  const title = getMeetingTitle(meeting);
  const status = getMeetingStatus(meeting);
  const meetingTime = getMeetingTime(meeting);
  const meetingProdi = getMeetingProdi(meeting);
  const isClosed = ["closed", "close", "selesai", "ditutup"].includes(
    status.toLowerCase()
  );

  return (
    <main className="meetingDetailPage">
      <div className="meetingDetailShell">
        <div className="meetingTopBar">
  <Link href="/" className="iconButton" aria-label="Kembali" title="Kembali">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </Link>

  <button
    type="button"
    className="iconButton"
    onClick={() => loadData(false)}
    disabled={isRefreshing}
    aria-label="Refresh"
    title="Refresh"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={isRefreshing ? "spinIcon" : ""}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  </button>
</div>

        <section className="meetingHeroCard meetingHeroCardWide meetingDetailV2">
          <div className="meetingDetailLeftPanel meetingDetailLeftPanelV2">
            <div className="meetingHeroContent">
              <p className="eyebrow">Detail Meeting</p>
              <h1>{title}</h1>
              <p className="meetingIdText">ID Meeting: {meetingId}</p>

              <div className="meetingInfoGridV2">
                <div className="meetingInfoCardV2 meetingInfoCardV2Full">
                  <span className="meetingInfoCardV2Label">Prodi</span>
                  <strong className="meetingInfoCardV2Value">{meetingProdi}</strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Status</span>
                  <strong className={`meetingInfoCardV2Value ${isClosed ? "statusClosed" : "statusActive"}`}>
                    {status}
                  </strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Waktu</span>
                  <strong className="meetingInfoCardV2Value">{meetingTime}</strong>
                </div>

                <div className="meetingInfoCardV2 meetingInfoCardV2Highlight">
                  <span className="meetingInfoCardV2Label">Hadir</span>
                  <strong className="meetingInfoCardV2Value">{sortedPresences.length} peserta</strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Update</span>
                  <strong className="meetingInfoCardV2Value">{formatUpdateTime(lastUpdated)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="meetingInlineAttendance">
            {isClosed ? (
              <div className="inlineAlert warning">
                Meeting sudah ditutup. Absensi wajah tidak tersedia.
              </div>
            ) : (
              <CameraAttendance
                meetingId={meetingId}
                variant="embedded"
                onAttendanceSuccess={() => loadData(true)}
              />
            )}
          </div>
        </section>

        <section className="presenceSection">
          <div className="presencePanel">
            <div className="presencePanelHeader">
              <div>
                <p className="eyebrow">Daftar Presensi</p>
                <h2>Peserta Hadir</h2>
                <p className="muted">
                  {sortedPresences.length} peserta tercatat. Diperbarui pukul{" "}
                  {formatUpdateTime(lastUpdated)}.
                </p>
              </div>

              <div className="presenceCounter">
                <strong>{sortedPresences.length}</strong>
                <span>Hadir</span>
              </div>
            </div>

            {sortedPresences.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon">👥</div>
                <h3>Belum ada presensi</h3>
                <p>Data peserta akan muncul otomatis setelah absensi berhasil.</p>
              </div>
            ) : (
              <div className="presenceList">
                {sortedPresences.map((presence, index) => {
                  const name = getPresenceName(presence);
                  const role = getPresenceRole(presence);
                  const method = getPresenceMethod(presence);
                  const score = getPresenceScore(presence);
                  const time = getPresenceTime(presence);

                  return (
                    <article
                      className="presenceCard"
                      key={
                        stringValue(presence.nameKey) ||
                        stringValue(presence.faceId) ||
                        `${name}-${index}`
                      }
                    >
                      <div className="presenceAvatar">
                        {getInitialLetter(name)}
                      </div>

                      <div className="presenceContent">
                        <div className="presenceMain">
                          <h3>{name}</h3>
                          <p>{role}</p>
                        </div>

                        <div className="presenceMeta">
                          <span>{time}</span>
                          <span>{method}</span>
                          {score && <span>Score {score}</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}