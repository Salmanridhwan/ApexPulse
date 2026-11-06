/**
 * BUTIR → WIDGET — diuji tanpa database dan tanpa model.
 *
 * Yang paling penting dijaga di sini: angka di kartu HARUS sama dengan angka
 * butir. Kalau ada satu jalur yang mengarang nilai, seluruh janji "angka bisa
 * ditelusuri ke dokumen" batal.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData } from '../src/types';
import {
  MAKS_WIDGET_PER_HALAMAN,
  butirKeHalaman,
  butirKeWidget,
  ringkasHalaman,
  sitasiDari,
  tataGrid,
} from '../src/services/analisis/butirKeWidget';

let urut = 0;
function butir(p: Partial<ButirData> = {}): ButirData {
  urut += 1;
  return {
    id: `btr-${urut}`,
    tenantId: 't-1',
    analisisId: 'anl-1',
    berkasId: 'brk-1',
    nama: `Indikator ${urut}`,
    kategori: 'Keuangan',
    bentukDisarankan: 'kpi',
    sitasi: { dokumen: 'Laporan Tahunan 2024', halaman: 12, kutipan: 'Pendapatan usaha ...' },
    keyakinan: 'tinggi',
    status: 'disetujui',
    dibuatPada: '2026-11-06T10:00:00Z',
    ...p,
  };
}

test('KPI memakai angka butir apa adanya, tanpa pembulatan atau karangan', () => {
  const w = butirKeWidget(butir({ nilai: 1234.56, satuan: 'juta rupiah' }));
  assert.ok(w);
  assert.equal(w!.kpi?.value, 1234.56);
  assert.equal(w!.kpi?.unit, 'juta rupiah');
  assert.equal(w!.type, 'kpi');
});

test('butir tanpa angka sama sekali tidak menghasilkan kartu', () => {
  assert.equal(butirKeWidget(butir({ nilai: undefined })), null);
});

test('deret jadi chart dengan sumbu dan seri dari butir', () => {
  const w = butirKeWidget(
    butir({
      bentukDisarankan: 'line',
      nilai: undefined,
      seri: [{ nama: 'Pendapatan', data: [10, 20, 30], kategori: ['2022', '2023', '2024'] }],
      satuan: 'miliar',
    })
  );
  assert.ok(w);
  assert.deepEqual(w!.chart?.xAxis, ['2022', '2023', '2024']);
  assert.deepEqual(w!.chart?.series[0].data, [10, 20, 30]);
  assert.equal(w!.chart?.unit, 'miliar');
});

test('deret tanpa label memakai nomor urut, bukan label karangan', () => {
  const w = butirKeWidget(butir({ bentukDisarankan: 'bar', nilai: undefined, seri: [{ nama: 'X', data: [5, 7] }] }));
  assert.deepEqual(w!.chart?.xAxis, ['1', '2']);
});

test('tabel butir jadi tabel widget dengan kolom dan baris utuh', () => {
  const w = butirKeWidget(
    butir({
      bentukDisarankan: 'table',
      nilai: undefined,
      tabel: { kolom: ['Jenis', 'Jumlah'], baris: [['Gaji', 100], ['Listrik', 20]] },
    })
  );
  assert.ok(w);
  assert.equal(w!.table?.columns.length, 2);
  assert.equal(w!.table?.columns[0].label, 'Jenis');
  assert.equal(w!.table?.rows.length, 2);
  assert.equal(w!.table?.rows[0].k1, 100);
});

test('sitasi butir ikut ke widget, lengkap dengan halaman', () => {
  const w = butirKeWidget(butir({ nilai: 10 }));
  assert.equal(w!.citations.length, 1);
  assert.equal(w!.citations[0].docName, 'Laporan Tahunan 2024');
  assert.equal(w!.citations[0].page, 12);
});

test('butir tanpa dokumen tidak dibuatkan sitasi palsu', () => {
  const s = sitasiDari(butir({ sitasi: { dokumen: 'Dokumen tidak disebutkan' } }));
  assert.deepEqual(s, []);
});

test('keyakinan tinggi jadi sumber, sedang/rendah jadi inferensi AI', () => {
  assert.equal(butirKeWidget(butir({ nilai: 1, keyakinan: 'tinggi' }))!.confidence, 'sumber');
  assert.equal(butirKeWidget(butir({ nilai: 1, keyakinan: 'sedang' }))!.confidence, 'inferensi AI');
  assert.equal(butirKeWidget(butir({ nilai: 1, keyakinan: 'rendah' }))!.confidence, 'inferensi AI');
});

test('butir yang ditolak admin tidak pernah masuk halaman', () => {
  const halaman = butirKeHalaman([
    butir({ nama: 'Dipakai', nilai: 1 }),
    butir({ nama: 'Ditolak', nilai: 2, status: 'ditolak' }),
  ]);
  const judul = halaman.flatMap((h) => h.widgets.map((w) => w.title));
  assert.deepEqual(judul, ['Dipakai']);
});

test('butir dikelompokkan per kategori, bukan dicampur', () => {
  const halaman = butirKeHalaman([
    butir({ nama: 'Pendapatan', nilai: 1, kategori: 'Keuangan' }),
    butir({ nama: 'Pegawai', nilai: 2, kategori: 'SDM' }),
  ]);
  assert.equal(halaman.length, 2);
  assert.deepEqual(
    halaman.map((h) => h.judul).sort(),
    ['Keuangan', 'SDM']
  );
});

test('halaman dipecah setelah 9 widget, diberi label Bagian', () => {
  const banyak = Array.from({ length: 12 }, (_, i) => butir({ nama: `KPI ${i}`, nilai: i, kategori: 'Keuangan' }));
  const halaman = butirKeHalaman(banyak);
  assert.equal(halaman.length, 2);
  assert.equal(halaman[0].widgets.length, MAKS_WIDGET_PER_HALAMAN);
  assert.equal(halaman[1].widgets.length, 3);
  assert.match(halaman[0].judul, /Bagian 1/);
  assert.match(halaman[1].judul, /Bagian 2/);
});

test('tidak ada halaman yang melebihi 9 widget', () => {
  const banyak = Array.from({ length: 25 }, (_, i) => butir({ nama: `KPI ${i}`, nilai: i, kategori: 'Keuangan' }));
  for (const h of butirKeHalaman(banyak)) {
    assert.ok(h.widgets.length <= MAKS_WIDGET_PER_HALAMAN, `halaman ${h.judul} berisi ${h.widgets.length}`);
  }
});

test('tataGrid tidak menumpuk kartu dan tidak melewati 12 kolom', () => {
  const widgets = [
    butirKeWidget(butir({ nilai: 1, bentukDisarankan: 'kpi' }))!,
    butirKeWidget(butir({ nilai: 2, bentukDisarankan: 'kpi' }))!,
    butirKeWidget(butir({ nilai: 3, bentukDisarankan: 'kpi' }))!,
    butirKeWidget(butir({ nilai: 4, bentukDisarankan: 'kpi' }))!,
    butirKeWidget(butir({ nilai: 5, bentukDisarankan: 'kpi' }))!,
    butirKeWidget(
      butir({ nilai: undefined, bentukDisarankan: 'line', seri: [{ nama: 'S', data: [1, 2, 3, 4, 5] }] })
    )!,
  ];
  const hasil = tataGrid(widgets);
  for (const w of hasil) {
    assert.ok(w.grid.x + w.grid.w <= 12, `kartu ${w.title} melewati kolom: ${w.grid.x}+${w.grid.w}`);
  }
  // KPI kelima harus turun baris karena 4 KPI sudah mengisi satu baris.
  assert.ok(hasil[4].grid.y > hasil[0].grid.y);
});

test('halaman kosong hanya dibuat bila judulnya diminta', () => {
  assert.deepEqual(butirKeHalaman([]), []);
  assert.equal(butirKeHalaman([], { judul: 'Halaman Baru' }).length, 1);
});

test('ringkasan menyebut kartu, butir ditolak, dan butir tanpa angka', () => {
  const daftar = [
    butir({ nama: 'A', nilai: 1 }),
    butir({ nama: 'B', nilai: 2, status: 'ditolak' }),
    butir({ nama: 'C', nilai: undefined }),
  ];
  const teks = ringkasHalaman(daftar, butirKeHalaman(daftar));
  assert.match(teks, /1 kartu/);
  assert.match(teks, /1 butir ditolak/);
  assert.match(teks, /1 butir tanpa angka/);
});
