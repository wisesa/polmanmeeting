# Patch Absensi Wajah Snapshot untuk Dosen dan Admin

Patch ini mengubah proses absensi wajah pada menu meeting agar memakai pola yang sama seperti login wajah dosen: sistem mengambil foto diam dari video kamera terlebih dahulu, lalu membaca descriptor wajah dari foto tersebut.

## File yang diubah

1. `components/CameraAttendance.tsx`
   - Mengganti pembacaan descriptor langsung dari video berjalan menjadi pembacaan dari snapshot/canvas.
   - Menambahkan fungsi `captureStillImageFromVideo()` dan `readFaceDataFromStillImage()`.
   - Saat tombol **Ambil Absen** ditekan, sistem mengambil foto wajah dulu, menampilkan preview foto yang dipakai, lalu mengirim descriptor ke API.
   - Preview snapshot tetap tampil jika wajah pada foto belum berhasil terbaca, sehingga pengguna tahu foto mana yang diperiksa.

2. `app/api/attendance/verify-descriptor/route.ts`
   - API absensi kini menerima sesi dosen maupun admin melalui `requireMeetingReadRequest()`.
   - Data presensi tetap memakai pencocokan descriptor yang sama terhadap data wajah terdaftar.
   - Source presensi dibedakan antara admin dan dosen.

3. `components/AdminMeetingRunClient.tsx`
   - Form absensi wajah ditambahkan ke halaman detail meeting admin.
   - Jika meeting sudah ditutup, absensi wajah tidak ditampilkan.

4. `app/globals.css`
   - Menambahkan tampilan preview snapshot wajah yang dipakai untuk absensi.

## Validasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run build` melewati proses compile dan TypeScript, tetapi proses berhenti karena timeout saat tahap `Collecting page data`. Peringatan build yang muncul berasal dari dependensi `node-fetch`/`face-api.js` tentang modul opsional `encoding`, bukan dari patch ini.

## Cara menerapkan

Salin/replace file di patch ini ke project utama sesuai path masing-masing, lalu jalankan:

```bash
npm ci
npx tsc --noEmit
npm run build
```
