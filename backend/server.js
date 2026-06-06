/**
 * RetailPOS Pro — Backend Server
 * Express.js + PostgreSQL
 *
 * Jalankan: node server.js
 * Env vars diperlukan di file .env
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');
const path       = require('path');
require('dotenv').config();

// ============================================================
// KONFIGURASI
// ============================================================
const app  = express();
const PORT = process.env.PORT || 3001;

// Koneksi PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Untuk lokal tanpa DATABASE_URL, pakai ini:
  // host:     process.env.DB_HOST     || 'localhost',
  // port:     process.env.DB_PORT     || 5432,
  // database: process.env.DB_NAME     || 'retailpos',
  // user:     process.env.DB_USER     || 'postgres',
  // password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ============================================================
// HELPER
// ============================================================
const db = {
  query: (text, params) => pool.query(text, params),
  one:   async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  },
  many:  async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  },
};

// Middleware error handler
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// ── AUTH ROUTES ──
// ============================================================

// POST /api/login
app.post('/api/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  // CATATAN: Di production, gunakan bcrypt.compare() untuk password hash!
  // const bcrypt = require('bcryptjs');
  // const match = await bcrypt.compare(password, user.password);
  const user = await db.one(
    'SELECT id, nama, username, role FROM users WHERE username=$1 AND password=$2',
    [username, password]
  );
  if (!user)
    return res.status(401).json({ error: 'Username atau password salah' });

  res.json({ success: true, user });
}));

// ============================================================
// ── SETTINGS ROUTES ──
// ============================================================

// GET /api/settings
app.get('/api/settings', asyncHandler(async (req, res) => {
  const s = await db.one('SELECT * FROM settings ORDER BY id LIMIT 1');
  res.json(s || {});
}));

// PUT /api/settings
app.put('/api/settings', asyncHandler(async (req, res) => {
  const { nama_toko, alamat, telepon, tagline, footer, email, low_threshold } = req.body;
  const existing = await db.one('SELECT id FROM settings LIMIT 1');

  if (existing) {
    await db.query(
      `UPDATE settings SET
        nama_toko=$1, alamat=$2, telepon=$3, tagline=$4,
        footer=$5, email=$6, low_threshold=$7, updated_at=NOW()
       WHERE id=$8`,
      [nama_toko, alamat, telepon, tagline, footer, email, low_threshold || 20, existing.id]
    );
  } else {
    await db.query(
      `INSERT INTO settings (nama_toko,alamat,telepon,tagline,footer,email,low_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nama_toko, alamat, telepon, tagline, footer, email, low_threshold || 20]
    );
  }
  res.json({ success: true });
}));

// ============================================================
// ── PRODUK ROUTES ──
// ============================================================

// GET /api/produk  (opsional: ?kategori=Makanan&search=indomie)
app.get('/api/produk', asyncHandler(async (req, res) => {
  const { kategori, search } = req.query;
  let sql    = 'SELECT * FROM produk WHERE 1=1';
  const vals = [];

  if (kategori) { vals.push(kategori); sql += ` AND kategori=$${vals.length}`; }
  if (search)   { vals.push(`%${search}%`); sql += ` AND (nama ILIKE $${vals.length} OR barcode ILIKE $${vals.length})`; }

  sql += ' ORDER BY id ASC';
  const rows = await db.many(sql, vals);
  res.json(rows);
}));

// GET /api/produk/barcode/:barcode
app.get('/api/produk/barcode/:barcode', asyncHandler(async (req, res) => {
  const p = await db.one('SELECT * FROM produk WHERE barcode=$1', [req.params.barcode]);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(p);
}));

// POST /api/produk
app.post('/api/produk', asyncHandler(async (req, res) => {
  const { barcode, nama, kategori, satuan, harga, stok } = req.body;
  if (!barcode || !nama || !harga)
    return res.status(400).json({ error: 'Barcode, nama, dan harga wajib diisi' });

  const dup = await db.one('SELECT id FROM produk WHERE barcode=$1', [barcode]);
  if (dup) return res.status(409).json({ error: 'Barcode sudah digunakan' });

  const p = await db.one(
    `INSERT INTO produk (barcode,nama,kategori,satuan,harga,stok)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [barcode, nama, kategori || 'Makanan', satuan || 'Pcs', harga, stok || 0]
  );
  res.status(201).json(p);
}));

// PUT /api/produk/:id
app.put('/api/produk/:id', asyncHandler(async (req, res) => {
  const { barcode, nama, kategori, satuan, harga, stok } = req.body;
  const dup = await db.one(
    'SELECT id FROM produk WHERE barcode=$1 AND id<>$2', [barcode, req.params.id]
  );
  if (dup) return res.status(409).json({ error: 'Barcode sudah digunakan produk lain' });

  const p = await db.one(
    `UPDATE produk SET barcode=$1,nama=$2,kategori=$3,satuan=$4,
      harga=$5,stok=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,
    [barcode, nama, kategori, satuan, harga, stok, req.params.id]
  );
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(p);
}));

// DELETE /api/produk/:id
app.delete('/api/produk/:id', asyncHandler(async (req, res) => {
  const r = await db.query('DELETE FROM produk WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json({ success: true });
}));

// POST /api/produk/import  (bulk import CSV)
app.post('/api/produk/import', asyncHandler(async (req, res) => {
  const { produk } = req.body; // array of produk objects
  if (!Array.isArray(produk) || !produk.length)
    return res.status(400).json({ error: 'Data produk kosong' });

  let berhasil = 0;
  const gagal  = [];

  for (const p of produk) {
    try {
      await db.query(
        `INSERT INTO produk (barcode,nama,kategori,satuan,harga,stok)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (barcode) DO NOTHING`,
        [p.barcode, p.nama, p.kategori || 'Makanan', p.satuan || 'Pcs', p.harga, p.stok || 0]
      );
      berhasil++;
    } catch (e) {
      gagal.push({ barcode: p.barcode, nama: p.nama, error: e.message });
    }
  }
  res.json({ berhasil, gagal });
}));

// ============================================================
// ── SUPPLIER ROUTES ──
// ============================================================

app.get('/api/supplier', asyncHandler(async (req, res) => {
  res.json(await db.many('SELECT * FROM supplier ORDER BY id ASC'));
}));

app.post('/api/supplier', asyncHandler(async (req, res) => {
  const { nama, telp, email, alamat } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama supplier wajib diisi' });
  const s = await db.one(
    'INSERT INTO supplier (nama,telp,email,alamat) VALUES ($1,$2,$3,$4) RETURNING *',
    [nama, telp || '', email || '', alamat || '']
  );
  res.status(201).json(s);
}));

app.put('/api/supplier/:id', asyncHandler(async (req, res) => {
  const { nama, telp, email, alamat } = req.body;
  const s = await db.one(
    'UPDATE supplier SET nama=$1,telp=$2,email=$3,alamat=$4 WHERE id=$5 RETURNING *',
    [nama, telp, email, alamat, req.params.id]
  );
  if (!s) return res.status(404).json({ error: 'Supplier tidak ditemukan' });
  res.json(s);
}));

app.delete('/api/supplier/:id', asyncHandler(async (req, res) => {
  const r = await db.query('DELETE FROM supplier WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Supplier tidak ditemukan' });
  res.json({ success: true });
}));

// ============================================================
// ── STOK MASUK ROUTES ──
// ============================================================

app.get('/api/stok', asyncHandler(async (req, res) => {
  const rows = await db.many(
    `SELECT sm.*, p.stok AS stok_sekarang, p.satuan
     FROM stok_masuk sm
     LEFT JOIN produk p ON p.id = sm.produk_id
     ORDER BY sm.tgl DESC`
  );
  res.json(rows);
}));

app.post('/api/stok', asyncHandler(async (req, res) => {
  const { barcode, jumlah, supplier_id, note, user_id } = req.body;
  if (!barcode || !jumlah) return res.status(400).json({ error: 'Barcode dan jumlah wajib' });

  const p = await db.one('SELECT * FROM produk WHERE barcode=$1', [barcode]);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });

  const supplier = supplier_id
    ? await db.one('SELECT * FROM supplier WHERE id=$1', [supplier_id])
    : null;

  // Update stok produk
  await db.query('UPDATE produk SET stok=stok+$1 WHERE barcode=$2', [jumlah, barcode]);

  // Catat riwayat
  const sm = await db.one(
    `INSERT INTO stok_masuk
       (produk_id, barcode, nama_produk, jumlah, supplier_id, nama_supplier, note, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [p.id, barcode, p.nama, jumlah,
     supplier?.id || null, supplier?.nama || '-', note || '', user_id || null]
  );
  res.status(201).json({ ...sm, stok_baru: p.stok + Number(jumlah) });
}));

// ============================================================
// ── TRANSAKSI ROUTES ──
// ============================================================

// GET /api/transaksi  (opsional: ?from=2025-01-01&to=2025-12-31&search=TRX001)
app.get('/api/transaksi', asyncHandler(async (req, res) => {
  const { from, to, search } = req.query;
  let sql  = `SELECT t.*, u.nama AS nama_kasir FROM transaksi t
              LEFT JOIN users u ON u.id = t.user_id WHERE 1=1`;
  const vals = [];

  if (from)   { vals.push(from);   sql += ` AND DATE(t.tgl) >= $${vals.length}`; }
  if (to)     { vals.push(to);     sql += ` AND DATE(t.tgl) <= $${vals.length}`; }
  if (search) {
    vals.push(`%${search}%`);
    sql += ` AND (t.nota ILIKE $${vals.length} OR t.pelanggan ILIKE $${vals.length})`;
  }
  sql += ' ORDER BY t.tgl DESC';

  const trxList = await db.many(sql, vals);

  // Ambil semua items untuk transaksi yang ditemukan
  if (trxList.length) {
    const ids   = trxList.map(t => t.id);
    const items = await db.many(
      `SELECT * FROM transaksi_item WHERE transaksi_id = ANY($1)`, [ids]
    );
    const itemMap = {};
    items.forEach(it => {
      if (!itemMap[it.transaksi_id]) itemMap[it.transaksi_id] = [];
      itemMap[it.transaksi_id].push(it);
    });
    trxList.forEach(t => { t.items = itemMap[t.id] || []; });
  }

  res.json(trxList);
}));

// GET /api/transaksi/:id  (detail 1 transaksi)
app.get('/api/transaksi/:id', asyncHandler(async (req, res) => {
  const t = await db.one('SELECT * FROM transaksi WHERE id=$1', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  t.items = await db.many('SELECT * FROM transaksi_item WHERE transaksi_id=$1', [t.id]);
  res.json(t);
}));

// POST /api/transaksi  (proses pembayaran baru)
app.post('/api/transaksi', asyncHandler(async (req, res) => {
  const { nota, pelanggan, metode, items, total, uang, diskon, user_id } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Items tidak boleh kosong' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cek stok setiap item
    for (const item of items) {
      const p = await client.query(
        'SELECT stok, nama FROM produk WHERE barcode=$1 FOR UPDATE', [item.barcode]
      );
      if (!p.rows.length) throw new Error(`Produk ${item.barcode} tidak ditemukan`);
      if (p.rows[0].stok < item.jumlah)
        throw new Error(`Stok ${p.rows[0].nama} tidak cukup (tersedia: ${p.rows[0].stok})`);
    }

    // Insert transaksi
    const trx = await client.query(
      `INSERT INTO transaksi (nota, pelanggan, metode, total, uang, diskon, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nota, pelanggan || 'Umum', metode || 'tunai', total, uang || total, diskon || 0, user_id || null]
    );
    const trxId = trx.rows[0].id;

    // Insert items & kurangi stok
    for (const item of items) {
      await client.query(
        `INSERT INTO transaksi_item (transaksi_id,barcode,nama,harga,jumlah,satuan)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [trxId, item.barcode, item.nama, item.harga, item.jumlah, item.satuan || 'Pcs']
      );
      await client.query(
        'UPDATE produk SET stok=stok-$1, updated_at=NOW() WHERE barcode=$2',
        [item.jumlah, item.barcode]
      );
    }

    await client.query('COMMIT');
    const result = trx.rows[0];
    result.items = items;
    res.status(201).json(result);

  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/transaksi/:id
app.delete('/api/transaksi/:id', asyncHandler(async (req, res) => {
  const r = await db.query('DELETE FROM transaksi WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  res.json({ success: true });
}));

// ============================================================
// ── USERS ROUTES ──
// ============================================================

app.get('/api/users', asyncHandler(async (req, res) => {
  // Jangan kembalikan password ke frontend
  res.json(await db.many('SELECT id,nama,username,role,created_at FROM users ORDER BY id'));
}));

app.post('/api/users', asyncHandler(async (req, res) => {
  const { nama, username, password, role } = req.body;
  if (!nama || !username || !password)
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });

  const dup = await db.one('SELECT id FROM users WHERE username=$1', [username]);
  if (dup) return res.status(409).json({ error: 'Username sudah digunakan' });

  // Di production: const hash = await bcrypt.hash(password, 10);
  const u = await db.one(
    'INSERT INTO users (nama,username,password,role) VALUES ($1,$2,$3,$4) RETURNING id,nama,username,role',
    [nama, username, password, role || 'Kasir']
  );
  res.status(201).json(u);
}));

app.put('/api/users/:id', asyncHandler(async (req, res) => {
  const { nama, username, password, role } = req.body;
  const dup = await db.one('SELECT id FROM users WHERE username=$1 AND id<>$2', [username, req.params.id]);
  if (dup) return res.status(409).json({ error: 'Username sudah digunakan' });

  let sql, vals;
  if (password) {
    sql  = 'UPDATE users SET nama=$1,username=$2,password=$3,role=$4 WHERE id=$5 RETURNING id,nama,username,role';
    vals = [nama, username, password, role, req.params.id];
  } else {
    sql  = 'UPDATE users SET nama=$1,username=$2,role=$3 WHERE id=$4 RETURNING id,nama,username,role';
    vals = [nama, username, role, req.params.id];
  }
  const u = await db.one(sql, vals);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json(u);
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
  const u = await db.one('SELECT username FROM users WHERE id=$1', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (u.username === 'admin')
    return res.status(403).json({ error: 'Akun admin utama tidak bisa dihapus' });

  await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// ── DASHBOARD / STATISTIK ──
// ============================================================

// GET /api/dashboard  (semua data ringkasan sekaligus)
app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const [revenue, produkCount, lowStockList, recentTrx, dailyRevenue, bestseller] =
    await Promise.all([
      db.one('SELECT COALESCE(SUM(total),0) AS total FROM transaksi'),
      db.one('SELECT COUNT(*) AS count FROM produk'),
      db.many(
        `SELECT id,nama,stok,satuan FROM produk
         WHERE stok <= (SELECT low_threshold FROM settings LIMIT 1)
         ORDER BY stok ASC LIMIT 10`
      ),
      db.many(
        `SELECT t.nota, t.pelanggan, t.total, t.tgl,
                COALESCE(SUM(ti.jumlah),0) AS total_items
         FROM transaksi t
         LEFT JOIN transaksi_item ti ON ti.transaksi_id = t.id
         GROUP BY t.id ORDER BY t.tgl DESC LIMIT 5`
      ),
      db.many(
        `SELECT DATE(tgl) AS tanggal, COALESCE(SUM(total),0) AS revenue
         FROM transaksi
         WHERE tgl >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(tgl) ORDER BY tanggal ASC`
      ),
      db.many(
        `SELECT ti.nama, SUM(ti.jumlah) AS total_qty
         FROM transaksi_item ti
         GROUP BY ti.nama ORDER BY total_qty DESC LIMIT 5`
      ),
    ]);

  res.json({
    revenue: Number(revenue.total),
    totalTrx: 0, // dihitung dari query lain jika perlu
    produkCount: Number(produkCount.count),
    lowStockList,
    recentTrx,
    dailyRevenue,
    bestseller,
  });
}));

// ============================================================
// CATCH-ALL: serve frontend
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('[RetailPOS Error]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ RetailPOS Pro server berjalan di port ${PORT}`);
  console.log(`   DB: ${process.env.DATABASE_URL ? 'Cloud (URL)' : 'Lokal'}`);
});

module.exports = app;
