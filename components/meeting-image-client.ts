const TARGET_BYTES = 200 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MIME_TYPE = "image/jpeg";

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak dapat dibaca."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal memproses gambar."));
      },
      MIME_TYPE,
      quality,
    );
  });
}

async function compressCanvas(canvas: HTMLCanvasElement) {
  const qualities = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.22];
  let bestBlob: Blob | null = null;

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= TARGET_BYTES) return blob;
  }

  return bestBlob;
}

export async function prepareMeetingImageFile(file: File) {
  if (!file || file.size <= 0) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Ukuran gambar maksimal 10 MB sebelum kompres.");
  }

  const image = await loadImageFromFile(file);
  const widths = [1600, 1280, 1024, 900, 768, 640];
  let bestBlob: Blob | null = null;

  for (const maxWidth of widths) {
    const scale = Math.min(1, maxWidth / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses gambar.");

    context.drawImage(image, 0, 0, width, height);
    const blob = await compressCanvas(canvas);
    if (blob && (!bestBlob || blob.size < bestBlob.size)) bestBlob = blob;
    if (blob && blob.size <= TARGET_BYTES) break;
  }

  if (!bestBlob) throw new Error("Gagal memproses gambar.");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "meeting";
  return new File([bestBlob], `${baseName}-${Date.now()}.jpg`, {
    type: MIME_TYPE,
  });
}

export async function prepareMeetingImageFromCanvas(canvas: HTMLCanvasElement, fileNamePrefix = "kamera-meeting") {
  const widths = [1280, 1024, 900, 768, 640];
  let bestBlob: Blob | null = null;

  for (const maxWidth of widths) {
    const scale = Math.min(1, maxWidth / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    const context = outputCanvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses gambar kamera.");

    context.drawImage(canvas, 0, 0, width, height);
    const blob = await compressCanvas(outputCanvas);
    if (blob && (!bestBlob || blob.size < bestBlob.size)) bestBlob = blob;
    if (blob && blob.size <= TARGET_BYTES) break;
  }

  if (!bestBlob) throw new Error("Gagal membuat file gambar dari kamera.");

  return new File([bestBlob], `${fileNamePrefix}-${Date.now()}.jpg`, {
    type: MIME_TYPE,
  });
}
