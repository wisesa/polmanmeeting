# Patch Absensi Wajah Snapshot + Stop Preview Kamera

Patch ini memperbarui absensi wajah pada menu meeting untuk akun dosen dan admin agar memakai pola yang sama seperti login wajah: sistem mengambil satu foto diam terlebih dahulu, lalu wajah dikenali dari foto tersebut.

## Perubahan Utama
1. Tombol **Ambil Absen** mengambil satu snapshot dari kamera.
2. Setelah snapshot diambil, stream kamera langsung dihentikan dengan `stopCamera()`.
3. Descriptor wajah dibaca dari snapshot/canvas, bukan dari video kamera berjalan.
4. Pergerakan user setelah tombol ditekan tidak memengaruhi hasil pencocokan.
5. Foto snapshot tidak lagi tampil sebagai preview tambahan di bawah kamera.
6. Snapshot hanya tampil di area kamera yang sama sebagai tampilan beku ketika sistem memproses hasil.
7. Setelah hasil keluar, status kamera menjadi `paused`.
8. Jika absensi berhasil, preview kamera tetap berhenti sampai user menekan tombol **Ambil Absen** kembali.
9. Tombol **Ambil Absen** pada kondisi `paused` akan membuka ulang kamera untuk percobaan berikutnya.
10. Menu meeting admin tetap mendapatkan form absensi wajah.
11. API absensi menerima sesi dosen dan admin.

## File yang Diubah
- `components/CameraAttendance.tsx`
- `components/AdminMeetingRunClient.tsx`
- `app/api/attendance/verify-descriptor/route.ts`
- `app/globals.css`

## Validasi
- `npx tsc --noEmit` berhasil tanpa error.

## Cara Menerapkan
Salin/replace file di patch ini ke project utama sesuai path masing-masing, lalu jalankan:

```bash
npm ci
npx tsc --noEmit
npm run build
```
