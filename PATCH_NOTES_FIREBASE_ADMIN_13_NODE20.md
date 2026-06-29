# Patch Notes — Firebase Admin 13 untuk Node 20 di Vercel

Perubahan:
- `firebase-admin` diturunkan dari versi `14.x/latest` menjadi `13.6.0`.
- `firebase-admin@13.6.0` masih mendukung Node `>=18`, sehingga tidak memunculkan warning `required node >=22` saat project sementara memakai Node 20.
- Semua dependency utama dipin ke versi konkret agar Vercel tidak terus menarik versi `latest` saat build.
- `package-lock.json` diperbarui agar versi dependency sesuai dengan `package.json`.
- `vercel.json` memakai `npm ci --no-audit --no-fund` agar install lebih deterministik.
- Fitur sebelumnya tetap dipertahankan: upload gambar meeting admin/dosen, Vercel Blob, gambar PDF halaman ketiga, dan field Catatan.

Catatan:
- Ini solusi stabil sementara untuk deploy di Node 20.
- Setelah masalah install Node 22/24 stabil, project dapat dinaikkan lagi ke Node 22/24 dan Firebase Admin 14.
