# Patch Notes - Upload Gambar Meeting

Perubahan utama:

1. Menambahkan upload gambar pada form Admin Meeting.
   - Input menerima JPG, PNG, dan WebP.
   - Form dikirim menggunakan multipart/form-data agar file dapat diterima API.

2. Menyimpan gambar meeting ke folder public/uploads/meetings.
   - Gambar dikompres server-side menjadi JPG dengan target sekitar 200 KB.
   - Metadata gambar disimpan di dokumen Firestore meeting:
     - meetingImageUrl
     - meetingImagePath
     - meetingImageFileName
     - meetingImageMimeType
     - meetingImageSize
     - meetingImageUpdatedAt

3. Menghapus file gambar lama secara otomatis.
   - Jika admin mengganti gambar meeting, file lama di public/uploads/meetings ikut dihapus.
   - Jika admin menghapus gambar dari form edit, file lama ikut dihapus.
   - Jika meeting dihapus, file gambar meeting juga ikut dihapus.

4. Merapikan halaman meeting.
   - Gambar meeting ditampilkan pada kartu daftar meeting.
   - Gambar meeting ditampilkan pada detail meeting admin/dosen.
   - Input Pembahasan, Catatan, dan Catatan Tambahan di bagian notulen dihapus dari UI.
   - Data lama untuk pembahasan/catatan tetap dipertahankan di database agar tidak hilang hanya karena inputnya dihapus.

File utama yang diubah/ditambah:
- components/AdminMeetingClient.tsx
- components/AdminMeetingRunClient.tsx
- components/MeetingDetailClient.tsx
- app/api/meetings/route.ts
- app/api/meetings/[meetingId]/route.ts
- app/api/meetings/[meetingId]/run-form/route.ts
- lib/firebase/schema.ts
- lib/firebase/db.ts
- lib/utils/meeting-image.ts
- app/globals.css
- package.json
- package-lock.json
- public/uploads/meetings/.gitkeep
