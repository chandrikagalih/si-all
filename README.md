# RetailPOS Pro — Panduan Deployment Full-Stack

## 📁 Struktur File

```
retailpos/
├── backend/
│   ├── server.js        ← Express API server
│   ├── package.json
│   └── .env.example     ← Salin jadi .env dan isi
├── frontend/
│   └── public/
│       ├── index.html   ← File asli kamu (dimodifikasi)
│       └── api.js       ← Layer pemanggilan API
└── database/
    └── schema.sql       ← Buat tabel + data awal
```

---

## 🗄️ Pilihan Database (SQL — PostgreSQL)

Kenapa PostgreSQL? Karena:
- **Gratis** tersedia di Supabase, Railway, Render
- **SQL** — cocok dengan data transaksi (relasional)
- **ACID** — transaksi aman, stok tidak salah hitung
- **Performa** — bisa handle ribuan transaksi/hari

---

## 🚀 OPSI HOSTING (Direkomendasikan)

### ✅ OPSI 1 — Supabase (Database) + Railway (Backend) + Vercel (Frontend)
> **GRATIS semua**, paling stabil untuk production

| Layanan | Fungsi | Gratis |
|---------|--------|--------|
| Supabase | PostgreSQL database | ✅ 500MB |
| Railway  | Node.js backend | ✅ $5/bulan gratis credit |
| Vercel   | Frontend static | ✅ Unlimited |

### ✅ OPSI 2 — Railway Saja (All-in-One)
> Paling simpel, 1 platform untuk backend + DB

- Deploy backend ke Railway
- Tambah plugin PostgreSQL di Railway
- Frontend di-serve langsung dari Express

### ✅ OPSI 3 — Render (Backend + DB)
> Alternatif Railway, 100% gratis tapi lebih lambat spin-up

---

## 📋 LANGKAH SETUP

### LANGKAH 1: Setup Database di Supabase

1. Daftar di **https://supabase.com** (gratis)
2. Buat project baru → pilih region **Singapore**
3. Masuk ke **SQL Editor**
4. Copy-paste isi file `database/schema.sql` → klik **Run**
5. Buka **Settings → Database → Connection String**
6. Salin **URI** (format: `postgresql://postgres.xxx:password@aws-...`)

### LANGKAH 2: Deploy Backend ke Railway

1. Daftar di **https://railway.app** (gratis $5 credit/bulan)
2. Klik **New Project → Deploy from GitHub Repo**
3. Upload folder `backend/` ke GitHub kamu dulu
4. Di Railway, pilih repo → set **Root Directory**: `backend`
5. Tambahkan **Environment Variables**:
   ```
   DATABASE_URL  = (paste dari Supabase)
   PORT          = 3001
   FRONTEND_URL  = https://retailpos-kamu.vercel.app
   ```
6. Railway otomatis detect `package.json` dan jalankan `npm start`
7. Salin URL Railway yang diberikan, contoh: `https://retailpos-production.up.railway.app`

### LANGKAH 3: Modifikasi Frontend

Buka file `frontend/public/index.html` dan tambahkan sebelum `</head>`:

```html
<script src="api.js"></script>
```

Lalu ganti semua fungsi yang menyimpan ke `localStorage` dengan panggilan ke `API.*`.

Lihat tabel mapping di bawah.

### LANGKAH 4: Deploy Frontend ke Vercel

1. Daftar di **https://vercel.com** (gratis)
2. Klik **New Project → Import Git**
3. Pilih folder `frontend/public/`
4. Set **Environment Variable**: tidak perlu, karena `api.js` auto-detect URL
5. Deploy → dapat URL seperti `https://retailpos-xxx.vercel.app`

---

## 🔄 MAPPING: localStorage → API

| Aksi Lama (localStorage) | API Baru |
|--------------------------|----------|
| `db.produk` (read)       | `await API.Produk.getAll()` |
| `db.produk.push()`       | `await API.Produk.create(data)` |
| `db.produk[i] = obj`     | `await API.Produk.update(id, data)` |
| `db.produk.splice(i,1)`  | `await API.Produk.delete(id)` |
| `db.transaksi.push()`    | `await API.Transaksi.create(data)` |
| `db.supplier` (read)     | `await API.Supplier.getAll()` |
| `db.settings`            | `await API.Settings.get()` |
| `saveSettings()`         | `await API.Settings.save(data)` |
| Login (hardcoded)        | `await API.Auth.login(user, pass)` |

---

## 🔐 KEAMANAN (Sebelum Production)

1. **Password hashing** — Install bcryptjs dan hash password sebelum simpan:
   ```js
   const bcrypt = require('bcryptjs');
   const hash = await bcrypt.hash(password, 10);
   // Saat login:
   const match = await bcrypt.compare(inputPassword, user.password);
   ```

2. **JWT Session** — Tambahkan token untuk validasi request:
   ```js
   const jwt = require('jsonwebtoken');
   const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET);
   ```

3. **HTTPS** — Railway dan Vercel otomatis pakai HTTPS ✅

4. **Rate limiting** — Cegah brute force login:
   ```js
   const rateLimit = require('express-rate-limit');
   ```

---

## 🖥️ SETUP LOKAL (Development)

```bash
# 1. Install PostgreSQL lokal
# Windows: download dari postgresql.org
# Mac: brew install postgresql
# Ubuntu: sudo apt install postgresql

# 2. Buat database
psql -U postgres -c "CREATE DATABASE retailpos;"
psql -U postgres -d retailpos -f database/schema.sql

# 3. Setup backend
cd backend
cp .env.example .env
# Edit .env: isi DATABASE_URL=postgresql://postgres:password@localhost:5432/retailpos
npm install
npm run dev    # pakai nodemon untuk auto-reload

# 4. Buka browser
# Buka: http://localhost:3001
```

---

## 📊 API ENDPOINTS LENGKAP

```
POST   /api/login                    Login user
GET    /api/settings                 Ambil pengaturan toko
PUT    /api/settings                 Simpan pengaturan

GET    /api/produk                   List semua produk
GET    /api/produk?kategori=Makanan  Filter per kategori
GET    /api/produk?search=indomie    Cari produk
GET    /api/produk/barcode/:barcode  Cari by barcode
POST   /api/produk                   Tambah produk baru
PUT    /api/produk/:id               Edit produk
DELETE /api/produk/:id               Hapus produk
POST   /api/produk/import            Import bulk dari CSV

GET    /api/supplier                 List supplier
POST   /api/supplier                 Tambah supplier
PUT    /api/supplier/:id             Edit supplier
DELETE /api/supplier/:id             Hapus supplier

GET    /api/stok                     Riwayat stok masuk
POST   /api/stok                     Tambah stok masuk

GET    /api/transaksi                List transaksi (filter: from,to,search)
GET    /api/transaksi/:id            Detail transaksi
POST   /api/transaksi                Proses transaksi baru
DELETE /api/transaksi/:id            Hapus transaksi

GET    /api/users                    List pengguna
POST   /api/users                    Tambah pengguna
PUT    /api/users/:id                Edit pengguna
DELETE /api/users/:id                Hapus pengguna

GET    /api/dashboard                Data ringkasan dashboard
```

---

## 💡 Tips Tambahan

- **Backup otomatis**: Supabase punya backup harian otomatis (gratis tier)
- **Multi-kasir**: Karena data di server, bisa dibuka dari HP/PC berbeda serentak
- **Offline mode**: Bisa tambah Service Worker untuk cache data saat offline
- **Real-time**: Supabase punya fitur Realtime WebSocket jika perlu live update antar kasir

---

## 📞 Akun Default Setelah Setup DB

| Username | Password  | Role       |
|----------|-----------|------------|
| admin    | admin123  | Superadmin |
| owner    | owner123  | Owner      |
| kasir1   | kasir123  | Kasir      |

⚠️ **Ganti password segera setelah deploy!**
