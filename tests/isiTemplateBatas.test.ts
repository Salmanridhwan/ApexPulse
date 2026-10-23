import test from 'node:test';
import assert from 'node:assert/strict';
import { isiTemplateDariRag, type RagPengambilData } from '../src/services/templates/isiDariRag';
import type { DashboardTemplate } from '../src/services/templates/dashboardTemplates';

/**
 * Keluhan produksi: tombol "Pakai Template Ini" berakhir "Failed to fetch".
 * Penyebabnya permintaan menunggu seluruh kartu selesai (tiap kartu bisa 30-60
 * detik pada dokumen ribuan halaman), sehingga proxy memutus koneksi lebih dulu.
 */
const template = {
  id: 'tpl-uji',
  nama: 'Uji',
  sektor: 'bank',
  deskripsi: '',
  fokus: [],
  aksen: '#123456',
  judulDashboard: 'Dashboard Uji',
  deskripsiDashboard: '',
  widgets: [
    { id: 'w1', type: 'kpi', title: 'Indikator A', confidence: 'contoh', grid: { x: 0, y: 0, w: 4, h: 3 } },
    { id: 'w2', type: 'kpi', title: 'Indikator B', confidence: 'contoh', grid: { x: 4, y: 0, w: 4, h: 3 } },
    { id: 'w3', type: 'kpi', title: 'Indikator C', confidence: 'contoh', grid: { x: 8, y: 0, w: 4, h: 3 } },
  ],
} as unknown as DashboardTemplate;

const dasar = { sector: 'bank' as const, instansi: 'Bank Uji', kbId: 'kb_uji' };

test('dokumen yang menggantung tidak menahan permintaan sampai proxy memutus', async () => {
  const menggantung: RagPengambilData = {
    ambilDataWidget: () => new Promise(() => {}),
  };
  const mulai = Date.now();
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag: menggantung, batasMs: 120 });
  const durasi = Date.now() - mulai;

  assert.ok(durasi < 2000, `harus berhenti di sekitar batas waktu, bukan menggantung (${durasi} ms)`);
  assert.equal(hasil.kedaluwarsa, true, 'penanda kehabisan waktu menyala');
  assert.equal(hasil.terisi, 0);
  assert.equal(hasil.kosong, 3);
  assert.ok(hasil.widgets.every((w) => w.dataKosong === true), 'semua kartu ditandai kosong');
  assert.ok(
    hasil.widgets.every((w) => /waktu pengambilan angka habis/i.test(w.catatanData || '')),
    'tiap kartu menjelaskan alasannya sendiri'
  );
});

test('kartu yang angkanya ada di dokumen tetap terisi', async () => {
  const cepat: RagPengambilData = {
    ambilDataWidget: async () => ({
      data: {
        id: 'x',
        type: 'kpi',
        title: 'Pendapatan Usaha',
        confidence: 'sumber',
        grid: { x: 0, y: 0, w: 4, h: 3 },
        kpi: { value: 1250 },
      },
      judul: 'Pendapatan Usaha',
    }),
  };
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag: cepat, batasMs: 5000 });
  assert.equal(hasil.kedaluwarsa, false);
  assert.equal(hasil.terisi, 3);
  assert.equal(hasil.kosong, 0);
});

test('kegagalan satu kartu tidak membatalkan kartu lain', async () => {
  let n = 0;
  const sebagian: RagPengambilData = {
    ambilDataWidget: async () => {
      n += 1;
      if (n === 1) throw new Error('layanan dokumen sedang sibuk');
      return { data: null, alasan: 'Indikator ini tidak ada di dokumen.' };
    },
  };
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag: sebagian, batasMs: 5000 });
  assert.equal(hasil.terisi, 0);
  assert.equal(hasil.kosong, 3);
  assert.ok(hasil.catatan.some((c) => /sibuk/i.test(c)), 'alasan kegagalan dicatat');
});
