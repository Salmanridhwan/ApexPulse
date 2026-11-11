/**
 * Usulan dari chat: kartu dibangun dari butir, kartu grafik tanpa deret ditolak,
 * "buatkan halaman kedua" dikenali sebagai halaman baru, dan pertanyaan tentang
 * dashboard sendiri dijawab dari metadata. Kasus diambil dari uji chat 11 November.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData, Dashboard, HalamanDashboard, WidgetSpec } from '../src/types';
import { bangunDariButir, validasiPerubahan } from '../src/services/analisis/usulan';
import { niatHalamanBaru, niatUbahHalaman } from '../src/services/analisis/niatUbahHalaman';
import { adalahPertanyaanDokumen } from '../src/services/chat/dokumen';
import { jawabMetaDashboard } from '../src/services/chat/metaDashboard';

const butirDeret: ButirData = {
  id: 'btr-sipil',
  tenantId: 't-1',
  analisisId: 'anl-1',
  berkasId: 'brk-1',
  nama: 'Realisasi SPM Sipil per Bulan',
  kategori: 'Operasional',
  bentukDisarankan: 'bar',
  seri: [{ nama: 'Realisasi', data: [10, 12, 15], kategori: ['Jan', 'Feb', 'Mar'] }],
  sitasi: { dokumen: 'Sipil SPM 2026 (1).xlsx', halaman: 0, kutipan: 'Realisasi ...' },
  keyakinan: 'tinggi',
  status: 'disetujui',
  dibuatPada: '2026-11-11T10:00:00Z',
} as ButirData;

const kosong: HalamanDashboard = { id: 'hlm-baru', judul: 'Ringkasan (lanjutan)', widgets: [] };

test('kartu "tambah" dari butir membawa deret grafiknya', () => {
  const hasil = bangunDariButir([{ aksi: 'tambah', butirId: 'btr-sipil', bentuk: 'bar', judul: 'Realisasi Sipil' }], [butirDeret], 's1') as any[];
  const w: WidgetSpec = hasil[0].widget;
  assert.ok(w.chart, 'chart wajib ada');
  assert.deepEqual(w.chart!.series[0].data, [10, 12, 15]);
  assert.equal(w.title, 'Realisasi Sipil');
  assert.ok(w.citations.length > 0);
  assert.equal(validasiPerubahan(hasil, kosong).sah, true);
});

test('kartu grafik tanpa deret ditolak (dulu tampil sebagai kartu kosong)', () => {
  const tanpaDeret = {
    aksi: 'tambah',
    widget: {
      id: 'w-x', type: 'bar', title: 'Kartu kosong', confidence: 'sumber', grid: { x: 0, y: 0, w: 6, h: 5 },
      citations: [{ id: 'c', docName: 'Sipil SPM 2026 (1).xlsx', page: 0, chunkSnippet: '', confidenceScore: 0.9, date: '' }],
    },
  };
  assert.equal(validasiPerubahan([tanpaDeret], kosong).sah, false);
});

test('permintaan halaman kedua dikenali sebagai halaman baru', () => {
  const kalimat = 'buatkan saya halaman keduanya yang masih menyambung dengan judul';
  assert.equal(niatHalamanBaru(kalimat), true);
  assert.equal(niatUbahHalaman(kalimat), true);
  assert.equal(niatHalamanBaru('tambahkan halaman lanjutan untuk keuangan'), true);
  assert.equal(niatHalamanBaru('tambahkan kartu tren pendapatan'), false);
  assert.equal(niatHalamanBaru('saya mau halaman baru'), false);
});

test('rata-rata nilai per dokumen bukan pertanyaan daftar dokumen', () => {
  assert.equal(adalahPertanyaanDokumen('berapa rata-rata nilai piutang per dokumen'), false);
  assert.equal(adalahPertanyaanDokumen('ada berapa dokumen?'), true);
});

const dash = {
  id: 'd-1',
  title: 'Dashboard YPT',
  widgets: [],
  halaman: [
    { id: 'h1', judul: 'Ringkasan', widgets: [] },
    {
      id: 'h2',
      judul: 'Piutang',
      widgets: [
        {
          id: 'w-aging', type: 'kpi', title: 'Aging 0-30 HARI', confidence: 'sumber', grid: { x: 0, y: 0, w: 3, h: 2 },
          kpi: { value: 1 },
          citations: [{ id: 'c', docName: 'Piutang 2026.xlsx', page: 0, chunkSnippet: 'Saldo Piutang 2026', confidenceScore: 0.9, date: '' }],
        },
      ],
    },
  ],
} as unknown as Dashboard;

test('jumlah dan nama halaman dijawab dari metadata dashboard', () => {
  const j = jawabMetaDashboard('ada berapa halaman dan apa namanya', dash);
  assert.ok(j && j.includes('2 halaman') && j.includes('Piutang'));
});

test('sumber data kartu dijawab dari sitasi kartu', () => {
  const j = jawabMetaDashboard('apa sumber data kartu Aging 0-30 HARI', dash);
  assert.ok(j && j.includes('Piutang 2026.xlsx'));
  assert.equal(jawabMetaDashboard('berapa total piutang?', dash), null);
});
