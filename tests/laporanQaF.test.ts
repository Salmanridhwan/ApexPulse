import { test } from 'node:test';
import assert from 'node:assert/strict';

import { periodeWidget, satuanUntukButir } from '../src/services/builder/halamanDiminta';
import { susunDashboardBerhalaman, tanpaElipsis } from '../src/services/builder/susunHalaman';
import { nilaiRingkas } from '../src/services/dashboard/nilaiRingkas';
import { payloadKeWidgetSpec, potongJudul } from '../src/services/rag/http';

test('F-01: kata "operasional" tidak lagi terbaca "rasio" (kelas satuan benar)', () => {
  for (const b of ['beban operasional', 'biaya operasional', 'pendapatan operasional', 'arus kas operasional', 'belanja operasional', 'ongkos operasional']) {
    assert.deepEqual(satuanUntukButir(b), ['uang'], b);
  }
  assert.notDeepEqual(satuanUntukButir('jumlah operasional harian'), ['persen']);
  assert.deepEqual(satuanUntukButir('jam operasional harian'), ['waktu', 'persen']);
  // Kontrol yang memang persen tetap persen.
  assert.deepEqual(satuanUntukButir('rasio lancar'), ['persen']);
  assert.deepEqual(satuanUntukButir('tingkat pelayanan'), ['persen']);
  assert.deepEqual(satuanUntukButir('beban pokok'), ['uang']);
});

test('F-05: nilai rekap ekspor terformat id-ID dengan satuan dan kategori', () => {
  assert.equal(nilaiRingkas({ type: 'kpi', kpi: { value: 3184.72, unit: 'Rp miliar' } } as any), '3.184,72 Rp miliar');
  const hbar = { type: 'hbar', chart: { xAxis: ['Utara', 'Timur'], unit: 'sambungan', series: [{ name: 'Pelanggan', data: [150000, 161380] }] } } as any;
  assert.equal(nilaiRingkas(hbar), 'Timur: 161.380 sambungan (titik terakhir)');
  assert.equal(nilaiRingkas({ type: 'table' } as any), 'Tabel');
});

test('F-06/F-07: judul dan periode tidak menyimpan elipsis; periode seragam', () => {
  assert.equal(potongJudul('Sampel memenuhi baku mutu (Kualitas Air) yang sangat panjang sekali', 40), 'Sampel memenuhi baku mutu (Kualitas Air)');
  assert.equal(potongJudul('Sampel memenuhi baku mutu (Kualitas Air)…', 60), 'Sampel memenuhi baku mutu (Kualitas Air)');
  assert.equal(tanpaElipsis('Januari–Okt…'), 'Januari–Okt');
  assert.equal(periodeWidget({ title: 'Beban operasional', periode: 'Januari sampai Oktober 2026' } as any), 's.d. Okt 2026');

  const ws = payloadKeWidgetSpec(
    {
      dashboardTitle: 'x',
      kpi: [{ label: 'Pendapatan usaha', nilai: '3184,72', satuan: 'Rp miliar', periode: 'Januari–Desember 2024', docName: 'd', chunkSnippet: 'x' }],
    },
    'pdam'
  ) as any[];
  const kpi = ws.find((w) => w.type === 'kpi');
  assert.equal(kpi.periode, '2024');

  const hasil = susunDashboardBerhalaman([{ ...kpi, title: 'Sampel memenuhi baku mutu…', periode: 'Januari…' }]);
  const w = hasil.halaman[0].widgets[0] as any;
  assert.equal(w.title, 'Sampel memenuhi baku mutu');
  assert.ok(!String(w.periode).includes('…'));
});
