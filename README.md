# Polman Meeting

Aplikasi ini digunakan untuk mengelola undangan rapat, data wajah peserta, presensi dosen, hasil rapat, dan dokumen rapat.

## Alur Penggunaan

1. Admin masuk melalui halaman admin.
2. Admin mengisi program studi, data wajah, undangan, dan jadwal meeting.
3. Dosen masuk menggunakan wajah.
4. Setelah berhasil masuk, dosen tidak perlu login ulang selama belum menekan tombol logout.
5. Dosen dapat membuka menu Ganti Profil untuk memperbarui nama, jabatan, prodi, foto wajah, dan tanda tangan.
6. Dosen dapat membuka menu Meeting untuk melihat jadwal dan melakukan presensi.

## Catatan Penting

- Pastikan kamera perangkat diizinkan saat login atau presensi.
- Pastikan data wajah dosen sudah pernah didaftarkan oleh admin.
- Preview wajah dan tanda tangan tetap ditampilkan walaupun dosen tidak menggantinya.
- File rahasia aplikasi tidak disertakan dalam paket ini. Gunakan `.env.example` sebagai contoh pengisian konfigurasi.

## Menjalankan Aplikasi

```bash
npm install
npm run dev
```
