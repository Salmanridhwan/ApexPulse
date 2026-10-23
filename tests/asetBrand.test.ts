import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { halamanPaket } from '../src/services/http/halamanPublik';

/**
 * Aset logo dipakai di beberapa tempat (halaman masuk, sidebar, halaman
 * publik, favicon). Kalau satu berkas hilang atau ukurannya salah, yang
 * muncul bukan galat build melainkan gambar rusak di produksi — jadi
 * keberadaannya dikunci di sini.
 */

const AKAR = process.cwd();
const BRAND = path.join(AKAR, 'public', 'brand');

/** Baca lebar/tinggi dari header IHDR PNG tanpa dependensi. */
function ukuranPng(berkas: string): { lebar: number; tinggi: number } {
  const buf = fs.readFileSync(berkas);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', `${berkas} bukan PNG`);
  return { lebar: buf.readUInt32BE(16), tinggi: buf.readUInt32BE(20) };
}

test('aset logo tersedia dengan ukuran yang benar', () => {
  const harapan: Record<string, [number, number]> = {
    'logo-lockup.png': [372, 96],
    'logo-lockup-terang.png': [372, 96],
    'logo-mark.png': [512, 512],
    'logo-mark-terang.png': [512, 512],
    'favicon-32.png': [32, 32],
    'apple-touch-icon.png': [180, 180],
  };
  for (const [nama, [lebar, tinggi]] of Object.entries(harapan)) {
    const berkas = path.join(BRAND, nama);
    assert.ok(fs.existsSync(berkas), `public/brand/${nama} tidak ada`);
    assert.deepEqual(ukuranPng(berkas), { lebar, tinggi }, `ukuran ${nama} tidak sesuai`);
  }
});

test('versi terang benar-benar berbeda dari versi biasa', () => {
  const biasa = fs.readFileSync(path.join(BRAND, 'logo-mark.png'));
  const terang = fs.readFileSync(path.join(BRAND, 'logo-mark-terang.png'));
  assert.ok(biasa.length > 0 && terang.length > 0);
  // Kalau navy tidak diganti putih, keduanya akan identik byte-per-byte.
  assert.notEqual(biasa.toString('base64'), terang.toString('base64'));
});

test('index.html memuat favicon & apple-touch-icon', () => {
  const html = fs.readFileSync(path.join(AKAR, 'index.html'), 'utf-8');
  assert.ok(html.includes('/brand/favicon-32.png'));
  assert.ok(html.includes('/brand/apple-touch-icon.png'));
  assert.ok(html.includes('name="theme-color"'));
});

test('halaman publik memakai lockup logo, bukan kotak warna', () => {
  const html = halamanPaket({ email: 'a@b.c', whatsapp: '', situs: 'https://x' });
  assert.ok(html.includes('/brand/logo-lockup.png'));
  assert.ok(!html.includes('class="tanda"'), 'kotak pengganti logo masih ada');
});

test('halaman masuk memuat lockup untuk mode terang & gelap', () => {
  const tsx = fs.readFileSync(path.join(AKAR, 'src', 'pages', 'Login.tsx'), 'utf-8');
  assert.ok(tsx.includes('/brand/logo-lockup.png'));
  assert.ok(tsx.includes('/brand/logo-lockup-terang.png'));
  assert.ok(tsx.includes('dark:hidden') && tsx.includes('dark:block'));
});

test('sidebar memakai lockup terang (latar sidebar selalu navy)', () => {
  const tsx = fs.readFileSync(path.join(AKAR, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
  assert.ok(tsx.includes('/brand/logo-lockup-terang.png'));
  assert.ok(tsx.includes('/brand/logo-mark-terang.png'));
});
