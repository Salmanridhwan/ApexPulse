import test from 'node:test';
import assert from 'node:assert/strict';
import { AREA_SAPUAN, WILAYAH_LAYANAN, jumlahWilayahDisebut, hasilWilayahSah } from '../src/services/rag/http';

const wilayah = AREA_SAPUAN.find((a) => a.id === 'wilayah');

test('instruksi area wilayah menyebut kelima wilayah layanan', () => {
  assert.ok(wilayah, 'area wilayah harus ada di AREA_SAPUAN');
  for (const nama of WILAYAH_LAYANAN) {
    assert.ok(
      wilayah!.instruksi.toLowerCase().includes(nama.toLowerCase()),
      `instruksi harus menyebut ${nama}`
    );
  }
  assert.match(wilayah!.instruksi, /bukan satu tahun/i, 'harus menolak deret tahunan');
});

test('menghitung nama wilayah yang disebut', () => {
  assert.equal(jumlahWilayahDisebut('Jakarta Barat dan Jakarta Utara'), 2);
  assert.equal(jumlahWilayahDisebut('tidak ada wilayah di sini'), 0);
  assert.equal(jumlahWilayahDisebut(WILAYAH_LAYANAN.join(', ')), 5);
  assert.equal(jumlahWilayahDisebut(''), 0);
});

test('hasil berisi sebaran wilayah dianggap sah', () => {
  const hasil = {
    kpi: [],
    grafik: {
      judul: 'Pelanggan per wilayah',
      kategori: ['Jakarta Barat', 'Jakarta Utara', 'Jakarta Pusat'],
      seri: [{ nama: 'Pelanggan', data: [208360, 172880, 150000] }],
    },
    tabel: null,
  };
  assert.equal(hasilWilayahSah(hasil), true);
});

test('grafik pendapatan tahunan ditolak (bukan sebaran wilayah)', () => {
  const salah = {
    kpi: [{ label: 'Pendapatan usaha 2024', nilai: '3.184,72', satuan: 'Rp miliar' }],
    grafik: {
      judul: 'Pendapatan usaha 2022-2024',
      kategori: ['2022', '2023', '2024'],
      seri: [{ nama: 'Pendapatan', data: [2600, 2900, 3184.72] }],
    },
    tabel: null,
  };
  assert.equal(hasilWilayahSah(salah), false, 'harus ditolak supaya diulang dengan instruksi ketat');
});

test('hasil kosong / null tidak dianggap sah', () => {
  assert.equal(hasilWilayahSah(null), false);
  assert.equal(hasilWilayahSah({ kpi: [], grafik: null, tabel: null }), false);
});
