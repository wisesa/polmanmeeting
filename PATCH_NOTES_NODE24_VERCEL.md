# Patch Notes — Vercel Node.js 24

## Masalah
Log build Vercel menampilkan peringatan:

- Node.js 20.x deprecated dan deployment setelah 2026-10-01 akan gagal build.
- `firebase-admin@14.1.0` membutuhkan Node.js `>=22` sedangkan build sebelumnya memakai Node.js 20.
- Warning optional dependency `encoding` dari `node-fetch`.

## Perbaikan
- `package.json` diperbarui:
  - `engines.node` dari `20.x` menjadi `24.x`.
  - Menambahkan dependency `encoding` untuk menghilangkan warning optional module dari `node-fetch`.
- `package-lock.json` diperbarui agar dependency sesuai.

## Langkah Setelah Upload ke GitHub/Vercel
1. Commit dan push perubahan `package.json` dan `package-lock.json`.
2. Di Vercel, buka Project → Settings → Build and Deployment.
3. Pada Node.js Version, pilih `24.x` bila tersedia.
4. Redeploy project tanpa cache jika perlu.
