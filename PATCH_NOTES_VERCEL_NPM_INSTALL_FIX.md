# PATCH NOTES - Vercel npm install fix

Perbaikan untuk error Vercel:

```
npm error Exit handler never called!
Error: Command "npm install" exited with 1
```

Perubahan:

1. `package.json` menggunakan `engines.node = "22.x"` agar memenuhi kebutuhan `firebase-admin@14.x` tanpa memaksa Node 24 yang sedang memicu kegagalan `npm install` pada build Vercel.
2. Ditambahkan `vercel.json` dengan `installCommand = "npm ci --no-audit --no-fund"` agar Vercel memakai instalasi deterministik dari `package-lock.json`, bukan `npm install`.
3. `package-lock.json` disesuaikan pada metadata root package.

Setelah push ke GitHub, lakukan Redeploy tanpa cache di Vercel.
