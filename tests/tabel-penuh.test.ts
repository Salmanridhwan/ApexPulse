import test from 'node:test';
import assert from 'node:assert/strict';
import { payloadKeWidgetSpec } from '../src/services/rag/http';

// Tabel dari dokumen (mis. rincian 12 bulan) tidak boleh dipotong lagi.
// Versi lama membatasi 4 kolom × 5 baris sehingga dashboard hanya menampilkan
// Januari–Mei dan pengguna menilai "dokumennya terpotong".
const bulan = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function payloadTabel(baris: number, kolom: number) {
  return {
    kpi: [],
    grafik: [],
    tabel: {
      judul: 'Kinerja Bulanan 2024',
      kolom: Array.from({ length: kolom }, (_, i) => (i === 0 ? 'Bulan' : `Kolom ${i}`)),
      baris: Array.from({ length: baris }, (_, i) => [
        bulan[i] ?? `Baris ${i}`,
        ...Array.from({ length: kolom - 1 }, (_, j) => String((i + 1) * (j + 2))),
      ]),
      docName: 'Laporan-Tahunan-PAM-JAYA-2024.pdf',
      page: 3,
    },
    narasi: '',
    dashboardTitle: 'Uji Tabel',
  };
}

test('tabel 12 bulan tidak terpotong', () => {
  const widgets = payloadKeWidgetSpec(payloadTabel(12, 4), 'air');
  const tabel = widgets.find((w: any) => w.type === 'table');
  assert.ok(tabel, 'widget tabel harus ada');
  assert.equal(tabel.table.rows.length, 12, '12 baris bulan harus utuh');
  assert.equal(tabel.table.columns.length, 4);
  assert.equal(tabel.table.rows[11].k0, 'Desember');
});

test('tabel 7 kolom tetap utuh sampai 8 kolom', () => {
  const widgets = payloadKeWidgetSpec(payloadTabel(6, 7), 'air');
  const tabel = widgets.find((w: any) => w.type === 'table');
  assert.ok(tabel);
  assert.equal(tabel.table.columns.length, 7, 'tujuh kolom tidak boleh dipangkas jadi 4');
  assert.equal(tabel.table.rows.length, 6);
});

test('tabel sangat panjang tetap dibatasi 14 baris', () => {
  const widgets = payloadKeWidgetSpec(payloadTabel(40, 3), 'air');
  const tabel = widgets.find((w: any) => w.type === 'table');
  assert.ok(tabel);
  assert.equal(tabel.table.rows.length, 14, 'batas aman 14 baris');
});
