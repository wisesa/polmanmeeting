# Patch: Upload Gambar Meeting ke Firebase Storage

## Perubahan
- Upload gambar meeting tidak lagi memakai folder `public/uploads/meetings`.
- Upload gambar meeting tidak lagi memakai Vercel Blob.
- File gambar disimpan langsung ke Firebase Storage melalui Firebase Admin SDK di API route.
- `@vercel/blob` dan `sharp` dihapus dari dependency utama project.
- Kompres gambar dipindah ke sisi browser memakai Canvas sebelum file dikirim ke API.
- Target ukuran gambar tetap sekitar 200 KB.
- Gambar lama dihapus dari Firebase Storage saat user mengganti gambar atau saat meeting dihapus.
- URL download Firebase Storage disimpan di Firestore agar tetap muncul di halaman detail dan PDF halaman ketiga.

## Environment yang dibutuhkan
Pastikan di Vercel ada:
- `FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

Contoh:
```env
FIREBASE_STORAGE_BUCKET=polman-635e0.appspot.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=polman-635e0.appspot.com
```

Jika bucket Firebase baru menggunakan domain `.firebasestorage.app`, gunakan nama bucket yang muncul di Firebase Console.

## Catatan deploy
Patch ini tetap memakai Node 20 dan `firebase-admin@13.6.0` agar tidak terkena kebutuhan Node >=22 dari firebase-admin 14.
