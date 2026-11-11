/**
 * USULAN PERUBAHAN HALAMAN — diuji tanpa model.
 *
 * Ini pagar terakhir sebelum chat menyentuh dashboard orang lain. Yang diuji:
 * usulan tanpa sumber ditolak, batas 9 kartu dihormati, dan usulan yang gagal
 * di tengah jalan TIDAK meninggalkan halaman setengah berubah.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData, Dashboard, HalamanDashboard, PerubahanHalaman, WidgetSpec } from '../src/types';
import {
  MAKS_WIDGET_HALAMAN,
  butirSiapPakai,
  halamanDari,
  ringkasUsulan,
  terapkanPerubahan,
  usulanMenunggu,
  validasiPerubahan,
} from '../src/services/analisis/usulan';

function widget(p: Partial<WidgetSpec> = {}): WidgetSpec {
  return {
    id: 'w-1',
    type: 'kpi',
    title: 'Pendapatan',
    confidence: 'sumber',
    grid: { x: 0, y: 0, w: 3, h: 2 },
    kpi: { value: 100 },
    citations: [
      {
        id: 'c-1',
        docName: 'Laporan 2024',
        page: 3,
        chunkSnippet: 'pendapatan ...',
        confidenceScore: 0.9,
        date: '2026-11-01',
      },
    ],
    ...p,
  };
}

function halaman(widgets: WidgetSpec[] = [widget()]): HalamanDashboard {
  return { id: 'hlm-1', judul: 'Ringkasan', widgets };
}

test('tambah kartu tanpa sumber dokumen ditolak', () => {
  const hasil = validasiPerubahan(
    [{ aksi: 'tambah', widget: widget({ id: 'w-9', citations: [] }) }],
    halaman()
  );
  assert.equal(hasil.sah, false);
  assert.match(String(hasil.galat), /sumber/i);
});

test('tambah kartu dengan sitasi diterima', () => {
  const hasil = validasiPerubahan([{ aksi: 'tambah', widget: widget({ id: 'w-9' }) }], halaman());
  assert.equal(hasil.sah, true);
  assert.equal(hasil.perubahan.length, 1);
});

test('kartu berdata kosong sengaja (dataKosong) boleh, karena jujur tidak ada angka', () => {
  const hasil = validasiPerubahan(
    [{ aksi: 'tambah', widget: widget({ id: 'w-9', citations: [], dataKosong: true, kpi: undefined }) }],
    halaman()
  );
  assert.equal(hasil.sah, true);
});

test('hapus kartu yang tidak ada di halaman ini ditolak', () => {
  const hasil = validasiPerubahan([{ aksi: 'hapus', widgetId: 'w-999' }], halaman());
  assert.equal(hasil.sah, false);
  assert.match(String(hasil.galat), /tidak ada di halaman ini/i);
});

test('aksi tak dikenal ditolak, bukan diabaikan diam-diam', () => {
  const hasil = validasiPerubahan([{ aksi: 'ganti-warna' } as any], halaman());
  assert.equal(hasil.sah, false);
  assert.match(String(hasil.galat), /tidak dikenal/i);
});

test('usulan kosong ditolak', () => {
  assert.equal(validasiPerubahan([], halaman()).sah, false);
  assert.equal(validasiPerubahan(null, halaman()).sah, false);
});

test('ubah kartu yang kehilangan sumber ditolak', () => {
  const hasil = validasiPerubahan(
    [{ aksi: 'ubah', widgetId: 'w-1', widget: widget({ citations: [] }) }],
    halaman()
  );
  assert.equal(hasil.sah, false);
});

test('angka tidak masuk akal (NaN) ditolak', () => {
  const hasil = validasiPerubahan(
    [{ aksi: 'tambah', widget: widget({ id: 'w-9', kpi: { value: Number.NaN } }) }],
    halaman()
  );
  assert.equal(hasil.sah, false);
});

test('tambah kartu saat halaman penuh ditolak dengan pesan yang jelas', () => {
  const penuh = Array.from({ length: MAKS_WIDGET_HALAMAN }, (_, i) => widget({ id: `w-${i}` }));
  const hasil = terapkanPerubahan(penuh, [{ aksi: 'tambah', widget: widget({ id: 'w-baru' }) }]);
  assert.equal(hasil.berhasil, false);
  assert.match(String(hasil.galat), /batas 9|sudah berisi/i);
  assert.equal(hasil.widgets.length, MAKS_WIDGET_HALAMAN, 'halaman tidak boleh berubah saat gagal');
});

test('ubah mempertahankan id kartu', () => {
  const hasil = terapkanPerubahan([widget()], [
    { aksi: 'ubah', widgetId: 'w-1', widget: widget({ id: 'w-lain', title: 'Pendapatan (baru)' }) },
  ]);
  assert.equal(hasil.berhasil, true);
  assert.equal(hasil.widgets[0].id, 'w-1');
  assert.equal(hasil.widgets[0].title, 'Pendapatan (baru)');
});

test('hapus mengurangi kartu', () => {
  const hasil = terapkanPerubahan([widget({ id: 'a' }), widget({ id: 'b' })], [{ aksi: 'hapus', widgetId: 'a' }]);
  assert.equal(hasil.berhasil, true);
  assert.deepEqual(
    hasil.widgets.map((w) => w.id),
    ['b']
  );
});

test('urutkan tidak menghilangkan kartu yang tidak disebut', () => {
  const hasil = terapkanPerubahan(
    [widget({ id: 'a' }), widget({ id: 'b' }), widget({ id: 'c' })],
    [{ aksi: 'urutkan', urutan: ['c', 'a'] }]
  );
  assert.equal(hasil.berhasil, true);
  assert.deepEqual(
    hasil.widgets.map((w) => w.id),
    ['c', 'a', 'b']
  );
});

test('usulan gagal di tengah jalan tidak mengubah halaman setengah jadi', () => {
  const awal = [widget({ id: 'a' })];
  const hasil = terapkanPerubahan(awal, [
    { aksi: 'hapus', widgetId: 'a' },
    { aksi: 'hapus', widgetId: 'tidak-ada' },
  ]);
  assert.equal(hasil.berhasil, false);
  assert.deepEqual(
    hasil.widgets.map((w) => w.id),
    ['a'],
    'kartu yang sudah dihapus harus kembali bila usulan gagal'
  );
});

test('ringkasan usulan memakai bahasa manusia', () => {
  const teks = ringkasUsulan([
    { aksi: 'tambah', widget: widget() },
    { aksi: 'hapus', widgetId: 'a' },
    { aksi: 'hapus', widgetId: 'b' },
  ]);
  assert.match(teks, /1 kartu ditambah/);
  assert.match(teks, /2 kartu dihapus/);
});

test('halamanDari memakai halaman aktif, dan dashboard lama dianggap satu halaman', () => {
  const dash: Dashboard = {
    id: 'd1',
    tenantId: 't1',
    title: 'D',
    description: '',
    sector: 'pdam',
    widgets: [widget({ id: 'w-lama' })],
    globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
    createdAt: '',
    updatedAt: '',
  };
  const h = halamanDari(dash);
  assert.equal(h?.id, 'hlm-1');
  assert.equal(h?.widgets[0].id, 'w-lama');
});

test('halamanDari menghormati halamanAktifId', () => {
  const dash: Dashboard = {
    id: 'd1',
    tenantId: 't1',
    title: 'D',
    description: '',
    sector: 'pdam',
    widgets: [],
    globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
    halaman: [
      { id: 'hlm-1', judul: 'A', widgets: [] },
      { id: 'hlm-2', judul: 'B', widgets: [] },
    ],
    halamanAktifId: 'hlm-2',
    createdAt: '',
    updatedAt: '',
  };
  assert.equal(halamanDari(dash)?.id, 'hlm-2');
  assert.equal(halamanDari(dash, 'hlm-1')?.id, 'hlm-1');
});

test('hanya butir disetujui yang boleh dipakai asisten', () => {
  const daftar = [
    { id: 'b1', status: 'disetujui' },
    { id: 'b2', status: 'draf' },
    { id: 'b3', status: 'ditolak' },
  ] as ButirData[];
  assert.deepEqual(
    butirSiapPakai(daftar).map((b) => b.id),
    ['b1']
  );
});

test('usulanMenunggu menyaring per halaman dan status', () => {
  const dasar = {
    tenantId: 't1',
    dashboardId: 'd1',
    halamanId: 'hlm-1',
    judulHalaman: 'A',
    ringkasan: '',
    perubahan: [] as PerubahanHalaman[],
    asal: 'chat' as const,
    dibuatOleh: 'u1',
    dibuatOlehNama: 'Admin',
    dibuatPada: '2026-11-06',
  };
  const hasil = usulanMenunggu(
    [
      { ...dasar, id: 'u1', status: 'menunggu' },
      { ...dasar, id: 'u2', status: 'diterapkan' },
      { ...dasar, id: 'u3', status: 'menunggu', halamanId: 'hlm-2' },
    ],
    'd1',
    'hlm-1'
  );
  assert.deepEqual(
    hasil.map((u) => u.id),
    ['u1']
  );
});

test('pangkasTambahan membuang kartu baru yang melewati sisa ruang', async () => {
  const { pangkasTambahan } = await import('../src/services/analisis/usulan');
  const tambah = (id: string) => ({ aksi: 'tambah', widget: { id } }) as any;
  const hasil = pangkasTambahan([tambah('a'), tambah('b'), tambah('c'), tambah('d')], 6, 9);
  assert.equal(hasil.dipangkas, 1);
  assert.deepEqual(hasil.perubahan.map((p: any) => p.widget.id), ['a', 'b', 'c']);
});

test('pangkasTambahan menghitung kartu yang dihapus sebagai ruang kosong', async () => {
  const { pangkasTambahan } = await import('../src/services/analisis/usulan');
  const hasil = pangkasTambahan(
    [{ aksi: 'hapus', widgetId: 'w-1' } as any, { aksi: 'tambah', widget: { id: 'a' } } as any],
    9,
    9
  );
  assert.equal(hasil.dipangkas, 0);
  assert.equal(hasil.perubahan.length, 2);
});
