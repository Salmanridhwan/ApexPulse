import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { lembarDariBerkas, lembarDariPotongan, widgetDariSumber, ringkasRupiah } from '../src/services/builder/dashboardLembar';

// Bentuk potongan basis dokumen dari berkas Excel: judul, header baris 4, data, baris Total.
const POTONGAN = [
  'Lembar: Saldo Piutang 2026\nbaris 1: A=PT. CONTOH\nbaris 2: A=SALDO PIUTANG\nbaris 4: A=No | B=Tanggal | C=Nama Perusahaan | D=Cabang | E=Tagihan | F=Saldo | G=Umur Lunas',
  'Lembar: Saldo Piutang 2026\nbaris 5: A=1 | B=2026-01-10 | C=PT Alfa | D=Bandung | E=1000000000 | F=0 | G=30 baris 6: A=2 | B=2026-02-11 | C=PT Beta | D=Jakarta | E=2500000000 | F=500000000 | G=45',
  'Lembar: Saldo Piutang 2026\nbaris 7: A=3 | B=2026-02-20 | C=PT Alfa | D=Bandung | E=1500000000 | F=1500000000 | G=10 baris 9: A=Total | E=6000000000 | F=2500000000',
  // Ekor lembar lain + awal lembar aging di potongan yang sama: ekornya dibuang.
  'Lembar: Aging\nbaris 120: A=9 | B=x | C=y | D=z | E=1 | F=1 | G=1 baris 1: A=PT. CONTOH baris 3: A=No | B=Tanggal | C=Nama Akun | D=Nilai Tagihan\nbaris 4: A=1 | B=2026-03-01 | C=Unit A | D=700000000',
];

test('potongan basis dokumen disusun jadi lembar, ekor lembar lain dibuang', () => {
  const lembar = lembarDariPotongan(POTONGAN);
  assert.deepEqual(lembar.map((l) => l.nama), ['Saldo Piutang 2026', 'Aging']);
  assert.equal(lembar[1].baris.has(120), false);
  assert.equal(lembar[0].baris.get(6)?.[2], 'PT Beta');
});

test('kartu dari potongan: total dari baris Total dokumen, rincian diberi catatan', () => {
  const hasil = widgetDariSumber({ jenis: 'potongan', lembar: lembarDariPotongan(POTONGAN), lengkap: false }, 'Piutang 2026.xlsx', 'u');
  const saldo = hasil.widgets.find((w) => w.title.endsWith('Total Saldo'))!;
  assert.deepEqual(saldo.kpi, { value: '2,5', unit: 'Rp miliar' });
  // Baris 8 tidak terbaca: 3 dari ±4 baris.
  const perPerusahaan = hasil.widgets.find((w) => w.type === 'hbar')!;
  assert.match(perPerusahaan.subtitle!, /dari 3 dari ±4 baris terbaca/);
  assert.ok(hasil.widgets.some((w) => w.chart?.xAxis.join() === 'PT Alfa,PT Beta'));
  // Umur (hari) tidak dijumlahkan menjadi kartu total.
  assert.ok(!hasil.widgets.some((w) => /Umur/.test(w.title) && w.type === 'kpi'));
  // Lembar Aging tanpa baris Total: tidak ada kartu total, ada catatan.
  assert.ok(!hasil.widgets.some((w) => w.title.startsWith('Aging') && w.type === 'kpi'));
  assert.ok(hasil.catatan.some((c) => /Aging/.test(c) && /Total-nya tidak terbaca/.test(c)));
  assert.ok(hasil.widgets.every((w) => w.citations[0].docName === 'Piutang 2026.xlsx'));
});

test('berkas asli: semua baris terbaca, total dihitung bila tanpa baris Total', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['LAPORAN PIUTANG'],
    [],
    ['No', 'Tanggal', 'Pelanggan', 'Cabang', 'Saldo'],
    [1, '2026-01-05', 'PT Alfa', 'Bandung', 2000000],
    [2, '2026-01-20', 'PT Beta', 'Jakarta', 3000000],
    [3, '2026-02-02', 'PT Alfa', 'Bandung', 5000000],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Piutang');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const hasil = widgetDariSumber({ jenis: 'berkas', lembar: lembarDariBerkas(buffer), lengkap: true }, 'Piutang.xlsx', 'b');
  assert.deepEqual(hasil.catatan, []);
  assert.deepEqual(hasil.widgets.find((w) => w.title === 'Total Saldo')!.kpi, { value: '10', unit: 'Rp juta' });
  const bulan = hasil.widgets.find((w) => w.title === 'Saldo per Bulan')!;
  assert.deepEqual(bulan.chart!.xAxis, ['Jan 26', 'Feb 26']);
  assert.deepEqual(bulan.chart!.series[0].data, [5000000, 5000000]);
});

test('rupiah besar diringkas', () => {
  assert.deepEqual(ringkasRupiah(15795214650), { nilai: '15,8', satuan: 'Rp miliar' });
  assert.deepEqual(ringkasRupiah(1250000000000), { nilai: '1,25', satuan: 'Rp triliun' });
});
