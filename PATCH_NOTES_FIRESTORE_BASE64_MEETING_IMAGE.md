# Patch Notes — Meeting Image Firestore Base64

Perubahan ini memindahkan penyimpanan gambar meeting dari storage file eksternal ke field base64 di dokumen Firestore.

## Perubahan utama

- Gambar meeting tidak lagi disimpan ke `public/uploads/meetings`.
- Gambar meeting tidak lagi memakai Vercel Blob.
- Gambar meeting tidak lagi memakai Firebase Storage bucket.
- Gambar dikompres di browser memakai Canvas sebelum dikirim ke API.
- API mengubah file hasil kompres menjadi base64.
- Base64 disimpan langsung ke dokumen `meetings` di Firestore pada field `meetingImageBase64`.
- `meetingImageUrl` tidak disimpan ke Firestore, tetapi dibuat otomatis saat data meeting dibaca sebagai data URL:
  `data:image/jpeg;base64,...`
- Hapus/ganti gambar cukup menghapus/mengganti field gambar di dokumen Firestore.
- PDF halaman ketiga membaca gambar dari base64 Firestore.

## Field Firestore baru

- `meetingImageBase64`
- `meetingImageFileName`
- `meetingImageMimeType`
- `meetingImageSize`
- `meetingImageUpdatedAt`
- `meetingImageStorage = firestore-base64`

## Catatan batas ukuran

Firestore tidak cocok untuk file besar. Karena itu gambar tetap dikompres sekitar 200 KB di browser dan API menolak file hasil kompres yang terlalu besar.
