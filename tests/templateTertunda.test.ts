/**
 * PAGAR: KARTU TEMPLATE YANG KEHABISAN WAKTU TIDAK BOLEH DILAPORKAN SEBAGAI
 * "TIDAK ADA DI DOKUMEN".
 *
 * Kejadian nyata: 57 dari 60 kartu template ditandai kosong, padahal 48 di
 * antaranya hanya belum sempat diisi (anggaran waktu habis dengan 2 kartu
 * serentak). Pengguna melihat dashboard penuh tulisan "belum ada di dokumen".
 *
 * Tes ini mengunci tiga hal:
 * 1. kehabisan waktu menghasilkan `dataTertunda`, bukan alasan "tidak ditemukan";
 * 2. hasilnya melaporkan jumlah `tertunda` sehingga pemanggil bisa melanjutkan;
 * 3. pengisian lanjutan benar-benar mengisi kartu tertunda dan menghapus tandanya;
 * 4. entri pratinjau dengan kartu tertunda TIDAK dianggap siap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { DashboardTemplate } from '../src/services/templates/dashboardTemplates';
import type { WidgetSpec } from '../src/types';
import { isiTemplateDariRag } from '../src/services/templates/isiDariRag';
import { masihBerlaku, type EntriPratinjau } from '../src/services/templates/gudangPratinjau';

const kartu = (id: string, title: string): WidgetSpec =>
  ({
    id,
    type: 'line',
    title,
    grid: { x: 0, y: 0, w: 6, h: 3 },
  }) as WidgetSpec;

const template: DashboardTemplate = {
  id: 'tpl-uji',
  nama: 'Uji',
  judulDashboard: 'Uji',
  sector: 'pdam',
  widgets: [kartu('a', 'Pendapatan'), kartu('b', 'EBITDA')],
} as unknown as DashboardTemplate;

const data = { chart: { xAxis: ['Jan'], series: [{ name: 'Nilai', data: [10] }] } } as any;

/** RAG palsu: judul tertentu menggantung (meniru layanan yang tidak menjawab). */
const ragMenggantung = (menggantung: string[]) =>
  ({
    ambilDataWidget: async (query: string) => {
      if (menggantung.some((k) => String(query).toLowerCase().includes(k.toLowerCase()))) {
        return new Promise(() => {}) as any;
      }
      return { data };
    },
  }) as any;

test('kartu yang kehabisan waktu ditandai tertunda, bukan "tidak ditemukan"', async () => {
  const hasil = await isiTemplateDariRag(template, {
    sector: 'pdam',
    instansi: 'Uji',
    rag: ragMenggantung(['EBITDA']),
    konkurensi: 2,
    batasMs: 300,
    putaranMaks: 1,
  });

  const a = hasil.widgets.find((w) => w.id === 'a')!;
  const b = hasil.widgets.find((w) => w.id === 'b')!;

  assert.equal(a.dataKosong, false, 'kartu yang ada datanya terisi');
  assert.equal(b.dataKosong, true);
  assert.equal(b.dataTertunda, true, 'ditandai belum selesai diisi');
  assert.doesNotMatch(String(b.catatanData), /tidak ditemukan/i, 'bukan alasan "tidak ada di dokumen"');
  assert.equal(hasil.tertunda, 1, 'jumlah tertunda dilaporkan');
});

test('pengisian lanjutan mengisi kartu tertunda dan menghapus tandanya', async () => {
  const pertama = await isiTemplateDariRag(template, {
    sector: 'pdam',
    instansi: 'Uji',
    rag: ragMenggantung(['EBITDA']),
    konkurensi: 2,
    batasMs: 300,
    putaranMaks: 1,
  });
  const sisa = pertama.widgets.filter((w) => w.dataTertunda);
  assert.equal(sisa.length, 1);

  // Putaran lanjutan: kali ini layanan sudah menjawab.
  const kedua = await isiTemplateDariRag(
    { ...template, widgets: sisa } as DashboardTemplate,
    { sector: 'pdam', instansi: 'Uji', rag: ragMenggantung([]), konkurensi: 1, batasMs: 5_000, putaranMaks: 1 }
  );

  assert.equal(kedua.tertunda, 0, 'tidak ada lagi yang tertunda');
  const b = kedua.widgets.find((w) => w.id === 'b')!;
  assert.equal(b.dataKosong, false);
  assert.equal(b.dataTertunda, undefined, 'tanda tertunda dibersihkan');
});

test('entri pratinjau dengan kartu tertunda tidak dianggap siap', () => {
  const entri = {
    tenantId: 't',
    templateId: 'tpl-uji',
    kbId: 'kb',
    versiKb: 'v1',
    status: 'siap',
    widgets: [kartu('a', 'Pendapatan')],
    terisi: 1,
    kosong: 0,
    tertunda: 1,
    catatan: [],
    progres: { selesai: 1, total: 2, judul: '' },
    mulai: Date.now(),
  } as unknown as EntriPratinjau;

  assert.equal(masihBerlaku(entri, 'v1'), false, 'masih ada kartu tertunda = belum siap');
  assert.equal(masihBerlaku({ ...entri, tertunda: 0 }, 'v1'), true);
});
