import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Meeting, MeetingInfoForm, Presence, RegisteredFace } from "@/lib/firebase/schema";

const FONT_REGULAR = "Times-Roman";
const FONT_BOLD = "Times-Bold";
const PAGE_MARGIN = 56;
const FORM_REVISION = "0";
const MINISTRY_NAME = "KEMENTERIAN PENDIDIKAN TINGGI, SAINS DAN TEKNOLOGI";
const MINISTRY_NAME_LINE_1 = "KEMENTERIAN PENDIDIKAN TINGGI, SAINS DAN";
const MINISTRY_NAME_LINE_2 = "TEKNOLOGI";
const INSTITUTION_NAME = "POLITEKNIK MANUFAKTUR NEGERI BANGKA BELITUNG";
const DEPARTMENT_NAME = "JURUSAN INFORMATIKA DAN BISNIS";
const ADDRESS_TEXT = "Kawasan Industri Airkantung Sungailiat - Bangka 33211";
const CONTACT_TEXT = "Telepon (0717) 93586, Laman: http://www.polman-babel.ac.id";

function text(value?: string | number | null) {
  const output = value === undefined || value === null ? "" : String(value).trim();
  return output || "-";
}

function nonEmpty(value?: string | number | null) {
  const output = value === undefined || value === null ? "" : String(value).trim();
  return output;
}

function normalizeKey(value?: string | null) {
  return nonEmpty(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function collectPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function formatMonthName(month: number) {
  return [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ][month - 1] || "";
}

function parseDateParts(value?: string | null) {
  const clean = nonEmpty(value);
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  const slash = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) return { year: Number(slash[3]), month: Number(slash[2]), day: Number(slash[1]) };

  return null;
}

function dateToLong(value?: string | null, fallbackMillis?: number | null) {
  const parts = parseDateParts(value || "");
  if (parts && parts.day && parts.month && parts.year) {
    return `${parts.day} ${formatMonthName(parts.month)} ${parts.year}`;
  }

  if (fallbackMillis) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(fallbackMillis));
  }

  return text(value);
}

function dateToDay(value?: string | null, fallbackMillis?: number | null) {
  if (fallbackMillis) {
    return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(new Date(fallbackMillis));
  }

  const parts = parseDateParts(value || "");
  if (!parts) return "";

  const millis = Date.parse(`${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T12:00:00+07:00`);
  if (!Number.isFinite(millis)) return "";

  return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(new Date(millis));
}

function formatTimeRange(item: Pick<Meeting | MeetingInfoForm, "waktu" | "waktuMulai" | "waktuSelesai">) {
  const existing = nonEmpty(item.waktu);
  if (existing) return existing;

  const start = nonEmpty(item.waktuMulai);
  const end = nonEmpty(item.waktuSelesai);
  if (start && end) return `${start} WIB s.d Selesai`;
  if (start) return `${start} WIB s.d Selesai`;
  return "-";
}

function getLogoPath() {
  const candidates = [
    path.join(process.cwd(), "public", "assets", "logo-polman.png"),
    path.join(process.cwd(), ".next", "standalone", "public", "assets", "logo-polman.png"),
    path.join(process.cwd(), "..", "public", "assets", "logo-polman.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function addLogo(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  const logoPath = getLogoPath();
  if (!logoPath) return;

  try {
    doc.image(logoPath, x, y, { fit: [width, height], align: "center", valign: "center" });
  } catch {
    // Logo bersifat dekoratif. PDF tetap dibuat walau logo gagal dibaca.
  }
}

function addLetterHeader(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const left = PAGE_MARGIN;
  const right = pageWidth - PAGE_MARGIN;
  const centerX = left + 112;
  const centerWidth = right - centerX;
  const lineY = 143;

  addLogo(doc, left, 34, 102, 76);

  doc.font(FONT_BOLD).fontSize(11.4).text(MINISTRY_NAME_LINE_1, centerX, 24, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });
  doc.font(FONT_BOLD).fontSize(11.4).text(MINISTRY_NAME_LINE_2, centerX, 39, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });
  doc.font(FONT_BOLD).fontSize(11.1).text(INSTITUTION_NAME, centerX, 60, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });
  doc.font(FONT_BOLD).fontSize(10.6).text(DEPARTMENT_NAME, centerX, 81, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });
  doc.font(FONT_REGULAR).fontSize(8.2).text(ADDRESS_TEXT, centerX, 104, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });
  doc.font(FONT_REGULAR).fontSize(8.2).text(CONTACT_TEXT, centerX, 117, {
    width: centerWidth,
    align: "center",
    lineBreak: false,
  });

  doc.lineWidth(1.2).moveTo(left, lineY).lineTo(right, lineY).stroke();
  doc.lineWidth(0.4).moveTo(left, lineY + 5).lineTo(right, lineY + 5).stroke();
  doc.y = lineY + 28;
}

function addFormHeader(doc: PDFKit.PDFDocument, noDokumen?: string | null) {
  const left = 70;
  const right = doc.page.width - 70;
  const logoSize = 46;
  const textX = left + 54;
  const headerTextWidth = right - textX;
  const metaBlockWidth = 220;
  const metaLabelWidth = 78;
  const metaLabelX = right - metaBlockWidth;
  const metaColonX = metaLabelX + metaLabelWidth + 8;
  const metaValueX = metaColonX + 18;
  const metaValueWidth = right - metaValueX;

  addLogo(doc, left, 42, logoSize, logoSize - 6);

  doc.font(FONT_BOLD).fontSize(8.5).text(MINISTRY_NAME, textX, 42, {
    width: headerTextWidth,
    lineBreak: false,
  });
  doc.font(FONT_BOLD).fontSize(8.1).text(INSTITUTION_NAME, textX, 56, {
    width: headerTextWidth,
    lineBreak: false,
  });
  doc.font(FONT_BOLD).fontSize(7.6).text(DEPARTMENT_NAME, textX, 70, {
    width: headerTextWidth,
    lineBreak: false,
  });

  const drawMetaLine = (label: string, value: string, y: number) => {
    const cleanValue = text(value);
    let valueFontSize = 9;
    doc.font(FONT_REGULAR).fontSize(valueFontSize);

    while (valueFontSize > 6.5 && doc.widthOfString(cleanValue) > metaValueWidth) {
      valueFontSize -= 0.25;
      doc.font(FONT_REGULAR).fontSize(valueFontSize);
    }

    doc.font(FONT_BOLD).fontSize(9).text(label, metaLabelX, y, { width: metaLabelWidth, lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(9).text(":", metaColonX, y, { width: 8, lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(valueFontSize).text(cleanValue, metaValueX, y, {
      width: metaValueWidth,
      lineBreak: false,
    });
  };

  drawMetaLine("No Dokumen", noDokumen || "", 88);
  drawMetaLine("Revisi", FORM_REVISION, 104);
}

function addCenteredTitle(doc: PDFKit.PDFDocument, title: string, y: number) {
  const width = doc.page.width - 140;
  const x = 70;
  doc.font(FONT_BOLD).fontSize(14).text(title, x, y, { width, align: "center" });
  const textWidth = doc.widthOfString(title);
  const lineX = x + (width - textWidth) / 2;
  doc.lineWidth(0.7).moveTo(lineX, y + 17).lineTo(lineX + textWidth, y + 17).stroke();
}

function labelValueLine(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, labelWidth: number, valueWidth: number) {
  doc.font(FONT_REGULAR).fontSize(11).text(label, x, y, { width: labelWidth });
  doc.text(":", x + labelWidth, y, { width: 8 });
  doc.font(FONT_REGULAR).fontSize(11).text(value || "-", x + labelWidth + 13, y, { width: valueWidth });
}

function letterKeyValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number) {
  doc.font(FONT_REGULAR).fontSize(10.5).text(label, x, y, { width: 68 });
  doc.text(":", x + 70, y, { width: 8 });
  doc.text(value || "-", x + 82, y, { width: 300 });
}

function wrapParagraph(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, fontSize = 11, align: "left" | "justify" = "left") {
  doc.font(FONT_REGULAR).fontSize(fontSize).text(value, x, y, {
    width,
    align,
    lineGap: 2,
  });
}

function addSignatureImage(doc: PDFKit.PDFDocument, data?: string, mime?: string, x = 0, y = 0, width = 70, height = 24) {
  const base64 = nonEmpty(data);
  if (!base64) return false;

  try {
    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    if (buffer.length === 0) return false;
    doc.image(buffer, x, y, { fit: [width, height], align: "center", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

function makeFaceLookup(faces: RegisteredFace[]) {
  const byNameKey = new Map<string, RegisteredFace>();
  const byNormalizedName = new Map<string, RegisteredFace>();

  faces.forEach((face) => {
    const nameKey = normalizeKey(face.nameKey || face.nodeKey);
    const nodeKey = normalizeKey(face.nodeKey);
    const name = normalizeKey(face.name);
    if (nameKey) byNameKey.set(nameKey, face);
    if (nodeKey) byNameKey.set(nodeKey, face);
    if (name) byNormalizedName.set(name, face);
  });

  return { byNameKey, byNormalizedName };
}

function findFaceForPresence(presence: Presence, faces: ReturnType<typeof makeFaceLookup>) {
  return (
    faces.byNameKey.get(normalizeKey(presence.nameKey)) ||
    faces.byNameKey.get(normalizeKey(presence.faceId)) ||
    faces.byNormalizedName.get(normalizeKey(presence.name)) ||
    null
  );
}

function findFaceForName(name: string | undefined, faces: ReturnType<typeof makeFaceLookup>) {
  const clean = nonEmpty(name);
  if (!clean) return null;
  return faces.byNameKey.get(normalizeKey(clean)) || faces.byNormalizedName.get(normalizeKey(clean)) || null;
}

function roleMatches(value: string | undefined | null, roleKeys: string[]) {
  const clean = normalizeKey(value);
  if (!clean) return false;

  return roleKeys.some((role) => {
    const normalizedRole = normalizeKey(role);
    return clean === normalizedRole || clean.includes(normalizedRole);
  });
}

function findFaceByJabatan(faces: ReturnType<typeof makeFaceLookup>, roleKeys: string[]) {
  const uniqueFaces = new Set<RegisteredFace>([...faces.byNameKey.values(), ...faces.byNormalizedName.values()]);
  return [...uniqueFaces].find((face) => roleMatches(face.jabatan, roleKeys)) || null;
}

function drawSingleLineCentered(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  maxFontSize = 8.3,
  minFontSize = 6.2
) {
  const clean = text(value);
  let fontSize = maxFontSize;
  doc.font(FONT_REGULAR).fontSize(fontSize);

  while (fontSize > minFontSize && doc.widthOfString(clean) > width - 2) {
    fontSize -= 0.2;
    doc.font(FONT_REGULAR).fontSize(fontSize);
  }

  doc.text(clean, x, y, {
    width,
    align: "center",
    lineBreak: false,
    ellipsis: true,
  });
}

function getDateLabel(item: Pick<Meeting | MeetingInfoForm, "hari" | "tanggal" | "meetingDate">) {
  const day = nonEmpty(item.hari) || dateToDay(item.tanggal, item.meetingDate);
  const date = dateToLong(item.tanggal, item.meetingDate);
  return [day, date].filter(Boolean).join(" / ") || "-";
}

function getInvitationCreatedDateLabel(item: Pick<Meeting | MeetingInfoForm, "createdAt" | "updatedAt" | "meetingDate" | "tanggal">) {
  if (item.createdAt) return dateToLong(undefined, item.createdAt);
  if (item.updatedAt) return dateToLong(undefined, item.updatedAt);
  if (item.meetingDate) return dateToLong(undefined, item.meetingDate);
  return dateToLong(item.tanggal);
}

function getTopic(item: Pick<Meeting | MeetingInfoForm, "topikRapat" | "meetingName">) {
  return nonEmpty(item.topikRapat) || nonEmpty(item.meetingName) || "Rapat";
}

function getAgenda(item: Meeting | MeetingInfoForm) {
  if ("runForm" in item) {
    return nonEmpty(item.runForm?.agendaRapat) || nonEmpty(item.agendaRapat) || nonEmpty(item.topikRapat) || "-";
  }

  return nonEmpty(item.agendaRapat) || nonEmpty(item.topikRapat) || "-";
}

function getLeader(item: Meeting | MeetingInfoForm) {
  if ("runForm" in item) return nonEmpty(item.runForm?.pemimpinRapat) || nonEmpty(item.pemimpinRapat);
  return nonEmpty(item.pemimpinRapat);
}

function getNotulis(item: Meeting | MeetingInfoForm) {
  if ("runForm" in item) return nonEmpty(item.runForm?.notulis) || nonEmpty(item.notulis);
  return nonEmpty(item.notulis);
}

function addInvitationLetter(doc: PDFKit.PDFDocument, item: Meeting | MeetingInfoForm, faces?: ReturnType<typeof makeFaceLookup>) {
  addLetterHeader(doc);

  const left = PAGE_MARGIN + 6;
  const contentWidth = doc.page.width - left - PAGE_MARGIN;
  const letterDate = getInvitationCreatedDateLabel(item);
  const prodiText = nonEmpty(item.prodiText) || item.prodiNames?.join(", ") || DEPARTMENT_NAME;
  const topic = getTopic(item);
  const agenda = getAgenda(item);
  const leader = getLeader(item);
  const leaderFace = faces ? findFaceForName(leader, faces) : null;

  const metaY = 172;
  const metaRowGap = 22;
  const recipientY = 250;
  const bodyY = 342;
  const kvY = 392;

  doc.font(FONT_REGULAR).fontSize(10.5).text(letterDate, doc.page.width - 220, metaY, {
    width: 160,
    align: "right",
  });

  letterKeyValue(doc, "Nomor", text(item.noDokumen), left, metaY);
  letterKeyValue(doc, "Lampiran", "-", left, metaY + metaRowGap);
  letterKeyValue(doc, "Perihal", "Undangan Rapat", left, metaY + metaRowGap * 2);

  doc.font(FONT_REGULAR).fontSize(11).text("Yth. Bapak / Ibu Dosen", left, recipientY, { width: contentWidth });
  doc.text(`Prodi ${prodiText}`, left, recipientY + 16, { width: contentWidth });
  doc.text("di-", left, recipientY + 32, { width: contentWidth });
  doc.text(INSTITUTION_NAME, left, recipientY + 48, { width: contentWidth });

  const bodyText = `Sehubungan dengan ${topic}, dengan ini kami mengundang Bapak/Ibu Dosen untuk menghadiri Rapat yang akan dilaksanakan pada :`;
  wrapParagraph(doc, bodyText, left, bodyY, contentWidth, 11, "justify");

  const kvX = left;
  const kvValueX = left + 116;
  const rows: Array<[string, string]> = [
    ["Hari / Tanggal", getDateLabel(item)],
    ["Waktu", formatTimeRange(item)],
    ["Tempat", text(item.tempat)],
    ["Agenda", agenda],
  ];

  rows.forEach(([label, value], index) => {
    const y = kvY + index * 22;
    doc.font(FONT_REGULAR).fontSize(11).text(label, kvX, y, { width: 110 });
    doc.text(":", kvValueX - 10, y, { width: 10 });
    doc.text(value, kvValueX, y, { width: contentWidth - 116 });
  });

  wrapParagraph(
    doc,
    "Demikian kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.",
    left,
    528,
    contentWidth,
    11,
    "justify"
  );

  const signX = doc.page.width - 230;
  doc.font(FONT_REGULAR).fontSize(11).text("Ka Prodi,", signX, 588, { width: 160, align: "center" });
  addSignatureImage(doc, leaderFace?.signatureBase64, leaderFace?.signatureMimeType, signX + 25, 618, 110, 38);
  doc.font(FONT_BOLD).fontSize(10.5).text(text(leader || "Ka Prodi"), signX, 666, { width: 160, align: "center" });
}

function drawAttendanceTableHeader(doc: PDFKit.PDFDocument, x: number, y: number, widths: number[], headerHeight: number) {
  const [noW, nameW, roleW, signW] = widths;
  const signX = x + noW + nameW + roleW;

  doc.font(FONT_BOLD).fontSize(9);
  doc.rect(x, y, noW, headerHeight).stroke();
  doc.rect(x + noW, y, nameW, headerHeight).stroke();
  doc.rect(x + noW + nameW, y, roleW, headerHeight).stroke();
  doc.rect(signX, y, signW, headerHeight).stroke();

  doc.text("No", x, y + 10, { width: noW, align: "center" });
  doc.text("Nama", x + noW, y + 10, { width: nameW, align: "center" });
  doc.text("Jabatan", x + noW + nameW, y + 10, { width: roleW, align: "center" });
  doc.text("Tanda Tangan", signX, y + 10, { width: signW, align: "center" });
}

function addAttendanceListPage(
  doc: PDFKit.PDFDocument,
  meeting: Meeting,
  presences: Presence[],
  faces: ReturnType<typeof makeFaceLookup>,
  pageIndex: number,
  totalPages: number
) {
  addFormHeader(doc, meeting.noDokumen);
  addCenteredTitle(doc, "DAFTAR HADIR", 126);

  const left = 70;
  const y0 = 166;
  const right = doc.page.width - 70;
  const fieldWidth = right - left;

  labelValueLine(doc, "Topik Rapat", getTopic(meeting), left, y0, 82, fieldWidth - 95);
  labelValueLine(doc, "Hari/Tanggal", getDateLabel(meeting), left, y0 + 25, 82, 190);
  labelValueLine(doc, "Tempat", text(meeting.tempat), left + 315, y0 + 25, 52, 140);

  if (totalPages > 1) {
    doc.font(FONT_REGULAR).fontSize(8).text(`Halaman daftar hadir ${pageIndex + 1} dari ${totalPages}`, left, y0 + 51, {
      width: fieldWidth,
      align: "right",
    });
  }

  const tableX = left;
  const tableY = 240;
  const widths = [34, 142, 118, 181];
  const headerHeight = 30;
  const rowHeight = 19;
  const signW = widths[3];
  const signX = tableX + widths[0] + widths[1] + widths[2];

  drawAttendanceTableHeader(doc, tableX, tableY, widths, headerHeight);

  for (let i = 0; i < 25; i++) {
    const y = tableY + headerHeight + i * rowHeight;
    const presence = presences[i];
    const rowNumber = pageIndex * 25 + i + 1;
    const signatureSlotX = signX;
    const face = presence ? findFaceForPresence(presence, faces) : null;

    doc.rect(tableX, y, widths[0], rowHeight).stroke();
    doc.rect(tableX + widths[0], y, widths[1], rowHeight).stroke();
    doc.rect(tableX + widths[0] + widths[1], y, widths[2], rowHeight).stroke();
    doc.rect(signX, y, widths[3], rowHeight).stroke();

    doc.font(FONT_REGULAR).fontSize(9).text(String(rowNumber), tableX, y + 5, { width: widths[0], align: "center" });
    doc.font(FONT_REGULAR).fontSize(8.5).text(presence ? text(presence.name) : "", tableX + widths[0] + 6, y + 5, {
      width: widths[1] - 10,
      height: rowHeight - 4,
      ellipsis: true,
    });
    doc.font(FONT_REGULAR).fontSize(8.5).text(presence ? text(presence.jabatan || presence.prodiName || presence.prodi) : "", tableX + widths[0] + widths[1] + 6, y + 5, {
      width: widths[2] - 10,
      height: rowHeight - 4,
      ellipsis: true,
    });

    doc.font(FONT_REGULAR).fontSize(8.5).text(`${rowNumber}.`, signatureSlotX + 4, y + 5, { width: 18 });
    if (face?.signatureBase64) {
      addSignatureImage(doc, face.signatureBase64, face.signatureMimeType, signatureSlotX + 28, y + 1, signW - 34, rowHeight - 2);
    }
  }
}

function drawWrappedTextInBox(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number, fontSize = 10) {
  doc.font(FONT_REGULAR).fontSize(fontSize).text(value || "-", x, y, {
    width,
    height,
    lineGap: 2,
    ellipsis: true,
  });
}

function addNotulenPage(doc: PDFKit.PDFDocument, meeting: Meeting, faces: ReturnType<typeof makeFaceLookup>) {
  addFormHeader(doc, meeting.noDokumen);
  addCenteredTitle(doc, "NOTULEN HASIL RAPAT", 126);

  const left = 60;
  const top = 160;
  const width = doc.page.width - 120;
  const rightCol = 145;
  const mainBottom = 754;
  const labelW = 84;
  const valueX = left + labelW;
  const runForm = meeting.runForm;
  const notulis = getNotulis(meeting);
  const leader = getLeader(meeting);
  const sekjurFace =
    findFaceByJabatan(faces, ["Sekjur JIB", "Sekretaris Jurusan Informatika dan Bisnis", "Sekretaris Jurusan"]) ||
    findFaceForName(notulis, faces);
  const leaderFace = findFaceForName(leader, faces);
  const sekjurName = nonEmpty(sekjurFace?.name) || nonEmpty(notulis) || "Sekjur JIB";
  const leaderName = nonEmpty(leader) || nonEmpty(leaderFace?.name) || "Pemimpin Rapat";
  const leaderPosition = nonEmpty(leaderFace?.jabatan) || "Pemimpin Rapat";

  doc.rect(left, top, width, mainBottom - top).stroke();
  doc.moveTo(left, 320).lineTo(left + width, 320).stroke();
  doc.moveTo(left, 454).lineTo(left + width, 454).stroke();
  doc.moveTo(left, 600).lineTo(left + width, 600).stroke();
  doc.moveTo(left + width - rightCol, 600).lineTo(left + width - rightCol, mainBottom).stroke();
  doc.moveTo(left + width - rightCol, 675).lineTo(left + width, 675).stroke();

  const detailRows: Array<[string, string]> = [
    ["Tanggal", dateToLong(meeting.tanggal, meeting.meetingDate)],
    ["Hari", nonEmpty(meeting.hari) || dateToDay(meeting.tanggal, meeting.meetingDate) || "-"],
    ["Tempat", text(meeting.tempat)],
    ["Waktu", formatTimeRange(meeting)],
    ["Topik Rapat", getTopic(meeting)],
  ];

  detailRows.forEach(([label, value], index) => {
    const y = top + 18 + index * 27;
    doc.font(FONT_REGULAR).fontSize(10.5).text(`${label} :`, left + 14, y, { width: labelW });
    doc.font(FONT_REGULAR).fontSize(11).text(value, valueX, y, { width: width - labelW - 24 });
  });

  doc.font(FONT_REGULAR).fontSize(10.5).text("Agenda Rapat :", left + 14, 332, { width: 96 });
  drawWrappedTextInBox(doc, nonEmpty(runForm?.agendaRapat) || nonEmpty(meeting.agendaRapat) || "-", left + 112, 332, width - 132, 100, 10.5);

  doc.font(FONT_REGULAR).fontSize(10.5).text("Hasil Tinjauan/Rapat :", left + 14, 470, { width: 120 });
  const hasil = [
    nonEmpty(runForm?.pembahasan) || nonEmpty(meeting.pembahasan),
    nonEmpty(runForm?.hasilRapat) || nonEmpty(meeting.hasilRapat),
    nonEmpty(runForm?.tindakLanjut) || nonEmpty(meeting.tindakLanjut),
  ]
    .filter(Boolean)
    .join("\n");
  drawWrappedTextInBox(doc, hasil || "-", left + 135, 470, width - 155, 110, 10.5);

  doc.font(FONT_REGULAR).fontSize(10.5).text("Catatan Tambahan :", left + 14, 615, { width: 130 });
  drawWrappedTextInBox(
    doc,
    nonEmpty(runForm?.catatanTambahan) || nonEmpty(meeting.catatanTambahan) || nonEmpty(meeting.catatan) || "-",
    left + 14,
    638,
    width - rightCol - 32,
    85,
    10
  );

  const signX = left + width - rightCol;
  const signInnerX = signX + 10;
  const signInnerW = rightCol - 20;

  doc.font(FONT_REGULAR).fontSize(10.5).text("Dibuat Oleh :", signInnerX, 606, { width: signInnerW });
  doc.font(FONT_REGULAR).fontSize(8.8).text("( Sekjur JIB )", signInnerX, 625, { width: signInnerW, align: "center" });
  addSignatureImage(doc, sekjurFace?.signatureBase64, sekjurFace?.signatureMimeType, signX + 38, 638, 78, 20);
  drawSingleLineCentered(doc, sekjurName, signInnerX, 661, signInnerW, 8.2, 6.2);

  doc.font(FONT_REGULAR).fontSize(10.5).text("Disetujui Oleh :", signInnerX, 684, { width: signInnerW });
  drawSingleLineCentered(doc, `( ${leaderPosition} )`, signInnerX, 703, signInnerW, 8.0, 5.8);
  addSignatureImage(doc, leaderFace?.signatureBase64, leaderFace?.signatureMimeType, signX + 38, 716, 78, 20);
  drawSingleLineCentered(doc, leaderName, signInnerX, 739, signInnerW, 8.2, 6.2);
}

function createDocument(title: string, margin = PAGE_MARGIN) {
  return new PDFDocument({
    size: "A4",
    margin,
    bufferPages: true,
    info: { Title: title },
  });
}

export async function buildInvitationPdf(invitation: MeetingInfoForm, registeredFaces: RegisteredFace[] = []) {
  const doc = createDocument(`Undangan - ${invitation.meetingName}`, PAGE_MARGIN);
  const faces = makeFaceLookup(registeredFaces);
  addInvitationLetter(doc, invitation, faces);
  return collectPdfBuffer(doc);
}

export async function buildMeetingPdf(meeting: Meeting, presences: Presence[], registeredFaces: RegisteredFace[] = []) {
  const doc = createDocument(`Meeting - ${meeting.meetingName}`, PAGE_MARGIN);
  const faces = makeFaceLookup(registeredFaces);
  const attendancePages = Math.max(1, Math.ceil(Math.max(presences.length, 1) / 25));

  for (let pageIndex = 0; pageIndex < attendancePages; pageIndex++) {
    if (pageIndex > 0) doc.addPage();
    addAttendanceListPage(doc, meeting, presences.slice(pageIndex * 25, pageIndex * 25 + 25), faces, pageIndex, attendancePages);
  }

  doc.addPage();
  addNotulenPage(doc, meeting, faces);

  return collectPdfBuffer(doc);
}