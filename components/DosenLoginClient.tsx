"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type FaceApiModule = typeof import("face-api.js");

type DosenLoginClientProps = {
  nextPath?: string;
};

type LoginState = {
  status: "idle" | "checking" | "loading-model" | "starting" | "ready" | "capturing" | "error";
  message: string;
};

type LoginResponse = {
  success?: boolean;
  matched?: boolean;
  message?: string;
  name?: string;
  nameKey?: string;
  distance?: number;
  score?: number;
  threshold?: number;
};

let faceApiPromise: Promise<FaceApiModule> | null = null;
let modelsLoaded = false;

function safeNextPath(value?: string) {
  if (!value) return "/dosen/meeting";
  if (!value.startsWith("/dosen")) return "/dosen/meeting";
  if (value.startsWith("/dosen/login")) return "/dosen/meeting";
  return value;
}

async function loadFaceApiModels(addDebug: (message: string) => void) {
  const modelUrl = process.env.NEXT_PUBLIC_FACE_API_MODEL_URL || "/models/face-api";

  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js");
  }

  const faceapi = await faceApiPromise;

  if (!modelsLoaded) {
    addDebug("Menyiapkan pemeriksaan wajah.");

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);

    modelsLoaded = true;
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

function formatNumber(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(4);
}

export default function DosenLoginClient({ nextPath }: DosenLoginClientProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const toast = useToast();
  const redirectTarget = useMemo(() => safeNextPath(nextPath), [nextPath]);
  const [state, setState] = useState<LoginState>({ status: "idle", message: "" });
  const [result, setResult] = useState<LoginResponse | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState("");
  const [, setDebugLines] = useState<string[]>(["Login wajah dosen siap."]);

  const isBusy = ["checking", "loading-model", "starting", "capturing"].includes(state.status);
  const isReady = state.status === "ready";

  useEffect(() => {
    if (!state.message || state.status !== "error") return;
    toast.error("Login wajah gagal", state.message);
  }, [state.message, state.status, toast]);

  useEffect(() => {
    if (!result) return;

    if (result.success) {
      toast.success("Login berhasil", result.message || "Wajah berhasil dikenali.");
      return;
    }

    toast.error("Login belum berhasil", result.message || "Wajah belum cocok dengan data yang tersimpan.");
  }, [result, toast]);

  function addDebug(message: string) {
    const time = new Date().toLocaleTimeString("id-ID");
    setDebugLines((current) => [`[${time}] ${message}`, ...current.slice(0, 11)]);
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
      setState({ status: "checking", message: "Mengecek kamera..." });
      setResult(null);
      setCapturedImageUrl("");
      stopCamera();

      if (!window.isSecureContext) {
        throw new Error("Akses kamera membutuhkan halaman yang aman. Gunakan alamat HTTPS atau localhost.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Perangkat ini belum mendukung akses kamera.");
      }

      setState({ status: "loading-model", message: "Menyiapkan pemeriksaan wajah..." });
      await loadFaceApiModels(addDebug);

      setState({ status: "starting", message: "Mengaktifkan kamera..." });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Elemen video belum tersedia.");
      }

      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();

      setState({ status: "ready", message: "Kamera siap." });
      addDebug("Kamera siap untuk login wajah.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kamera gagal dibuka.";
      setState({ status: "error", message });
      addDebug(`ERROR: ${message}`);
    }
  }

  async function loginWithFace() {
    try {
      if (!videoRef.current) {
        throw new Error("Video kamera tidak tersedia.");
      }

      setState({ status: "capturing", message: "Mengambil foto wajah..." });
      setResult(null);

      const snapshot = captureStillImageFromVideo(videoRef.current);
      setCapturedImageUrl(snapshot.imageUrl);
      addDebug("Foto wajah berhasil diambil.");

      setState({ status: "capturing", message: "Mencocokkan wajah dari foto yang diambil..." });
      const faceapi = await loadFaceApiModels(addDebug);
      const descriptor = await readFaceDataFromStillImage(snapshot.canvas, faceapi);
      addDebug("Data wajah berhasil dibaca dari foto.");

      const response = await fetch("/api/auth/dosen/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });

      const data = (await response.json()) as LoginResponse;

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Login wajah dosen gagal.");
      }

      setResult(data);
      addDebug(`Login berhasil untuk ${data.name || "dosen"}.`);
      window.location.href = redirectTarget;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login wajah gagal.";
      setCapturedImageUrl("");
      setState({ status: "ready", message: "Kamera siap." });
      setResult({ success: false, matched: false, message });
      addDebug(`ERROR login: ${message}`);
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <main className="appShell authShell">
      <section className="authCard faceLoginCard">
        <div className="authHeader">
          <p className="eyebrow">Login Dosen</p>
          <h1>Masuk dengan Wajah</h1>
          <p className="muted">
            Arahkan wajah ke kamera. Setelah wajah berhasil dikenali, akun akan tetap masuk sampai dosen menekan logout.
          </p>
        </div>

        <div className="cameraPreview registerPreview">
          <video ref={videoRef} className="cameraVideo" playsInline muted autoPlay />
          {capturedImageUrl && state.status === "capturing" ? (
            <img className="cameraSnapshotImage" src={capturedImageUrl} alt="Foto wajah yang sedang dicocokkan" />
          ) : null}

          <div className="faceGuideLayer" aria-hidden="true">
            <div className="faceGuideOval">
              <span className="faceGuideCorner topLeft" />
              <span className="faceGuideCorner topRight" />
              <span className="faceGuideCorner bottomLeft" />
              <span className="faceGuideCorner bottomRight" />
            </div>
            <div className="faceGuideText">Area wajah</div>
          </div>

          {state.status === "idle" && <div className="cameraOverlay"><span>Tekan Buka Kamera</span></div>}
          {state.status === "checking" && <div className="cameraOverlay"><span>Mengecek kamera...</span></div>}
          {state.status === "loading-model" && <div className="cameraOverlay"><span>Menyiapkan pemeriksaan wajah...</span></div>}
          {state.status === "starting" && <div className="cameraOverlay"><span>Mengaktifkan kamera...</span></div>}
          {state.status === "capturing" && <div className="cameraOverlay"><span>{state.message || "Mencocokkan wajah..."}</span></div>}
          {state.status === "error" && <div className="cameraOverlay error"><span>{state.message}</span></div>}
        </div>

        <div className="cameraActions">
          <button type="button" className="primaryButton" onClick={startCamera} disabled={isBusy}>
            {state.status === "idle" || state.status === "error" ? "Buka Kamera" : "Muat Ulang Kamera"}
          </button>
          <button type="button" className="ghostButton" onClick={loginWithFace} disabled={!isReady || isBusy}>
            Login dengan Wajah
          </button>
        </div>

        {result ? (
          <div className={result.success ? "inlineAlert success" : "inlineAlert error"}>
            <strong>{result.success ? "Berhasil" : "Gagal"}</strong>
            <span>{result.message}</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
