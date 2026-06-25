# Polman Meeting Web

Aplikasi Next.js untuk daftar meeting user, presensi wajah dengan face-api.js, panel admin, Firestore, Firebase Authentication, export PDF, dan master prodi.

## Menu user

User biasa membuka halaman berikut.

```text
/
/meeting/[meetingId]
/absen/[meetingId]
```

User hanya melihat daftar meeting dan melakukan absensi dari detail meeting.

## Menu admin

Admin harus login melalui Firebase Authentication.

```text
/admin/login
/admin
/admin/register-wajah
/admin/prodi
/admin/undangan
/admin/meeting
/admin/meeting/[meetingId]
```

Admin dapat mengelola:

```text
Register Face
Master Prodi
Undangan
Meeting
Export PDF
```

## Master Prodi

Master prodi disimpan di Firestore collection berikut.

```text
master_prodi/{prodiId}
```

Contoh dokumen:

```json
{
  "prodiId": "ti",
  "kode": "TI",
  "nama": "Teknik Informatika",
  "displayName": "TI - Teknik Informatika",
  "jenjang": "D4",
  "jurusan": "Teknik Komputer dan Informatika",
  "isActive": true,
  "sortOrder": 1,
  "createdAt": 1782061200000,
  "updatedAt": 1782061200000,
  "syncedAt": 1782061200000,
  "source": "nextjs_admin_master_prodi"
}
```

Master prodi dipakai sebagai lookup di:

```text
/admin/register-wajah  -> pilih satu prodi
/admin/undangan        -> pilih lebih dari satu prodi
/admin/meeting         -> pilih lebih dari satu prodi
```

## Register wajah

Register wajah dapat mengambil descriptor dari dua sumber:

```text
Webcam
File gambar JPG, PNG, atau WebP
```

Descriptor tetap memakai face-api.js ukuran 128 angka.

## Struktur Firestore

```text
master_prodi/{prodiId}
registered_faces/{nameKey}
meeting_info_forms/{formId}
meetings/{meetingId}
meetings/{meetingId}/presences/{nameKey}
calendar_marks/{dateKey}
```

## Setup

```bash
npm install
npm run setup:firebase -- ./polman-635e0-firebase-adminsdk-fbsvc-79d2864d27.json
```

Isi Firebase Web App Config di `.env.local`.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=polman-635e0.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=polman-635e0
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxxxxxxx:web:xxxxxxxx
```

Jalankan aplikasi.

```bash
npm run verify:firestore
npm run dev
```

## Model face-api.js

Default memakai CDN.

```env
NEXT_PUBLIC_FACE_API_MODEL_URL=https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights
```

Bila ingin lokal, simpan model ke folder ini lalu ubah env ke `/models/face-api`.

```text
public/models/face-api
```
