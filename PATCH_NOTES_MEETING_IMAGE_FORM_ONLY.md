# Patch Meeting Image Form Only

Perubahan:
- Input gambar meeting dihapus dari halaman Register Meeting (`/admin/meeting`).
- Tombol `Ambil dari File` dan `Ambil dari Kamera` tidak lagi tampil pada form register/edit meeting utama.
- Upload gambar meeting tetap tersedia hanya pada halaman Form Meeting (`/admin/meeting/[meetingId]`).
- Field `Catatan` tetap dipertahankan.
- Preview gambar pada kartu daftar meeting tetap dipertahankan agar gambar yang sudah diunggah dari Form Meeting tetap terlihat.

Catatan teknis:
- Komponen `AdminMeetingClient.tsx` dibersihkan dari state/ref/fungsi kamera yang tidak lagi dipakai di halaman register meeting.
- Komponen `AdminMeetingRunClient.tsx` tidak dihapus karena merupakan halaman Form Meeting yang memang menjadi lokasi input gambar.
