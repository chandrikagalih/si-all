-- ============================================================
-- RetailPOS Pro — Database Schema (PostgreSQL)
-- ============================================================
-- Jalankan file ini sekali saat pertama setup database
-- Perintah: psql -U postgres -d retailpos -f schema.sql
-- ============================================================

-- Buat database (jalankan sebagai superuser postgres jika belum ada)
-- CREATE DATABASE retailpos;
-- \c retailpos

-- ============================================================
-- TABEL: users (pengguna sistem)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    nama       VARCHAR(100) NOT NULL,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,   -- simpan sebagai bcrypt hash di production
    role       VARCHAR(20)  NOT NULL DEFAULT 'Kasir'
                            CHECK (role IN ('Superadmin','Owner','Kasir')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABEL: settings (pengaturan toko, hanya 1 baris)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id             SERIAL PRIMARY KEY,
    nama_toko      VARCHAR(100) DEFAULT 'RetailPOS Pro',
    alamat         TEXT         DEFAULT '',
    telepon        VARCHAR(30)  DEFAULT '',
    tagline        VARCHAR(200) DEFAULT 'Belanja Hemat, Kualitas Terjamin',
    footer         TEXT         DEFAULT 'Terima Kasih Sudah Berbelanja',
    email          VARCHAR(100) DEFAULT '',
    low_threshold  INTEGER      DEFAULT 20,
    updated_at     TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- TABEL: produk (katalog produk)
-- ============================================================
CREATE TABLE IF NOT EXISTS produk (
    id         SERIAL PRIMARY KEY,
    barcode    VARCHAR(50)  NOT NULL UNIQUE,
    nama       VARCHAR(150) NOT NULL,
    kategori   VARCHAR(50)  DEFAULT 'Makanan',
    satuan     VARCHAR(20)  DEFAULT 'Pcs',
    harga      INTEGER      NOT NULL DEFAULT 0,
    stok       INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMP    DEFAULT NOW(),
    updated_at TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- TABEL: supplier
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier (
    id         SERIAL PRIMARY KEY,
    nama       VARCHAR(100) NOT NULL,
    telp       VARCHAR(30)  DEFAULT '',
    email      VARCHAR(100) DEFAULT '',
    alamat     TEXT         DEFAULT '',
    created_at TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- TABEL: transaksi (header transaksi)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaksi (
    id         SERIAL PRIMARY KEY,
    nota       VARCHAR(20)  NOT NULL UNIQUE,
    tgl        TIMESTAMP    NOT NULL DEFAULT NOW(),
    pelanggan  VARCHAR(100) DEFAULT 'Umum',
    metode     VARCHAR(20)  DEFAULT 'tunai'
                            CHECK (metode IN ('tunai','debit','qris')),
    total      INTEGER      NOT NULL DEFAULT 0,
    uang       INTEGER      NOT NULL DEFAULT 0,
    diskon     INTEGER      NOT NULL DEFAULT 0,
    user_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- TABEL: transaksi_item (detail item per transaksi)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaksi_item (
    id            SERIAL PRIMARY KEY,
    transaksi_id  INTEGER NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
    barcode       VARCHAR(50)  NOT NULL,
    nama          VARCHAR(150) NOT NULL,
    harga         INTEGER      NOT NULL,
    jumlah        INTEGER      NOT NULL DEFAULT 1,
    satuan        VARCHAR(20)  DEFAULT 'Pcs'
);

-- ============================================================
-- TABEL: stok_masuk (riwayat penambahan stok)
-- ============================================================
CREATE TABLE IF NOT EXISTS stok_masuk (
    id          SERIAL PRIMARY KEY,
    tgl         TIMESTAMP    NOT NULL DEFAULT NOW(),
    produk_id   INTEGER      REFERENCES produk(id) ON DELETE SET NULL,
    barcode     VARCHAR(50)  NOT NULL,
    nama_produk VARCHAR(150) NOT NULL,
    jumlah      INTEGER      NOT NULL,
    supplier_id INTEGER      REFERENCES supplier(id) ON DELETE SET NULL,
    nama_supplier VARCHAR(100) DEFAULT '-',
    note        TEXT         DEFAULT '',
    user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES untuk performa query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_produk_barcode    ON produk(barcode);
CREATE INDEX IF NOT EXISTS idx_produk_kategori   ON produk(kategori);
CREATE INDEX IF NOT EXISTS idx_transaksi_tgl     ON transaksi(tgl DESC);
CREATE INDEX IF NOT EXISTS idx_transaksi_nota    ON transaksi(nota);
CREATE INDEX IF NOT EXISTS idx_trx_item_trx_id   ON transaksi_item(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_stok_masuk_tgl    ON stok_masuk(tgl DESC);

-- ============================================================
-- DATA AWAL (SEED)
-- ============================================================

-- Default user: admin (password: admin123)
-- Di production, ganti dengan bcrypt hash!
INSERT INTO users (nama, username, password, role) VALUES
    ('Administrator', 'admin',  'admin123',  'Superadmin'),
    ('Budi Santoso',  'owner',  'owner123',  'Owner'),
    ('Kasir Satu',    'kasir1', 'kasir123',  'Kasir'),
    ('Kasir Dua',     'kasir2', 'kasir123',  'Kasir'),
    ('Kasir Tiga',    'kasir3', 'kasir123',  'Kasir')
ON CONFLICT (username) DO NOTHING;

-- Default settings
INSERT INTO settings (nama_toko, alamat, telepon, tagline, footer, email, low_threshold)
VALUES ('RetailPOS Pro', 'Jl. Contoh No. 1, Jakarta', '021-000-0000',
        'Belanja Hemat, Kualitas Terjamin', 'Terima Kasih Sudah Berbelanja',
        'toko@email.com', 20)
ON CONFLICT DO NOTHING;

-- Sample produk
INSERT INTO produk (barcode, nama, kategori, satuan, harga, stok) VALUES
    ('908881727172',  'Sasarimi Isi 2',      'Makanan',    'Pcs', 2550,  238),
    ('908980989787',  'Inara Drink ZZ',      'Minuman',    'Btl', 7575,  14),
    ('1212535615611', 'Beras Arjuan N09',    'Makanan',    'KG',  11500, 100),
    ('9088817271721', 'Sasarimi Biasa',      'Makanan',    'Pcs', 2250,  5),
    ('9088817271722', 'Sabasa Chik 8M',      'Makanan',    'Pcs', 1500,  120),
    ('112233445566',  'Aqua Galon 19L',      'Minuman',    'Btl', 20000, 45),
    ('998877665544',  'Mie Goreng Instan',   'Mie Instan', 'Pcs', 3500,  300),
    ('111222333444',  'Gula Pasir 1KG',      'Makanan',    'KG',  14000, 8),
    ('555666777888',  'Sabun Mandi Lifeboy', 'Sabun',      'Pcs', 5000,  60),
    ('444333222111',  'Roti Tawar Sari Roti','Roti',       'Pcs', 18500, 22)
ON CONFLICT (barcode) DO NOTHING;

-- Sample supplier
INSERT INTO supplier (nama, telp, email, alamat) VALUES
    ('PT Maju Jaya',   '08123456789', 'maju@jaya.com',      'Jl. Raya No. 1, Jakarta'),
    ('CV Sejahtera',   '08567891234', 'cv@sejahtera.co.id', 'Jl. Pahlawan No. 5, Bandung'),
    ('UD Berkah Tani', '08112233445', 'berkah@tani.id',     'Jl. Sawah No. 3, Bogor')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VIEWS berguna
-- ============================================================

-- View produk dengan status stok
CREATE OR REPLACE VIEW v_produk_stok AS
SELECT
    p.*,
    CASE
        WHEN p.stok = 0         THEN 'habis'
        WHEN p.stok <= (SELECT low_threshold FROM settings LIMIT 1) THEN 'rendah'
        ELSE 'aman'
    END AS status_stok
FROM produk p;

-- View ringkasan transaksi harian
CREATE OR REPLACE VIEW v_laporan_harian AS
SELECT
    DATE(tgl) AS tanggal,
    COUNT(*)  AS jumlah_transaksi,
    SUM(total) AS total_pendapatan,
    SUM(diskon) AS total_diskon
FROM transaksi
GROUP BY DATE(tgl)
ORDER BY tanggal DESC;

-- ============================================================
-- SELESAI — Schema berhasil dibuat
-- ============================================================
