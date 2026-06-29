# Patch: Upload Gambar Meeting dari File atau Kamera

Perubahan pada halaman Admin Meeting:

1. Upload gambar meeting sekarang bisa memakai dua sumber:
   - **Ambil dari File** untuk memilih gambar JPG/PNG/WebP dari perangkat.
   - **Ambil dari Kamera** untuk membuka kamera browser, menampilkan preview video, lalu mengambil foto langsung.

2. Hasil foto dari kamera dibuat sebagai file JPG sementara di browser, kemudian dikirim melalui field `meetingImage` yang sama dengan upload file biasa.

3. Alur backend tetap sama:
   - gambar diproses oleh API meeting,
   - dikompres server-side memakai `sharp`,
   - disimpan ke `public/uploads/meetings`,
   - target ukuran tetap sekitar 200 KB,
   - gambar lama tetap dihapus saat meeting diganti gambarnya atau meeting dihapus.

4. UI tambahan:
   - preview gambar baru sebelum disimpan,
   - tombol untuk membatalkan gambar baru,
   - tombol membuka kamera,
   - tombol mengambil foto,
   - tombol menutup kamera,
   - pesan error jika browser/perangkat tidak mengizinkan akses kamera.

File utama yang diubah:
- `components/AdminMeetingClient.tsx`
- `app/globals.css`

Catatan teknis:
- Fitur kamera membutuhkan izin kamera dari browser.
- Pada browser modern, akses kamera biasanya perlu `https` atau `localhost` saat development.
