# Patch: Preview Wajah Peserta dan Edit Notulen Dosen

Perubahan utama:

1. Admin Meeting
   - Halaman `/admin/meeting/[meetingId]` sekarang menampilkan daftar peserta hadir di bawah form meeting.
   - Daftar presensi otomatis refresh berkala.
   - Peserta yang memiliki thumbnail wajah akan tampil dengan preview wajah, bukan hanya inisial.

2. Akun Dosen
   - Halaman detail meeting dosen sekarang memiliki form edit notulen.
   - Dosen dapat mengedit pemimpin rapat, notulen, agenda, pembahasan, hasil rapat, tindak lanjut, catatan, dan catatan tambahan.
   - Daftar peserta hadir di akun dosen sekarang menampilkan preview wajah jika thumbnail tersedia.

3. Data Presensi
   - Saat dosen berhasil absen wajah, thumbnail wajah dari data register ikut disimpan ke dokumen presensi.
   - Data presensi lama yang belum memiliki thumbnail akan mencoba mengambil thumbnail dari koleksi `registered_faces` berdasarkan `nameKey`.

4. API
   - Endpoint `PATCH /api/meetings/[meetingId]/run-form` sekarang bisa dipakai oleh admin dan dosen yang memiliki sesi valid.

Validasi:

- `npx tsc --noEmit --pretty false` berhasil tanpa error.
- `npm run build` berhasil melewati compile dan TypeScript, tetapi proses build di sandbox berhenti karena timeout pada tahap `Collecting page data`. Ada warning lama dari dependency `face-api.js` terkait modul opsional `encoding`.
