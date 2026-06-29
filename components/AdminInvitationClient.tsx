"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SearchableMultiSelect, SearchableSelect, type LookupOption } from "@/components/SearchLookup";
import type { MeetingInfoForm } from "@/lib/firebase/schema";
import { useToast } from "@/components/ToastProvider";

type FacePersonOption = {
  name: string;
  nameKey: string;
  jabatan?: string;
  prodi?: string;
};

type ProdiOption = {
  prodiId: string;
  kode?: string;
  nama: string;
  displayName: string;
  jenjang?: string;
  jurusan?: string;
};

type AdminInvitationClientProps = {
  initialInvitations: MeetingInfoForm[];
  todayDateKey: string;
  faceOptions: FacePersonOption[];
  prodiOptions: ProdiOption[];
  listMonth: string;
  currentPage: number;
  pageSize: number;
  totalCount: number;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function formatDate(value?: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function isSchedulePast(dateKey: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const millis = new Date(`${dateKey}T${safeTime}:00`).getTime();
  return Number.isFinite(millis) && millis < Date.now();
}

function formatMonthLabel(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return "Bulan berjalan";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function paginationHref(basePath: string, monthKey: string, page: number) {
  return `${basePath}?month=${encodeURIComponent(monthKey)}&page=${page}`;
}

function statusLabel(value?: string) {
  if (value === "started") return "Sudah jadi meeting";
  if (value === "scheduled") return "Terjadwal";
  if (value === "cancelled") return "Dibatalkan";
  return value || "Terjadwal";
}

function personLabel(face: FacePersonOption) {
  const detail = [face.jabatan, face.prodi].filter(Boolean).join(" • ");
  return detail ? `${face.name} - ${detail}` : face.name;
}

function prodiLabel(prodi: ProdiOption) {
  return prodi.displayName || (prodi.kode ? `${prodi.kode} - ${prodi.nama}` : prodi.nama);
}

function value(value?: string | null) {
  return value || "";
}

function toLeaderOptions(faces: FacePersonOption[]): LookupOption[] {
  return faces.map((face) => ({
    value: face.name,
    label: face.name,
    description: [face.jabatan, face.prodi].filter(Boolean).join(" • "),
    searchText: personLabel(face),
  }));
}

function toProdiOptions(prodiOptions: ProdiOption[]): LookupOption[] {
  return prodiOptions.map((prodi) => ({
    value: prodi.prodiId,
    label: prodiLabel(prodi),
    description: [prodi.jenjang, prodi.jurusan].filter(Boolean).join(" • "),
    searchText: [prodi.kode, prodi.nama, prodi.displayName, prodi.jenjang, prodi.jurusan].filter(Boolean).join(" "),
  }));
}

function readSelectedProdi(formElement: HTMLFormElement, prodiOptions: ProdiOption[]) {
  const selectedIds = new FormData(formElement)
    .getAll("prodiIds")
    .map((item) => String(item).trim())
    .filter(Boolean);

  const selectedNames = selectedIds
    .map((prodiId) => prodiOptions.find((item) => item.prodiId === prodiId))
    .filter((item): item is ProdiOption => Boolean(item))
    .map(prodiLabel);

  return {
    prodiIds: selectedIds,
    prodiNames: selectedNames,
    prodiText: selectedNames.join(", "),
  };
}

export default function AdminInvitationClient({
  initialInvitations,
  todayDateKey,
  faceOptions,
  prodiOptions,
  listMonth,
  currentPage,
  pageSize,
  totalCount,
}: AdminInvitationClientProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [totalItems, setTotalItems] = useState(totalCount);
  const [editingInvitation, setEditingInvitation] = useState<MeetingInfoForm | null>(null);
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });
  const [startingId, setStartingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
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

  const isSaving = state.status === "saving";
  const isEditing = Boolean(editingInvitation);
  const defaultNoDokumen = useMemo(() => `UND-${todayDateKey.replaceAll("-", "")}`, [todayDateKey]);
  const leaderOptions = useMemo(() => toLeaderOptions(faceOptions), [faceOptions]);
  const lookupProdiOptions = useMemo(() => toProdiOptions(prodiOptions), [prodiOptions]);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const monthLabel = formatMonthLabel(listMonth);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    try {
      setState({ status: "saving", message: isEditing ? "Memperbarui undangan..." : "Menyimpan undangan..." });

      const formData = new FormData(formElement);
      const prodiSelection = readSelectedProdi(formElement, prodiOptions);
      const tanggalKey = getString(formData, "tanggalKey");
      const waktuMulai = getString(formData, "waktuMulai");

      if (isSchedulePast(tanggalKey, waktuMulai)) {
        throw new Error("Waktu undangan tidak boleh mundur dari waktu sekarang.");
      }

      const payload = {
        noDokumen: getString(formData, "noDokumen"),
        meetingName: getString(formData, "meetingName"),
        topikRapat: getString(formData, "topikRapat"),
        agendaRapat: getString(formData, "agendaRapat"),
        tanggalKey,
        tempat: getString(formData, "tempat"),
        waktuMulai,
        waktuSelesai: getString(formData, "waktuSelesai"),
        pemimpinRapat: getString(formData, "pemimpinRapat"),
        notulis: getString(formData, "notulis"),
        ...prodiSelection,
        pesertaText: editingInvitation?.pesertaText || "",
        catatan: getString(formData, "catatan"),
        status: getString(formData, "status") || "scheduled",
      };

      const url = editingInvitation ? `/api/invitations/${encodeURIComponent(editingInvitation.formId)}` : "/api/invitations";
      const method = editingInvitation ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Undangan gagal disimpan.");
      }

      if (editingInvitation) {
        setInvitations((current) => current.map((item) => item.formId === editingInvitation.formId ? data.invitation : item));
        setState({ status: "success", message: "Undangan berhasil diperbarui." });
      } else {
        const nextInvitation = data.invitation as MeetingInfoForm;
        const isCurrentMonth = (nextInvitation.meetingDateKey || "").slice(0, 7) === listMonth;
        if (isCurrentMonth && currentPage === 1) {
          setInvitations((current) => [nextInvitation, ...current].slice(0, pageSize));
        }
        if (isCurrentMonth) setTotalItems((current) => current + 1);
        setState({ status: "success", message: "Undangan berhasil disimpan." });
      }

      setEditingInvitation(null);
      formElement.reset();
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Undangan gagal disimpan." });
    }
  }

  async function startMeeting(formId: string) {
    try {
      setStartingId(formId);
      setState({ status: "saving", message: "Membuat meeting dari undangan..." });

      const response = await fetch(`/api/invitations/${encodeURIComponent(formId)}/start-meeting`, { method: "POST" });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Meeting gagal dibuat.");
      }

      setInvitations((current) => current.map((item) => item.formId === formId ? { ...item, status: "started", meetingId: data.meeting.meetingId } : item));
      setState({ status: "success", message: "Meeting berhasil dibuat dari undangan." });
      window.location.href = `/admin/meeting/${encodeURIComponent(data.meeting.meetingId)}`;
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Meeting gagal dibuat." });
    } finally {
      setStartingId("");
    }
  }

  async function deleteInvitation(formId: string) {
    if (!window.confirm("Hapus undangan ini? Data yang dihapus tidak bisa dikembalikan.")) return;

    try {
      setDeletingId(formId);
      const response = await fetch(`/api/invitations/${encodeURIComponent(formId)}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Undangan gagal dihapus.");
      }

      setInvitations((current) => current.filter((item) => item.formId !== formId));
      setTotalItems((current) => Math.max(0, current - 1));
      if (editingInvitation?.formId === formId) setEditingInvitation(null);
      setState({ status: "success", message: "Undangan berhasil dihapus." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Undangan gagal dihapus." });
    } finally {
      setDeletingId("");
    }
  }

  const formKey = editingInvitation?.formId || "new-invitation";
  const selectedLeader = value(editingInvitation?.pemimpinRapat);
  const selectedLeaderExists = selectedLeader && faceOptions.some((face) => face.name === selectedLeader);
  const selectedProdiIds = editingInvitation?.prodiIds || [];

  return (
    <main className="appShell">
      <section className="heroPanel compactHero">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Admin Undangan</p>
            <h1 className="heroTitle">Register Undangan</h1>
            <p className="heroSubtitle">Buat, edit, hapus, cetak PDF, dan mulai meeting dari data undangan.</p>
          </div>
          <div className="heroMetric">
            <strong>{invitations.length}</strong>
            <span>Total undangan</span>
          </div>
        </div>
      </section>

      <section className="formPanel adminFormPanel">
        <div className="sectionTitleRow noMargin">
          <div>
            <p className="eyebrow">Form Undangan</p>
            <h2>{isEditing ? "Edit Undangan" : "Data Undangan Meeting"}</h2>
          </div>
          <div className="formActions">
            {isEditing ? <button type="button" className="ghostButton small" onClick={() => setEditingInvitation(null)}>Batal Edit</button> : null}
            <Link href="/admin/meeting" className="ghostButton small">Buka Meeting</Link>
          </div>
        </div>

        <form key={formKey} className="modernForm" onSubmit={handleSubmit}>
          <div className="formGrid two">
            <label>
              <span>No Dokumen</span>
              <input name="noDokumen" defaultValue={editingInvitation?.noDokumen || defaultNoDokumen} placeholder="UND-20260623" />
            </label>
            <label>
              <span>Tanggal</span>
              <input name="tanggalKey" type="date" min={todayDateKey} defaultValue={editingInvitation?.meetingDateKey || todayDateKey} required />
            </label>
          </div>

          <label>
            <span>Nama Meeting</span>
            <input name="meetingName" defaultValue={editingInvitation?.meetingName || ""} placeholder="Rapat koordinasi program studi" required />
          </label>

          <label>
            <span>Topik Rapat</span>
            <input name="topikRapat" defaultValue={editingInvitation?.topikRapat || ""} placeholder="Evaluasi pembelajaran dan rencana tindak lanjut" />
          </label>

          <label>
            <span>Prodi yang Diundang</span>
            <SearchableMultiSelect
              name="prodiIds"
              values={selectedProdiIds}
              options={lookupProdiOptions}
              placeholder="Cari prodi lalu pilih satu atau lebih"
              emptyText="Prodi tidak ditemukan. Isi Master Prodi dulu."
            />
            <span className="muted small">Klik kolom pencarian untuk menambah prodi. Pilihan bisa lebih dari satu.</span>
          </label>

          <div className="formGrid two">
            <label>
              <span>Waktu Mulai</span>
              <input name="waktuMulai" type="time" defaultValue={editingInvitation?.waktuMulai || "09:00"} required />
            </label>
            <label>
              <span>Waktu Selesai</span>
              <input name="waktuSelesai" type="time" defaultValue={editingInvitation?.waktuSelesai || "10:00"} />
            </label>
          </div>

          <div className="formGrid two">
            <label>
              <span>Tempat</span>
              <input name="tempat" defaultValue={editingInvitation?.tempat || ""} placeholder="Ruang Rapat" />
            </label>
            <label>
              <span>Pemimpin Rapat</span>
              <SearchableSelect
                name="pemimpinRapat"
                value={selectedLeader}
                options={leaderOptions}
                placeholder={faceOptions.length === 0 ? "Belum ada data wajah" : "Cari nama dari register wajah"}
                fallbackLabel={selectedLeader && !selectedLeaderExists ? selectedLeader : undefined}
                emptyText="Nama tidak ditemukan. Daftarkan wajah terlebih dahulu."
              />
              {faceOptions.length === 0 ? <span className="muted small">Daftarkan wajah terlebih dahulu di menu Data Wajah.</span> : null}
            </label>
          </div>

          <label>
            <span>Notulen</span>
            <input name="notulis" defaultValue={editingInvitation?.notulis || ""} placeholder="Notulen" />
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={editingInvitation?.status || "scheduled"}>
              <option value="scheduled">Terjadwal</option>
              <option value="started">Sudah jadi meeting</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </label>

          <label>
            <span>Agenda Rapat</span>
            <textarea name="agendaRapat" rows={4} defaultValue={editingInvitation?.agendaRapat || ""} placeholder="Tuliskan agenda utama rapat" />
          </label>

          <label>
            <span>Catatan</span>
            <textarea name="catatan" rows={3} defaultValue={editingInvitation?.catatan || ""} placeholder="Catatan tambahan" />
          </label>

          <div className="formActions">
            <button type="submit" className="primaryButton" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : isEditing ? "Update Undangan" : "Simpan Undangan"}
            </button>
          </div>
        </form>
      </section>

      <section className="contentSection">
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">Riwayat Undangan</p>
            <h2>Undangan Bulan {monthLabel}</h2>
          </div>
          <span className="counterPill">{totalItems} data</span>
        </div>

        <form className="listFilterBar" action="/admin/undangan" method="get">
          <label>
            <span>Bulan</span>
            <input name="month" type="month" defaultValue={listMonth} />
          </label>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="ghostButton small">Tampilkan</button>
        </form>

        {invitations.length === 0 ? (
          <div className="emptyState modernEmpty">
            <div className="emptyIcon">✉️</div>
            <h2>Belum ada undangan</h2>
            <p className="muted">Gunakan form di atas untuk membuat undangan pertama.</p>
          </div>
        ) : (
          <div className="meetingGrid">
            {invitations.map((invitation) => (
              <article key={invitation.formId} className="meetingCard staticCard">
                <div className="cardTopline">
                  <span className="badge active">{statusLabel(invitation.status)}</span>
                  <span className="presenceChip">{invitation.noDokumen || "Tanpa nomor"}</span>
                </div>
                <h3>{invitation.meetingName}</h3>
                {invitation.topikRapat ? <p className="topic">{invitation.topikRapat}</p> : null}
                <div className="meetingInfoGrid">
                  <div className="infoTile">
                    <span>Tanggal</span>
                    <strong>{invitation.hari ? `${invitation.hari}, ` : ""}{invitation.tanggal || "-"}</strong>
                  </div>
                  <div className="infoTile">
                    <span>Waktu</span>
                    <strong>{invitation.waktu || "-"}</strong>
                  </div>
                  <div className="infoTile full">
                    <span>Prodi</span>
                    <strong>{invitation.prodiText || invitation.prodiNames?.join(", ") || "-"}</strong>
                  </div>
                  <div className="infoTile full">
                    <span>Tempat</span>
                    <strong>{invitation.tempat || "-"}</strong>
                  </div>
                </div>
                <div className="meetingCardActions wrapActions">
                  {invitation.meetingId ? (
                    <Link href={`/admin/meeting/${encodeURIComponent(invitation.meetingId)}`} className="primaryButton small">Kelola Meeting</Link>
                  ) : (
                    <button type="button" className="primaryButton small" onClick={() => startMeeting(invitation.formId)} disabled={startingId === invitation.formId}>
                      {startingId === invitation.formId ? "Memulai..." : "Mulai Meeting"}
                    </button>
                  )}
                  <a href={`/api/export/invitations/${encodeURIComponent(invitation.formId)}`} className="ghostButton small" target="_blank" rel="noreferrer">Export PDF</a>
                  <button type="button" className="ghostButton small" onClick={() => setEditingInvitation(invitation)}>Edit</button>
                  <button type="button" className="dangerButton small" onClick={() => deleteInvitation(invitation.formId)} disabled={deletingId === invitation.formId}>
                    {deletingId === invitation.formId ? "Menghapus..." : "Hapus"}
                  </button>
                  <span className="muted small">Update {formatDate(invitation.updatedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="paginationBar">
          <Link className={currentPage <= 1 ? "ghostButton small disabledLink" : "ghostButton small"} href={paginationHref("/admin/undangan", listMonth, Math.max(1, currentPage - 1))}>Sebelumnya</Link>
          <span>Halaman {currentPage} dari {totalPages}</span>
          <Link className={currentPage >= totalPages ? "ghostButton small disabledLink" : "ghostButton small"} href={paginationHref("/admin/undangan", listMonth, Math.min(totalPages, currentPage + 1))}>Berikutnya</Link>
        </div>
      </section>
    </main>
  );
}