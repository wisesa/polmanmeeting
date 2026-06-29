"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type Presence = {
  id?: string;
  key?: string;
  name?: string;
  nameKey?: string;
  faceId?: string;
  faceThumbnailBase64?: string;
  faceThumbnailMimeType?: string;
  hasFaceThumbnail?: boolean;
  jabatan?: string;
  prodi?: string;
  method?: string;
  matched?: boolean;
  score?: number;
  lastScore?: number;
  firstCheckInAt?: number;
  lastCheckInAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

type MeetingResponse = {
  success?: boolean;
  meeting?: Record<string, unknown> | null;
  presences?: Presence[] | Record<string, Presence>;
  message?: string;
  serverTime?: number;
};

type PresenceListLiveProps = {
  meetingId: string;
  initialPresences?: Presence[];
  intervalMs?: number;
};

function normalizePresences(value: MeetingResponse["presences"]): Presence[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item, index) => ({
        id: item.id || item.key || item.nameKey || String(index),
        ...item,
      }));
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => ({
        id: item.id || item.key || item.nameKey || key,
        key,
        nameKey: item.nameKey || key,
        ...item,
      }))
      .filter((item) => item.name || item.nameKey);
  }

  return [];
}

function getPresenceTime(presence: Presence) {
  return (
    presence.lastCheckInAt ||
    presence.firstCheckInAt ||
    presence.updatedAt ||
    presence.createdAt ||
    0
  );
}

function formatTime(value?: number) {
  if (!value || !Number.isFinite(value)) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatScore(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(4);
}

function dataUrlFromBase64(base64?: string, mimeType = "image/jpeg") {
  const cleanBase64 = typeof base64 === "string" ? base64.trim() : "";
  if (!cleanBase64) return "";
  if (cleanBase64.startsWith("data:")) return cleanBase64;
  return `data:${mimeType || "image/jpeg"};base64,${cleanBase64}`;
}

function presenceFaceSrc(presence: Presence) {
  return dataUrlFromBase64(presence.faceThumbnailBase64, presence.faceThumbnailMimeType || "image/jpeg");
}

export default function PresenceListLive({
  meetingId,
  initialPresences = [],
  intervalMs = 3000,
}: PresenceListLiveProps) {
  const [presences, setPresences] = useState<Presence[]>(initialPresences);
  const [loading, setLoading] = useState(initialPresences.length === 0);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const toast = useToast();
  const lastErrorToastRef = useRef("");

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!error || error === lastErrorToastRef.current) return;
    lastErrorToastRef.current = error;
    toast.error("Gagal memuat presensi", error);
  }, [error, toast]);

  const sortedPresences = useMemo(() => {
    return [...presences].sort((a, b) => getPresenceTime(b) - getPresenceTime(a));
  }, [presences]);

  const loadPresences = useCallback(async () => {
    try {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = (await response.json()) as MeetingResponse;

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Gagal memuat data presensi.");
      }

      setPresences(normalizePresences(data.presences));
      setLastUpdatedAt(Date.now());
      setError("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data presensi."
      );
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadPresences();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPresences();
      }
    }, intervalMs);

    function handleFocus() {
      loadPresences();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadPresences();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      abortRef.current?.abort();
    };
  }, [loadPresences, intervalMs]);

  return (
    <section className="presenceLiveSection">
      <div className="presenceLiveHeader">
        <div>
          <p className="eyebrow">Daftar Presensi</p>
          <h2>Orang yang Sudah Absen</h2>
          <p className="muted">
            Total {sortedPresences.length} peserta
            {lastUpdatedAt ? `, update ${formatTime(lastUpdatedAt)}` : ""}
          </p>
        </div>

        <button
          type="button"
          className="ghostButton"
          onClick={loadPresences}
          disabled={loading}
        >
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {sortedPresences.length === 0 ? (
        <div className="emptyState">
          <strong>Belum ada peserta yang absen.</strong>
          <span>Data akan otomatis muncul setelah peserta berhasil absen.</span>
        </div>
      ) : (
        <div className="presenceGrid">
          {sortedPresences.map((presence, index) => (
            <article
              className="presenceCard"
              key={presence.id || presence.nameKey || `${presence.name}-${index}`}
            >
              <div className={presenceFaceSrc(presence) ? "presenceAvatar presencePhotoAvatar" : "presenceAvatar"}>
                {presenceFaceSrc(presence) ? (
                  <img src={presenceFaceSrc(presence)} alt={`Preview wajah ${presence.name || "peserta"}`} />
                ) : (
                  (presence.name || "?").charAt(0).toUpperCase()
                )}
              </div>

              <div className="presenceInfo">
                <h3>{presence.name || "Tanpa Nama"}</h3>

                <p>
                  {presence.jabatan || "Peserta"}
                  {presence.prodi ? `, ${presence.prodi}` : ""}
                </p>

                <div className="presenceMeta">
                  <span>{formatTime(getPresenceTime(presence))}</span>
                  <span>{presence.method || "web_face"}</span>
                  <span>Kecocokan {formatScore(presence.lastScore || presence.score)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}