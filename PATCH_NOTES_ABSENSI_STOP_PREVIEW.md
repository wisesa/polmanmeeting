# Patch Absensi Wajah: Stop Preview Setelah Ambil Absen

## Tujuan
Patch ini menyesuaikan alur absensi wajah pada menu meeting agar kamera tidak terus berjalan setelah tombol **Ambil Absen** ditekan.

## Perubahan Utama
1. Saat tombol **Ambil Absen** ditekan, sistem langsung mengambil satu foto diam dari video kamera.
2. Setelah foto berhasil diambil, stream kamera dihentikan dengan `stopCamera()` sehingga pergerakan user setelah klik tidak memengaruhi hasil pencocokan.
3. Foto diam hanya ditampilkan di area kamera yang sama sebagai tampilan beku, bukan sebagai preview tambahan di bawah kamera.
4. Preview tambahan `.attendanceSnapshotPreview` di bawah kamera dihapus dari komponen.
5. Setelah hasil absensi keluar, status kamera menjadi `paused`.
6. Jika absensi berhasil, preview kamera tetap berhenti sampai user menekan tombol **Ambil Absen** kembali.
7. Tombol **Ambil Absen** pada kondisi `paused` akan membuka ulang kamera untuk percobaan absensi berikutnya.

## File yang Diubah
- `components/CameraAttendance.tsx`
- `app/globals.css`

## Validasi
- `npx tsc --noEmit` berhasil tanpa error.
