# Patch: Gambar Meeting di PDF Halaman Ketiga

Perubahan:
- Menambahkan halaman dokumentasi rapat pada export PDF meeting.
- Gambar meeting yang diupload dari Form Meeting admin/dosen ditampilkan di halaman setelah Notulen Hasil Rapat.
- Pada kondisi normal PDF menjadi:
  1. Daftar Hadir
  2. Notulen Hasil Rapat
  3. Dokumentasi Rapat berisi gambar meeting
- Gambar diambil dari `meetingImageUrl` atau `meetingImagePath`.
- Mendukung gambar dari Vercel Blob (`https://...`) dan local development (`/uploads/meetings/...`).
- Jika gambar gagal dimuat saat export PDF, halaman dokumentasi tetap dibuat dengan pesan fallback agar PDF tidak gagal total.

File utama yang diubah:
- `lib/pdf/documents.ts`

Validasi:
- `npm install` berhasil.
- `npx tsc --noEmit --pretty false` berhasil tanpa error TypeScript.
