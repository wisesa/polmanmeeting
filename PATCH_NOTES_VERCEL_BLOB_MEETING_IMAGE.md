# Patch: Storage Gambar Meeting Aman untuk Vercel

Masalah sebelumnya:
- Upload gambar meeting menulis file ke `public/uploads/meetings`.
- Saat deploy ke Vercel, path tersebut berada di `/var/task/public/...` dan bersifat read-only.
- Dampaknya muncul error `EROFS: read-only file system`.

Perbaikan:
- Menambahkan dependency `@vercel/blob`.
- `lib/utils/meeting-image.ts` sekarang otomatis memakai Vercel Blob saat aplikasi berjalan di Vercel.
- Mode lokal tetap tersedia untuk pengembangan lokal.
- Gambar tetap dikompres ke JPEG sekitar 200 KB sebelum upload.
- URL gambar yang disimpan di Firestore sekarang berupa URL Vercel Blob saat di production.
- Saat gambar diganti atau meeting dihapus, gambar lama dihapus dari Blob jika URL-nya adalah Blob URL.

Environment yang perlu disiapkan di Vercel:
1. Buka dashboard project Vercel.
2. Masuk ke tab Storage.
3. Create Database -> Blob.
4. Hubungkan Blob Store ke project dan environment production/preview yang digunakan.
5. Pastikan Environment Variable `BLOB_READ_WRITE_TOKEN` tersedia.
6. Tambahkan `MEETING_IMAGE_STORAGE=blob` jika ingin memaksa mode Blob.

Catatan:
- Jangan memakai `public/uploads/meetings` sebagai storage production di Vercel.
- Folder tersebut hanya aman untuk local development.
