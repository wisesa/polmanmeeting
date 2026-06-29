"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SearchableMultiSelect,
  SearchableSelect,
  type LookupOption,
} from "@/components/SearchLookup";
import type { Meeting } from "@/lib/firebase/schema";
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

type MeetingInvitationOption = {
  formId: string;
  noDokumen?: string;
  meetingName: string;
  topikRapat?: string;
  agendaRapat?: string;
  meetingDateKey?: string;
  tanggal?: string;
  hari?: string;
  tempat?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  waktu?: string;
  pemimpinRapat?: string;
  notulis?: string;
  prodiIds?: string[];
  prodiNames?: string[];
  prodiText?: string;
  pesertaText?: string;
  catatan?: string;
  meetingDate?: number;
};

type AdminMeetingClientProps = {
  initialMeetings: Meeting[];
  todayDateKey: string;
  faceOptions: FacePersonOption[];
  prodiOptions: ProdiOption[];
  invitationOptions: MeetingInvitationOption[];
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

function statusLabel(value?: string) {
  if (value === "closed") return "Selesai";
  return "Aktif";
}

function formatDate(value?: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function paginationHref(basePath: string, monthKey: string, page: number) {
  return `${basePath}?month=${encodeURIComponent(monthKey)}&page=${page}`;
}

function personLabel(face: FacePersonOption) {
  const detail = [face.jabatan, face.prodi].filter(Boolean).join(" • ");
  return detail ? `${face.name} - ${detail}` : face.name;
}

function prodiLabel(prodi: ProdiOption) {
  return (
    prodi.displayName ||
    (prodi.kode ? `${prodi.kode} - ${prodi.nama}` : prodi.nama)
  );
}

function invitationLabel(invitation: MeetingInvitationOption) {
  const dateText =
    invitation.tanggal || invitation.meetingDateKey || "Tanpa tanggal";
  const numberText = invitation.noDokumen ? `${invitation.noDokumen} • ` : "";
  return `${numberText}${dateText} • ${invitation.meetingName}`;
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
    searchText: [
      prodi.kode,
      prodi.nama,
      prodi.displayName,
      prodi.jenjang,
      prodi.jurusan,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

function readSelectedProdi(
  formElement: HTMLFormElement,
  prodiOptions: ProdiOption[],
) {
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

export default function AdminMeetingClient({
  initialMeetings,
  todayDateKey,
  faceOptions,
  prodiOptions,
  invitationOptions,
  listMonth,
  currentPage,
  pageSize,
  totalCount,
}: AdminMeetingClientProps) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [totalItems, setTotalItems] = useState(totalCount);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [selectedInvitationId, setSelectedInvitationId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [removeMeetingImage, setRemoveMeetingImage] = useState(false);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<SaveState>({
    status: "idle",
    message: "",
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

  useEffect(() => {
    setRemoveMeetingImage(false);
    setSelectedImageName("");
    setSelectedImagePreviewUrl("");
    setCameraError("");
    stopCamera();
  }, [editingMeeting?.meetingId, selectedInvitationId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!selectedImagePreviewUrl) return;
    return () => URL.revokeObjectURL(selectedImagePreviewUrl);
  }, [selectedImagePreviewUrl]);

  const isSaving = state.status === "saving";
  const isEditing = Boolean(editingMeeting);
  const activeCount = meetings.filter(
    (meeting) => (meeting.status || "active") !== "closed",
  ).length;
  const leaderOptions = useMemo(
    () => toLeaderOptions(faceOptions),
    [faceOptions],
  );
  const lookupProdiOptions = useMemo(
    () => toProdiOptions(prodiOptions),
    [prodiOptions],
  );
  const selectedInvitation = useMemo(
    () =>
      invitationOptions.find((item) => item.formId === selectedInvitationId) ||
      null,
    [invitationOptions, selectedInvitationId],
  );
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const monthLabel = formatMonthLabel(listMonth);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    try {
      setState({
        status: "saving",
        message: isEditing ? "Memperbarui meeting..." : "Menyimpan meeting...",
      });

      const formData = new FormData(formElement);
      const prodiSelection = readSelectedProdi(formElement, prodiOptions);
      const tanggalKey = getString(formData, "tanggalKey");
      const waktuMulai = getString(formData, "waktuMulai");

      if (isSchedulePast(tanggalKey, waktuMulai)) {
        throw new Error(
          "Waktu meeting tidak boleh mundur dari waktu sekarang.",
        );
      }

      formData.set("tanggalKey", tanggalKey);
      formData.set("prodiText", prodiSelection.prodiText);
      formData.delete("prodiNames");
      prodiSelection.prodiNames.forEach((name) =>
        formData.append("prodiNames", name),
      );
      formData.set("status", getString(formData, "status") || "active");
      formData.set(
        "sourceInvitationFormId",
        isEditing
          ? editingMeeting?.sourceInvitationFormId || ""
          : selectedInvitationId,
      );

      if (isEditing && removeMeetingImage) {
        formData.set("deleteMeetingImage", "1");
      } else {
        formData.delete("deleteMeetingImage");
      }

      const url = editingMeeting
        ? `/api/meetings/${encodeURIComponent(editingMeeting.meetingId)}`
        : "/api/meetings";
      const method = editingMeeting ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Meeting gagal disimpan.");
      }

      if (editingMeeting) {
        setMeetings((current) =>
          current.map((item) =>
            item.meetingId === editingMeeting.meetingId ? data.meeting : item,
          ),
        );
        setState({
          status: "success",
          message: "Meeting berhasil diperbarui.",
        });
      } else {
        const nextMeeting = data.meeting as Meeting;
        const isCurrentMonth =
          (nextMeeting.meetingDateKey || "").slice(0, 7) === listMonth;
        if (isCurrentMonth && currentPage === 1) {
          setMeetings((current) =>
            [nextMeeting, ...current].slice(0, pageSize),
          );
        }
        if (isCurrentMonth) setTotalItems((current) => current + 1);
        setState({
          status: "success",
          message: selectedInvitationId
            ? "Meeting berhasil dibuat dari undangan."
            : "Meeting berhasil dibuat.",
        });
      }

      setEditingMeeting(null);
      setSelectedInvitationId("");
      setRemoveMeetingImage(false);
      setMeetingImageFile(null);
      stopCamera();
      formElement.reset();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Meeting gagal disimpan.",
      });
    }
  }

  async function deleteMeeting(meetingId: string) {
    if (!window.confirm("Hapus meeting ini beserta daftar presensinya?"))
      return;

    try {
      setDeletingId(meetingId);
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Meeting gagal dihapus.");
      }

      setMeetings((current) =>
        current.filter((item) => item.meetingId !== meetingId),
      );
      setTotalItems((current) => Math.max(0, current - 1));
      if (editingMeeting?.meetingId === meetingId) {
        setEditingMeeting(null);
        setRemoveMeetingImage(false);
        setMeetingImageFile(null);
        stopCamera();
      }
      setState({ status: "success", message: "Meeting berhasil dihapus." });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Meeting gagal dihapus.",
      });
    } finally {
      setDeletingId("");
    }
  }

  const sourceNoDokumen =
    editingMeeting?.noDokumen || selectedInvitation?.noDokumen || "";
  const sourceDateKey =
    editingMeeting?.meetingDateKey ||
    selectedInvitation?.meetingDateKey ||
    todayDateKey;
  const sourceMeetingName =
    editingMeeting?.meetingName || selectedInvitation?.meetingName || "";
  const sourceTopik =
    editingMeeting?.topikRapat || selectedInvitation?.topikRapat || "";
  const sourceAgenda =
    editingMeeting?.agendaRapat ||
    editingMeeting?.runForm?.agendaRapat ||
    selectedInvitation?.agendaRapat ||
    "";
  const sourceWaktuMulai =
    editingMeeting?.waktuMulai || selectedInvitation?.waktuMulai || "09:00";
  const sourceWaktuSelesai =
    editingMeeting?.waktuSelesai || selectedInvitation?.waktuSelesai || "10:00";
  const sourceTempat =
    editingMeeting?.tempat || selectedInvitation?.tempat || "";
  const selectedLeader = value(
    editingMeeting?.pemimpinRapat ||
      editingMeeting?.runForm?.pemimpinRapat ||
      selectedInvitation?.pemimpinRapat,
  );
  const selectedLeaderExists =
    selectedLeader && faceOptions.some((face) => face.name === selectedLeader);
  const sourceNotulis =
    editingMeeting?.notulis ||
    editingMeeting?.runForm?.notulis ||
    selectedInvitation?.notulis ||
    "";
  const selectedProdiIds =
    editingMeeting?.prodiIds || selectedInvitation?.prodiIds || [];
  const sourceMeetingImageUrl = editingMeeting?.meetingImageUrl || "";
  const formKey =
    editingMeeting?.meetingId || selectedInvitationId || "new-meeting";

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
    setIsCameraStarting(false);
  }

  function setMeetingImageFile(file: File | null) {
    if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);

    setSelectedImageName(file?.name || "");
    setSelectedImagePreviewUrl(file ? URL.createObjectURL(file) : "");

    if (fileInputRef.current) {
      if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInputRef.current.files = transfer.files;
      } else {
        fileInputRef.current.value = "";
      }
    }

    if (file) setRemoveMeetingImage(false);
  }

  function handleMeetingImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setMeetingImageFile(file);
  }

  async function openCamera() {
    try {
      stopCamera();
      setCameraError("");
      setIsCameraStarting(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser tidak mendukung akses kamera langsung.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
      setIsCameraStarting(false);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (error) {
      stopCamera();
      setCameraError(
        error instanceof Error
          ? error.message
          : "Kamera tidak dapat dibuka. Periksa izin kamera browser.",
      );
    }
  }

  async function captureMeetingImage() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      setCameraError("Kamera belum siap. Coba tekan Ambil Foto sekali lagi.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Gagal mengambil gambar dari kamera.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );

    if (!blob) {
      setCameraError("Gagal membuat file gambar dari kamera.");
      return;
    }

    const file = new File([blob], `kamera-meeting-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setMeetingImageFile(file);
    stopCamera();
  }

  return (
    <main className="appShell">
      <section className="heroPanel compactHero">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Admin Meeting</p>
            <h1 className="heroTitle">Register Meeting</h1>
            <p className="heroSubtitle">
              Buat, edit, hapus, cetak PDF, dan kelola form meeting berjalan.
            </p>
          </div>
          <div className="heroMetric">
            <strong>{activeCount}</strong>
            <span>Meeting aktif</span>
          </div>
        </div>
      </section>

      <section className="formPanel adminFormPanel">
        <div className="sectionTitleRow noMargin">
          <div>
            <p className="eyebrow">Form Meeting</p>
            <h2>
              {isEditing
                ? "Edit Meeting"
                : selectedInvitation
                  ? "Buat Meeting dari Undangan"
                  : "Buat Meeting Langsung"}
            </h2>
          </div>
          <div className="formActions">
            {isEditing ? (
              <button
                type="button"
                className="ghostButton small"
                onClick={() => {
                  setEditingMeeting(null);
                  setRemoveMeetingImage(false);
                  setMeetingImageFile(null);
                  stopCamera();
                }}
              >
                Batal Edit
              </button>
            ) : null}
            {selectedInvitation && !isEditing ? (
              <button
                type="button"
                className="ghostButton small"
                onClick={() => setSelectedInvitationId("")}
              >
                Create Sendiri
              </button>
            ) : null}
            <Link href="/admin/undangan" className="ghostButton small">
              Buat Undangan
            </Link>
          </div>
        </div>

        <form key={formKey} className="modernForm" onSubmit={handleSubmit}>
          <label>
            <span>Sumber Data</span>
            <select
              value={selectedInvitationId}
              onChange={(event) => {
                setSelectedInvitationId(event.target.value);
                setEditingMeeting(null);
                setState({ status: "idle", message: "" });
              }}
              disabled={isEditing}
            >
              <option value="">Create sendiri tanpa undangan</option>
              {invitationOptions.map((invitation) => (
                <option key={invitation.formId} value={invitation.formId}>
                  {invitationLabel(invitation)}
                </option>
              ))}
            </select>
            <span className="muted small">
              Pilih undangan untuk mengisi field di bawah otomatis. Field tetap
              bisa diedit sebelum disimpan.
            </span>
          </label>

          <div className="formGrid two">
            <label>
              <span>No Dokumen</span>
              <input
                name="noDokumen"
                defaultValue={sourceNoDokumen}
                placeholder="MGT-20260623"
              />
            </label>
            <label>
              <span>Tanggal</span>
              <input
                name="tanggalKey"
                type="date"
                min={todayDateKey}
                defaultValue={sourceDateKey}
                required
              />
            </label>
          </div>

          <label>
            <span>Nama Meeting</span>
            <input
              name="meetingName"
              defaultValue={sourceMeetingName}
              placeholder="Rapat koordinasi program studi"
              required
            />
          </label>

          <label>
            <span>Topik Rapat</span>
            <input
              name="topikRapat"
              defaultValue={sourceTopik}
              placeholder="Evaluasi pembelajaran dan rencana tindak lanjut"
            />
          </label>

          <div className="meetingImageField formLikeField">
            <span>Gambar Meeting</span>
            {sourceMeetingImageUrl && !removeMeetingImage ? (
              <div className="meetingImagePreviewBox">
                <img
                  src={sourceMeetingImageUrl}
                  alt={`Gambar meeting ${sourceMeetingName || "meeting"}`}
                />
                <button
                  type="button"
                  className="dangerButton small"
                  onClick={() => setRemoveMeetingImage(true)}
                >
                  Hapus gambar lama
                </button>
              </div>
            ) : null}
            {sourceMeetingImageUrl && removeMeetingImage ? (
              <div className="inlineAlert warning">
                Gambar lama akan dihapus saat perubahan meeting disimpan.
                <button
                  type="button"
                  className="ghostButton small"
                  onClick={() => setRemoveMeetingImage(false)}
                >
                  Batal hapus
                </button>
              </div>
            ) : null}
            {selectedImagePreviewUrl ? (
              <div className="meetingImagePreviewBox newImagePreviewBox">
                <img
                  src={selectedImagePreviewUrl}
                  alt="Preview gambar meeting baru"
                />
                <span className="muted small">
                  Gambar baru siap disimpan: {selectedImageName}
                </span>
                <button
                  type="button"
                  className="ghostButton small"
                  onClick={() => setMeetingImageFile(null)}
                >
                  Batalkan gambar baru
                </button>
              </div>
            ) : null}
            <div className="meetingImageSourceActions">
              <label className="ghostButton small filePickButton">
                Ambil dari File
                <input
                  ref={fileInputRef}
                  name="meetingImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleMeetingImageChange}
                />
              </label>
              <button
                type="button"
                className="ghostButton small"
                onClick={openCamera}
                disabled={isCameraStarting}
              >
                {isCameraStarting ? "Membuka Kamera..." : "Ambil dari Kamera"}
              </button>
            </div>
            {isCameraOpen ? (
              <div className="meetingCameraBox">
                <video ref={videoRef} playsInline muted />
                <canvas ref={canvasRef} className="hiddenCanvas" />
                <div className="meetingImageSourceActions">
                  <button
                    type="button"
                    className="primaryButton small"
                    onClick={captureMeetingImage}
                  >
                    Ambil Foto
                  </button>
                  <button
                    type="button"
                    className="ghostButton small"
                    onClick={stopCamera}
                  >
                    Tutup Kamera
                  </button>
                </div>
              </div>
            ) : (
              <canvas ref={canvasRef} className="hiddenCanvas" />
            )}
            {cameraError ? (
              <span className="muted small warningText">{cameraError}</span>
            ) : null}
            <span className="muted small">
              Pilih gambar dari file atau ambil foto langsung dari kamera.
              Sistem akan menyimpan hasil kompres sekitar 200 KB di folder
              public/uploads/meetings.
            </span>
          </div>

          <label>
            <span>Prodi Terkait</span>
            <SearchableMultiSelect
              name="prodiIds"
              values={selectedProdiIds}
              options={lookupProdiOptions}
              placeholder="Cari prodi lalu pilih satu atau lebih"
              emptyText="Prodi tidak ditemukan. Isi Master Prodi dulu."
            />
            <span className="muted small">
              Klik kolom pencarian untuk menambah prodi. Pilihan bisa lebih dari
              satu.
            </span>
          </label>

          <div className="formGrid two">
            <label>
              <span>Waktu Mulai</span>
              <input
                name="waktuMulai"
                type="time"
                defaultValue={sourceWaktuMulai}
                required
              />
            </label>
            <label>
              <span>Waktu Selesai</span>
              <input
                name="waktuSelesai"
                type="time"
                defaultValue={sourceWaktuSelesai}
              />
            </label>
          </div>

          <div className="formGrid two">
            <label>
              <span>Tempat</span>
              <input
                name="tempat"
                defaultValue={sourceTempat}
                placeholder="Ruang Rapat"
              />
            </label>
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
          </div>

          <label>
            <span>Notulen</span>
            <input
              name="notulis"
              defaultValue={sourceNotulis}
              placeholder="Notulen"
            />
          </label>

          <label>
            <span>Status</span>
            <select
              name="status"
              defaultValue={
                editingMeeting?.status === "closed" ? "closed" : "active"
              }
            >
              <option value="active">Aktif</option>
              <option value="closed">Selesai</option>
            </select>
          </label>

          <label>
            <span>Agenda Rapat</span>
            <textarea
              name="agendaRapat"
              rows={4}
              defaultValue={sourceAgenda}
              placeholder="Tuliskan agenda awal rapat"
            />
          </label>

          <button type="submit" className="primaryButton" disabled={isSaving}>
            {isSaving
              ? "Menyimpan..."
              : isEditing
                ? "Update Meeting"
                : "Simpan Meeting"}
          </button>
        </form>
      </section>

      <section className="contentSection">
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">Daftar Meeting</p>
            <h2>Meeting Bulan {monthLabel}</h2>
          </div>
          <span className="counterPill">{totalItems} data</span>
        </div>

        <form className="listFilterBar" action="/admin/meeting" method="get">
          <label>
            <span>Bulan</span>
            <input name="month" type="month" defaultValue={listMonth} />
          </label>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="ghostButton small">
            Tampilkan
          </button>
        </form>

        {meetings.length === 0 ? (
          <div className="emptyState modernEmpty">
            <div className="emptyIcon">📝</div>
            <h2>Belum ada meeting</h2>
            <p className="muted">
              Buat meeting langsung atau ambil data dari undangan.
            </p>
          </div>
        ) : (
          <div className="meetingGrid">
            {meetings.map((meeting) => {
              const isClosed = meeting.status === "closed";
              return (
                <article
                  key={meeting.meetingId}
                  className="meetingCard staticCard"
                >
                  <div className="cardTopline">
                    <span
                      className={isClosed ? "badge closed" : "badge active"}
                    >
                      {statusLabel(meeting.status)}
                    </span>
                    <span className="presenceChip">
                      {meeting.participantsCount || 0} hadir
                    </span>
                  </div>
                  {meeting.meetingImageUrl ? (
                    <img
                      className="meetingCardImage"
                      src={meeting.meetingImageUrl}
                      alt={`Gambar meeting ${meeting.meetingName}`}
                    />
                  ) : null}
                  <h3>{meeting.meetingName}</h3>
                  {meeting.topikRapat ? (
                    <p className="topic">{meeting.topikRapat}</p>
                  ) : null}
                  <div className="meetingInfoGrid">
                    <div className="infoTile">
                      <span>Tanggal</span>
                      <strong>
                        {meeting.hari ? `${meeting.hari}, ` : ""}
                        {meeting.tanggal || meeting.meetingDateKey || "-"}
                      </strong>
                    </div>
                    <div className="infoTile">
                      <span>Waktu</span>
                      <strong>{meeting.waktu || "-"}</strong>
                    </div>
                    <div className="infoTile full">
                      <span>Prodi</span>
                      <strong>
                        {meeting.prodiText ||
                          meeting.prodiNames?.join(", ") ||
                          "-"}
                      </strong>
                    </div>
                    <div className="infoTile full">
                      <span>Tempat</span>
                      <strong>{meeting.tempat || "-"}</strong>
                    </div>
                  </div>
                  <div className="meetingCardActions wrapActions">
                    <Link
                      href={`/admin/meeting/${encodeURIComponent(meeting.meetingId)}`}
                      className="primaryButton small"
                    >
                      Form Meeting
                    </Link>
                    <Link
                      href={`/meeting/${encodeURIComponent(meeting.meetingId)}`}
                      className="ghostButton small"
                    >
                      Presensi
                    </Link>
                    <a
                      href={`/api/export/meetings/${encodeURIComponent(meeting.meetingId)}`}
                      className="ghostButton small"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Export PDF
                    </a>
                    <button
                      type="button"
                      className="ghostButton small"
                      onClick={() => {
                        setEditingMeeting(meeting);
                        setSelectedInvitationId("");
                        setRemoveMeetingImage(false);
                        setMeetingImageFile(null);
                        stopCamera();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="dangerButton small"
                      onClick={() => deleteMeeting(meeting.meetingId)}
                      disabled={deletingId === meeting.meetingId}
                    >
                      {deletingId === meeting.meetingId
                        ? "Menghapus..."
                        : "Hapus"}
                    </button>
                    <span className="muted small">
                      Update {formatDate(meeting.updatedAt)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="paginationBar">
          <Link
            className={
              currentPage <= 1
                ? "ghostButton small disabledLink"
                : "ghostButton small"
            }
            href={paginationHref(
              "/admin/meeting",
              listMonth,
              Math.max(1, currentPage - 1),
            )}
          >
            Sebelumnya
          </Link>
          <span>
            Halaman {currentPage} dari {totalPages}
          </span>
          <Link
            className={
              currentPage >= totalPages
                ? "ghostButton small disabledLink"
                : "ghostButton small"
            }
            href={paginationHref(
              "/admin/meeting",
              listMonth,
              Math.min(totalPages, currentPage + 1),
            )}
          >
            Berikutnya
          </Link>
        </div>
      </section>
    </main>
  );
}
