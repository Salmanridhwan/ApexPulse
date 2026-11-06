/**
 * JALANKAN ANALISIS — diuji dengan penyimpanan palsu dan model palsu.
 *
 * Yang dijaga: kuota diperiksa sebelum model dipanggil, dokumen instansi lain
 * tidak bocor, dan kegagalan tidak pernah dilaporkan sebagai "selesai".
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { AnalisisDokumen, ButirData } from '../src/types';
import { KUOTA_ANALISIS_BAWAAN } from '../src/services/analisis/antrean';
import {
  jalankanAnalisis,
  pemakaianHariIni,
  petakanKeluaranRag,
  type PenyimpananAnalisis,
} from '../src/services/analisis/jalankan';
import type { KonteksEkstraksi } from '../src/services/analisis/ekstrakButir';

const konteks: KonteksEkstraksi = {
  tenantId: 't-1',
  analisisId: '',
  berkasId: 'brk-1',
  judulBerkas: 'Laporan Tahunan 2024.pdf',
  instansi: 'Perumda Tirta Moedal',
};

function penyimpananPalsu(awal: { analisis?: AnalisisDokumen[]; kuota?: number } = {}) {
  const analisis: AnalisisDokumen[] = [...(awal.analisis || [])];
  const butir: ButirData[] = [];
  let urut = 0;
  const store: PenyimpananAnalisis & { analisis: AnalisisDokumen[]; butir: ButirData[] } = {
    analisis,
    butir,
    systemConfig: { kuotaAnalisisHarian: awal.kuota },
    createAnalisisDokumen(data) {
      urut += 1;
      const baru = {
        ...data,
        id: `anl-${urut}`,
        dibuatPada: new Date().toISOString(),
        jumlahButir: data.jumlahButir ?? 0,
        kategoriTerdeteksi: data.kategoriTerdeteksi ?? [],
      } as AnalisisDokumen;
      analisis.push(baru);
      return baru;
    },
    updateAnalisisDokumen(id, tenantId, partial) {
      const i = analisis.findIndex((a) => a.id === id && a.tenantId === tenantId);
      if (i === -1) return undefined;
      analisis[i] = { ...analisis[i], ...partial };
      return analisis[i];
    },
    simpanButirData(daftar) {
      butir.push(...daftar);
      return daftar;
    },
    getAnalisisDokumen(tenantId, filter) {
      return analisis.filter(
        (a) =>
          a.tenantId === tenantId &&
          (!filter?.permintaanId || a.permintaanId === filter.permintaanId) &&
          (!filter?.status || a.status === filter.status) &&
          (!filter?.berkasId || a.berkasId === filter.berkasId)
      );
    },
    hapusButirAnalisis(analisisId, tenantId) {
      const sebelum = butir.length;
      for (let i = butir.length - 1; i >= 0; i -= 1) {
        if (butir[i].analisisId === analisisId && butir[i].tenantId === tenantId) butir.splice(i, 1);
      }
      return sebelum - butir.length;
    },
  };
  return store;
}

const keluaranSah = {
  ringkasan: 'Laporan memuat realisasi pendapatan dan beban.',
  butir: [
    {
      nama: 'Pendapatan Usaha 2024',
      nilai: '1.234.567',
      satuan: 'juta rupiah',
      sitasi: { dokumen: 'Laporan Tahunan 2024', halaman: 12, kutipan: 'Pendapatan usaha ...' },
      keyakinan: 'tinggi',
    },
  ],
};

test('pemakaian hari ini hanya menghitung analisis RAG hari ini', () => {
  const sekarang = new Date('2026-11-06T10:00:00').getTime();
  const hariIni = new Date('2026-11-06T01:00:00').toISOString();
  const kemarin = new Date('2026-11-05T23:00:00').toISOString();
  const jumlah = pemakaianHariIni(
    [
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'selesai' },
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'tertunda-kuota' },
      { metode: 'rag-extract', dibuatPada: kemarin, status: 'selesai' },
      { metode: 'tabel-lokal', dibuatPada: hariIni, status: 'selesai' },
    ],
    sekarang
  );
  assert.equal(jumlah, 1, 'yang tertunda kuota, kemarin, dan tabel lokal tidak dihitung');
});

test('analisis yang gagal tidak menghabiskan kuota instansi', () => {
  const sekarang = new Date('2026-11-06T10:00:00').getTime();
  const hariIni = new Date('2026-11-06T01:00:00').toISOString();
  const jumlah = pemakaianHariIni(
    [
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'gagal' },
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'gagal' },
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'selesai' },
      { metode: 'rag-extract', dibuatPada: hariIni, status: 'proses' },
    ],
    sekarang
  );
  assert.equal(jumlah, 2, 'hanya yang selesai dan yang sedang berjalan dihitung');
});

test('keluaran RAG dipetakan dari kpi/grafik/tabel, bukan hanya butir', () => {
  const hasil = petakanKeluaranRag(
    {
      kpi: [{ label: 'Pendapatan', nilai: '100', docName: 'Laporan Tahunan 2024', page: 3 }],
      grafik: [
        {
          title: 'Tren pendapatan',
          series: [{ name: 'Pendapatan', data: [1, 2, 3], categories: ['2022', '2023', '2024'] }],
          data: [{ docName: 'Laporan Tahunan 2024', page: 4 }],
        },
      ],
      tabel: { title: 'Rincian', headers: ['A', 'B'], rows: [[1, 2]], docName: 'Laporan Tahunan 2024' },
    },
    'Laporan Tahunan 2024.pdf'
  );
  assert.equal(hasil.length, 3);
  assert.equal((hasil[0] as any).nilai, '100');
});

test('butir dari dokumen lain dibuang, bukan dicampur', () => {
  const hasil = petakanKeluaranRag(
    {
      kpi: [
        { label: 'Pendapatan', nilai: '100', docName: 'Laporan Bank BJB 2024' },
        { label: 'Pendapatan', nilai: '200', docName: 'Laporan Tahunan 2024' },
      ],
    },
    'Laporan Tahunan 2024.pdf'
  );
  assert.equal(hasil.length, 1);
  assert.equal((hasil[0] as any).nilai, '200');
});

test('analisis berhasil menyimpan butir dan merekomendasikan template', async () => {
  const store = penyimpananPalsu();
  const hasil = await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async () => keluaranSah,
  });
  assert.equal(hasil.analisis.status, 'selesai');
  assert.equal(hasil.butir.length, 1);
  assert.equal(hasil.rekomendasi.length, 2);
  assert.equal(hasil.analisis.jumlahButir, 1);
  assert.deepEqual(hasil.analisis.kategoriTerdeteksi, ['Keuangan']);
  assert.ok(hasil.analisis.selesaiPada);
  assert.equal(hasil.sisaKuota, KUOTA_ANALISIS_BAWAAN - 1);
});

test('kuota habis: dokumen diterima tetapi tertunda, model tidak dipanggil', async () => {
  let dipanggil = 0;
  const store = penyimpananPalsu({ kuota: 1 });
  const pertama = await jalankanAnalisis({ penyimpanan: store, konteks, ekstraktor: async () => (dipanggil += 1, keluaranSah) });
  assert.equal(pertama.analisis.status, 'selesai');

  const kedua = await jalankanAnalisis({
    penyimpanan: store,
    konteks: { ...konteks, berkasId: 'brk-2' },
    ekstraktor: async () => (dipanggil += 1, keluaranSah),
  });
  assert.equal(kedua.analisis.status, 'tertunda-kuota');
  assert.equal(kedua.butir.length, 0);
  assert.equal(dipanggil, 1, 'model tidak boleh dipanggil saat kuota habis');
  assert.match(String(kedua.analisis.galat), /kuota/i);
});

test('abaikanKuota memaksa analisis jalan untuk mengulang yang tertunda', async () => {
  const store = penyimpananPalsu({ kuota: 1 });
  await jalankanAnalisis({ penyimpanan: store, konteks, ekstraktor: async () => keluaranSah });
  const ulang = await jalankanAnalisis({
    penyimpanan: store,
    konteks: { ...konteks, berkasId: 'brk-2' },
    ekstraktor: async () => keluaranSah,
    abaikanKuota: true,
  });
  assert.equal(ulang.analisis.status, 'selesai');
});

test('model melempar galat: status gagal, pesannya disimpan', async () => {
  const store = penyimpananPalsu();
  const hasil = await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async () => {
      throw new Error('RAG menolak: 429 terlalu banyak permintaan');
    },
  });
  assert.equal(hasil.analisis.status, 'gagal');
  assert.match(String(hasil.analisis.galat), /429/);
  assert.equal(hasil.butir.length, 0);
});

test('nol butir tanpa ringkasan dianggap gagal, bukan selesai', async () => {
  const store = penyimpananPalsu();
  const hasil = await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async () => ({ butir: [] }),
  });
  assert.equal(hasil.analisis.status, 'gagal');
  assert.match(String(hasil.analisis.galat), /tidak memuat angka/i);
});

test('nol butir tetapi ada ringkasan tetap selesai', async () => {
  const store = penyimpananPalsu();
  const hasil = await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async () => ({ ringkasan: 'Dokumen ini hanya memuat narasi kebijakan.', butir: [] }),
  });
  assert.equal(hasil.analisis.status, 'selesai');
  assert.equal(hasil.butir.length, 0);
  assert.equal(hasil.rekomendasi.length, 2, 'template tetap disarankan walau tanpa butir');
});

test('analisis ulang membersihkan butir lama', async () => {
  const store = penyimpananPalsu();
  await jalankanAnalisis({ penyimpanan: store, konteks, ekstraktor: async () => keluaranSah });
  assert.equal(store.butir.length, 1);
  const ulang = await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async () => ({ butir: [{ nama: 'Beban Operasional', nilai: 500, sitasi: { dokumen: 'Laporan Tahunan 2024' } }] }),
  });
  assert.equal(store.butir.length, 1, 'butir lama tidak boleh menumpuk');
  assert.equal(store.butir[0].nama, 'Beban Operasional');
  assert.notEqual(ulang.analisis.id, store.analisis[0].id);
});

test('ekstraktor menerima prompt yang menyebut dokumennya', async () => {
  const store = penyimpananPalsu();
  let prompt = '';
  await jalankanAnalisis({
    penyimpanan: store,
    konteks,
    ekstraktor: async (arg) => {
      prompt = arg.prompt;
      return keluaranSah;
    },
  });
  assert.match(prompt, /Laporan Tahunan 2024\.pdf/);
});
