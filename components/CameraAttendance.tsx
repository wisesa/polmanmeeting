"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type FaceApiModule = typeof import("face-api.js");

type VerifyResponse = {
  success?: boolean;
  matched?: boolean;
  recognized?: boolean;
  message?: string;
  meetingId?: string;
  name?: string;
  nameKey?: string;
  score?: number;
  distance?: number;
  threshold?: number;
};

type CameraAttendanceProps = {
  meetingId: string;
  variant?: "standalone" | "embedded";
  onAttendanceSuccess?: () => void | Promise<void>;
};

type CameraStatus =
  | "idle"
  | "checking"
  | "loading-model"
  | "starting"
  | "ready"
  | "capturing"
  | "paused"
  | "error";

let faceApiPromise: Promise<FaceApiModule> | null = null;
let faceApiLoaded = false;

function isAttendanceSuccess(result: VerifyResponse | null) {
  if (!result) return false;

  return Boolean(
    result.success === true &&
      (result.matched === true || result.recognized === true)
  );
}

function normalizeVerifyResponse(data: VerifyResponse): VerifyResponse {
  const success = Boolean(
    data.success === true &&
      (data.matched === true || data.recognized === true)
  );

  return {
    ...data,
    success,
    matched: success,
    recognized: success,
  };
}

function formatNumber(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(4);
}

async function loadFaceApiModels(addDebug: (message: string) => void) {
  const modelUrl = process.env.NEXT_PUBLIC_FACE_API_MODEL_URL || "/models/face-api";

  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js");
  }

  const faceapi = await faceApiPromise;

  if (!faceApiLoaded) {
    addDebug("Menyiapkan pemeriksaan wajah.");

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);

    faceApiLoaded = true;
    addDebug("Pemeriksaan wajah siap.");
  }

  return faceapi;
}

function captureStillImageFromVideo(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Preview kamera belum siap. Tunggu sampai gambar kamera muncul.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Foto wajah belum bisa diambil. Silakan muat ulang kamera.");
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return {
    canvas,
    imageUrl: canvas.toDataURL("image/jpeg", 0.92),
  };
}

async function readFaceDataFromStillImage(image: HTMLCanvasElement, faceapi: FaceApiModule) {
  const detection = await faceapi
    .detectSingleFace(
      image,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("Wajah tidak terdeteksi pada foto yang diambil. Posisikan wajah di tengah area panduan dan coba lagi.");
  }

  const descriptor = Array.from(detection.descriptor).map((item) => Number(item));

  if (descriptor.length !== 128) {
    throw new Error("Data wajah belum terbaca dengan benar. Silakan coba lagi.");
  }

  return descriptor;
}

export default function CameraAttendance({
  meetingId,
  variant = "standalone",
  onAttendanceSuccess,
}: CameraAttendanceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setShowDebug(false);
  }, [meetingId]);

  const [debugLines, setDebugLines] = useState<string[]>([
    "Debug siap.",
    "Tekan tombol Buka Kamera.",
  ]);

  const isBusy =
    status === "checking" ||
    status === "loading-model" ||
    status === "starting" ||
    status === "capturing";

  const isCameraReady = status === "ready";
  const isCameraPaused = status === "paused";
  useEffect(() => {
    if (!result) return;

    if (isAttendanceSuccess(result)) {
      toast.success("Absensi berhasil", result.message || "Absensi berhasil disimpan.");
      return;
    }

    toast.error("Absensi belum berhasil", result.message || "Wajah belum dikenali. Silakan coba lagi.");
  }, [result, toast]);

  function addDebug(message: string) {
    const time = new Date().toLocaleTimeString("id-ID");

    setDebugLines((current) => [
      `[${time}] ${message}`,
      ...current.slice(0, 11),
    ]);

    console.log("[camera-debug]", message);
  }

  async function getPermissionState() {
    try {
      if (!navigator.permissions?.query) return "unknown";

      const permission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      return permission.state;
    } catch {
      return "unknown";
    }
  }

  async function checkBrowserSupport() {
    addDebug(`URL: ${window.location.href}`);
    addDebug(`Protocol: ${window.location.protocol}`);
    addDebug(`Secure context: ${String(window.isSecureContext)}`);
    addDebug(`navigator.mediaDevices: ${String(Boolean(navigator.mediaDevices))}`);
    addDebug(
      `getUserMedia: ${String(Boolean(navigator.mediaDevices?.getUserMedia))}`
    );
    addDebug(`Camera permission: ${await getPermissionState()}`);
    addDebug(`User agent: ${navigator.userAgent}`);
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera() {
    try {
      addDebug("Tombol Buka Kamera diklik.");

      setStatus("checking");
      setErrorMessage("");
      setResult(null);
      setCapturedImageUrl("");

      stopCamera();

      await checkBrowserSupport();

      if (!window.isSecureContext) {
        throw new Error(
          "Akses kamera membutuhkan halaman yang aman. Gunakan alamat HTTPS atau localhost."
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Perangkat tidak dapat membuka kamera. Cek izin kamera lalu coba lagi."
        );
      }

      setStatus("loading-model");
      await loadFaceApiModels(addDebug);

      setStatus("starting");
      addDebug("Meminta izin kamera ke browser.");

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        addDebug("getUserMedia sukses dengan facingMode user.");
      } catch {
        addDebug("facingMode user gagal. Coba video true.");

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        addDebug("getUserMedia sukses dengan video true.");
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Elemen video belum tersedia.");
      }

      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      await videoRef.current.play();

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.();

      addDebug(`Track aktif: ${track?.label || "unknown"}`);
      addDebug(`Ukuran video: ${settings?.width || "-"} x ${settings?.height || "-"}`);

      setStatus("ready");
      addDebug("Preview kamera siap.");
    } catch (error) {
      const errorName =
        error instanceof DOMException ? error.name : "CameraError";

      const message =
        error instanceof Error
          ? error.message
          : "Kamera tidak bisa dibuka.";

      addDebug(`ERROR ${errorName}: ${message}`);

      setStatus("error");
      setErrorMessage(`${errorName}: ${message}`);
      toast.error("Kamera gagal dibuka", `${errorName}: ${message}`);
    }
  }

  async function handleAttendance() {
    try {
      if (!videoRef.current) {
        throw new Error("Video kamera tidak tersedia.");
      }

      addDebug("Mulai proses ambil absen dengan wajah.");

      setStatus("capturing");
      setErrorMessage("");
      setResult(null);
      setCapturedImageUrl("");

      const snapshot = captureStillImageFromVideo(videoRef.current);
      setCapturedImageUrl(snapshot.imageUrl);
      stopCamera();
      addDebug("Foto wajah berhasil diambil. Preview kamera dihentikan sementara proses absensi berjalan.");

      const faceapi = await loadFaceApiModels(addDebug);
      const descriptor = await readFaceDataFromStillImage(snapshot.canvas, faceapi);

      addDebug("Data wajah berhasil dibaca dari foto yang diambil.");

      const response = await fetch("/api/attendance/verify-descriptor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingId,
          descriptor,
        }),
      });

      addDebug(`API response status: ${response.status}`);

      const data = (await response.json()) as VerifyResponse;
      const normalizedData = normalizeVerifyResponse(data);

      setResult(normalizedData);
      setStatus("paused");

      if (normalizedData.success && onAttendanceSuccess) {
        await onAttendanceSuccess();
      }

      addDebug(
        normalizedData.success
          ? "Absensi berhasil."
          : normalizedData.message || "Absensi belum dikenali."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Absensi gagal diproses.";

      addDebug(`ERROR attendance: ${message}`);

      stopCamera();
      setStatus("paused");
      setResult({
        success: false,
        matched: false,
        recognized: false,
        message,
      });
    }
  }

  useEffect(() => {
    addDebug("Component CameraAttendance mounted.");

    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div
      className={
        variant === "embedded"
          ? "cameraAttendance cameraAttendanceEmbedded"
          : "cameraAttendance"
      }
    >
      <div className="cameraShell">
        <div className="cameraHeader">
          <p className="eyebrow">Presensi Wajah</p>
          {variant === "embedded" ? (
            <h2>Form Absensi Wajah</h2>
          ) : (
            <h1>Absen dengan Wajah</h1>
          )}
          <p className="muted">
            Buka kamera, posisikan wajah di area panduan, lalu tekan tombol
            Ambil Absen. Setelah tombol ditekan, sistem memakai satu foto diam dan preview kamera dihentikan sampai proses selesai.
          </p>
        </div>

        <div className="cameraPreview">
          <video
            ref={videoRef}
            className="cameraVideo"
            playsInline
            muted
            autoPlay
          />

          {capturedImageUrl && (status === "capturing" || status === "paused") ? (
            <img
              className="cameraSnapshotImage attendanceSnapshotImage"
              src={capturedImageUrl}
              alt="Foto wajah yang sedang diproses untuk absensi"
            />
          ) : null}

          <div className="faceGuideLayer" aria-hidden="true">
            <div className="faceGuideOval">
              <span className="faceGuideCorner topLeft" />
              <span className="faceGuideCorner topRight" />
              <span className="faceGuideCorner bottomLeft" />
              <span className="faceGuideCorner bottomRight" />
            </div>

            <div className="faceGuideText">
              Posisikan wajah di dalam area ini
            </div>
          </div>

          {status === "idle" && (
            <div className="cameraOverlay">
              <span>Tekan tombol Buka Kamera</span>
            </div>
          )}

          {status === "checking" && (
            <div className="cameraOverlay">
              <span>Mengecek izin kamera...</span>
            </div>
          )}

          {status === "loading-model" && (
            <div className="cameraOverlay">
              <span>Menyiapkan pemeriksaan wajah...</span>
            </div>
          )}

          {status === "starting" && (
            <div className="cameraOverlay">
              <span>Mengaktifkan kamera...</span>
            </div>
          )}

          {status === "capturing" && (
            <div className="cameraOverlay">
              <span>Mencocokkan wajah dari foto yang diambil...</span>
            </div>
          )}

          {status === "paused" && (
            <div className="cameraOverlay">
              <span>Preview kamera berhenti. Tekan Ambil Absen untuk membuka ulang kamera.</span>
            </div>
          )}

          {status === "error" && (
            <div className="cameraOverlay error">
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="cameraActions">
          {(status === "idle" || status === "error") && (
            <button
              type="button"
              className="primaryButton"
              onClick={startCamera}
              disabled={isBusy}
            >
              Buka Kamera
            </button>
          )}

          {status === "ready" && (
            <button
              type="button"
              className="primaryButton"
              onClick={handleAttendance}
              disabled={!isCameraReady || isBusy}
            >
              Ambil Absen
            </button>
          )}

          {status === "paused" && (
            <button
              type="button"
              className="primaryButton"
              onClick={startCamera}
              disabled={isBusy}
            >
              Ambil Absen
            </button>
          )}

          {(status === "ready" || isCameraPaused) && (
            <button
              type="button"
              className="ghostButton"
              onClick={startCamera}
              disabled={isBusy}
            >
              Muat Ulang Kamera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
