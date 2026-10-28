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
  tujuan: '',
  caraPenyampaian: '',
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

test('putaran kedua mengisi kartu yang gagal di putaran pertama', async () => {
  // Uji nyata: dua kartu gagal karena 429, tetapi berhasil saat diminta sendiri.
  // Putaran kedua (satu per satu) harus mengisinya, bukan membiarkan kosong.
  let n = 0;
  const sempat: RagPengambilData = {
    ambilDataWidget: async () => {
      n += 1;
      // 3 kartu x 2 percobaan = 6 panggilan gagal, lalu baru berhasil.
      if (n <= 6) throw new Error('Layanan RAG membalas 429.');
      return {
        data: {
          id: 'x',
          type: 'kpi',
          title: 'Pendapatan Usaha',
          confidence: 'sumber',
          grid: { x: 0, y: 0, w: 4, h: 3 },
          kpi: { value: 1250 },
        },
        judul: 'Pendapatan Usaha',
      };
    },
  };
  const hasil = await isiTemplateDariRag(template, {
    ...dasar,
    rag: sempat,
    batasMs: 60_000,
    konkurensi: 1,
  });
  assert.equal(hasil.terisi, 3, 'putaran kedua mengisi ketiga kartu');
  assert.equal(hasil.kosong, 0);
  assert.ok(n > 6, `kartu dicoba lagi setelah putaran pertama (panggilan: ${n})`);
});

test('kartu yang datanya memang tidak ada TIDAK diulang terus-menerus', async () => {
  // Penting: pengulangan hanya untuk kegagalan layanan. Kalau dokumen memang
  // tidak memuat indikatornya, mengulang cuma memakan waktu tanpa hasil.
  let n = 0;
  const tanpaData: RagPengambilData = {
    ambilDataWidget: async () => {
      n += 1;
      return { data: null, alasan: 'Indikator ini tidak ditemukan di dokumen instansi.' };
    },
  };
  const hasil = await isiTemplateDariRag(template, {
    ...dasar,
    rag: tanpaData,
    batasMs: 60_000,
    konkurensi: 1,
    putaranMaks: 6,
  });
  assert.equal(hasil.terisi, 0);
  assert.equal(hasil.kosong, 3);
  // Sekali dengan pertanyaan ketat + sekali dengan pertanyaan longgar per kartu,
  // lalu berhenti — bukan diulang terus-menerus sampai anggaran habis.
  assert.equal(n, 6, 'dua panggilan per kartu, lalu berhenti');
  assert.equal(hasil.kedaluwarsa, false, 'bukan kehabisan waktu — memang tidak ada');
});

test('kartu yang gagal karena layanan terus diulang sampai terisi', async () => {
  // Permintaan pengguna: "kalau datanya memang ada, tunggu sampai semua terisi".
  let n = 0;
  const sibukLaluBerhasil: RagPengambilData = {
    ambilDataWidget: async () => {
      n += 1;
      // Gagal di putaran 1 dan 2, baru berhasil di putaran 3.
      if (n <= 6) throw new Error('Layanan RAG membalas 429.');
      return {
        data: {
          id: 'x',
          type: 'kpi',
          title: 'Pendapatan Usaha',
          confidence: 'sumber',
          grid: { x: 0, y: 0, w: 4, h: 3 },
          kpi: { value: 1250 },
        },
        judul: 'Pendapatan Usaha',
      };
    },
  };
  const hasil = await isiTemplateDariRag(template, {
    ...dasar,
    rag: sibukLaluBerhasil,
    batasMs: 120_000,
    konkurensi: 1,
    putaranMaks: 6,
  });
  assert.equal(hasil.terisi, 3, 'ketiga kartu akhirnya terisi');
  assert.equal(hasil.kedaluwarsa, false);
});

test('kartu "tidak ada" dicoba sekali lagi dengan pertanyaan longgar', async () => {
  // Uji nyata: "Komposisi Biaya Operasional" dijawab "tidak ada di dokumen" pada
  // pertanyaan ketat (dengan subjudul + "kalau tidak ada katakan tidak ada"),
  // tetapi angkanya ada (beban usaha di laporan laba rugi) dan berhasil saat
  // ditanya lebih longgar.
  const dipanggil: string[] = [];
  const rewel: RagPengambilData = {
    ambilDataWidget: async (query: string) => {
      dipanggil.push(query);
      if (!query.includes('TERDEKAT')) {
        return { data: null, alasan: 'Indikator ini tidak ditemukan di dokumen instansi.' };
      }
      return {
        data: {
          id: 'x',
          type: 'kpi',
          title: 'Beban usaha',
          confidence: 'sumber',
          grid: { x: 0, y: 0, w: 4, h: 3 },
          kpi: { value: 1905640, unit: 'Rp juta' },
        },
        judul: 'Beban usaha',
      };
    },
  };
  const hasil = await isiTemplateDariRag(template, {
    ...dasar,
    rag: rewel,
    batasMs: 120_000,
    konkurensi: 1,
  });
  assert.equal(hasil.terisi, 3, 'ketiga kartu terisi lewat pertanyaan longgar');
  assert.ok(
    dipanggil.some((q) => q.includes('TERDEKAT')),
    'harus ada percobaan dengan pertanyaan longgar'
  );
});

test('kartu dicari ulang memakai ISTILAH DOKUMEN lewat kamus', async () => {
  // Uji nyata: "Komposisi Biaya Operasional" tidak pernah dijawab walau kalimat
  // pertanyaannya dilonggarkan, tetapi berhasil begitu ditanya "komposisi beban
  // usaha … laporan keuangan audited" — istilah yang dipakai dokumennya.
  const tpl = {
    ...template,
    widgets: [
      {
        id: 'w1',
        type: 'pie',
        title: 'Komposisi Biaya Operasional',
        subtitle: 'STRUKTUR BEBAN USAHA',
        confidence: 'contoh',
        grid: { x: 0, y: 0, w: 6, h: 4 },
      },
    ],
  } as unknown as DashboardTemplate;
  let n = 0;
  const kamus: RagPengambilData = {
    ambilDataWidget: async (query: string) => {
      n += 1;
      // Hanya kueri kamus yang memakai frasa ini (subjudul kartu juga memuat
      // "beban usaha", jadi pencocokan harus spesifik).
      if (!/komposisi beban usaha/i.test(query)) {
        return { data: null, alasan: 'Indikator ini tidak ditemukan di dokumen instansi.' };
      }
      return {
        data: {
          id: 'x',
          type: 'bar',
          title: 'Komposisi Beban 2024 (Laba Rugi)',
          confidence: 'sumber',
          grid: { x: 0, y: 0, w: 6, h: 4 },
          chart: {
            xAxis: ['Beban usaha', 'Beban umum dan administrasi'],
            series: [{ name: '2024', data: [1905640, 968450] }],
          },
        },
        judul: 'Komposisi Beban 2024 (Laba Rugi)',
      };
    },
  };
  const hasil = await isiTemplateDariRag(tpl, { ...dasar, rag: kamus, batasMs: 120_000, konkurensi: 1 });
  assert.equal(hasil.terisi, 1, 'kartu terisi setelah istilah dokumen dipakai');
  assert.equal(hasil.widgets[0].title, 'Komposisi Beban 2024 (Laba Rugi)', 'judul dari dokumen');
  assert.ok(n >= 3, `ditolak dulu baru berhasil (panggilan: ${n})`);
});

test('kegagalan sementara dicoba ulang, bukan langsung dikosongkan', async () => {
  // RAG sesekali membalas 429/502 sekejap. Dulu kartu langsung kosong; sekarang
  // dicoba ulang sekali supaya kanvas tidak penuh "Belum ada di dokumen".
  let n = 0;
  const sesekali: RagPengambilData = {
    ambilDataWidget: async () => {
      n += 1;
      if (n <= 3) throw new Error('layanan dokumen sedang sibuk');
      return {
        data: {
          id: 'x',
          type: 'kpi',
          title: 'Pendapatan Usaha',
          confidence: 'sumber',
          grid: { x: 0, y: 0, w: 4, h: 3 },
          kpi: { value: 1250 },
        },
        judul: 'Pendapatan Usaha',
      };
    },
  };
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag: sesekali, batasMs: 20_000 });
  assert.equal(hasil.terisi, 3, 'ketiga kartu terisi setelah percobaan ulang');
  assert.equal(n, 6, 'tiap kartu dipanggil dua kali (gagal lalu berhasil)');
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
