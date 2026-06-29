import "server-only";

const DEFAULT_STRICT_DISTANCE_THRESHOLD = 0.45;
const DEFAULT_MIN_DISTANCE_GAP = 0.04;

function finitePositiveNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

/**
 * Endpoint login dan absensi perlu lebih ketat daripada default face-api.js.
 * Nilai lama FACE_API_DISTANCE_THRESHOLD=0.6 terlalu longgar untuk presensi,
 * karena sistem dapat menerima wajah yang sebenarnya berbeda tetapi menjadi
 * kandidat terdekat. Variabel khusus endpoint tetap dapat dipakai untuk
 * kalibrasi manual.
 */
export function getStrictFaceDistanceThreshold(envName: string) {
  const specific = finitePositiveNumber(process.env[envName]);
  if (specific !== null) return specific;

  const legacy = finitePositiveNumber(process.env.FACE_API_DISTANCE_THRESHOLD);
  if (legacy !== null) return Math.min(legacy, DEFAULT_STRICT_DISTANCE_THRESHOLD);

  return DEFAULT_STRICT_DISTANCE_THRESHOLD;
}

export function getFaceMinDistanceGap(envName: string) {
  const specific = finitePositiveNumber(process.env[envName]);
  if (specific !== null) return specific;

  const legacy = finitePositiveNumber(process.env.FACE_API_MIN_DISTANCE_GAP);
  if (legacy !== null) return legacy;

  return DEFAULT_MIN_DISTANCE_GAP;
}