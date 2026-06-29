# Patch Notes: Export PDF Meeting untuk Akun Dosen

Perubahan:
- Menambahkan tombol `Export PDF` pada daftar meeting akun dosen.
- Menambahkan tombol `Export PDF` pada detail meeting akun dosen, di sebelah tombol refresh.
- Endpoint export PDF meeting sekarang dapat digunakan oleh sesi admin maupun sesi dosen.

Validasi:
- `npx tsc --noEmit --pretty false` berhasil tanpa error.
- `npm run build` berhasil melewati compile dan TypeScript, lalu berhenti karena timeout sandbox saat proses `Collecting page data`.
