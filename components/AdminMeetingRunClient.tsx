"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SearchableSelect, type LookupOption } from "@/components/SearchLookup";
import type { Meeting } from "@/lib/firebase/schema";
import { useToast } from "@/components/ToastProvider";
import PresenceListLive from "@/components/PresenceListLive";
import CameraAttendance from "@/components/CameraAttendance";

type FacePersonOption = {
  name: string;
  nameKey: string;
  jabatan?: string;
  prodi?: string;
};

type AdminMeetingRunClientProps = {
  meeting: Meeting;
  faceOptions: FacePersonOption[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
  meeting?: Meeting;
};

function value(value?: string | null) {
  return value || "";
}

function formatDate(value?: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function personLabel(face: FacePersonOption) {
  const detail = [face.jabatan, face.prodi].filter(Boolean).join(" • ");
  return detail ? `${face.name} - ${detail}` : face.name;
}

function toLeaderOptions(faces: FacePersonOption[]): LookupOption[] {
  return faces.map((face) => ({
    value: face.name,
    label: face.name,
    description: [face.jabatan, face.prodi].filter(Boolean).join(" • "),
    searchText: personLabel(face),
  }));
}

function makePayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  const status = String(formData.get("status") || "active");

  return {
    agendaRapat: String(formData.get("agendaRapat") || ""),
    hasilRapat: String(formData.get("hasilRapat") || ""),
    tindakLanjut: String(formData.get("tindakLanjut") || ""),
    pemimpinRapat: String(formData.get("pemimpinRapat") || ""),
    notulis: String(formData.get("notulis") || ""),
    status,
    finishedAt: status === "closed" ? Date.now() : null,
  };
}

export default function AdminMeetingRunClient({
  meeting,
  faceOptions,
}: AdminMeetingRunClientProps) {
  const [state, setState] = useState<SaveState>({
    status: "idle",
    message: "",
    meeting,
  });
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;

    if (state.status === "success") {
      toast.success("Berhasil", state.message);
    }

    if (state.status === "error") {
      toast.error("Gagal", state.message);
    }
  }, [state.message, state.status, toast]);
  const activeMeeting = state.meeting || meeting;
  const isSaving = state.status === "saving";
  const isClosed = activeMeeting.status === "closed";
  const selectedLeader = value(
    activeMeeting.runForm?.pemimpinRapat || activeMeeting.pemimpinRapat,
  );
  const selectedLeaderExists =
    selectedLeader && faceOptions.some((face) => face.name === selectedLeader);
  const leaderOptions = useMemo(
    () => toLeaderOptions(faceOptions),
    [faceOptions],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    try {
      setState((current) => ({
        ...current,
        status: "saving",
        message: "Menyimpan form meeting...",
      }));

      const response = await fetch(
        `/api/meetings/${encodeURIComponent(activeMeeting.meetingId)}/run-form`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makePayload(formElement)),
        },
      );

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Form meeting gagal disimpan.");
      }

      setState({
        status: "success",
        message: "Form meeting berhasil disimpan.",
        meeting: data.meeting,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Form meeting gagal disimpan.",
      }));
    }
  }

  async function deleteCurrentMeeting() {
    if (!window.confirm("Hapus meeting ini beserta daftar presensinya?"))
      return;

    try {
      setState((current) => ({
        ...current,
        status: "saving",
        message: "Menghapus meeting...",
      }));
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(activeMeeting.meetingId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Meeting gagal dihapus.");
      }

      window.location.href = "/admin/meeting";
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message:
          error instanceof Error ? error.message : "Meeting gagal dihapus.",
      }));
    }
  }

  return (
    <main className="appShell">
      <section className="heroPanel compactHero">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Form Saat Meeting</p>
            <h1 className="heroTitle">{activeMeeting.meetingName}</h1>
            <p className="heroSubtitle">
              Isi agenda, hasil rapat, tindak lanjut, dan status meeting.
              Presensi tetap bisa dibuka dari tombol Presensi User.
            </p>
          </div>
          <div className="heroMetric">
            <strong>{activeMeeting.participantsCount || 0}</strong>
            <span>Peserta hadir</span>
          </div>
        </div>
      </section>

      <section className="formPanel adminFormPanel">
        <div className="sectionTitleRow noMargin">
          <div>
            <p className="eyebrow">Ringkasan</p>
            <h2>{isClosed ? "Meeting Selesai" : "Meeting Aktif"}</h2>
          </div>
          <div className="formActions">
            <Link
              href={`/meeting/${encodeURIComponent(activeMeeting.meetingId)}`}
              className="ghostButton small"
            >
              Presensi User
            </Link>
            <a
              href={`/api/export/meetings/${encodeURIComponent(activeMeeting.meetingId)}`}
              className="ghostButton small"
              target="_blank"
              rel="noreferrer"
            >
              Export PDF
            </a>
            <button
              type="button"
              className="dangerButton small"
              onClick={deleteCurrentMeeting}
              disabled={isSaving}
            >
              Hapus Meeting
            </button>
            <Link href="/admin/meeting" className="ghostButton small">
              Kembali
            </Link>
          </div>
        </div>

        <div className="meetingSummaryStrip">
          <div>
            <span>No Dokumen</span>
            <strong>{activeMeeting.noDokumen || "-"}</strong>
          </div>
          <div>
            <span>Tanggal</span>
            <strong>
              {activeMeeting.hari ? `${activeMeeting.hari}, ` : ""}
              {activeMeeting.tanggal || activeMeeting.meetingDateKey || "-"}
            </strong>
          </div>
          <div>
            <span>Tempat</span>
            <strong>{activeMeeting.tempat || "-"}</strong>
          </div>
          <div>
            <span>Waktu</span>
            <strong>{activeMeeting.waktu || "-"}</strong>
          </div>
          <div>
            <span>Prodi</span>
            <strong>
              {activeMeeting.prodiText ||
                activeMeeting.prodiNames?.join(", ") ||
                "-"}
            </strong>
          </div>
        </div>

        {activeMeeting.meetingImageUrl ? (
          <img
            className="meetingDetailImage"
            src={activeMeeting.meetingImageUrl}
            alt={`Gambar meeting ${activeMeeting.meetingName}`}
          />
        ) : null}

        <form className="modernForm" onSubmit={handleSubmit}>
          <div className="formGrid two">
            <label>
              <span>Pemimpin Rapat</span>
              <SearchableSelect
                name="pemimpinRapat"
                value={selectedLeader}
                options={leaderOptions}
                placeholder={
                  faceOptions.length === 0
                    ? "Belum ada data wajah"
                    : "Cari nama dari register wajah"
                }
                fallbackLabel={
                  selectedLeader && !selectedLeaderExists
                    ? selectedLeader
                    : undefined
                }
                emptyText="Nama tidak ditemukan. Daftarkan wajah terlebih dahulu."
              />
              {faceOptions.length === 0 ? (
                <span className="muted small">
                  Daftarkan wajah terlebih dahulu di menu Data Wajah.
                </span>
              ) : null}
            </label>
            <label>
              <span>Notulen</span>
              <input
                name="notulis"
                defaultValue={value(
                  activeMeeting.runForm?.notulis || activeMeeting.notulis,
                )}
              />
            </label>
          </div>

          <label>
            <span>Agenda Rapat</span>
            <textarea
              name="agendaRapat"
              rows={4}
              defaultValue={value(
                activeMeeting.runForm?.agendaRapat || activeMeeting.agendaRapat,
              )}
            />
          </label>

          <label>
            <span>Hasil Rapat</span>
            <textarea
              name="hasilRapat"
              rows={5}
              defaultValue={value(
                activeMeeting.runForm?.hasilRapat || activeMeeting.hasilRapat,
              )}
              placeholder="Tuliskan keputusan atau kesepakatan"
            />
          </label>

          <label>
            <span>Tindak Lanjut</span>
            <textarea
              name="tindakLanjut"
              rows={4}
              defaultValue={value(
                activeMeeting.runForm?.tindakLanjut ||
                  activeMeeting.tindakLanjut,
              )}
              placeholder="PIC, target waktu, atau pekerjaan lanjutan"
            />
          </label>

          <label>
            <span>Status Meeting</span>
            <select
              name="status"
              defaultValue={
                activeMeeting.status === "closed" ? "closed" : "active"
              }
            >
              <option value="active">Aktif atau masih berjalan</option>
              <option value="closed">Selesai dan tutup meeting</option>
            </select>
          </label>

          <div className="formActions">
            <button type="submit" className="primaryButton" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan Form Meeting"}
            </button>
            <span className="muted small">
              Update terakhir {formatDate(activeMeeting.updatedAt)}
            </span>
          </div>
        </form>

        <div className="adminMeetingPresenceBlock">
          {isClosed ? (
            <div className="inlineAlert warning">
              Meeting sudah ditutup. Absensi wajah tidak tersedia.
            </div>
          ) : (
            <CameraAttendance
              meetingId={activeMeeting.meetingId}
              variant="embedded"
            />
          )}

          <PresenceListLive meetingId={activeMeeting.meetingId} allowDelete />
        </div>
      </section>
    </main>
  );
}
