import "server-only";

import type { CollectionReference, Query } from "firebase-admin/firestore";
import { firestoreDb, increment, serverTimestamp, Timestamp } from "./admin";
import { asBool, asNumber, asString, makeSafeDocId, millisNow } from "@/lib/utils/id";
import type { MasterProdi, Meeting, MeetingInfoForm, MeetingRunForm, Presence, RegisteredFace } from "./schema";

function mapFromSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function arrayOfNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asNumber(item, NaN)).filter((item) => Number.isFinite(item));
}

function arrayOfNumberArrays(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => arrayOfNumbers(item)).filter((item) => item.length > 0);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    const text = cleanString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }

  return output;
}

function cleanString(value: unknown, fallback = "") {
  return asString(value, fallback).trim();
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanFirestoreData<T>(value: T): T {
  if (value === undefined) return undefined as T;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Timestamp) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => cleanFirestoreData(item))
      .filter((item) => item !== undefined) as T;
  }

  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const cleaned = cleanFirestoreData(item);
    if (cleaned !== undefined) output[key] = cleaned;
  }

  return output as T;
}

function numberFromFirestore(value: unknown, fallback = 0) {
  if (value instanceof Timestamp) return value.toMillis();

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : fallback;
  }

  return asNumber(value, fallback);
}

function normalizeDateKey(value: unknown) {
  const text = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function dateKeyToReadable(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function dateKeyToDayName(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

function dateTimeJakartaToMillis(dateKey: string, time = "00:00") {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const millis = Date.parse(`${dateKey}T${safeTime}:00+07:00`);
  return Number.isFinite(millis) ? millis : millisNow();
}

function normalizeMonthKey(value: unknown) {
  const text = cleanString(value);
  return /^\d{4}-\d{2}$/.test(text) ? text : "";
}

function monthRangeJakartaMillis(monthKey: string) {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = Date.parse(`${match[1]}-${match[2]}-01T00:00:00+07:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = Date.parse(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}

function safePageParams(page?: number, pageSize?: number) {
  const cleanPage = Math.max(1, Math.floor(asNumber(page, 1)));
  const cleanPageSize = Math.min(100, Math.max(1, Math.floor(asNumber(pageSize, 20))));
  return { page: cleanPage, pageSize: cleanPageSize, offset: (cleanPage - 1) * cleanPageSize };
}

function assertScheduleNotPast(dateKey: string, time: string, label: string) {
  const meetingDate = dateTimeJakartaToMillis(dateKey, time || "00:00");
  if (meetingDate < millisNow()) {
    throw new Error(`${label} tidak boleh mundur dari waktu sekarang.`);
  }

  return meetingDate;
}

function makeTimeRange(start?: string, end?: string) {
  const cleanStart = cleanString(start);
  const cleanEnd = cleanString(end);
  if (cleanStart && cleanEnd) return `${cleanStart} - ${cleanEnd} WIB`;
  if (cleanStart) return `${cleanStart} WIB`;
  return "";
}

function optionalSafeDocId(value: unknown) {
  const text = cleanString(value);
  return text ? makeSafeDocId(text) : "";
}

function normalizeProdiSelection(params: { prodiIds?: unknown; prodiNames?: unknown; prodiText?: unknown }) {
  const prodiIds = stringArray(params.prodiIds).map((item) => makeSafeDocId(item));
  const prodiNames = stringArray(params.prodiNames);
  const prodiText = prodiNames.length > 0 ? prodiNames.join(", ") : cleanString(params.prodiText);

  return { prodiIds, prodiNames, prodiText };
}

function mapMasterProdiFromRaw(prodiId: string, raw: Record<string, unknown>): MasterProdi {
  const kode = cleanString(raw.kode || raw.code);
  const nama = cleanString(raw.nama || raw.name || raw.prodiName, prodiId);
  const displayName = cleanString(raw.displayName, kode ? `${kode} - ${nama}` : nama);

  return {
    prodiId: cleanString(raw.prodiId, prodiId),
    kode,
    nama,
    displayName,
    jenjang: cleanString(raw.jenjang),
    jurusan: cleanString(raw.jurusan),
    isActive: asBool(raw.isActive, true),
    createdAt: numberFromFirestore(raw.createdAt),
    updatedAt: numberFromFirestore(raw.updatedAt),
    syncedAt: raw.syncedAt && typeof raw.syncedAt === "object" ? numberFromFirestore(raw.syncedAt) : asNumber(raw.syncedAt),
    source: cleanString(raw.source),
  };
}

function mapRunForm(raw: Record<string, unknown>): MeetingRunForm | undefined {
  if (Object.keys(raw).length === 0) return undefined;

  return {
    agendaRapat: cleanString(raw.agendaRapat),
    pembahasan: cleanString(raw.pembahasan),
    hasilRapat: cleanString(raw.hasilRapat),
    catatanTambahan: cleanString(raw.catatanTambahan),
    tindakLanjut: cleanString(raw.tindakLanjut),
    pemimpinRapat: cleanString(raw.pemimpinRapat),
    notulis: cleanString(raw.notulis),
    startedAt: numberFromFirestore(raw.startedAt),
    finishedAt: raw.finishedAt === null ? null : numberFromFirestore(raw.finishedAt),
    updatedAt: numberFromFirestore(raw.updatedAt),
    status: cleanString(raw.status),
  };
}

function mapPresence(nameKey: string, raw: Record<string, unknown>): Presence | null {
  const name = cleanString(raw.name, nameKey);
  if (!name) return null;

  return {
    name,
    nameKey: cleanString(raw.nameKey, nameKey),
    faceId: cleanString(raw.faceId),
    jabatan: cleanString(raw.jabatan),
    prodi: cleanString(raw.prodi),
    prodiId: cleanString(raw.prodiId),
    prodiName: cleanString(raw.prodiName, cleanString(raw.prodi)),
    matched: asBool(raw.matched),
    score: asNumber(raw.score, NaN),
    lastScore: asNumber(raw.lastScore, asNumber(raw.score)),
    distance: asNumber(raw.distance, NaN),
    method: cleanString(raw.method, "web_face_api_js"),
    firstCheckInAt: numberFromFirestore(raw.firstCheckInAt),
    lastCheckInAt: numberFromFirestore(raw.lastCheckInAt),
    createdAt: numberFromFirestore(raw.createdAt),
    updatedAt: numberFromFirestore(raw.updatedAt),
    syncedAt: raw.syncedAt && typeof raw.syncedAt === "object" ? numberFromFirestore(raw.syncedAt) : asNumber(raw.syncedAt),
    source: cleanString(raw.source),
  };
}

function mapInvitationFromRaw(formId: string, raw: Record<string, unknown>): MeetingInfoForm {
  return {
    formId: cleanString(raw.formId, formId),
    noDokumen: cleanString(raw.noDokumen),
    meetingName: cleanString(raw.meetingName || raw.kegiatan || raw.title, "Undangan Meeting"),
    topikRapat: cleanString(raw.topikRapat),
    agendaRapat: cleanString(raw.agendaRapat),
    tanggal: cleanString(raw.tanggal),
    hari: cleanString(raw.hari),
    tempat: cleanString(raw.tempat),
    waktuMulai: cleanString(raw.waktuMulai),
    waktuSelesai: cleanString(raw.waktuSelesai),
    waktu: cleanString(raw.waktu),
    pemimpinRapat: cleanString(raw.pemimpinRapat),
    notulis: cleanString(raw.notulis),
    prodiIds: stringArray(raw.prodiIds),
    prodiNames: stringArray(raw.prodiNames),
    prodiText: cleanString(raw.prodiText || raw.prodi),
    pesertaText: cleanString(raw.pesertaText),
    catatan: cleanString(raw.catatan),
    status: cleanString(raw.status, "scheduled"),
    meetingId: cleanString(raw.meetingId),
    meetingDate: numberFromFirestore(raw.meetingDate),
    meetingDateKey: cleanString(raw.meetingDateKey),
    createdAt: numberFromFirestore(raw.createdAt),
    updatedAt: numberFromFirestore(raw.updatedAt),
    syncedAt: numberFromFirestore(raw.syncedAt),
    source: cleanString(raw.source),
  };
}

function mapMeetingFromRaw(meetingId: string, raw: Record<string, unknown>): Meeting {
  const presencesRaw = mapFromSnapshot(raw.presences);
  const presences: Record<string, Presence> = {};

  for (const [presenceKey, presenceRaw] of Object.entries(presencesRaw)) {
    const presence = mapPresence(presenceKey, mapFromSnapshot(presenceRaw));
    if (presence) presences[presenceKey] = presence;
  }

  const presenceCount = Object.keys(presences).length;

  return {
    meetingId: cleanString(raw.meetingId, meetingId),
    meetingName: cleanString(raw.meetingName || raw.name || raw.title, meetingId),
    noDokumen: cleanString(raw.noDokumen),
    catatan: cleanString(raw.catatan),
    tanggal: cleanString(raw.tanggal),
    hari: cleanString(raw.hari),
    tempat: cleanString(raw.tempat),
    waktu: cleanString(raw.waktu),
    waktuMulai: cleanString(raw.waktuMulai),
    waktuSelesai: cleanString(raw.waktuSelesai),
    topikRapat: cleanString(raw.topikRapat),
    agendaRapat: cleanString(raw.agendaRapat),
    pembahasan: cleanString(raw.pembahasan),
    hasilRapat: cleanString(raw.hasilRapat),
    catatanTambahan: cleanString(raw.catatanTambahan),
    tindakLanjut: cleanString(raw.tindakLanjut),
    pemimpinRapat: cleanString(raw.pemimpinRapat),
    notulis: cleanString(raw.notulis),
    prodiIds: stringArray(raw.prodiIds),
    prodiNames: stringArray(raw.prodiNames),
    prodiText: cleanString(raw.prodiText || raw.prodi),
    sourceInvitationFormId: cleanString(raw.sourceInvitationFormId),
    meetingDate: numberFromFirestore(raw.meetingDate),
    meetingDateKey: cleanString(raw.meetingDateKey),
    status: cleanString(raw.status, "active"),
    participantsCount: asNumber(raw.participantsCount, presenceCount),
    createdAt: numberFromFirestore(raw.createdAt),
    updatedAt: numberFromFirestore(raw.updatedAt),
    closedAt: raw.closedAt === null ? null : numberFromFirestore(raw.closedAt),
    syncedAt: numberFromFirestore(raw.syncedAt),
    source: cleanString(raw.source),
    runForm: mapRunForm(mapFromSnapshot(raw.runForm)),
    presences,
  };
}

export async function getMasterProdi(includeInactive = true): Promise<MasterProdi[]> {
  const snap = await firestoreDb().collection("master_prodi").get();
  const items: MasterProdi[] = [];

  for (const doc of snap.docs) {
    const item = mapMasterProdiFromRaw(doc.id, mapFromSnapshot(doc.data()));
    if (!includeInactive && !item.isActive) continue;
    items.push(item);
  }

  return items.sort((a, b) => a.displayName.localeCompare(b.displayName, "id-ID"));
}

export async function getActiveMasterProdi(): Promise<MasterProdi[]> {
  return getMasterProdi(false);
}

export async function getMasterProdiItem(prodiId: string): Promise<MasterProdi | null> {
  const cleanProdiId = makeSafeDocId(cleanString(prodiId));
  if (!cleanProdiId) return null;

  const snap = await firestoreDb().collection("master_prodi").doc(cleanProdiId).get();
  if (!snap.exists) return null;
  return mapMasterProdiFromRaw(cleanProdiId, mapFromSnapshot(snap.data()));
}

export async function saveMasterProdi(params: {
  prodiId?: string;
  kode?: string;
  nama: string;
  jenjang?: string;
  jurusan?: string;
  isActive?: boolean;
}): Promise<MasterProdi> {
  const nama = cleanString(params.nama);
  if (!nama) throw new Error("Nama prodi wajib diisi.");

  const kode = cleanString(params.kode).toUpperCase();
  const prodiId = makeSafeDocId(cleanString(params.prodiId, kode || nama));
  if (!prodiId) throw new Error("prodiId gagal dibuat.");

  const now = millisNow();
  const docRef = firestoreDb().collection("master_prodi").doc(prodiId);
  const snap = await docRef.get();
  const existing = mapFromSnapshot(snap.data());
  const createdAt = snap.exists ? numberFromFirestore(existing.createdAt, now) : now;
  const displayName = kode ? `${kode} - ${nama}` : nama;

  const item: MasterProdi = {
    prodiId,
    kode,
    nama,
    displayName,
    jenjang: cleanString(params.jenjang),
    jurusan: cleanString(params.jurusan),
    isActive: params.isActive ?? asBool(existing.isActive, true),
    createdAt,
    updatedAt: now,
    syncedAt: now,
    source: "nextjs_admin_master_prodi",
  };

  await docRef.set(cleanFirestoreData({ ...item, syncedAt: serverTimestamp() }), { merge: true });
  return item;
}

export async function updateMasterProdi(prodiId: string, params: {
  kode?: string;
  nama?: string;
  jenjang?: string;
  jurusan?: string;
  isActive?: boolean;
}): Promise<MasterProdi> {
  const cleanProdiId = makeSafeDocId(cleanString(prodiId));
  if (!cleanProdiId) throw new Error("prodiId wajib diisi.");

  const existing = await getMasterProdiItem(cleanProdiId);
  if (!existing) throw new Error("Master prodi tidak ditemukan.");

  const kode = cleanString(params.kode, existing.kode || "").toUpperCase();
  const nama = cleanString(params.nama, existing.nama);
  if (!nama) throw new Error("Nama prodi wajib diisi.");

  const now = millisNow();
  const displayName = kode ? `${kode} - ${nama}` : nama;

  const updated: MasterProdi = {
    ...existing,
    prodiId: cleanProdiId,
    kode,
    nama,
    displayName,
    jenjang: cleanString(params.jenjang, existing.jenjang || ""),
    jurusan: cleanString(params.jurusan, existing.jurusan || ""),
    isActive: params.isActive ?? existing.isActive,
    updatedAt: now,
    syncedAt: now,
    source: existing.source || "nextjs_admin_master_prodi",
  };

  await firestoreDb().collection("master_prodi").doc(cleanProdiId).set(
    cleanFirestoreData({ ...updated, syncedAt: serverTimestamp() }),
    { merge: true }
  );

  return updated;
}

export async function deleteMasterProdi(prodiId: string): Promise<void> {
  const cleanProdiId = makeSafeDocId(cleanString(prodiId));
  if (!cleanProdiId) throw new Error("prodiId wajib diisi.");
  await firestoreDb().collection("master_prodi").doc(cleanProdiId).delete();
}

export async function getMeetings(collectionPath = "meetings"): Promise<Meeting[]> {
  const snap = await firestoreDb().collection(collectionPath).get();
  const meetings: Meeting[] = [];

  for (const doc of snap.docs) {
    const raw = mapFromSnapshot(doc.data());
    if (Object.keys(raw).length === 0) continue;
    meetings.push(mapMeetingFromRaw(doc.id, raw));
  }

  return meetings.sort((a, b) => {
    const dateB = b.meetingDate || b.updatedAt || b.createdAt || 0;
    const dateA = a.meetingDate || a.updatedAt || a.createdAt || 0;
    return dateB - dateA;
  });
}

export async function getMeetingsPage(params: { monthKey?: string; page?: number; pageSize?: number } = {}): Promise<{ items: Meeting[]; totalCount: number; page: number; pageSize: number; monthKey: string }> {
  const monthKey = normalizeMonthKey(params.monthKey);
  const { page, pageSize, offset } = safePageParams(params.page, params.pageSize);
  const range = monthKey ? monthRangeJakartaMillis(monthKey) : null;
  let query: Query = firestoreDb().collection("meetings");

  if (range) {
    query = query.where("meetingDate", ">=", range.start).where("meetingDate", "<", range.end).orderBy("meetingDate", "desc");
  }

  const snap = await query.get();
  const allItems: Meeting[] = [];

  for (const doc of snap.docs) {
    const raw = mapFromSnapshot(doc.data());
    if (Object.keys(raw).length === 0) continue;
    allItems.push(mapMeetingFromRaw(doc.id, raw));
  }

  const sorted = allItems.sort((a, b) => {
    const dateB = b.meetingDate || b.updatedAt || b.createdAt || 0;
    const dateA = a.meetingDate || a.updatedAt || a.createdAt || 0;
    return dateB - dateA;
  });

  return {
    items: sorted.slice(offset, offset + pageSize),
    totalCount: sorted.length,
    page,
    pageSize,
    monthKey,
  };
}

export async function getMeeting(meetingId: string, collectionPath = "meetings"): Promise<Meeting | null> {
  const cleanMeetingId = meetingId.trim();
  if (!cleanMeetingId) return null;

  const snap = await firestoreDb().collection(collectionPath).doc(cleanMeetingId).get();
  if (!snap.exists) return null;

  return mapMeetingFromRaw(cleanMeetingId, mapFromSnapshot(snap.data()));
}

export async function getPresenceList(meetingId: string, collectionPath = "meetings"): Promise<Presence[]> {
  const cleanMeetingId = meetingId.trim();
  if (!cleanMeetingId) return [];

  const snap = await firestoreDb().collection(collectionPath).doc(cleanMeetingId).collection("presences").get();
  const presences: Presence[] = [];

  for (const doc of snap.docs) {
    const presence = mapPresence(doc.id, mapFromSnapshot(doc.data()));
    if (presence) presences.push(presence);
  }

  return presences.sort((a, b) => {
    const timeB = b.lastCheckInAt || b.firstCheckInAt || b.updatedAt || 0;
    const timeA = a.lastCheckInAt || a.firstCheckInAt || a.updatedAt || 0;
    return timeB - timeA;
  });
}

export async function getInvitationForms(): Promise<MeetingInfoForm[]> {
  const snap = await firestoreDb().collection("meeting_info_forms").get();
  const forms: MeetingInfoForm[] = [];

  for (const doc of snap.docs) {
    const raw = mapFromSnapshot(doc.data());
    if (Object.keys(raw).length === 0) continue;
    forms.push(mapInvitationFromRaw(doc.id, raw));
  }

  return forms.sort((a, b) => {
    const dateB = b.meetingDate || b.updatedAt || b.createdAt || 0;
    const dateA = a.meetingDate || a.updatedAt || a.createdAt || 0;
    return dateB - dateA;
  });
}

export async function getInvitationFormsPage(params: { monthKey?: string; page?: number; pageSize?: number } = {}): Promise<{ items: MeetingInfoForm[]; totalCount: number; page: number; pageSize: number; monthKey: string }> {
  const monthKey = normalizeMonthKey(params.monthKey);
  const { page, pageSize, offset } = safePageParams(params.page, params.pageSize);
  const range = monthKey ? monthRangeJakartaMillis(monthKey) : null;
  let query: Query = firestoreDb().collection("meeting_info_forms");

  if (range) {
    query = query.where("meetingDate", ">=", range.start).where("meetingDate", "<", range.end).orderBy("meetingDate", "desc");
  }

  const snap = await query.get();
  const allItems: MeetingInfoForm[] = [];

  for (const doc of snap.docs) {
    const raw = mapFromSnapshot(doc.data());
    if (Object.keys(raw).length === 0) continue;
    allItems.push(mapInvitationFromRaw(doc.id, raw));
  }

  const sorted = allItems.sort((a, b) => {
    const dateB = b.meetingDate || b.updatedAt || b.createdAt || 0;
    const dateA = a.meetingDate || a.updatedAt || a.createdAt || 0;
    return dateB - dateA;
  });

  return {
    items: sorted.slice(offset, offset + pageSize),
    totalCount: sorted.length,
    page,
    pageSize,
    monthKey,
  };
}

export async function getInvitationForm(formId: string): Promise<MeetingInfoForm | null> {
  const cleanFormId = formId.trim();
  if (!cleanFormId) return null;

  const snap = await firestoreDb().collection("meeting_info_forms").doc(cleanFormId).get();
  if (!snap.exists) return null;

  return mapInvitationFromRaw(cleanFormId, mapFromSnapshot(snap.data()));
}

export async function createInvitationForm(params: {
  noDokumen?: string;
  meetingName: string;
  topikRapat?: string;
  agendaRapat?: string;
  tanggalKey: string;
  tempat?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  pemimpinRapat?: string;
  notulis?: string;
  prodiIds?: string[];
  prodiNames?: string[];
  prodiText?: string;
  pesertaText?: string;
  catatan?: string;
}): Promise<MeetingInfoForm> {
  const now = millisNow();
  const dateKey = normalizeDateKey(params.tanggalKey);
  const meetingName = cleanString(params.meetingName);
  const waktuMulai = cleanString(params.waktuMulai);

  if (!meetingName) throw new Error("Nama meeting wajib diisi.");
  if (!dateKey) throw new Error("Tanggal wajib memakai format yyyy-MM-dd.");

  const formId = `undangan_${now}_${makeSafeDocId(meetingName).slice(0, 32)}`;
  const meetingDate = assertScheduleNotPast(dateKey, waktuMulai || "00:00", "Waktu undangan");
  const prodiSelection = normalizeProdiSelection(params);

  const form: MeetingInfoForm = {
    formId,
    noDokumen: cleanString(params.noDokumen),
    meetingName,
    topikRapat: cleanString(params.topikRapat),
    agendaRapat: cleanString(params.agendaRapat),
    tanggal: dateKeyToReadable(dateKey),
    hari: dateKeyToDayName(dateKey),
    tempat: cleanString(params.tempat),
    waktuMulai,
    waktuSelesai: cleanString(params.waktuSelesai),
    waktu: makeTimeRange(waktuMulai, params.waktuSelesai),
    pemimpinRapat: cleanString(params.pemimpinRapat),
    notulis: cleanString(params.notulis),
    prodiIds: prodiSelection.prodiIds,
    prodiNames: prodiSelection.prodiNames,
    prodiText: prodiSelection.prodiText,
    pesertaText: cleanString(params.pesertaText),
    catatan: cleanString(params.catatan),
    status: "scheduled",
    meetingDate,
    meetingDateKey: dateKey,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    source: "nextjs_admin_invitation",
  };

  const db = firestoreDb();
  const batch = db.batch();
  batch.set(db.collection("meeting_info_forms").doc(formId), cleanFirestoreData({ ...form, syncedAt: serverTimestamp() }));
  batch.set(
    db.collection("calendar_marks").doc(dateKey),
    cleanFirestoreData({
      meetingInfoForms: { [formId]: true },
      updatedAt: now,
      syncedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  await batch.commit();
  return form;
}


export async function updateInvitationForm(formId: string, params: {
  noDokumen?: string;
  meetingName?: string;
  topikRapat?: string;
  agendaRapat?: string;
  tanggalKey?: string;
  tempat?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  pemimpinRapat?: string;
  notulis?: string;
  prodiIds?: string[];
  prodiNames?: string[];
  prodiText?: string;
  pesertaText?: string;
  catatan?: string;
  status?: string;
}): Promise<MeetingInfoForm> {
  const cleanFormId = cleanString(formId);
  if (!cleanFormId) throw new Error("formId wajib diisi.");

  const existing = await getInvitationForm(cleanFormId);
  if (!existing) throw new Error("Undangan tidak ditemukan.");

  const now = millisNow();
  const meetingName = cleanString(params.meetingName, existing.meetingName);
  const dateKey = normalizeDateKey(params.tanggalKey || existing.meetingDateKey);
  const waktuMulai = cleanString(params.waktuMulai, existing.waktuMulai || "");
  const waktuSelesai = cleanString(params.waktuSelesai, existing.waktuSelesai || "");
  const prodiSelection = normalizeProdiSelection({
    prodiIds: params.prodiIds !== undefined ? params.prodiIds : existing.prodiIds,
    prodiNames: params.prodiNames !== undefined ? params.prodiNames : existing.prodiNames,
    prodiText: params.prodiText !== undefined ? params.prodiText : existing.prodiText,
  });

  if (!meetingName) throw new Error("Nama meeting wajib diisi.");
  if (!dateKey) throw new Error("Tanggal wajib memakai format yyyy-MM-dd.");

  const patch: Partial<MeetingInfoForm> = {
    noDokumen: cleanString(params.noDokumen, existing.noDokumen || ""),
    meetingName,
    topikRapat: cleanString(params.topikRapat, existing.topikRapat || ""),
    agendaRapat: cleanString(params.agendaRapat, existing.agendaRapat || ""),
    tanggal: dateKeyToReadable(dateKey),
    hari: dateKeyToDayName(dateKey),
    tempat: cleanString(params.tempat, existing.tempat || ""),
    waktuMulai,
    waktuSelesai,
    waktu: makeTimeRange(waktuMulai, waktuSelesai),
    pemimpinRapat: cleanString(params.pemimpinRapat, existing.pemimpinRapat || ""),
    notulis: cleanString(params.notulis, existing.notulis || ""),
    prodiIds: prodiSelection.prodiIds,
    prodiNames: prodiSelection.prodiNames,
    prodiText: prodiSelection.prodiText,
    pesertaText: cleanString(params.pesertaText, existing.pesertaText || ""),
    catatan: cleanString(params.catatan, existing.catatan || ""),
    status: cleanString(params.status, existing.status || "scheduled"),
    meetingDate: assertScheduleNotPast(dateKey, waktuMulai || "00:00", "Waktu undangan"),
    meetingDateKey: dateKey,
    updatedAt: now,
    syncedAt: now,
  };

  await firestoreDb().collection("meeting_info_forms").doc(cleanFormId).set(
    cleanFirestoreData({ ...patch, syncedAt: serverTimestamp() }),
    { merge: true }
  );

  const updated = await getInvitationForm(cleanFormId);
  if (!updated) throw new Error("Undangan gagal dimuat setelah disimpan.");
  return updated;
}

export async function deleteInvitationForm(formId: string): Promise<void> {
  const cleanFormId = cleanString(formId);
  if (!cleanFormId) throw new Error("formId wajib diisi.");
  await firestoreDb().collection("meeting_info_forms").doc(cleanFormId).delete();
}

export async function createMeetingFromInvitation(formId: string): Promise<Meeting> {
  const invitation = await getInvitationForm(formId);
  if (!invitation) throw new Error("Undangan tidak ditemukan.");

  if (invitation.meetingId) {
    const existing = await getMeeting(invitation.meetingId);
    if (existing) return existing;
  }

  const now = millisNow();
  const meetingId = `meeting_${now}_${makeSafeDocId(invitation.meetingName).slice(0, 32)}`;

  const runForm: MeetingRunForm = {
    agendaRapat: invitation.agendaRapat || "",
    pembahasan: "",
    hasilRapat: "",
    catatanTambahan: "",
    tindakLanjut: "",
    pemimpinRapat: invitation.pemimpinRapat || "",
    notulis: invitation.notulis || "",
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    status: "active",
  };

  const meeting: Meeting = {
    meetingId,
    meetingName: invitation.meetingName,
    noDokumen: invitation.noDokumen || "",
    catatan: invitation.catatan || "",
    tanggal: invitation.tanggal || "",
    hari: invitation.hari || "",
    tempat: invitation.tempat || "",
    waktu: invitation.waktu || makeTimeRange(invitation.waktuMulai, invitation.waktuSelesai),
    waktuMulai: invitation.waktuMulai || "",
    waktuSelesai: invitation.waktuSelesai || "",
    topikRapat: invitation.topikRapat || "",
    agendaRapat: invitation.agendaRapat || "",
    pembahasan: "",
    hasilRapat: "",
    catatanTambahan: "",
    tindakLanjut: "",
    pemimpinRapat: invitation.pemimpinRapat || "",
    notulis: invitation.notulis || "",
    prodiIds: invitation.prodiIds || [],
    prodiNames: invitation.prodiNames || [],
    prodiText: invitation.prodiText || "",
    sourceInvitationFormId: formId,
    meetingDate: assertScheduleNotPast(invitation.meetingDateKey || "", invitation.waktuMulai || "00:00", "Waktu meeting"),
    meetingDateKey: invitation.meetingDateKey || "",
    status: "active",
    participantsCount: 0,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    syncedAt: now,
    source: "nextjs_admin_invitation_start",
    runForm,
  };

  const db = firestoreDb();
  const batch = db.batch();
  batch.set(db.collection("meetings").doc(meetingId), cleanFirestoreData({ ...meeting, syncedAt: serverTimestamp() }));
  batch.set(
    db.collection("meeting_info_forms").doc(formId),
    cleanFirestoreData({ meetingId, status: "started", updatedAt: now, syncedAt: serverTimestamp() }),
    { merge: true }
  );
  if (meeting.meetingDateKey) {
    batch.set(
      db.collection("calendar_marks").doc(meeting.meetingDateKey),
      cleanFirestoreData({ meetings: { [meetingId]: true }, updatedAt: now, syncedAt: serverTimestamp() }),
      { merge: true }
    );
  }

  await batch.commit();
  return meeting;
}

export async function createMeetingDirect(params: {
  meetingName: string;
  noDokumen?: string;
  topikRapat?: string;
  agendaRapat?: string;
  tanggalKey: string;
  tempat?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  pemimpinRapat?: string;
  notulis?: string;
  prodiIds?: string[];
  prodiNames?: string[];
  prodiText?: string;
  catatan?: string;
  sourceInvitationFormId?: string;
}): Promise<Meeting> {
  const now = millisNow();
  const dateKey = normalizeDateKey(params.tanggalKey);
  const meetingName = cleanString(params.meetingName);
  const waktuMulai = cleanString(params.waktuMulai);

  if (!meetingName) throw new Error("Nama meeting wajib diisi.");
  if (!dateKey) throw new Error("Tanggal wajib memakai format yyyy-MM-dd.");

  const meetingId = `meeting_${now}_${makeSafeDocId(meetingName).slice(0, 32)}`;
  const meetingDate = assertScheduleNotPast(dateKey, waktuMulai || "00:00", "Waktu meeting");
  const sourceInvitationFormId = cleanString(params.sourceInvitationFormId);
  const prodiSelection = normalizeProdiSelection(params);
  const runForm: MeetingRunForm = {
    agendaRapat: cleanString(params.agendaRapat),
    pembahasan: "",
    hasilRapat: "",
    catatanTambahan: "",
    tindakLanjut: "",
    pemimpinRapat: cleanString(params.pemimpinRapat),
    notulis: cleanString(params.notulis),
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    status: "active",
  };

  const meeting: Meeting = {
    meetingId,
    meetingName,
    noDokumen: cleanString(params.noDokumen),
    catatan: cleanString(params.catatan),
    tanggal: dateKeyToReadable(dateKey),
    hari: dateKeyToDayName(dateKey),
    tempat: cleanString(params.tempat),
    waktu: makeTimeRange(waktuMulai, params.waktuSelesai),
    waktuMulai,
    waktuSelesai: cleanString(params.waktuSelesai),
    topikRapat: cleanString(params.topikRapat),
    agendaRapat: cleanString(params.agendaRapat),
    pembahasan: "",
    hasilRapat: "",
    catatanTambahan: "",
    tindakLanjut: "",
    pemimpinRapat: cleanString(params.pemimpinRapat),
    notulis: cleanString(params.notulis),
    prodiIds: prodiSelection.prodiIds,
    prodiNames: prodiSelection.prodiNames,
    prodiText: prodiSelection.prodiText,
    sourceInvitationFormId,
    meetingDate,
    meetingDateKey: dateKey,
    status: "active",
    participantsCount: 0,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    syncedAt: now,
    source: "nextjs_admin_direct_meeting",
    runForm,
  };

  const db = firestoreDb();
  const batch = db.batch();
  batch.set(db.collection("meetings").doc(meetingId), cleanFirestoreData({ ...meeting, syncedAt: serverTimestamp() }));
  batch.set(
    db.collection("calendar_marks").doc(dateKey),
    cleanFirestoreData({ meetings: { [meetingId]: true }, updatedAt: now, syncedAt: serverTimestamp() }),
    { merge: true }
  );

  if (sourceInvitationFormId) {
    batch.set(
      db.collection("meeting_info_forms").doc(sourceInvitationFormId),
      cleanFirestoreData({ meetingId, status: "started", updatedAt: now, syncedAt: serverTimestamp() }),
      { merge: true }
    );
  }

  await batch.commit();

  return meeting;
}


export async function updateMeetingDirect(meetingId: string, params: {
  meetingName?: string;
  noDokumen?: string;
  topikRapat?: string;
  agendaRapat?: string;
  tanggalKey?: string;
  tempat?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  pemimpinRapat?: string;
  notulis?: string;
  prodiIds?: string[];
  prodiNames?: string[];
  prodiText?: string;
  catatan?: string;
  status?: string;
}): Promise<Meeting> {
  const cleanMeetingId = cleanString(meetingId);
  if (!cleanMeetingId) throw new Error("meetingId wajib diisi.");

  const existing = await getMeeting(cleanMeetingId);
  if (!existing) throw new Error("Meeting tidak ditemukan.");

  const now = millisNow();
  const meetingName = cleanString(params.meetingName, existing.meetingName);
  const dateKey = normalizeDateKey(params.tanggalKey || existing.meetingDateKey);
  const waktuMulai = cleanString(params.waktuMulai, existing.waktuMulai || "");
  const waktuSelesai = cleanString(params.waktuSelesai, existing.waktuSelesai || "");
  const status = cleanString(params.status, existing.status || "active") === "closed" ? "closed" : "active";
  const prodiSelection = normalizeProdiSelection({
    prodiIds: params.prodiIds !== undefined ? params.prodiIds : existing.prodiIds,
    prodiNames: params.prodiNames !== undefined ? params.prodiNames : existing.prodiNames,
    prodiText: params.prodiText !== undefined ? params.prodiText : existing.prodiText,
  });

  if (!meetingName) throw new Error("Nama meeting wajib diisi.");
  if (!dateKey) throw new Error("Tanggal wajib memakai format yyyy-MM-dd.");

  const agendaRapat = cleanString(params.agendaRapat, existing.agendaRapat || "");
  const pemimpinRapat = cleanString(params.pemimpinRapat, existing.pemimpinRapat || "");
  const notulis = cleanString(params.notulis, existing.notulis || "");
  const runForm: MeetingRunForm = {
    ...(existing.runForm || {}),
    agendaRapat,
    pemimpinRapat,
    notulis,
    updatedAt: now,
    status,
    finishedAt: status === "closed" ? existing.runForm?.finishedAt || now : null,
  };

  const patch: Partial<Meeting> = {
    meetingName,
    noDokumen: cleanString(params.noDokumen, existing.noDokumen || ""),
    topikRapat: cleanString(params.topikRapat, existing.topikRapat || ""),
    agendaRapat,
    catatan: cleanString(params.catatan, existing.catatan || ""),
    tanggal: dateKeyToReadable(dateKey),
    hari: dateKeyToDayName(dateKey),
    tempat: cleanString(params.tempat, existing.tempat || ""),
    waktuMulai,
    waktuSelesai,
    waktu: makeTimeRange(waktuMulai, waktuSelesai),
    pemimpinRapat,
    notulis,
    prodiIds: prodiSelection.prodiIds,
    prodiNames: prodiSelection.prodiNames,
    prodiText: prodiSelection.prodiText,
    meetingDate: assertScheduleNotPast(dateKey, waktuMulai || "00:00", "Waktu meeting"),
    meetingDateKey: dateKey,
    status,
    closedAt: status === "closed" ? existing.closedAt || now : null,
    updatedAt: now,
    syncedAt: now,
    runForm,
  };

  await firestoreDb().collection("meetings").doc(cleanMeetingId).set(
    cleanFirestoreData({ ...patch, syncedAt: serverTimestamp() }),
    { merge: true }
  );

  const updated = await getMeeting(cleanMeetingId);
  if (!updated) throw new Error("Meeting gagal dimuat setelah disimpan.");
  return updated;
}

async function deleteSubcollection(collectionRef: CollectionReference, batchSize = 400) {
  while (true) {
    const snap = await collectionRef.limit(batchSize).get();
    if (snap.empty) break;

    const batch = firestoreDb().batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const cleanMeetingId = cleanString(meetingId);
  if (!cleanMeetingId) throw new Error("meetingId wajib diisi.");

  const meetingRef = firestoreDb().collection("meetings").doc(cleanMeetingId);
  await deleteSubcollection(meetingRef.collection("presences"));
  await meetingRef.delete();
}

export async function saveMeetingRunForm(meetingId: string, params: MeetingRunForm): Promise<Meeting> {
  const cleanMeetingId = cleanString(meetingId);
  if (!cleanMeetingId) throw new Error("meetingId wajib diisi.");

  const meeting = await getMeeting(cleanMeetingId);
  if (!meeting) throw new Error("Meeting tidak ditemukan.");

  const now = millisNow();
  const nextStatus = cleanString(params.status, meeting.status || "active") === "closed" ? "closed" : "active";
  const isClosed = nextStatus === "closed";

  const runForm: MeetingRunForm = {
    agendaRapat: cleanString(params.agendaRapat, meeting.agendaRapat || ""),
    pembahasan: cleanString(params.pembahasan),
    hasilRapat: cleanString(params.hasilRapat),
    catatanTambahan: cleanString(params.catatanTambahan),
    tindakLanjut: cleanString(params.tindakLanjut),
    pemimpinRapat: cleanString(params.pemimpinRapat, meeting.pemimpinRapat || ""),
    notulis: cleanString(params.notulis, meeting.notulis || ""),
    startedAt: asNumber(params.startedAt, meeting.runForm?.startedAt || meeting.createdAt || now),
    finishedAt: isClosed ? asNumber(params.finishedAt, now) : null,
    updatedAt: now,
    status: nextStatus,
  };

  await firestoreDb().collection("meetings").doc(cleanMeetingId).set(
    cleanFirestoreData({
      agendaRapat: runForm.agendaRapat || "",
      pembahasan: runForm.pembahasan || "",
      hasilRapat: runForm.hasilRapat || "",
      catatanTambahan: runForm.catatanTambahan || "",
      tindakLanjut: runForm.tindakLanjut || "",
      pemimpinRapat: runForm.pemimpinRapat || "",
      notulis: runForm.notulis || "",
      runForm,
      status: nextStatus,
      closedAt: isClosed ? now : null,
      updatedAt: now,
      syncedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  const updated = await getMeeting(cleanMeetingId);
  if (!updated) throw new Error("Meeting gagal dimuat setelah disimpan.");
  return updated;
}

export async function getRegisteredFaces(): Promise<RegisteredFace[]> {
  const snap = await firestoreDb().collection("registered_faces").get();
  const faces: RegisteredFace[] = [];

  for (const doc of snap.docs) {
    const nodeKey = doc.id;
    const data = mapFromSnapshot(doc.data());
    const faceApiRaw = mapFromSnapshot(data.faceApi);
    const name = cleanString(data.name, nodeKey);
    const nameKey = cleanString(data.nameKey, nodeKey);
    const descriptor = arrayOfNumbers(data.descriptor || data.faceDescriptor || data.faceApiDescriptor || faceApiRaw.descriptor);
    const descriptors = arrayOfNumberArrays(data.descriptors || faceApiRaw.descriptors);
    const matrix = arrayOfNumbers(data.matrix || faceApiRaw.matrix);

    if (!name || !nameKey) continue;
    if (descriptor.length === 0 && descriptors.length === 0 && matrix.length === 0) continue;

    faces.push({
      nodeKey,
      name,
      nameKey,
      faceId: cleanString(data.faceId, nameKey),
      jabatan: cleanString(data.jabatan),
      prodi: cleanString(data.prodiName || data.prodi),
      prodiId: cleanString(data.prodiId),
      prodiName: cleanString(data.prodiName || data.prodi),
      descriptor: descriptor.length > 0 ? descriptor : undefined,
      descriptors: descriptors.length > 0 ? descriptors : undefined,
      descriptorSize: asNumber(data.descriptorSize || faceApiRaw.descriptorSize, descriptor.length || descriptors[0]?.length || matrix.length),
      descriptorModel: cleanString(data.descriptorModel || faceApiRaw.model, "face-api.js"),
      matrix: matrix.length > 0 ? matrix : undefined,
      matrixRows: asNumber(data.matrixRows || faceApiRaw.matrixRows, matrix.length > 0 ? 1 : 0),
      matrixCols: asNumber(data.matrixCols || faceApiRaw.matrixCols, matrix.length),
      faceApi: Object.keys(faceApiRaw).length > 0
        ? {
            model: cleanString(faceApiRaw.model, "face-api.js"),
            modelName: cleanString(faceApiRaw.modelName, "FaceRecognitionNet"),
            descriptorSize: asNumber(faceApiRaw.descriptorSize, descriptor.length || descriptors[0]?.length || matrix.length || 128),
            descriptor: arrayOfNumbers(faceApiRaw.descriptor),
            descriptors: arrayOfNumberArrays(faceApiRaw.descriptors),
            matrix: arrayOfNumbers(faceApiRaw.matrix),
            matrixRows: asNumber(faceApiRaw.matrixRows, matrix.length > 0 ? 1 : 0),
            matrixCols: asNumber(faceApiRaw.matrixCols, matrix.length),
            metric: cleanString(faceApiRaw.metric, "euclidean"),
            distanceThreshold: asNumber(faceApiRaw.distanceThreshold, 0.6),
            createdAt: numberFromFirestore(faceApiRaw.createdAt),
            updatedAt: numberFromFirestore(faceApiRaw.updatedAt),
          }
        : undefined,
      hasSignature: asBool(data.hasSignature),
      signatureBase64: cleanString(data.signatureBase64),
      signatureMimeType: cleanString(data.signatureMimeType),
      signatureUpdatedAt: data.signatureUpdatedAt === null ? null : numberFromFirestore(data.signatureUpdatedAt),
      hasFaceThumbnail: asBool(data.hasFaceThumbnail),
      faceThumbnailBase64: cleanString(data.faceThumbnailBase64),
      faceThumbnailMimeType: cleanString(data.faceThumbnailMimeType),
      faceThumbnailUpdatedAt: data.faceThumbnailUpdatedAt === null ? null : numberFromFirestore(data.faceThumbnailUpdatedAt),
      createdAt: numberFromFirestore(data.createdAt),
      updatedAt: numberFromFirestore(data.updatedAt),
      syncedAt: numberFromFirestore(data.syncedAt),
      source: cleanString(data.source),
    });
  }

  return faces.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}


export async function getRegisteredFace(nameKey: string): Promise<RegisteredFace | null> {
  const cleanNameKey = makeSafeDocId(cleanString(nameKey));
  if (!cleanNameKey) return null;

  const faces = await getRegisteredFaces();
  return faces.find((face) => face.nameKey === cleanNameKey || face.nodeKey === cleanNameKey || face.faceId === cleanNameKey) || null;
}

export async function saveFaceApiRegisteredFace(params: {
  name: string;
  nameKey?: string;
  faceId?: string;
  jabatan?: string;
  prodi?: string;
  prodiId?: string;
  prodiName?: string;
  descriptor?: number[];
  descriptors?: number[][];
  matrix?: number[];
  faceThumbnailBase64?: string;
  faceThumbnailMimeType?: string;
  signatureBase64?: string;
  signatureMimeType?: string;
}): Promise<RegisteredFace> {
  const now = millisNow();
  const name = cleanString(params.name);
  const nameKey = makeSafeDocId(cleanString(params.nameKey, name));
  const faceId = cleanString(params.faceId, nameKey);
  const prodiId = optionalSafeDocId(params.prodiId);
  const prodiName = cleanString(params.prodiName, cleanString(params.prodi));
  const descriptor = arrayOfNumbers(params.descriptor);
  const descriptors = arrayOfNumberArrays(params.descriptors);
  const matrix = arrayOfNumbers(params.matrix);
  const signatureBase64 = cleanString(params.signatureBase64);
  const signatureMimeType = cleanString(params.signatureMimeType, "image/png");
  const firstVector = descriptor.length > 0 ? descriptor : descriptors[0] || matrix;

  if (!name) throw new Error("Nama wajib diisi.");
  if (!nameKey) throw new Error("nameKey gagal dibuat.");
  if (firstVector.length !== 128) throw new Error("Descriptor face-api.js harus berisi 128 angka.");

  const docRef = firestoreDb().collection("registered_faces").doc(nameKey);
  const existingSnap = await docRef.get();
  const existing = mapFromSnapshot(existingSnap.data());
  const createdAt = existingSnap.exists ? numberFromFirestore(existing.createdAt, now) : now;

  const face: RegisteredFace = {
    nodeKey: nameKey,
    name,
    nameKey,
    faceId,
    jabatan: cleanString(params.jabatan),
    prodi: prodiName,
    prodiId,
    prodiName,
    descriptor: descriptor.length > 0 ? descriptor : firstVector,
    descriptors: descriptors.length > 0 ? descriptors : undefined,
    matrix: matrix.length > 0 ? matrix : firstVector,
    matrixRows: 1,
    matrixCols: firstVector.length,
    descriptorSize: firstVector.length,
    descriptorModel: "face-api.js",
    faceApi: {
      model: "face-api.js",
      modelName: "FaceRecognitionNet",
      descriptorSize: firstVector.length,
      descriptor: descriptor.length > 0 ? descriptor : firstVector,
      descriptors: descriptors.length > 0 ? descriptors : undefined,
      matrix: matrix.length > 0 ? matrix : firstVector,
      matrixRows: 1,
      matrixCols: firstVector.length,
      metric: "euclidean",
      distanceThreshold: 0.6,
      createdAt,
      updatedAt: now,
    },
    hasSignature: Boolean(signatureBase64) || asBool(existing.hasSignature),
    signatureBase64: signatureBase64 || cleanString(existing.signatureBase64),
    signatureMimeType: signatureBase64 ? signatureMimeType : cleanString(existing.signatureMimeType),
    signatureUpdatedAt: signatureBase64 ? now : existing.signatureUpdatedAt === null ? null : numberFromFirestore(existing.signatureUpdatedAt),
    hasFaceThumbnail: Boolean(params.faceThumbnailBase64) || asBool(existing.hasFaceThumbnail),
    faceThumbnailBase64: cleanString(params.faceThumbnailBase64, cleanString(existing.faceThumbnailBase64)),
    faceThumbnailMimeType: cleanString(params.faceThumbnailMimeType, cleanString(existing.faceThumbnailMimeType, "image/jpeg")),
    faceThumbnailUpdatedAt: params.faceThumbnailBase64 ? now : numberFromFirestore(existing.faceThumbnailUpdatedAt),
    createdAt,
    updatedAt: now,
    syncedAt: now,
    source: "nextjs_face_api_js_register",
  };

  await docRef.set(cleanFirestoreData({ ...face, syncedAt: serverTimestamp(), updatedAt: now }), { merge: true });
  return face;
}


export async function updateRegisteredFace(nameKey: string, params: {
  name?: string;
  jabatan?: string;
  prodi?: string;
  prodiId?: string;
  prodiName?: string;
  faceId?: string;
  descriptor?: number[];
  descriptors?: number[][];
  matrix?: number[];
  faceThumbnailBase64?: string;
  faceThumbnailMimeType?: string;
  updateDescriptor?: boolean;
  updateFaceThumbnail?: boolean;
  signatureBase64?: string;
  signatureMimeType?: string;
  updateSignature?: boolean;
  clearSignature?: boolean;
}): Promise<RegisteredFace> {
  const cleanNameKey = makeSafeDocId(cleanString(nameKey));
  if (!cleanNameKey) throw new Error("nameKey wajib diisi.");

  const docRef = firestoreDb().collection("registered_faces").doc(cleanNameKey);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error("Data wajah tidak ditemukan.");

  const existing = mapFromSnapshot(snap.data());
  const existingFaceApi = mapFromSnapshot(existing.faceApi);
  const name = cleanString(params.name, cleanString(existing.name, cleanNameKey));
  if (!name) throw new Error("Nama wajib diisi.");

  const now = millisNow();
  const updatePayload: Record<string, unknown> = {
    name,
    nameKey: cleanNameKey,
    faceId: cleanString(params.faceId, cleanString(existing.faceId, cleanNameKey)),
    jabatan: cleanString(params.jabatan, cleanString(existing.jabatan)),
    prodi: cleanString(params.prodiName || params.prodi, cleanString(existing.prodiName || existing.prodi)),
    prodiId: optionalSafeDocId(params.prodiId) || cleanString(existing.prodiId),
    prodiName: cleanString(params.prodiName || params.prodi, cleanString(existing.prodiName || existing.prodi)),
    updatedAt: now,
    syncedAt: serverTimestamp(),
  };

  if (params.updateDescriptor) {
    const descriptor = arrayOfNumbers(params.descriptor);
    const descriptors = arrayOfNumberArrays(params.descriptors);
    const matrix = arrayOfNumbers(params.matrix);
    const firstVector = descriptor.length > 0 ? descriptor : descriptors[0] || matrix;

    if (firstVector.length !== 128) throw new Error("Descriptor face-api.js harus berisi 128 angka.");

    updatePayload.descriptor = descriptor.length > 0 ? descriptor : firstVector;
    updatePayload.descriptors = descriptors.length > 0 ? descriptors : undefined;
    updatePayload.matrix = matrix.length > 0 ? matrix : firstVector;
    updatePayload.matrixRows = 1;
    updatePayload.matrixCols = firstVector.length;
    updatePayload.descriptorSize = firstVector.length;
    updatePayload.descriptorModel = "face-api.js";
    updatePayload.faceApi = {
      model: "face-api.js",
      modelName: "FaceRecognitionNet",
      descriptorSize: firstVector.length,
      descriptor: descriptor.length > 0 ? descriptor : firstVector,
      descriptors: descriptors.length > 0 ? descriptors : undefined,
      matrix: matrix.length > 0 ? matrix : firstVector,
      matrixRows: 1,
      matrixCols: firstVector.length,
      metric: "euclidean",
      distanceThreshold: 0.6,
      createdAt: numberFromFirestore(existingFaceApi.createdAt, numberFromFirestore(existing.createdAt, now)),
      updatedAt: now,
    };
  }

  if (params.updateFaceThumbnail) {
    const faceThumbnailBase64 = cleanString(params.faceThumbnailBase64);
    updatePayload.hasFaceThumbnail = Boolean(faceThumbnailBase64);
    updatePayload.faceThumbnailBase64 = faceThumbnailBase64;
    updatePayload.faceThumbnailMimeType = faceThumbnailBase64 ? cleanString(params.faceThumbnailMimeType, "image/jpeg") : "";
    updatePayload.faceThumbnailUpdatedAt = faceThumbnailBase64 ? now : null;
  }

  if (params.updateSignature) {
    const signatureBase64 = params.clearSignature ? "" : cleanString(params.signatureBase64);
    updatePayload.hasSignature = Boolean(signatureBase64);
    updatePayload.signatureBase64 = signatureBase64;
    updatePayload.signatureMimeType = signatureBase64 ? cleanString(params.signatureMimeType, "image/png") : "";
    updatePayload.signatureUpdatedAt = signatureBase64 ? now : null;
  }

  await docRef.set(cleanFirestoreData(updatePayload), { merge: true });

  const faces = await getRegisteredFaces();
  const updated = faces.find((face) => face.nameKey === cleanNameKey || face.nodeKey === cleanNameKey);
  if (!updated) throw new Error("Data wajah gagal dimuat setelah disimpan.");
  return updated;
}

export async function deleteRegisteredFace(nameKey: string): Promise<void> {
  const cleanNameKey = makeSafeDocId(cleanString(nameKey));
  if (!cleanNameKey) throw new Error("nameKey wajib diisi.");
  await firestoreDb().collection("registered_faces").doc(cleanNameKey).delete();
}

export async function upsertPresence(params: {
  meetingId: string;
  name: string;
  nameKey?: string;
  faceId?: string;
  jabatan?: string;
  prodi?: string;
  prodiId?: string;
  prodiName?: string;
  score?: number;
  lastScore?: number;
  distance?: number;
  matched?: boolean;
  method?: string;
  source?: string;
  collectionPath?: string;
}): Promise<{ inserted: boolean; presence: Presence; participantsCount: number }> {
  const collectionPath = params.collectionPath || "meetings";
  const meetingId = params.meetingId.trim();
  const name = params.name.trim();
  const nameKey = makeSafeDocId((params.nameKey || name).trim());
  const now = millisNow();

  if (!meetingId || !name || !nameKey) {
    throw new Error("meetingId, name, dan nameKey wajib diisi.");
  }

  const rootDb = firestoreDb();
  const meetingRef = rootDb.collection(collectionPath).doc(meetingId);
  const presenceRef = meetingRef.collection("presences").doc(nameKey);
  const lastScore = asNumber(params.lastScore, asNumber(params.score));

  return rootDb.runTransaction(async (transaction) => {
    const [meetingSnap, existingSnap] = await Promise.all([transaction.get(meetingRef), transaction.get(presenceRef)]);

    if (!meetingSnap.exists) throw new Error("Meeting tidak ditemukan.");

    const meetingRaw = mapFromSnapshot(meetingSnap.data());
    const existing = mapFromSnapshot(existingSnap.data()) as Partial<Presence>;
    const inserted = !existingSnap.exists;
    const currentCount = asNumber(meetingRaw.participantsCount);
    const participantsCount = inserted ? currentCount + 1 : currentCount;

    const presence: Presence = {
      name,
      nameKey,
      faceId: cleanString(params.faceId, cleanString(existing.faceId)),
      jabatan: cleanString(params.jabatan, cleanString(existing.jabatan)),
      prodi: cleanString(params.prodiName || params.prodi, cleanString(existing.prodiName || existing.prodi)),
      prodiId: cleanString(params.prodiId, cleanString(existing.prodiId)),
      prodiName: cleanString(params.prodiName || params.prodi, cleanString(existing.prodiName || existing.prodi)),
      matched: params.matched ?? true,
      score: asNumber(params.score, lastScore),
      lastScore,
      distance: asNumber(params.distance, asNumber(existing.distance, NaN)),
      method: params.method || "web_face_api_js",
      firstCheckInAt: inserted ? now : numberFromFirestore(existing.firstCheckInAt, now),
      lastCheckInAt: now,
      createdAt: inserted ? now : numberFromFirestore(existing.createdAt, now),
      updatedAt: now,
      syncedAt: now,
      source: params.source || "nextjs_face_api_js_attendance",
    };

    transaction.set(presenceRef, cleanFirestoreData({ ...presence, syncedAt: serverTimestamp() }), { merge: true });

    const meetingUpdate: Record<string, unknown> = { updatedAt: now, syncedAt: serverTimestamp() };
    if (inserted) meetingUpdate.participantsCount = increment(1);
    transaction.set(meetingRef, cleanFirestoreData(meetingUpdate), { merge: true });

    return { inserted, presence, participantsCount };
  });
}
