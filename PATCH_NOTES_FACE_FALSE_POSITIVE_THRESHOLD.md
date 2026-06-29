# Patch Absensi/Login Wajah: Perketat Pencocokan agar Tidak Salah Orang

## Masalah
Dua wajah yang secara visual jelas berbeda masih dapat dianggap cocok karena nilai threshold lama `0.6` terlalu longgar untuk kebutuhan absensi/login. Sistem face-api.js akan mencari kandidat terdekat; jika batas jarak terlalu besar, kandidat yang sebenarnya berbeda tetap bisa diterima.

## Perubahan Utama
1. Threshold login dan absensi dibuat lebih ketat dengan nilai bawaan efektif `0.45`.
2. Nilai lama `FACE_API_DISTANCE_THRESHOLD=0.6` tidak lagi dibiarkan membuat endpoint login/absensi longgar. Jika belum ada variabel khusus, nilai legacy tersebut akan dibatasi maksimal menjadi `0.45`.
3. Ditambahkan pemeriksaan selisih kandidat terbaik dan kandidat kedua (`minDistanceGap`). Jika dua kandidat terlalu dekat, sistem menolak sebagai wajah ambigu, bukan langsung memilih salah satu.
4. Endpoint absensi mengembalikan informasi tambahan: `secondDistance`, `distanceGap`, `minDistanceGap`, `ambiguous`, dan `rejectionReason`.
5. Endpoint login dosen memakai logika ketat yang sama agar hasil login dan absensi konsisten.
6. `.env.example` diperbarui dengan variabel khusus:
   - `FACE_API_LOGIN_DISTANCE_THRESHOLD=0.45`
   - `FACE_API_ATTENDANCE_DISTANCE_THRESHOLD=0.45`
   - `FACE_API_LOGIN_MIN_DISTANCE_GAP=0.04`
   - `FACE_API_ATTENDANCE_MIN_DISTANCE_GAP=0.04`

## File yang Diubah
- `lib/face/matcher.ts`
- `lib/face/strict-threshold.ts`
- `app/api/attendance/verify-descriptor/route.ts`
- `app/api/auth/dosen/session/route.ts`
- `components/CameraAttendance.tsx`
- `components/DosenLoginClient.tsx`
- `.env.example`

## Catatan Implementasi
Setelah patch diterapkan, restart server Next.js agar environment dan kode server terbaca ulang.

Jika masih ada wajah yang tertukar, lakukan daftar ulang wajah menggunakan foto/kamera yang terang, wajah menghadap depan, tanpa filter, dan jangan hanya mengganti thumbnail. Descriptor wajah harus ikut diperbarui.

## Validasi
- `npx tsc --noEmit` berhasil tanpa error.
