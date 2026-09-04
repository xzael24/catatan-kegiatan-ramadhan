# Ramadhan App Anak Sholeh

Aplikasi web untuk melacak kegiatan ibadah siswa SD selama bulan Ramadhan. Dibangun untuk membantu guru memantau aktivitas harian siswa secara realtime, mulai dari sahur hingga sholat tarawih.

## Fitur

- **Tracking 9 Kegiatan Ibadah**: Sahur, Puasa, Sholat Subuh, Sholat Zuhur, Sholat Ashar, Sholat Maghrib, Sholat Isya, Tadarus, dan Sholat Tarawih
- **Dashboard Guru**: Tabel monitoring realtime per kelas dengan filter dan statistik completion rate
- **Panel Admin**: CRUD siswa, manajemen data, reset database, dan log aktivitas lengkap
- **Export/Import Data**: Mendukung format CSV dan Excel (XLSX), single date atau bulk import
- **Progressive Web App**: Bisa diinstall langsung dari browser ke homescreen perangkat mobile maupun desktop
- **Offline Support**: Firestore persistent cache memungkinkan akses data tanpa koneksi internet
- **Activity Logging**: Semua perubahan data tercatat dengan timestamp, actor, dan detail perubahan

## Tech Stack

- React 19
- Vite 7
- Firebase Firestore (database + offline cache)
- Vite PWA (service worker + manifest)
- SheetJS (xlsx) untuk export/import Excel
- React Router v7

## Struktur Aplikasi

| Route | Halaman | Keterangan |
|-------|---------|------------|
| `/` | StudentView | Halaman siswa untuk checklist ibadah harian |
| `/guru` | TeacherView | Dashboard guru dengan tabel monitoring realtime |
| `/admin` | AdminView | Panel admin untuk kelola siswa, data, dan log |

## Persiapan

1. Buat project Firebase di [Firebase Console](https://console.firebase.google.com/)
2. Aktifkan Firestore Database
3. Aktifkan Firebase Analytics (opsional)
4. Salin konfigurasi Firebase ke file `.env`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Jalankan

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build untuk production
npm run build

# Preview hasil build
npm run preview
```

## Firebase Index

Beberapa query membutuhkan composite index di Firestore. Jika muncul error index saat pertama kali menjalankan, klik link yang muncul di console browser untuk membuat index secara otomatis.

## Catatan Pengembangan

- Data siswa bisa di-seed otomatis via `seedInitialData()` di `src/services/firebase.js` jika koleksi `students` masih kosong
- Import CSV/Excel menggunakan header kolom: Nama, Kelas, Tanggal (untuk bulk), Sahur, Puasa, Sholat Subuh, Sholat Zuhur, Sholat Ashar, Sholat Maghrib, Sholat Isya, Tadarus, Catatan Tadarus, Tarawih
- Batch write dibatasi 450 operasi per batch untuk menghindari limit Firestore
