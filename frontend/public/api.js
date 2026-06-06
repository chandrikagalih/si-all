/**
 * RetailPOS Pro — API Client Layer
 * Semua pemanggilan ke backend dilakukan lewat file ini.
 *
 * Cara pakai:  <script src="api.js"></script>
 * Kemudian gunakan: await API.produk.getAll()  dll.
 */

'use strict';

/* ============================================================
   KONFIGURASI BASE URL
   - Saat development lokal: http://localhost:3001
   - Saat production: sama domain (karena backend serve frontend)
   ============================================================ */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

/* ============================================================
   HELPER FETCH
   ============================================================ */
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const defaultOpts = {
    headers: { 'Content-Type': 'application/json' },
  };
  const merged = { ...defaultOpts, ...options };
  if (options.body && typeof options.body === 'object') {
    merged.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, merged);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ============================================================
   AUTH
   ============================================================ */
const Auth = {
  async login(username, password) {
    return apiFetch('/login', { method: 'POST', body: { username, password } });
  },
};

/* ============================================================
   SETTINGS
   ============================================================ */
const Settings = {
  async get()    { return apiFetch('/settings'); },
  async save(data) { return apiFetch('/settings', { method: 'PUT', body: data }); },
};

/* ============================================================
   PRODUK
   ============================================================ */
const Produk = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/produk' + (qs ? '?' + qs : ''));
  },
  async getByBarcode(barcode) { return apiFetch('/produk/barcode/' + barcode); },
  async create(data)  { return apiFetch('/produk', { method: 'POST', body: data }); },
  async update(id, data) { return apiFetch('/produk/' + id, { method: 'PUT', body: data }); },
  async delete(id)    { return apiFetch('/produk/' + id, { method: 'DELETE' }); },
  async importBulk(produkArr) {
    return apiFetch('/produk/import', { method: 'POST', body: { produk: produkArr } });
  },
};

/* ============================================================
   SUPPLIER
   ============================================================ */
const Supplier = {
  async getAll()          { return apiFetch('/supplier'); },
  async create(data)      { return apiFetch('/supplier', { method: 'POST', body: data }); },
  async update(id, data)  { return apiFetch('/supplier/' + id, { method: 'PUT', body: data }); },
  async delete(id)        { return apiFetch('/supplier/' + id, { method: 'DELETE' }); },
};

/* ============================================================
   STOK
   ============================================================ */
const Stok = {
  async getAll()   { return apiFetch('/stok'); },
  async tambah(data) { return apiFetch('/stok', { method: 'POST', body: data }); },
};

/* ============================================================
   TRANSAKSI
   ============================================================ */
const Transaksi = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/transaksi' + (qs ? '?' + qs : ''));
  },
  async getById(id) { return apiFetch('/transaksi/' + id); },
  async create(data) { return apiFetch('/transaksi', { method: 'POST', body: data }); },
  async delete(id)   { return apiFetch('/transaksi/' + id, { method: 'DELETE' }); },
};

/* ============================================================
   USERS
   ============================================================ */
const Users = {
  async getAll()         { return apiFetch('/users'); },
  async create(data)     { return apiFetch('/users', { method: 'POST', body: data }); },
  async update(id, data) { return apiFetch('/users/' + id, { method: 'PUT', body: data }); },
  async delete(id)       { return apiFetch('/users/' + id, { method: 'DELETE' }); },
};

/* ============================================================
   DASHBOARD
   ============================================================ */
const Dashboard = {
  async get() { return apiFetch('/dashboard'); },
};

/* ============================================================
   EXPORT GLOBAL
   ============================================================ */
window.API = { Auth, Settings, Produk, Supplier, Stok, Transaksi, Users, Dashboard };

/* ============================================================
   STATE LOKAL (cache in-memory untuk session ini)
   Digunakan agar tidak terlalu banyak request ke server.
   ============================================================ */
window.localState = {
  produk:    [],
  supplier:  [],
  settings:  {},
  users:     [],
  stok:      [],
  transaksi: [],
  loaded:    {},

  async ensureProduk() {
    if (!this.loaded.produk) {
      this.produk = await API.Produk.getAll();
      this.loaded.produk = true;
    }
    return this.produk;
  },
  async ensureSupplier() {
    if (!this.loaded.supplier) {
      this.supplier = await API.Supplier.getAll();
      this.loaded.supplier = true;
    }
    return this.supplier;
  },
  async ensureSettings() {
    if (!this.loaded.settings) {
      this.settings = await API.Settings.get();
      this.loaded.settings = true;
    }
    return this.settings;
  },
  invalidate(key) {
    this.loaded[key] = false;
  },
};
