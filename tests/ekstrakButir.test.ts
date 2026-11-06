/**
 * EKSTRAKSI BUTIR — bagian yang memanggil model, diuji tanpa jaringan.
 *
 * Yang dijaga: angka model tidak boleh jadi 0 palsu, butir tanpa sitasi tidak
 * boleh berkeyakinan tinggi, dan bentuk widget mengikuti bentuk data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BATAS_BUTIR,
  SKEMA_BUTIR,
  angka,
  bentukDari,
  hitungKeyakinan,
  instruksiButir,
  normalisasiButir,
  type KonteksEkstraksi,
} from '../src/services/analisis/ekstrakButir';

const konteks: KonteksEkstraksi = {
  tenantId: 't-1',
  analisisId: 'anl-1',
  berkasId: 'brk-1',
  judulBerkas: 'Laporan Tahunan 2024.pdf',
  bidang: 'Keuangan',
  dataDiminta: 'pendapatan usaha dan beban operasional',
  instansi: 'Perumda Tirta Moedal',
};

test('skema butir tidak meminta kategori atau bentuk — itu diturunkan lokal', () => {
  const properti = Object.keys((SKEMA_BUTIR as any).properties.butir.items.properties);
  assert.ok(properti.includes('nama'));
  assert.ok(properti.includes('sitasi'));
  assert.ok(!properti.includes('kategori'), 'kategori tidak boleh ditanyakan ke model');
  assert.ok(!properti.includes('bentukDisarankan'));
});

test('instruksi menyebut nama dokumen, instansi, dan larangan mengarang', () => {
  const teks = instruksiButir(konteks);
  assert.match(teks, /Laporan Tahunan 2024\.pdf/);
  assert.match(teks, /Perumda Tirta Moedal/);
  assert.match(teks, /jangan mengarang/i);
  assert.match(teks, /sitasi/i);
});

test('instruksi memuat konteks permintaan bila ada', () => {
  const teks = instruksiButir(konteks);
  assert.match(teks, /pendapatan usaha dan beban operasional/);
  assert.match(teks, /Keuangan/);
});

test('angka membaca format Indonesia dan menolak sampah', () => {
  assert.equal(angka('1.234,56'), 1234.56);
  assert.equal(angka('Rp 1.234'), 1234);
  assert.equal(angka('12%'), 12);
  assert.equal(angka(7.5), 7.5);
  assert.equal(angka('tidak ada'), null);
  assert.equal(angka(''), null);
  assert.equal(angka(null), null);
  // Nol adalah angka sah — tidak boleh dianggap gagal baca.
  assert.equal(angka('0'), 0);
});

test('butir angka tunggal jadi kpi dan kategorinya diturunkan dari nama', () => {
  const hasil = normalisasiButir(
    {
      ringkasan: 'Laporan memuat realisasi pendapatan usaha.',
      butir: [
        {
          nama: 'Pendapatan Usaha 2024',
          nilai: '1.234.567',
          satuan: 'juta rupiah',
          sitasi: { dokumen: 'Laporan Tahunan 2024', halaman: 12, kutipan: 'Pendapatan usaha 2024 sebesar ...' },
          keyakinan: 'tinggi',
        },
      ],
    },
    konteks
  );
  assert.equal(hasil.butir.length, 1);
  const b = hasil.butir[0];
  assert.equal(b.bentukDisarankan, 'kpi');
  assert.equal(b.nilai, 1234567);
  assert.equal(b.kategori, 'Keuangan');
  assert.equal(b.keyakinan, 'tinggi');
  assert.equal(b.status, 'draf');
  assert.equal(b.sitasi.halaman, 12);
  assert.match(hasil.ringkasan || '', /pendapatan/i);
});

test('butir tanpa sitasi tetap disimpan tetapi keyakinannya rendah', () => {
  const hasil = normalisasiButir(
    { butir: [{ nama: 'Jumlah pegawai', nilai: 120, keyakinan: 'tinggi' }] },
    konteks
  );
  assert.equal(hasil.butir.length, 1);
  assert.equal(hasil.butir[0].keyakinan, 'rendah');
  assert.equal(hasil.butir[0].status, 'draf');
  assert.match(hasil.butir[0].sitasi.dokumen, /tidak disebutkan/i);
});

test('butir tanpa angka sama sekali dibuang, dan jumlahnya dilaporkan', () => {
  const hasil = normalisasiButir(
    { butir: [{ nama: 'Visi misi', sitasi: { dokumen: 'Laporan 2024' } }, { nama: '', nilai: 5 }] },
    konteks
  );
  assert.equal(hasil.butir.length, 0);
  assert.equal(hasil.dibuang, 2);
});

test('butir ganda dibuang, yang pertama dipertahankan', () => {
  const hasil = normalisasiButir(
    {
      butir: [
        { nama: 'Pendapatan', nilai: 10, sitasi: { dokumen: 'L1' } },
        { nama: 'pendapatan', nilai: 99, sitasi: { dokumen: 'L1' } },
      ],
    },
    konteks
  );
  assert.equal(hasil.butir.length, 1);
  assert.equal(hasil.butir[0].nilai, 10);
});

test('deret panjang jadi garis, deret berlabel pendek jadi donat, deret pendek jadi batang', () => {
  assert.equal(bentukDari({ seri: [{ nama: 'Pendapatan', data: [1, 2, 3, 4, 5, 6] }] }), 'line');
  assert.equal(
    bentukDari({ seri: [{ nama: 'Beban', data: [10, 20, 30], kategori: ['A', 'B', 'C'] }] }),
    'donut'
  );
  assert.equal(bentukDari({ seri: [{ nama: 'Beban', data: [10, 20] }] }), 'bar');
  assert.equal(bentukDari({ nilai: 42 }), 'kpi');
});

test('tabel butuh minimal dua kolom dan satu baris; kalau tidak, dibuang', () => {
  const sah = normalisasiButir(
    {
      butir: [
        {
          nama: 'Rincian beban',
          tabel: { kolom: ['Jenis', 'Jumlah'], baris: [['Gaji', 100], ['Listrik', 20]] },
          sitasi: { dokumen: 'Laporan 2024' },
        },
      ],
    },
    konteks
  );
  assert.equal(sah.butir.length, 1);
  assert.equal(sah.butir[0].bentukDisarankan, 'table');

  const rusak = normalisasiButir(
    { butir: [{ nama: 'Rincian', tabel: { kolom: ['Jenis'], baris: [] }, sitasi: { dokumen: 'L' } }] },
    konteks
  );
  assert.equal(rusak.butir.length, 0);
});

test('seri dengan data kosong tidak dianggap punya angka', () => {
  const hasil = normalisasiButir(
    { butir: [{ nama: 'Tren', seri: [{ nama: 'X', data: [] }], sitasi: { dokumen: 'L' } }] },
    konteks
  );
  assert.equal(hasil.butir.length, 0);
});

test('jumlah butir dibatasi supaya satu dokumen tidak meledak', () => {
  const banyak = Array.from({ length: BATAS_BUTIR + 15 }, (_, i) => ({
    nama: `Indikator ${i}`,
    nilai: i,
    sitasi: { dokumen: 'Laporan 2024' },
  }));
  const hasil = normalisasiButir({ butir: banyak }, konteks);
  assert.equal(hasil.butir.length, BATAS_BUTIR);
});

test('id butir unik dan terikat ke analisisnya', () => {
  const hasil = normalisasiButir(
    {
      butir: [
        { nama: 'A', nilai: 1, sitasi: { dokumen: 'L' } },
        { nama: 'B', nilai: 2, sitasi: { dokumen: 'L' } },
      ],
    },
    konteks
  );
  const id = hasil.butir.map((b) => b.id);
  assert.equal(new Set(id).size, 2);
  assert.ok(hasil.butir.every((b) => b.analisisId === 'anl-1' && b.tenantId === 't-1'));
});

test('permintaanId diteruskan bila ada', () => {
  const hasil = normalisasiButir(
    { butir: [{ nama: 'A', nilai: 1, sitasi: { dokumen: 'L' } }] },
    { ...konteks, permintaanId: 'pmt-9' }
  );
  assert.equal(hasil.butir[0].permintaanId, 'pmt-9');
});

test('masukan bukan array atau kosong tidak melempar galat', () => {
  assert.deepEqual(normalisasiButir(null, konteks).butir, []);
  assert.deepEqual(normalisasiButir({}, konteks).butir, []);
  assert.deepEqual(normalisasiButir([], konteks).butir, []);
});

test('hitung keyakinan memisah tiga tingkat', () => {
  const hasil = normalisasiButir(
    {
      butir: [
        { nama: 'A', nilai: 1, sitasi: { dokumen: 'L' }, keyakinan: 'tinggi' },
        { nama: 'B', nilai: 2, sitasi: { dokumen: 'L' }, keyakinan: 'sedang' },
        { nama: 'C', nilai: 3 },
      ],
    },
    konteks
  );
  assert.deepEqual(hitungKeyakinan(hasil.butir), { tinggi: 1, sedang: 1, rendah: 1 });
});
