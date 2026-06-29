# Patch Notes - Hapus Presensi Peserta Admin

Perubahan fitur:

1. Menambahkan tombol `Hapus Presensi` pada setiap kartu peserta di daftar presensi meeting akun admin.
2. Tombol hanya aktif di akun admin melalui properti `allowDelete` pada komponen `PresenceListLive`.
3. Menambahkan API khusus admin:
   - `DELETE /api/meetings/[meetingId]/presences/[presenceId]`
4. Menambahkan fungsi Firestore `deleteMeetingPresence()` untuk:
   - menghapus dokumen presensi peserta dari subcollection `meetings/{meetingId}/presences/{presenceId}`;
   - menghapus data presensi lama jika masih tersimpan pada field map `presences` di dokumen meeting;
   - memperbarui `participantsCount` agar jumlah peserta hadir ikut berkurang.
5. Setelah presensi dihapus, daftar peserta otomatis diperbarui tanpa reload halaman.

Validasi:

- `npx tsc --noEmit --pretty false` berhasil tanpa error.
- `npm run build` berhasil melewati compile dan TypeScript, lalu berhenti karena timeout sandbox pada tahap `Collecting page data`.
