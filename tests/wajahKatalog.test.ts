import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOpsi, DAFTAR_CHART } from '../src/services/chart/chartDefault';
import { contohData } from '../src/services/chart/contohData';
import { PESANAN_STATUS } from '../src/services/chart/varianLensa';

/**
 * Penjaga: satu wajah yang melempar galat membuat seluruh halaman katalog
 * kosong (React membongkar pohonnya). Jadi semua wajah harus bisa dibangun
 * dengan data contoh, apa pun variannya.
 */
test('semua wajah bisa dibangun tanpa melempar galat', () => {
  for (const id of DAFTAR_CHART) {
    for (const varian of ['default', 'ringkasan', 'analitik', 'trafik'] as const) {
      const hasil = buildOpsi(id, contohData(id), varian, 1);
      // Varian yang belum punya wajah boleh jatuh ke varian lain, tapi tidak
      // boleh kosong sama sekali.
      assert.ok(hasil.opsi, `${id} varian ${varian} tidak menghasilkan opsi`);
    }
  }
});

test('batang status Lensa aman walau datanya lebih panjang dari jumlah status', () => {
  const panjang = {
    kategori: Array.from({ length: 29 }, (_, i) => `Hari ${i + 1}`),
    seri: [{ nama: 'Pesanan', data: Array.from({ length: 29 }, (_, i) => i * 10) }],
    dariDokumen: true,
  };
  const hasil = buildOpsi('bar-tegak-sorot', panjang as any, 'analitik', 1);
  const seri = (hasil.opsi as any).series[0];
  // Satu batang per status; data selebihnya dipotong, bukan dibaca mentah.
  assert.equal(seri.data.length, PESANAN_STATUS.length);
});

test('kartu KPI punya wajah sendiri per template', () => {
  const jenis = (varian: 'default' | 'ringkasan' | 'analitik' | 'trafik') =>
    (buildOpsi('kpi-kartu', contohData('kpi-kartu'), varian, 1).opsi as any).jenis;
  assert.equal(jenis('default'), 'kpi-kartu');
  assert.equal(jenis('ringkasan'), 'kpi-kartu');
  // Lensa dan Nadi tidak lagi menggambar kartunya sendiri di halaman.
  assert.equal(jenis('analitik'), 'kpi-lensa');
  assert.equal(jenis('trafik'), 'kpi-nadi');
});

test('tiga widget pindahan terdaftar di katalog', () => {
  const jenis = (id: any, varian: any) => (buildOpsi(id, contohData(id), varian, 1).opsi as any).jenis;
  assert.equal(jenis('strip-os', 'trafik'), 'strip-os');
  assert.equal(jenis('kpi-strip', 'analitik'), 'kpi-strip');
  assert.equal(jenis('tabel-ringkas', 'trafik'), 'tabel-ringkas');
});
