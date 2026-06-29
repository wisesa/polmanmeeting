# Patch Notes - Vercel PNPM Install Fix

Perubahan ini dibuat karena proses deploy Vercel berhenti pada tahap dependency install dengan error npm:

```
npm error Exit handler never called!
```

Error tersebut terjadi sebelum `next build`, sehingga penyebabnya berada pada proses install `npm`, bukan pada kode aplikasi.

## Perubahan

1. Mengganti jalur install Vercel dari `npm ci` menjadi `pnpm install`.
2. Menambahkan `packageManager: pnpm@10.17.1` pada `package.json`.
3. Mengubah `vercel.json` agar Vercel menjalankan:

```bash
corepack enable && pnpm install --no-frozen-lockfile
corepack enable && pnpm run build
```

4. Menambahkan `.npmrc` untuk membuat konfigurasi install lebih toleran terhadap engine/peer dependency.
5. Node tetap `22.x` karena `firebase-admin` versi baru membutuhkan Node `>=22`.

## Langkah Deploy

Jika sebelumnya repository masih memiliki `package-lock.json`, hapus file tersebut dari repository agar Vercel tidak kembali memakai pola npm lama:

```bash
git rm package-lock.json
git add .
git commit -m "fix: use pnpm for vercel install stability"
git push
```

Di Vercel, lakukan redeploy tanpa cache.
