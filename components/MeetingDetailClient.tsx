"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CameraAttendance from "@/components/CameraAttendance";
import { prepareMeetingImageFile, prepareMeetingImageFromCanvas } from "@/components/meeting-image-client";
import { useToast } from "@/components/ToastProvider";

type AnyRecord = Record<string, unknown>;

type MeetingDetailClientProps = {
  meetingId: string;
  initialMeeting: AnyRecord | null;
  initialPresences: AnyRecord[];
  backHref?: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  meetingId: string;
  meeting: AnyRecord | null;
  presences: AnyRecord[];
  updatedAt: number;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
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
    const values = meeting.prodiNames
      .map((item) => stringValue(item))
      .filter(Boolean);
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
    [
      stringValue(presence.jabatan),
      stringValue(presence.prodiName) || stringValue(presence.prodi),
    ]
      .filter(Boolean)
      .join(" • ") ||
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

function dataUrlFromBase64(base64: unknown, mimeType: unknown = "image/jpeg") {
  const cleanBase64 = stringValue(base64);
  if (!cleanBase64) return "";
  if (cleanBase64.startsWith("data:")) return cleanBase64;
  const cleanMimeType = stringValue(mimeType, "image/jpeg");
  return `data:${cleanMimeType || "image/jpeg"};base64,${cleanBase64}`;
}

function getPresenceFaceSrc(presence: AnyRecord) {
  return dataUrlFromBase64(
    presence.faceThumbnailBase64,
    presence.faceThumbnailMimeType || "image/jpeg",
  );
}

function getMeetingFormValue(meeting: AnyRecord | null, key: string) {
  if (!meeting) return "";
  const runForm = recordValue(meeting.runForm);
  return stringValue(runForm[key]) || stringValue(meeting[key]);
}

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
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
  backHref = "/dosen/meeting",
}: MeetingDetailClientProps) {
  const [meeting, setMeeting] = useState<AnyRecord | null>(initialMeeting);
  const [presences, setPresences] = useState<AnyRecord[]>(
    Array.isArray(initialPresences) ? initialPresences : [],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [removeMeetingImage, setRemoveMeetingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const toast = useToast();
  const lastErrorToastRef = useRef("");

  useEffect(() => {
    if (!errorMessage || errorMessage === lastErrorToastRef.current) return;
    lastErrorToastRef.current = errorMessage;
    toast.error("Gagal memuat presensi", errorMessage);
  }, [errorMessage, toast]);

  useEffect(() => {
    if (!saveState.message) return;

    if (saveState.status === "success") {
      toast.success("Berhasil", saveState.message);
    }

    if (saveState.status === "error") {
      toast.error("Gagal", saveState.message);
    }
  }, [saveState.message, saveState.status, toast]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!selectedImagePreviewUrl) return;
    return () => URL.revokeObjectURL(selectedImagePreviewUrl);
  }, [selectedImagePreviewUrl]);

  const sortedPresences = useMemo(() => sortPresences(presences), [presences]);

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOpen(false);
    setIsCameraStarting(false);
  }

  function setMeetingImageFile(file: File | null) {
    if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);

    setSelectedImageFile(file);
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

  async function handleMeetingImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    try {
      setCameraError("");
      const compressedFile = file ? await prepareMeetingImageFile(file) : null;
      setMeetingImageFile(compressedFile);
    } catch (error) {
      setMeetingImageFile(null);
      setCameraError(error instanceof Error ? error.message : "Gambar gagal diproses.");
    }
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

    try {
      const file = await prepareMeetingImageFromCanvas(canvas);
      setMeetingImageFile(file);
      stopCamera();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Gagal membuat file gambar dari kamera.");
    }
  }

  async function syncMeetingImageIfNeeded(currentMeeting: AnyRecord | null) {
    if (!selectedImageFile && !removeMeetingImage) return currentMeeting;

    const formData = new FormData();
    if (selectedImageFile) formData.set("meetingImage", selectedImageFile);
    if (removeMeetingImage && !selectedImageFile) {
      formData.set("deleteMeetingImage", "1");
    }

    const response = await fetch(
      `/api/meetings/${encodeURIComponent(meetingId)}`,
      { method: "PATCH", body: formData },
    );
    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      meeting?: AnyRecord | null;
    };

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Gambar meeting gagal disimpan.");
    }

    setRemoveMeetingImage(false);
    setMeetingImageFile(null);
    stopCamera();
    return data.meeting ?? currentMeeting;
  }

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
          },
        );

        const text = await response.text();

        let data: ApiResponse;

        try {
          data = JSON.parse(text) as ApiResponse;
        } catch {
          throw new Error(
            "Data terbaru belum bisa dimuat. Data terakhir tetap ditampilkan.",
          );
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
            : "Gagal memuat data presensi.",
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [meetingId],
  );

  async function handleMeetingFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSaveState({
        status: "saving",
        message: "Menyimpan perubahan notulen...",
      });

      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}/run-form`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agendaRapat: getFormString(formData, "agendaRapat"),
            hasilRapat: getFormString(formData, "hasilRapat"),
            catatan: getFormString(formData, "catatan"),
            tindakLanjut: getFormString(formData, "tindakLanjut"),
            pemimpinRapat: getFormString(formData, "pemimpinRapat"),
            notulis: getFormString(formData, "notulis"),
            status: isClosed ? "closed" : "active",
            finishedAt: isClosed
              ? numberValue(meeting?.closedAt, Date.now())
              : null,
          }),
        },
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        meeting?: AnyRecord | null;
      };

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Notulen gagal disimpan.");
      }

      const updatedMeeting = await syncMeetingImageIfNeeded(
        data.meeting ?? meeting,
      );

      if (updatedMeeting) {
        setMeeting(updatedMeeting);
        setLastUpdated(
          new Date(numberValue(updatedMeeting.updatedAt, Date.now())),
        );
      }

      setSaveState({
        status: "success",
        message:
          selectedImageFile || removeMeetingImage
            ? "Notulen dan gambar meeting berhasil diperbarui."
            : "Notulen berhasil diperbarui.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Notulen gagal disimpan.",
      });
    }
  }

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
    status.toLowerCase(),
  );
  const isSavingForm = saveState.status === "saving";
  const defaultAgendaRapat = getMeetingFormValue(meeting, "agendaRapat");
  const defaultHasilRapat = getMeetingFormValue(meeting, "hasilRapat");
  const defaultCatatan = getMeetingFormValue(meeting, "catatan");
  const defaultTindakLanjut = getMeetingFormValue(meeting, "tindakLanjut");
  const defaultPemimpinRapat = getMeetingFormValue(meeting, "pemimpinRapat");
  const defaultNotulis = getMeetingFormValue(meeting, "notulis");
  const meetingImageUrl = stringValue(meeting?.meetingImageUrl);

  return (
    <main className="meetingDetailPage">
      <div className="meetingDetailShell">
        <div className="meetingTopBar">
          <Link
            href={backHref}
            className="iconButton"
            aria-label="Kembali"
            title="Kembali"
          >
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

          <div className="meetingTopBarActions">
            <a
              href={`/api/export/meetings/${encodeURIComponent(meetingId)}`}
              className="ghostButton small"
              target="_blank"
              rel="noreferrer"
            >
              Export PDF
            </a>

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
        </div>

        <section className="meetingHeroCard meetingHeroCardWide meetingDetailV2">
          <div className="meetingDetailLeftPanel meetingDetailLeftPanelV2">
            <div className="meetingHeroContent">
              <p className="eyebrow">Detail Meeting</p>
              <h1>{title}</h1>
              <p className="meetingIdText">ID Meeting: {meetingId}</p>
              {meetingImageUrl ? (
                <img
                  className="meetingDetailImage"
                  src={meetingImageUrl}
                  alt={`Gambar meeting ${title}`}
                />
              ) : null}

              <div className="meetingInfoGridV2">
                <div className="meetingInfoCardV2 meetingInfoCardV2Full">
                  <span className="meetingInfoCardV2Label">Prodi</span>
                  <strong className="meetingInfoCardV2Value">
                    {meetingProdi}
                  </strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Status</span>
                  <strong
                    className={`meetingInfoCardV2Value ${isClosed ? "statusClosed" : "statusActive"}`}
                  >
                    {status}
                  </strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Waktu</span>
                  <strong className="meetingInfoCardV2Value">
                    {meetingTime}
                  </strong>
                </div>

                <div className="meetingInfoCardV2 meetingInfoCardV2Highlight">
                  <span className="meetingInfoCardV2Label">Hadir</span>
                  <strong className="meetingInfoCardV2Value">
                    {sortedPresences.length} peserta
                  </strong>
                </div>

                <div className="meetingInfoCardV2">
                  <span className="meetingInfoCardV2Label">Update</span>
                  <strong className="meetingInfoCardV2Value">
                    {formatUpdateTime(lastUpdated)}
                  </strong>
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

        <section className="meetingEditSection">
          <div className="presencePanel meetingEditPanel">
            <div className="presencePanelHeader">
              <div>
                <p className="eyebrow">Form Meeting</p>
                <h2>Edit Notulen</h2>
                <p className="muted">
                  Dosen dapat memperbarui pemimpin rapat, notulen, agenda, hasil
                  rapat, dan tindak lanjut.
                </p>
              </div>
            </div>

            <form
              className="modernForm meetingEditForm"
              onSubmit={handleMeetingFormSubmit}
            >
              <div className="meetingImageField formLikeField">
                <span>Gambar Meeting</span>
                {meetingImageUrl && !removeMeetingImage ? (
                  <div className="meetingImagePreviewBox">
                    <img
                      src={meetingImageUrl}
                      alt={`Gambar meeting ${title}`}
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
                {meetingImageUrl && removeMeetingImage ? (
                  <div className="inlineAlert warning">
                    Gambar lama akan dihapus saat form meeting disimpan.
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
                    {isCameraStarting
                      ? "Membuka Kamera..."
                      : "Ambil dari Kamera"}
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
                  Gambar dapat diambil dari file atau kamera. Sistem akan
                  mengompres gambar sekitar 200 KB dan menyimpannya ke
                  Firebase Storage.
                </span>
              </div>

              <div className="formGrid two">
                <label>
                  <span>Pemimpin Rapat</span>
                  <input
                    name="pemimpinRapat"
                    defaultValue={defaultPemimpinRapat}
                    placeholder="Nama pemimpin rapat"
                  />
                </label>
                <label>
                  <span>Notulen</span>
                  <input
                    name="notulis"
                    defaultValue={defaultNotulis}
                    placeholder="Notulen"
                  />
                </label>
              </div>

              <label>
                <span>Agenda Rapat</span>
                <textarea
                  name="agendaRapat"
                  rows={3}
                  defaultValue={defaultAgendaRapat}
                  placeholder="Tuliskan agenda rapat"
                />
              </label>

              <label>
                <span>Hasil Rapat</span>
                <textarea
                  name="hasilRapat"
                  rows={4}
                  defaultValue={defaultHasilRapat}
                  placeholder="Tuliskan keputusan atau kesepakatan"
                />
              </label>

              <label>
                <span>Catatan</span>
                <textarea
                  name="catatan"
                  rows={3}
                  defaultValue={defaultCatatan}
                  placeholder="Catatan tambahan selama meeting"
                />
              </label>

              <label>
                <span>Tindak Lanjut</span>
                <textarea
                  name="tindakLanjut"
                  rows={3}
                  defaultValue={defaultTindakLanjut}
                  placeholder="PIC, target waktu, atau pekerjaan lanjutan"
                />
              </label>

              <div className="formActions">
                <button
                  type="submit"
                  className="primaryButton"
                  disabled={isSavingForm}
                >
                  {isSavingForm ? "Menyimpan..." : "Simpan"}
                </button>
                {saveState.message ? (
                  <span className="muted small">{saveState.message}</span>
                ) : null}
              </div>
            </form>
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
                <p>
                  Data peserta akan muncul otomatis setelah absensi berhasil.
                </p>
              </div>
            ) : (
              <div className="presenceList">
                {sortedPresences.map((presence, index) => {
                  const name = getPresenceName(presence);
                  const role = getPresenceRole(presence);
                  const method = getPresenceMethod(presence);
                  const score = getPresenceScore(presence);
                  const time = getPresenceTime(presence);

                  const faceSrc = getPresenceFaceSrc(presence);

                  return (
                    <article
                      className="presenceCard"
                      key={
                        stringValue(presence.nameKey) ||
                        stringValue(presence.faceId) ||
                        `${name}-${index}`
                      }
                    >
                      <div
                        className={
                          faceSrc
                            ? "presenceAvatar presencePhotoAvatar"
                            : "presenceAvatar"
                        }
                      >
                        {faceSrc ? (
                          <img src={faceSrc} alt={`Preview wajah ${name}`} />
                        ) : (
                          getInitialLetter(name)
                        )}
                      </div>

                      <div className="presenceContent">
                        <div className="presenceMain">
                          <h3>{name}</h3>
                          <p>{role}</p>
                        </div>

                        <div className="presenceMeta">
                          <span>{time}</span>
                          <span>{method}</span>
                          {score && <span>Kecocokan {score}</span>}
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
