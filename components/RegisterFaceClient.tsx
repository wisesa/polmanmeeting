"use client";

import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { SearchableSelect, type LookupOption } from "@/components/SearchLookup";
import { useToast } from "@/components/ToastProvider";
import type { MasterProdi } from "@/lib/firebase/schema";

type FaceApiModule = typeof import("face-api.js");

type FaceSummary = {
  nodeKey: string;
  name: string;
  nameKey: string;
  faceId: string;
  jabatan?: string;
  prodi?: string;
  prodiId?: string;
  prodiName?: string;
  descriptorSize?: number;
  descriptorModel?: string;
  hasSignature?: boolean;
  signatureBase64?: string;
  signatureMimeType?: string;
  signatureUpdatedAt?: number | null;
  hasFaceThumbnail?: boolean;
  faceThumbnailBase64?: string;
  faceThumbnailMimeType?: string;
  faceThumbnailUpdatedAt?: number | null;
  updatedAt?: number;
};

type ProdiOption = Pick<MasterProdi, "prodiId" | "kode" | "nama" | "displayName">;

type RegisterFaceClientProps = {
  initialFaces: FaceSummary[];
  prodiOptions: ProdiOption[];
  mode?: "admin" | "dosen";
  allowDelete?: boolean;
};

type RegisterStatus =
  | "idle"
  | "checking"
  | "loading-model"
  | "starting"
  | "ready"
  | "detecting"
  | "saving"
  | "error";

type SubmitResult = {
  success: boolean;
  message: string;
  name?: string;
  descriptorSize?: number;
};

type Point = {
  x: number;
  y: number;
};

let faceApiPromise: Promise<FaceApiModule> | null = null;
let modelsLoaded = false;

function makeNameKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function formatDateTime(value?: number | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function prodiLabel(prodi: ProdiOption) {
  return prodi.displayName || (prodi.kode ? `${prodi.kode} - ${prodi.nama}` : prodi.nama);
}

async function loadFaceApiModels(addLog: (message: string) => void) {
  const modelUrl = process.env.NEXT_PUBLIC_FACE_API_MODEL_URL || "/models/face-api";

  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js");
  }

  const faceapi = await faceApiPromise;

  if (!modelsLoaded) {
    addLog(`Memuat model face-api.js dari ${modelUrl}.`);

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);

    modelsLoaded = true;
    addLog("Model face-api.js siap.");
  }

  return faceapi;
}

function detectorOptions(faceapi: FaceApiModule) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });
}

async function detectDescriptorFromVideo(video: HTMLVideoElement, faceapi: FaceApiModule) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Preview kamera belum siap.");
  }

  const detection = await faceapi
    .detectSingleFace(video, detectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("Wajah tidak terdeteksi. Pastikan wajah berada di tengah kamera.");
  }

  const descriptor = Array.from(detection.descriptor).map((item) => Number(item));

  if (descriptor.length !== 128) {
    throw new Error("Descriptor tidak valid. Ukuran wajib 128 angka.");
  }

  return descriptor;
}

async function detectDescriptorFromImage(image: HTMLImageElement, faceapi: FaceApiModule) {
  const detection = await faceapi
    .detectSingleFace(image, detectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("Wajah tidak terdeteksi pada file gambar. Gunakan foto wajah yang jelas dan tidak terlalu jauh.");
  }

  const descriptor = Array.from(detection.descriptor).map((item) => Number(item));

  if (descriptor.length !== 128) {
    throw new Error("Descriptor tidak valid. Ukuran wajib 128 angka.");
  }

  return descriptor;
}

function thumbnailFromVideo(video: HTMLVideoElement) {
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return "";

  const sourceSize = Math.min(width, height);
  const sx = Math.max(0, (width - sourceSize) / 2);
  const sy = Math.max(0, (height - sourceSize) / 2);

  ctx.save();
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.84);
}

function thumbnailFromImage(image: HTMLImageElement) {
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return "";

  const sourceSize = Math.min(width, height);
  const sx = Math.max(0, (width - sourceSize) / 2);
  const sy = Math.max(0, (height - sourceSize) / 2);
  ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

  return canvas.toDataURL("image/jpeg", 0.84);
}

function stripDataUrl(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function mimeTypeFromDataUrl(dataUrl: string, fallback = "image/png") {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match?.[1] || fallback;
}

function dataUrlFromBase64(base64?: string, mimeType = "image/png") {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType || "image/png"};base64,${base64}`;
}

function selectedProdi(prodiOptions: ProdiOption[], prodiId: string) {
  return prodiOptions.find((item) => item.prodiId === prodiId);
}

function toProdiLookupOptions(prodiOptions: ProdiOption[]): LookupOption[] {
  return prodiOptions.map((prodi) => ({
    value: prodi.prodiId,
    label: prodiLabel(prodi),
    searchText: [prodi.kode, prodi.nama, prodi.displayName].filter(Boolean).join(" "),
  }));
}

function faceProdiDisplay(face: FaceSummary) {
  return face.prodiName || face.prodi || "-";
}

const faceNameCollator = new Intl.Collator("id-ID", {
  numeric: true,
  sensitivity: "base",
});

function sortFacesByName(faces: FaceSummary[]) {
  return [...faces].sort((a, b) => {
    const nameCompare = faceNameCollator.compare(a.name || "", b.name || "");
    if (nameCompare !== 0) return nameCompare;

    return faceNameCollator.compare(a.nameKey || a.nodeKey || "", b.nameKey || b.nodeKey || "");
  });
}

function faceThumbnailSrc(face: FaceSummary) {
  return dataUrlFromBase64(face.faceThumbnailBase64, face.faceThumbnailMimeType || "image/jpeg");
}

function signatureSrc(face: FaceSummary) {
  return dataUrlFromBase64(face.signatureBase64, face.signatureMimeType || "image/png");
}

export default function RegisterFaceClient({ initialFaces, prodiOptions, mode = "admin", allowDelete }: RegisterFaceClientProps) {
  const initialDosenFace = mode === "dosen" && initialFaces.length === 1 ? initialFaces[0] : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureDrawingRef = useRef(false);
  const signatureLastPointRef = useRef<Point | null>(null);

  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState(initialDosenFace ? signatureSrc(initialDosenFace) : "");
  const [signatureTouched, setSignatureTouched] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const toast = useToast();
  const [faces, setFaces] = useState(initialFaces);
  const [editingFace, setEditingFace] = useState<FaceSummary | null>(initialDosenFace);
  const [deletingKey, setDeletingKey] = useState("");
  const [logs, setLogs] = useState<string[]>(["Register wajah siap."]);
  const [showDebug, setShowDebug] = useState(false);

  const isBusy = ["checking", "loading-model", "starting", "detecting", "saving"].includes(status);
  const cameraReady = status === "ready";
  const isEditing = Boolean(editingFace);
  const lookupProdiOptions = useMemo(() => toProdiLookupOptions(prodiOptions), [prodiOptions]);
  const isDosenMode = mode === "dosen";
  const canDelete = allowDelete ?? !isDosenMode;
  const sortedFaces = useMemo(() => sortFacesByName(faces), [faces]);

  useEffect(() => {
    if (!result) return;

    if (result.success) {
      toast.success("Berhasil", result.message);
      return;
    }

    toast.error("Gagal", result.message);
  }, [result, toast]);

  function addLog(message: string) {
    const time = new Date().toLocaleTimeString("id-ID");
    setLogs((current) => [`[${time}] ${message}`, ...current.slice(0, 9)]);
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

  function prepareSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 560);
    const height = Math.max(1, rect.height || 180);
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    const shouldResize = canvas.width !== nextWidth || canvas.height !== nextHeight;

    if (shouldResize) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#0f172a";

    return ctx;
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    const ctx = prepareSignatureCanvas();
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width || canvas.width, rect.height || canvas.height);
  }

  function drawSignatureDataUrl(dataUrl: string) {
    if (!dataUrl) {
      clearSignatureCanvas();
      return;
    }

    const canvas = signatureCanvasRef.current;
    const ctx = prepareSignatureCanvas();
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 560;
    const height = rect.height || 180;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const dx = (width - drawWidth) / 2;
      const dy = (height - drawHeight) / 2;
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    };
    image.src = dataUrl;
  }

  function getSignaturePoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startSignatureDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = prepareSignatureCanvas();
    if (!ctx) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    signatureDrawingRef.current = true;
    const point = getSignaturePoint(event);
    signatureLastPointRef.current = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function moveSignatureDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!signatureDrawingRef.current) return;

    const ctx = prepareSignatureCanvas();
    const lastPoint = signatureLastPointRef.current;
    if (!ctx || !lastPoint) return;

    const point = getSignaturePoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    signatureLastPointRef.current = point;
  }

  function finishSignatureDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!signatureDrawingRef.current) return;

    signatureDrawingRef.current = false;
    signatureLastPointRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture bisa sudah dilepas browser.
    }

    setSignatureDataUrl(event.currentTarget.toDataURL("image/png"));
    setSignatureTouched(true);
  }

  function clearSignature() {
    clearSignatureCanvas();
    setSignatureDataUrl("");
    setSignatureTouched(true);
  }

  async function startCamera() {
    try {
      setStatus("checking");
      setResult(null);
      setDescriptor(null);
      setThumbnailDataUrl("");
      stopCamera();

      if (!window.isSecureContext) {
        throw new Error("Kamera browser perlu HTTPS atau localhost.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser tidak mendukung akses kamera.");
      }

      setStatus("loading-model");
      await loadFaceApiModels(addLog);

      setStatus("starting");
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

      setStatus("ready");
      addLog("Kamera siap.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kamera gagal dibuka.";
      setStatus("error");
      setResult({ success: false, message });
      addLog(`ERROR: ${message}`);
    }
  }

  async function takeDescriptor() {
    try {
      if (!videoRef.current) {
        throw new Error("Video kamera tidak tersedia.");
      }

      setStatus("detecting");
      setResult(null);
      const faceapi = await loadFaceApiModels(addLog);
      const nextDescriptor = await detectDescriptorFromVideo(videoRef.current, faceapi);
      const thumbnail = thumbnailFromVideo(videoRef.current);

      setDescriptor(nextDescriptor);
      setThumbnailDataUrl(thumbnail);
      setStatus("ready");
      setResult({
        success: true,
        message: editingFace
          ? "Descriptor wajah baru berhasil dibuat dari kamera. Klik update untuk menyimpan perubahan."
          : "Descriptor wajah berhasil dibuat dari kamera. Isi identitas lalu simpan.",
        descriptorSize: nextDescriptor.length,
      });
      addLog(`Descriptor kamera berhasil dibuat. Panjang: ${nextDescriptor.length}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Descriptor gagal dibuat.";
      setStatus("ready");
      setResult({ success: false, message });
      addLog(`ERROR: ${message}`);
    }
  }

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("File harus berupa gambar.");
      }

      setStatus("loading-model");
      setResult(null);
      setDescriptor(null);
      setThumbnailDataUrl("");

      const faceapi = await loadFaceApiModels(addLog);
      const objectUrl = URL.createObjectURL(file);

      try {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = objectUrl;
        await image.decode();

        setStatus("detecting");
        const nextDescriptor = await detectDescriptorFromImage(image, faceapi);
        const thumbnail = thumbnailFromImage(image);

        setDescriptor(nextDescriptor);
        setThumbnailDataUrl(thumbnail);
        setStatus(cameraReady ? "ready" : "idle");
        setResult({
          success: true,
          message: editingFace
            ? "Descriptor wajah baru berhasil dibuat dari file gambar. Klik update untuk menyimpan perubahan."
            : "Descriptor wajah berhasil dibuat dari file gambar. Isi identitas lalu simpan.",
          descriptorSize: nextDescriptor.length,
        });
        addLog(`Descriptor file ${file.name} berhasil dibuat. Panjang: ${nextDescriptor.length}.`);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Descriptor dari file gambar gagal dibuat.";
      setStatus(cameraReady ? "ready" : "error");
      setResult({ success: false, message });
      addLog(`ERROR: ${message}`);
    } finally {
      event.target.value = "";
    }
  }

  function handleSignatureFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("File TTD harus berupa gambar.");
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          setResult({ success: false, message: "File TTD gagal dibaca." });
          return;
        }

        setSignatureDataUrl(dataUrl);
        setSignatureTouched(true);
        drawSignatureDataUrl(dataUrl);
        addLog(`TTD dari file ${file.name} berhasil dimuat.`);
      };
      reader.onerror = () => setResult({ success: false, message: "File TTD gagal dibaca." });
      reader.readAsDataURL(file);
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : "File TTD gagal diproses." });
    } finally {
      event.target.value = "";
    }
  }

  function editFace(face: FaceSummary) {
    const nextSignatureDataUrl = signatureSrc(face);
    setEditingFace(face);
    setDescriptor(null);
    setThumbnailDataUrl("");
    setSignatureDataUrl(nextSignatureDataUrl);
    setSignatureTouched(false);
    setResult({ success: true, message: `Mode edit aktif untuk ${face.name}.` });

    window.setTimeout(() => drawSignatureDataUrl(nextSignatureDataUrl), 0);
  }

  function cancelEdit() {
    setEditingFace(null);
    setSignatureDataUrl("");
    setSignatureTouched(false);
    clearSignatureCanvas();
  }

  async function deleteFace(nameKey: string) {
    if (!window.confirm("Hapus data wajah ini? Descriptor wajah dan TTD akan ikut terhapus.")) return;

    try {
      setDeletingKey(nameKey);
      const response = await fetch(`/api/faces/${encodeURIComponent(nameKey)}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Data wajah gagal dihapus.");
      }

      setFaces((current) => current.filter((item) => item.nameKey !== nameKey && item.nodeKey !== nameKey));
      if (editingFace?.nameKey === nameKey) cancelEdit();
      setResult({ success: true, message: "Data wajah berhasil dihapus." });
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : "Data wajah gagal dihapus." });
    } finally {
      setDeletingKey("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const name = String(form.get("name") || "").trim();
      const jabatan = String(form.get("jabatan") || "").trim();
      const prodiId = String(form.get("prodiId") || "").trim();
      const prodi = selectedProdi(prodiOptions, prodiId);
      const prodiName = prodi ? prodiLabel(prodi) : String(form.get("prodiNameFallback") || "").trim();
      const generatedNameKey = makeNameKey(name);

      if (!name) throw new Error("Nama wajib diisi.");
      if (!generatedNameKey) throw new Error("Nama belum bisa dipakai sebagai ID internal. Gunakan huruf atau angka pada nama.");
      if (!prodiId && !prodiName) throw new Error("Prodi wajib dipilih dari master prodi.");

      setStatus("saving");
      setResult(null);

      if (editingFace) {
        const payload: Record<string, unknown> = {
          name,
          jabatan,
          prodi: prodiName,
          prodiId,
          prodiName,
        };

        if (descriptor) {
          payload.descriptor = descriptor;
          payload.matrix = descriptor;
        }

        if (thumbnailDataUrl) {
          payload.faceThumbnailBase64 = stripDataUrl(thumbnailDataUrl);
          payload.faceThumbnailMimeType = "image/jpeg";
        }

        if (signatureTouched) {
          payload.signatureBase64 = signatureDataUrl ? stripDataUrl(signatureDataUrl) : "";
          payload.signatureMimeType = signatureDataUrl ? mimeTypeFromDataUrl(signatureDataUrl) : "";
          payload.clearSignature = !signatureDataUrl;
        }

        const response = await fetch(`/api/faces/${encodeURIComponent(editingFace.nameKey || editingFace.nodeKey)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Data wajah gagal diperbarui.");
        }

        const updatedFace = data.face as FaceSummary;
        setFaces((current) => current.map((item) => item.nameKey === editingFace.nameKey ? updatedFace : item));
        setEditingFace(updatedFace);
        setDescriptor(null);
        setThumbnailDataUrl("");
        setSignatureTouched(false);
        setSignatureDataUrl(signatureSrc(updatedFace));
        window.setTimeout(() => drawSignatureDataUrl(signatureSrc(updatedFace)), 0);
        setStatus(cameraReady ? "ready" : "idle");
        setResult({ success: true, message: "Data wajah berhasil diperbarui.", name: updatedFace?.name });
        addLog(`Data wajah ${name} berhasil diperbarui.`);
        return;
      }

      if (!descriptor) throw new Error("Ambil descriptor wajah dari kamera atau file gambar terlebih dahulu.");

      const response = await fetch("/api/faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nameKey: generatedNameKey,
          faceId: generatedNameKey,
          jabatan,
          prodi: prodiName,
          prodiId,
          prodiName,
          descriptor,
          matrix: descriptor,
          faceThumbnailBase64: thumbnailDataUrl ? stripDataUrl(thumbnailDataUrl) : "",
          faceThumbnailMimeType: thumbnailDataUrl ? "image/jpeg" : "",
          signatureBase64: signatureDataUrl ? stripDataUrl(signatureDataUrl) : "",
          signatureMimeType: signatureDataUrl ? mimeTypeFromDataUrl(signatureDataUrl) : "",
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Data wajah gagal disimpan.");
      }

      setResult({
        success: true,
        message: data.message || "Data wajah berhasil disimpan.",
        name: data.face?.name,
        descriptorSize: data.face?.descriptorSize,
      });

      setFaces((current) => {
        const nextFace = data.face as FaceSummary;
        const filtered = current.filter((item) => item.nameKey !== nextFace.nameKey);
        return [nextFace, ...filtered];
      });

      setDescriptor(null);
      setThumbnailDataUrl("");
      setSignatureDataUrl("");
      setSignatureTouched(false);
      clearSignatureCanvas();
      setStatus(cameraReady ? "ready" : "idle");
      addLog(`Data wajah ${name} berhasil disimpan.`);
      formElement.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data wajah gagal disimpan.";
      setStatus(cameraReady ? "ready" : "error");
      setResult({ success: false, message });
      addLog(`ERROR: ${message}`);
    }
  }

  useEffect(() => {
    prepareSignatureCanvas();
    if (signatureDataUrl) {
      window.setTimeout(() => drawSignatureDataUrl(signatureDataUrl), 0);
    }

    const onResize = () => {
      const currentSignature = signatureDataUrl;
      prepareSignatureCanvas();
      if (currentSignature) drawSignatureDataUrl(currentSignature);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [signatureDataUrl]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const editingProdiValue = editingFace?.prodiId || "";
  const editingProdiFallback = editingFace && editingProdiValue && !prodiOptions.some((item) => item.prodiId === editingProdiValue);
  const currentThumbnailSrc = thumbnailDataUrl || (editingFace ? faceThumbnailSrc(editingFace) : "");
  const currentThumbnailTitle = thumbnailDataUrl ? "Descriptor wajah baru siap" : "Preview wajah tersimpan";
  const currentThumbnailMeta = thumbnailDataUrl ? `${descriptor?.length || 0} angka` : `${editingFace?.descriptorSize || 0} angka tersimpan`;

  return (
    <main className="appShell">
      <section className={isDosenMode ? "heroPanel compactHero dosenHeroPanel" : "heroPanel compactHero"}>
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">{isDosenMode ? "Dosen Register" : "Register Wajah"}</p>
            <h1 className="heroTitle">{isDosenMode ? "Ganti Profil Dosen" : "Data Wajah Peserta"}</h1>
            <p className="heroSubtitle">
              {isDosenMode
                ? "Perbarui profil dosen, foto wajah, descriptor wajah, prodi, jabatan, dan tanda tangan yang sudah tersimpan."
                : "Daftarkan, edit, dan hapus data wajah peserta. Descriptor bisa dibuat dari webcam atau file gambar."}
            </p>
          </div>
          <div className="heroMetric">
            <strong>{faces.length}</strong>
            <span>Wajah terdaftar</span>
          </div>
        </div>
      </section>

      <section className="registerGrid">
        <div className="registerPanel">
          <div className="cameraHeader">
            <p className="eyebrow">Sumber Wajah</p>
            <h2>{isEditing ? "Ganti Descriptor Wajah" : "Ambil Descriptor Wajah"}</h2>
            <p className="muted">Gunakan kamera atau unggah file gambar wajah yang jelas.</p>
          </div>

          <div className="cameraPreview registerPreview">
            <video ref={videoRef} className="cameraVideo" playsInline muted autoPlay />

            <div className="faceGuideLayer" aria-hidden="true">
              <div className="faceGuideOval">
                <span className="faceGuideCorner topLeft" />
                <span className="faceGuideCorner topRight" />
                <span className="faceGuideCorner bottomLeft" />
                <span className="faceGuideCorner bottomRight" />
              </div>
              <div className="faceGuideText">Area wajah</div>
            </div>

            {status === "idle" && <div className="cameraOverlay"><span>Buka kamera atau unggah gambar</span></div>}
            {status === "loading-model" && <div className="cameraOverlay"><span>Memuat model face-api.js...</span></div>}
            {status === "starting" && <div className="cameraOverlay"><span>Mengaktifkan kamera...</span></div>}
            {status === "detecting" && <div className="cameraOverlay"><span>Membuat descriptor...</span></div>}
          </div>

          <div className="cameraActions">
            <button type="button" className="primaryButton" onClick={startCamera} disabled={isBusy}>
              {status === "idle" || status === "error" ? "Buka Kamera" : "Muat Ulang Kamera"}
            </button>
            <button type="button" className="ghostButton" onClick={takeDescriptor} disabled={!cameraReady || isBusy}>
              Ambil dari Webcam
            </button>
          </div>

          <label className="fileUploadBox">
            <span>Ambil dari File Gambar</span>
            <input type="file" accept="image/*" onChange={handleImageFile} disabled={isBusy} />
            <small>Format JPG, PNG, atau WebP. Gunakan satu wajah dalam foto.</small>
          </label>

          {currentThumbnailSrc ? (
            <div className="thumbnailBox">
              <img src={currentThumbnailSrc} alt="Preview wajah" />
              <div>
                <strong>{currentThumbnailTitle}</strong>
                <span>{currentThumbnailMeta}</span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="ghostButton cameraDebugToggle"
            onClick={() => setShowDebug((current) => !current)}
          >
            {showDebug ? "Sembunyikan Debug Camera" : "Tampilkan Debug Camera"}
          </button>

          {showDebug ? (
            <div className="cameraDebugBox">
              <strong>Debug Camera Register</strong>
              {logs.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
            </div>
          ) : null}
        </div>

        <div className="registerPanel">
          <div className="cameraHeader">
            <p className="eyebrow">{isDosenMode ? "Ganti Profil" : "Identitas Peserta"}</p>
            <h2>{isDosenMode ? "Profil Dosen" : isEditing ? "Edit Data Wajah" : "Simpan ke Firestore"}</h2>
            <p className="muted">{isDosenMode ? "Preview wajah dan TTD tetap ditampilkan walaupun tidak diganti." : "ID wajah dibuat otomatis dari nama. Prodi diambil dari Master Prodi."}</p>
          </div>

          <form key={editingFace?.nameKey || "new-face"} className="registerForm" onSubmit={handleSubmit}>
            <label>
              <span>Nama</span>
              <input name="name" defaultValue={editingFace?.name || ""} placeholder={isDosenMode ? "Nama dosen" : "Nama peserta"} required />
            </label>

            <div className="registerFormTwo">
              <label>
                <span>Jabatan</span>
                <input name="jabatan" defaultValue={editingFace?.jabatan || ""} placeholder="Dosen, Staf, Mahasiswa" />
              </label>

              <label>
                <span>Prodi</span>
                <SearchableSelect
                  name="prodiId"
                  value={editingProdiValue}
                  options={lookupProdiOptions}
                  placeholder={prodiOptions.length === 0 ? "Belum ada master prodi" : "Cari prodi"}
                  fallbackLabel={editingProdiFallback ? editingFace?.prodiName || editingFace?.prodi || editingProdiValue : undefined}
                  emptyText="Prodi tidak ditemukan. Isi Master Prodi terlebih dahulu."
                  required
                />
                <input type="hidden" name="prodiNameFallback" defaultValue={editingFace?.prodiName || editingFace?.prodi || ""} />
                {prodiOptions.length === 0 ? <span className="muted small">Isi Master Prodi terlebih dahulu.</span> : null}
              </label>
            </div>

            <div className="signatureField">
              <div className="signatureHeader">
                <div>
                  <span>TTD</span>
                  <small>Gambar langsung di area putih atau unggah file gambar tanda tangan.</small>
                </div>
                <button type="button" className="ghostButton small" onClick={clearSignature}>Bersihkan</button>
              </div>

              <canvas
                ref={signatureCanvasRef}
                className="signatureCanvas"
                aria-label="Area gambar tanda tangan"
                onPointerDown={startSignatureDraw}
                onPointerMove={moveSignatureDraw}
                onPointerUp={finishSignatureDraw}
                onPointerCancel={finishSignatureDraw}
                onPointerLeave={finishSignatureDraw}
              />

              <label className="fileUploadBox signatureUploadBox">
                <span>Ambil TTD dari File Gambar</span>
                <input type="file" accept="image/*" onChange={handleSignatureFile} />
                <small>Disarankan PNG transparan atau JPG dengan latar putih.</small>
              </label>

              {signatureDataUrl ? (
                <div className="signaturePreviewBox">
                  <img src={signatureDataUrl} alt="Preview TTD" />
                  <span>TTD siap disimpan</span>
                </div>
              ) : (
                <p className="muted small noMargin">TTD opsional. Kosongkan jika belum tersedia.</p>
              )}
            </div>

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isBusy || (!descriptor && !isEditing)}>
                {status === "saving" ? "Menyimpan..." : isDosenMode ? "Update Profil" : isEditing ? "Update Data Wajah" : "Simpan Data Wajah"}
              </button>
              {isEditing ? <button type="button" className="ghostButton" onClick={cancelEdit}>Batal Edit</button> : null}
            </div>
          </form>

        </div>
      </section>

      <section className="contentSection">
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">{isDosenMode ? "Profil Tersimpan" : "Daftar Wajah"}</p>
            <h2>{isDosenMode ? "Data Wajah Login" : "Kelola Data Wajah"}</h2>
          </div>
          <span className="counterPill">{faces.length} data</span>
        </div>

        {faces.length === 0 ? (
          <div className="emptyState modernEmpty">
            <div className="emptyIcon">🙂</div>
            <h2>Belum ada data wajah</h2>
            <p className="muted">Ambil descriptor dari webcam atau gambar, lalu simpan identitas peserta.</p>
          </div>
        ) : (
          <div className="faceListGrid">
            {sortedFaces.map((face) => {
              const thumbnailSrc = faceThumbnailSrc(face);
              const faceKey = face.nameKey || face.nodeKey;

              return (
                <article key={faceKey} className="faceCard">
                  <div className="facePreviewFrame">
                    {thumbnailSrc ? (
                      <img src={thumbnailSrc} alt={`Preview wajah ${face.name}`} />
                    ) : (
                      <div className="avatar faceFallbackAvatar">{face.name.slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>

                  <div className="faceCardMain">
                    <div className="faceCardTopline">
                      <h3>{face.name}</h3>
                    </div>
                    <p className="muted">{[face.jabatan, faceProdiDisplay(face)].filter(Boolean).join(" • ")}</p>
                    <div className="faceMetaGrid">
                      <span>Descriptor {face.descriptorSize || 0}</span>
                      <span>Update {formatDateTime(face.updatedAt)}</span>
                    </div>
                    {signatureSrc(face) ? (
                      <div className="faceSignatureMini">
                        <img src={signatureSrc(face)} alt={`TTD ${face.name}`} />
                      </div>
                    ) : null}
                    <div className="faceSignatureStatus">
                      <span>Status TTD</span>
                      <strong className={face.hasSignature || face.signatureBase64 ? "signatureText active" : "signatureText"}>
                        {face.hasSignature || face.signatureBase64 ? "Ada" : "Tidak ada"}
                      </strong>
                    </div>
                  </div>

                  <div className="faceCardActions">
                    <button type="button" className="ghostButton small" onClick={() => editFace(face)}>Edit</button>
                    {canDelete ? (
                      <button type="button" className="dangerButton small" onClick={() => deleteFace(faceKey)} disabled={deletingKey === faceKey}>
                        {deletingKey === faceKey ? "Menghapus..." : "Hapus"}
                      </button>
                    ) : null}
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
