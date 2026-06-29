# Patch Notes - Vercel pnpm ERR_INVALID_THIS Fix

Perubahan deploy:
- Pin package manager ke `pnpm@9.15.9`.
- `vercel.json` memakai `corepack prepare pnpm@9.15.9 --activate`.
- Dependency `latest` dipin ke versi konkret agar build lebih deterministik.
- `.npmrc` menambahkan registry npm resmi dan konfigurasi retry/network-concurrency.

Tujuan:
- Menghindari error Vercel/pnpm `ERR_INVALID_THIS` saat fetch metadata package dari registry.
- Mengurangi ketergantungan pada resolusi versi terbaru saat build.
