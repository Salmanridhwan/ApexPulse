/**
 * INSIGHT AI PER HALAMAN — yang diuji sisi aplikasi, bukan modelnya:
 * penyidik isi halaman (kapan insight dianggap usang), penyusun konteks yang
 * dikirim ke model (dipotong, angka pokok ikut), dan perapian jawaban model
 * (tahan ```json, butir berlebih dipotong, jawaban kosong ditolak).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { HalamanDashboard, WidgetSpec } from '../src/types';
import {
  BATAS_BUTIR,
  BATAS_KONTEKS,
  insightUsang,
  perluBuatInsight,
  rapikanJawabanInsight,
  ringkasHalamanInsight,
  sidikHalaman,
} from '../src/services/analisis/insightHalaman';

const kartu = (isi: Partial<WidgetSpec> & { id: string; title: string }): WidgetSpec =>
  ({
    type: 'kpi',
    confidence: 'tinggi',
    grid: { x: 0, y: 0, w: 3, h: 2 },
    citations: [],
    ...isi,
  }) as WidgetSpec;

const halaman = (widgets: WidgetSpec[], judul = 'Ringkasan'): HalamanDashboard => ({
  id: 'hlm-1',
  judul,
  widgets,
});

const HALAMAN_CONTOH = halaman([
  kartu({ id: 'w1', title: 'Total Pendapatan', type: 'kpi', kpi: { value: 15800000000, unit: 'Rp', delta: 8.2 } }),
  kartu({
    id: 'w2',
    title: 'Realisasi Bulanan',
    type: 'line',
    chartId: 'garis-tren',
    chart: {
      unit: 'Rp',
      xAxis: ['Jan', 'Feb', 'Mar', 'Apr'],
      series: [{ name: 'Realisasi', data: [10, 12, 9, 14] }],
    },
  }),
]);

test('sidik halaman berubah saat angka kartu berubah, tetap saat tidak berubah', () => {
  const a = sidikHalaman(HALAMAN_CONTOH);
  const b = sidikHalaman(halaman([...HALAMAN_CONTOH.widgets]));
  assert.equal(a, b, 'isi sama -> sidik sama');

  const berubah = halaman([
    { ...HALAMAN_CONTOH.widgets[0], kpi: { value: 20000000000, unit: 'Rp' } } as WidgetSpec,
    HALAMAN_CONTOH.widgets[1],
  ]);
  assert.notEqual(a, sidikHalaman(berubah), 'angka berubah -> sidik berubah');
  assert.equal(sidikHalaman(undefined), sidikHalaman(null), 'halaman kosong aman');
});

test('insight dianggap usang hanya bila isi halaman bergeser', () => {
  const sidik = sidikHalaman(HALAMAN_CONTOH);
  const denganInsight = { ...HALAMAN_CONTOH, insight: { ringkasan: 'x', temuan: [], saran: [], dibuatPada: '2026-11-16T00:00:00.000Z', sidik, asal: 'rag' as const } };
  assert.equal(insightUsang(denganInsight), false);
  assert.equal(insightUsang({ ...denganInsight, judul: 'Judul lain' }), true, 'judul berubah -> usang');
  assert.equal(insightUsang(HALAMAN_CONTOH), false, 'tanpa insight bukan usang');

  assert.equal(perluBuatInsight(HALAMAN_CONTOH), true);
  assert.equal(perluBuatInsight(denganInsight), false);
  assert.equal(perluBuatInsight(halaman([])), false, 'halaman tanpa kartu tidak perlu insight');
});

test('konteks halaman memuat angka pokok dan dipotong di batas', () => {
  const teks = ringkasHalamanInsight(HALAMAN_CONTOH);
  assert.match(teks, /Halaman "Ringkasan" berisi 2 kartu/);
  assert.match(teks, /Total Pendapatan/);
  assert.match(teks, /15,8 M/, 'nilai KPI diringkas, bukan angka mentah');
  assert.match(teks, /Seri "Realisasi": 4 titik/);
  assert.match(teks, /cenderung naik/, 'arah tren ikut supaya model tidak salah baca');

  // Halaman padat: konteks tidak boleh melebihi batas, dan sisanya disebut.
  const banyak = halaman(
    Array.from({ length: 40 }, (_, i) =>
      kartu({
        id: `w${i}`,
        title: `Indikator panjang nomor ${i} dengan nama yang sengaja dibuat panjang`,
        type: 'line',
        chartId: 'garis-tren',
        chart: {
          unit: 'Rp',
          xAxis: Array.from({ length: 36 }, (_, j) => `Kategori ${j}`),
          series: [{ name: 'Seri', data: Array.from({ length: 36 }, (_, j) => j * (i + 1)) }],
        },
      })
    )
  );
  const padat = ringkasHalamanInsight(banyak);
  assert.ok(padat.length <= BATAS_KONTEKS, `konteks ${padat.length} karakter melebihi batas ${BATAS_KONTEKS}`);
  assert.match(padat, /kartu lain di halaman ini tidak ditampilkan/);
});

test('jawaban model dirapikan: pagar markdown, butir berlebih, dan hasil kosong', () => {
  const jawaban = [
    'Baik, ini insightnya:',
    '```json',
    JSON.stringify({
      ringkasan: '  Realisasi naik tipis sementara pendapatan tertahan.  ',
      temuan: ['- Pendapatan 15,8 M', '* Piutang menumpuk', 'Realisasi naik 4 poin', 'butir keempat dibuang'],
      saran: ['Tinjau piutang > 90 hari'],
    }),
    '```',
  ].join('\n');

  const hasil = rapikanJawabanInsight(jawaban);
  assert.ok(hasil);
  assert.equal(hasil!.ringkasan, 'Realisasi naik tipis sementara pendapatan tertahan.');
  assert.equal(hasil!.temuan.length, 3, 'maksimal 3 butir temuan');
  assert.equal(hasil!.temuan[0], 'Pendapatan 15,8 M', 'penanda daftar dibuang');
  assert.equal(hasil!.saran.length, 1);
  assert.ok(hasil!.temuan.every((t) => t.length <= BATAS_BUTIR));

  assert.equal(rapikanJawabanInsight('maaf, saya tidak bisa'), null, 'bukan JSON -> ditolak');
  assert.equal(rapikanJawabanInsight({ ringkasan: '   ', temuan: [], saran: [] }), null, 'kosong -> ditolak');
  assert.equal(rapikanJawabanInsight(null), null);
});
