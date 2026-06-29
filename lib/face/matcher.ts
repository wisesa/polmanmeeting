import "server-only";

export type FaceRecord = Record<string, unknown>;

export type FaceCandidate = {
  id?: string;
  key?: string;
  name?: string;
  nameKey?: string;
  faceId?: string;
  score: number;
  distance?: number;
  descriptorSize?: number;
  descriptorModel?: string;
};

export type FaceDistanceMatchResult = {
  matched: boolean;
  ambiguous: boolean;
  threshold: number;
  minDistanceGap: number;
  distance: number;
  secondDistance?: number;
  distanceGap?: number;
  rejectionReason?: "distance_above_threshold" | "ambiguous_match";
  comparedCount: number;
  bestMatch: FaceRecord | null;
  candidates: FaceCandidate[];
};

function isRecord(value: unknown): value is FaceRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseDescriptor(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const numbers: number[] = [];

    for (const item of value) {
      const numberValue = toFiniteNumber(item);
      if (numberValue !== null) numbers.push(numberValue);
    }

    return numbers.length > 0 ? numbers : null;
  }

  if (typeof value === "string") {
    try {
      return parseDescriptor(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (isRecord(value)) {
    const nestedKeys = [
      "descriptor",
      "faceDescriptor",
      "faceApiDescriptor",
      "matrix",
      "values",
      "data",
      "vector",
    ];

    for (const key of nestedKeys) {
      const parsed = parseDescriptor(value[key]);
      if (parsed) return parsed;
    }

    const numericEntries = Object.entries(value)
      .filter(([key]) => /^\d+$/.test(key))
      .sort(([a], [b]) => Number(a) - Number(b));

    if (numericEntries.length > 0) {
      const numbers: number[] = [];

      for (const [, item] of numericEntries) {
        const numberValue = toFiniteNumber(item);
        if (numberValue !== null) numbers.push(numberValue);
      }

      return numbers.length > 0 ? numbers : null;
    }
  }

  return null;
}

function parseDescriptorList(value: unknown): number[][] {
  if (!value) return [];

  if (Array.isArray(value)) {
    const direct = parseDescriptor(value);
    if (direct) return [direct];

    return value
      .map((item) => parseDescriptor(item))
      .filter((item): item is number[] => Boolean(item && item.length > 0));
  }

  if (typeof value === "string") {
    try {
      return parseDescriptorList(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (isRecord(value)) {
    const nestedListKeys = ["descriptors", "matrices", "vectors"];
    const output: number[][] = [];

    for (const key of nestedListKeys) {
      output.push(...parseDescriptorList(value[key]));
    }

    const single = parseDescriptor(value);
    if (single) output.push(single);

    return dedupeVectors(output);
  }

  return [];
}

function dedupeVectors(vectors: number[][]) {
  const seen = new Set<string>();
  const unique: number[][] = [];

  for (const vector of vectors) {
    const key = `${vector.length}:${vector
      .slice(0, 8)
      .map((item) => item.toFixed(6))
      .join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(vector);
  }

  return unique;
}

function extractDescriptorsFromFace(face: FaceRecord) {
  const keys = [
    "descriptor",
    "descriptors",
    "matrix",
    "faceDescriptor",
    "faceApiDescriptor",
    "faceApi",
  ];

  const descriptors: number[][] = [];

  for (const key of keys) {
    descriptors.push(...parseDescriptorList(face[key]));
  }

  return dedupeVectors(descriptors);
}

export function euclideanDistance(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

function getFaceName(face: FaceRecord) {
  return (
    stringValue(face.name) ||
    stringValue(face.fullName) ||
    stringValue(face.nama) ||
    stringValue(face.displayName) ||
    "Tanpa Nama"
  );
}

function getFaceNameKey(face: FaceRecord) {
  return (
    stringValue(face.nameKey) ||
    stringValue(face.faceId) ||
    stringValue(face.id) ||
    stringValue(face.key)
  );
}

function normalizeFaceRecords(rawFaces: unknown): FaceRecord[] {
  const faces: FaceRecord[] = [];

  if (Array.isArray(rawFaces)) {
    rawFaces.forEach((item, index) => {
      if (!isRecord(item)) return;

      faces.push({
        ...item,
        id: stringValue(item.id) || stringValue(item.key) || String(index),
      });
    });

    return faces;
  }

  if (isRecord(rawFaces)) {
    for (const [key, value] of Object.entries(rawFaces)) {
      if (!isRecord(value)) continue;

      faces.push({
        ...value,
        id: stringValue(value.id) || key,
        key: stringValue(value.key) || key,
        nameKey: stringValue(value.nameKey) || key,
      });
    }
  }

  return faces;
}

export function sanitizeFaceRecord(face: FaceRecord | null) {
  if (!face) return null;

  const copy: FaceRecord = { ...face };

  delete copy.descriptor;
  delete copy.descriptors;
  delete copy.matrix;
  delete copy.faceDescriptor;
  delete copy.faceApiDescriptor;

  if (isRecord(copy.faceApi)) {
    copy.faceApi = {
      ...copy.faceApi,
      descriptor: undefined,
      descriptors: undefined,
      matrix: undefined,
    };
  }

  return copy;
}

export function matchFaceDescriptorDistance(
  inputDescriptor: number[],
  rawFaces: unknown,
  options: {
    threshold?: number;
    minDistanceGap?: number;
    topK?: number;
    descriptorSize?: number;
  } = {}
): FaceDistanceMatchResult {
  const threshold = Number(
    options.threshold ?? process.env.FACE_API_DISTANCE_THRESHOLD ?? "0.6"
  );
  const minDistanceGap = Number(options.minDistanceGap ?? process.env.FACE_API_MIN_DISTANCE_GAP ?? "0");

  const topK = options.topK ?? 5;
  const descriptorSize = options.descriptorSize ?? 128;
  const faces = normalizeFaceRecords(rawFaces);
  const candidates: Array<FaceCandidate & { rawFace: FaceRecord }> = [];

  for (const face of faces) {
    const storedDescriptors = extractDescriptorsFromFace(face);
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestSize = 0;

    for (const storedDescriptor of storedDescriptors) {
      if (storedDescriptor.length !== descriptorSize) continue;
      if (storedDescriptor.length !== inputDescriptor.length) continue;

      const distance = euclideanDistance(inputDescriptor, storedDescriptor);

      if (Number.isFinite(distance) && distance < bestDistance) {
        bestDistance = distance;
        bestSize = storedDescriptor.length;
      }
    }

    if (!Number.isFinite(bestDistance)) continue;

    const faceApi = isRecord(face.faceApi) ? face.faceApi : undefined;

    candidates.push({
      id: stringValue(face.id) || undefined,
      key: stringValue(face.key) || undefined,
      name: getFaceName(face),
      nameKey: getFaceNameKey(face) || undefined,
      faceId: stringValue(face.faceId) || undefined,
      score: 1 / (1 + bestDistance),
      distance: bestDistance,
      descriptorSize: bestSize,
      descriptorModel: stringValue(face.descriptorModel) || stringValue(faceApi?.model) || "face-api.js",
      rawFace: face,
    });
  }

  candidates.sort(
    (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)
  );

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const bestDistance = best?.distance ?? Number.POSITIVE_INFINITY;
  const secondDistance = second?.distance;
  const distanceGap =
    typeof secondDistance === "number" && Number.isFinite(secondDistance)
      ? secondDistance - bestDistance
      : undefined;
  const withinThreshold = Boolean(best && bestDistance <= threshold);
  const ambiguous = Boolean(
    withinThreshold &&
      typeof distanceGap === "number" &&
      Number.isFinite(distanceGap) &&
      Number.isFinite(minDistanceGap) &&
      minDistanceGap > 0 &&
      distanceGap < minDistanceGap
  );
  const matched = withinThreshold && !ambiguous;
  const rejectionReason = matched
    ? undefined
    : ambiguous
      ? "ambiguous_match"
      : "distance_above_threshold";

  return {
    matched,
    ambiguous,
    threshold,
    minDistanceGap,
    distance: bestDistance,
    secondDistance,
    distanceGap,
    rejectionReason,
    comparedCount: candidates.length,
    bestMatch: best ? best.rawFace : null,
    candidates: candidates.slice(0, topK).map((candidate) => ({
      id: candidate.id,
      key: candidate.key,
      name: candidate.name,
      nameKey: candidate.nameKey,
      faceId: candidate.faceId,
      score: candidate.score,
      distance: candidate.distance,
      descriptorSize: candidate.descriptorSize,
      descriptorModel: candidate.descriptorModel,
    })),
  };
}
