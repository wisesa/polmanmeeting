# Patch Meeting Image + Catatan Fix

Perbaikan dari revisi sebelumnya:

1. Field **Catatan** dikembalikan.
   - Ada di form Register Meeting (`/admin/meeting`).
   - Ada di Form Saat Meeting (`/admin/meeting/[meetingId]`).
   - Nilai tersimpan sebagai `catatan` dan ikut masuk ke `runForm.catatan` saat form meeting disimpan.

2. Input **Gambar Meeting** sekarang muncul di Form Saat Meeting.
   - Tombol **Ambil dari File**.
   - Tombol **Ambil dari Kamera**.
   - Preview gambar lama.
   - Preview gambar baru sebelum disimpan.
   - Tombol hapus gambar lama.

3. Penyimpanan gambar tetap memakai alur server-side.
   - File dikirim ke API meeting sebagai `multipart/form-data`.
   - Gambar dikompres dengan `sharp` ke JPG sekitar 200 KB.
   - File disimpan ke `public/uploads/meetings`.

4. Penghapusan file lama tetap aman.
   - Jika gambar diganti, gambar lama dihapus dari folder public.
   - Jika gambar dihapus dari form meeting, file lama dihapus saat disimpan.
   - Jika meeting dihapus, gambar terkait ikut dihapus.

5. API update meeting diperbaiki agar mendukung patch parsial.
   - Upload/hapus gambar dari Form Saat Meeting tidak lagi mengosongkan field meeting lain.

Catatan build:
- `npm install` berhasil dijalankan di sandbox.
- `npm run build` berhasil melewati compile dan TypeScript, tetapi proses berhenti karena timeout saat tahap `Collecting page data`. Tidak ada error TypeScript dari perubahan ini sebelum timeout.
