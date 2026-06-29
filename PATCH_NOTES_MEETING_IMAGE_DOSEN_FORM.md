# Patch: Upload Gambar Meeting di Akun Dosen

## Ringkasan
- Input gambar meeting ditambahkan pada halaman akun dosen: `/dosen/meeting/[meetingId]` melalui `components/MeetingDetailClient.tsx`.
- Dosen dapat memilih gambar dari file atau mengambil foto langsung dari kamera.
- Field `Catatan` tersedia pada form meeting dosen dan ikut dikirim ke API run-form.
- Halaman register meeting admin `/admin/meeting` tetap tidak memiliki input gambar.
- Halaman form meeting admin `/admin/meeting/[meetingId]` tetap memiliki input gambar.

## Perubahan Teknis
- `components/MeetingDetailClient.tsx`
  - Menambahkan state upload gambar, preview gambar, kamera, dan canvas.
  - Menambahkan tombol `Ambil dari File`, `Ambil dari Kamera`, `Ambil Foto`, `Tutup Kamera`.
  - Menambahkan opsi hapus gambar lama.
  - Menambahkan sinkronisasi gambar ke `PATCH /api/meetings/[meetingId]` setelah form meeting disimpan.
  - Menambahkan field textarea `Catatan`.

- `app/api/meetings/[meetingId]/route.ts`
  - PATCH sekarang menerima session admin atau dosen.
  - Admin tetap dapat memperbarui data meeting.
  - Dosen hanya diperbolehkan memperbarui gambar meeting (`meetingImage` atau `deleteMeetingImage`).
  - File gambar lama tetap dihapus saat diganti atau saat gambar dihapus.

## Catatan Build
- `npm install` berhasil.
- `npm run build` melewati tahap compile dan TypeScript.
- Proses berhenti karena timeout saat tahap `Collecting page data`, bukan karena error TypeScript.
- Ada warning bawaan dependency `node-fetch`/`encoding` dari `face-api.js`, sama seperti pola dependency lama.
