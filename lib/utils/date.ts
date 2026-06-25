import type { Meeting } from "@/lib/firebase/schema";

export const APP_TIME_ZONE = "Asia/Jakarta";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function isValidDateKey(value?: string | null): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}


export function isValidMonthKey(value?: string | null): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export function currentMonthKey(timeZone = APP_TIME_ZONE) {
  return todayDateKey(timeZone).slice(0, 7);
}

export function monthKeyFromDateKey(value?: string | null) {
  const text = value?.trim() || "";
  return isValidDateKey(text) ? text.slice(0, 7) : "";
}

export function normalizeMonthKey(value?: string | null, fallback = currentMonthKey()) {
  return isValidMonthKey(value) ? (value as string) : fallback;
}

export function formatMonthKeyLong(monthKey: string) {
  if (!isValidMonthKey(monthKey)) return "Bulan tidak valid";
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1, 12));

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric"
  }).format(date);
}

export function todayDateKey(timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function dateKeyFromMillis(value?: number, timeZone = APP_TIME_ZONE) {
  if (!value || !Number.isFinite(value)) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function parseReadableDateKey(value?: string | null) {
  const text = value?.trim() || "";
  if (!text) return "";

  if (isValidDateKey(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  return "";
}

export function getMeetingDateKey(meeting: Pick<Meeting, "meetingDateKey" | "meetingDate" | "tanggal">) {
  const storedKey = meeting.meetingDateKey?.trim() || "";
  if (isValidDateKey(storedKey)) return storedKey;

  const fromMillis = dateKeyFromMillis(meeting.meetingDate);
  if (fromMillis) return fromMillis;

  return parseReadableDateKey(meeting.tanggal);
}

export function formatDateKeyLong(dateKey: string) {
  if (!isValidDateKey(dateKey)) return "Tanggal tidak valid";
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDateKeyShort(dateKey: string) {
  if (!isValidDateKey(dateKey)) return "-";
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
