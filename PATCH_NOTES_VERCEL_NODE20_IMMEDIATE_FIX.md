# Patch: Vercel Node 20 immediate deployment fix

Masalah deployment terbaru terjadi pada tahap install dependency dengan Node 22/24, baik memakai npm maupun pnpm. Log pnpm menunjukkan `ERR_INVALID_THIS` saat mengambil metadata dari npm registry (`URLSearchParams`).

Patch ini mengembalikan konfigurasi deploy ke Node 20.x dan npm install karena kombinasi ini sudah terbukti melewati tahap install dan build pada deployment sebelumnya. Ini adalah perbaikan praktis agar aplikasi kembali deploy sekarang.

Perubahan:
- `package.json` engines dikembalikan ke `node: 20.x`.
- `vercel.json` memakai `npm install --no-audit --no-fund` dan `npm run build`.
- `package-lock.json` dipertahankan.
- Tidak memakai pnpm/Corepack.

Catatan:
- Vercel memberi peringatan bahwa Node 20 akan deprecated pada periode mendatang. Migrasi ke Node 22/24 bisa dilakukan setelah issue registry/package-manager di build environment stabil.
