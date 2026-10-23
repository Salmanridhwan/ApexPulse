import { test } from 'node:test';
import assert from 'node:assert/strict';
import { halamanPaket, halamanSyarat, konfigKontak } from '../src/services/http/halamanPublik';

const kontak = { email: 'kontak@contoh.id', whatsapp: '', situs: 'https://contoh.id' };

test('halaman paket: tiga paket tanpa angka harga', () => {
  const html = halamanPaket(kontak);
  assert.ok(html.includes('Dasar'));
  assert.ok(html.includes('Profesional'));
  assert.ok(html.includes('Instansi / Grup'));
  assert.ok(html.includes('Cara mulai'));
  assert.ok(!/\bRp\s?\d/.test(html), 'tidak boleh memuat angka harga');
  assert.ok(html.includes('Penawaran sesuai kebutuhan instansi'));
});

test('halaman paket: tanpa WhatsApp memakai tautan email', () => {
  const html = halamanPaket(kontak);
  assert.ok(html.includes('mailto:kontak@contoh.id'));
  assert.ok(html.includes('Hubungi kami'));
  assert.ok(!html.includes('wa.me'));
});

test('halaman paket: dengan WhatsApp memakai wa.me dan pesan terisi', () => {
  const html = halamanPaket({ ...kontak, whatsapp: '+62 812-3456-7890' });
  assert.ok(html.includes('https://wa.me/6281234567890?text='));
});

test('halaman publik meng-escape kontak (tidak bisa menyuntik HTML)', () => {
  const html = halamanPaket({ email: '<script>alert(1)</script>', whatsapp: '', situs: '"><b>x' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('halaman syarat: memuat bagian penting & tautan kontak', () => {
  const html = halamanSyarat(kontak);
  for (const bagian of [
    'Definisi',
    'Akun dan keamanan',
    'Penggunaan yang dilarang',
    'Data dan kerahasiaan',
    'Ketersediaan layanan',
    'Kekayaan intelektual',
    'Batasan tanggung jawab',
    'Hukum yang berlaku',
  ]) {
    assert.ok(html.includes(bagian), `bagian "${bagian}" harus ada`);
  }
  assert.ok(html.includes('mailto:kontak@contoh.id'));
  assert.ok(html.includes('Seluruh hak dilindungi'));
});

test('halaman publik menyertakan tautan navigasi ke paket & syarat', () => {
  for (const html of [halamanPaket(kontak), halamanSyarat(kontak)]) {
    assert.ok(html.includes('href="/paket"'));
    assert.ok(html.includes('href="/syarat-ketentuan"'));
  }
});

test('konfigKontak memakai nilai environment bila diisi', () => {
  const simpan = { ...process.env };
  process.env.KONTAK_EMAIL = 'halo@aiones.app';
  process.env.KONTAK_WHATSAPP = '628111';
  process.env.KONTAK_URL = 'https://aiones.app';
  const k = konfigKontak();
  assert.equal(k.email, 'halo@aiones.app');
  assert.equal(k.whatsapp, '628111');
  process.env = simpan;
});
