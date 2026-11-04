import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dokumenDariPermintaan, namaTanpaEkstensi } from '../src/services/builder/dokumenDiminta';
import { cocokDokumen } from '../src/services/rag/http';

const KB = [
  'Sipil SPM 2026 (1).xlsx',
  'Tim Pengadaan 2026.xlsx',
  'Anggaran 2026 FIX.xlsx',
  'MARKETING ALL AREA.xlsx',
  'Piutang 2026.xlsx',
  'pam-jaya-keuangan-okt-2026.md',
  'pam-jaya-okt-2026.md',
  'Laporan-Tahunan-PAM-JAYA-2024.pdf',
  'Laporan-Keuangan-Audited-PAM-JAYA-2024.pdf',
];

test('dokumen yang disebut pengguna dikenali dari nama berkasnya', () => {
  assert.equal(dokumenDariPermintaan('saya mau kamu buatkan dashboard dari dokumen Piutang 2026', KB), 'Piutang 2026.xlsx');
  assert.equal(dokumenDariPermintaan('kamu buatkan dashboard dari file piutang', KB), 'Piutang 2026.xlsx');
  assert.equal(dokumenDariPermintaan('dashboard dari file marketing', KB), 'MARKETING ALL AREA.xlsx');
  assert.equal(dokumenDariPermintaan('buat dashboard dari berkas tim pengadaan', KB), 'Tim Pengadaan 2026.xlsx');
  assert.equal(dokumenDariPermintaan('dashboard laporan tahunan', KB), 'Laporan-Tahunan-PAM-JAYA-2024.pdf');
});

test('kalimat umum tidak dianggap meminta satu dokumen', () => {
  assert.equal(dokumenDariPermintaan('buatkan dashboard PDAM', KB), undefined);
  assert.equal(dokumenDariPermintaan('buatkan dashboard keuangan', KB), undefined);
  assert.equal(dokumenDariPermintaan('dashboard dari dokumen PAM JAYA 2026', KB), undefined);
});

test('sitasi dicocokkan ke dokumen target tanpa peduli ekstensi', () => {
  assert.ok(cocokDokumen('Piutang 2026.xlsx', 'Piutang 2026.xlsx'));
  assert.ok(cocokDokumen('piutang_2026', 'Piutang 2026.xlsx'));
  assert.ok(!cocokDokumen('Laporan-Tahunan-PAM-JAYA-2024.pdf', 'Piutang 2026.xlsx'));
  assert.ok(!cocokDokumen('', 'Piutang 2026.xlsx'));
  assert.equal(namaTanpaEkstensi('Piutang 2026.xlsx'), 'Piutang 2026');
});
