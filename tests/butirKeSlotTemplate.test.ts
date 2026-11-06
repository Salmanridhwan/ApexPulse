/**
 * UJI PENGISIAN SLOT TEMPLATE DARI BUTIR.
 *
 * Yang dijaga: tidak ada satu pun angka ilustrasi template yang lolos ke halaman.
 * Slot yang tidak ada butirnya harus kosong dan beralasan, bukan diisi nol atau
 * angka contoh — dashboard pimpinan dengan angka karangan lebih berbahaya
 * daripada dashboard dengan kartu kosong yang jujur.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData } from '../src/types';
import type { DashboardTemplate } from '../src/services/templates/dashboardTemplates';
import {
  isiSlotTemplate,
  slotKosong,
  widgetTerisi,
} from '../src/services/analisis/butirKeSlotTemplate';
import { MAKS_WIDGET_PER_HALAMAN } from '../src/services/analisis/butirKeWidget';

let urut = 0;

function butir(p: Partial<ButirData> & { nama: string }): ButirData {
  urut += 1;
  return {
    id: p.id ?? `b${urut}`,
    tenantId: 'tenant-uji',
    analisisId: 'an1',
    berkasId: 'berkas1',
    nama: p.nama,
    kategori: p.kategori ?? 'Keuangan',
    periode: p.periode ?? '2026',
    satuan: p.satuan,
    nilai: p.nilai,
    seri: p.seri,
    tabel: p.tabel,
    bentukDisarankan: p.bentukDisarankan ?? 'kpi',
    sitasi: p.sitasi ?? { dokumen: 'Laporan Keuangan 2026.pdf', halaman: 12, kutipan: '...' },
    keyakinan: p.keyakinan ?? 'tinggi',
    status: p.status ?? 'disetujui',
    dibuatPada: '2026-11-06T08:00:00.000Z',
  };
}

function tpl(widgets: Array<{ id: string; type: string; title: string; grid?: any }>): DashboardTemplate {
  return {
    id: 'tpl-uji',
    nama: 'Uji',
    tujuan: '',
    caraPenyampaian: '',
    deskripsi: '',
    fokus: [],
    aksen: '#000',
    tema: 'oranye',
    judulDashboard: 'Uji',
    widgets: widgets.map((w, i) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      grid: w.grid ?? { x: (i % 4) * 3, y: Math.floor(i / 4) * 2, w: 3, h: 2 },
    })),
  } as unknown as DashboardTemplate;
}

const BUTIR_KPI = butir({ nama: 'Total Aset', nilai: 1234, satuan: 'miliar Rp', bentukDisarankan: 'kpi' });
const BUTIR_DERET = butir({
  nama: 'Pendapatan per Bulan',
  seri: [{ nama: 'Pendapatan', data: [10, 12, 15], kategori: ['Jan', 'Feb', 'Mar'] }],
  satuan: 'miliar Rp',
  bentukDisarankan: 'bar',
});
const BUTIR_TABEL = butir({
  nama: 'Rincian Biaya',
  tabel: { kolom: ['Pos', 'Nilai'], baris: [['Gaji', 100], ['Listrik', 20]] },
  bentukDisarankan: 'table',
});

test('slot KPI diisi butir angka tunggal', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'kpi', title: 'KPI' }]), [BUTIR_KPI]);
  assert.equal(hasil.terisi, 1);
  assert.equal(hasil.slots[0].widget?.kpi?.value, 1234);
  assert.equal(hasil.slots[0].butirId, BUTIR_KPI.id);
});

test('slot grafik diisi butir deret', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'bar', title: 'Grafik' }]), [BUTIR_DERET]);
  assert.equal(hasil.terisi, 1);
  assert.equal(hasil.slots[0].widget?.chart?.series[0].data.length, 3);
});

test('slot tabel diisi butir tabel', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'table', title: 'Tabel' }]), [BUTIR_TABEL]);
  assert.equal(hasil.terisi, 1);
  assert.equal(hasil.slots[0].widget?.table?.rows.length, 2);
});

test('slot tanpa butir yang cocok dibiarkan kosong dan beralasan', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'bar', title: 'Grafik' }]), [BUTIR_KPI]);
  assert.equal(hasil.terisi, 0);
  assert.equal(hasil.kosong, 1);
  assert.equal(hasil.slots[0].widget, null);
  assert.match(String(hasil.slots[0].alasanKosong), /deret|belum ada/i);
});

test('tidak ada angka contoh yang lolos ke kartu kosong', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'kpi', title: 'KPI' }]), []);
  assert.deepEqual(widgetTerisi(hasil), []);
  assert.equal(hasil.slots[0].widget, null);
});

test('butir berstatus draf atau ditolak tidak dipakai', () => {
  const draf = butir({ nama: 'Draf', nilai: 5, status: 'draf' });
  const ditolak = butir({ nama: 'Ditolak', nilai: 6, status: 'ditolak' });
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'kpi', title: 'KPI' }]), [draf, ditolak]);
  assert.equal(hasil.terisi, 0);
});

test('satu butir tidak dipakai dua slot', () => {
  const hasil = isiSlotTemplate(
    tpl([
      { id: 's1', type: 'kpi', title: 'KPI 1' },
      { id: 's2', type: 'kpi', title: 'KPI 2' },
    ]),
    [BUTIR_KPI]
  );
  assert.equal(hasil.terisi, 1);
  assert.equal(hasil.kosong, 1);
  assert.equal(hasil.slots.filter((s) => s.butirId === BUTIR_KPI.id).length, 1);
});

test('posisi dan ukuran grid mengikuti template, bukan butir', () => {
  const grid = { x: 8, y: 4, w: 4, h: 3 };
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'kpi', title: 'KPI', grid }]), [BUTIR_KPI]);
  assert.deepEqual(hasil.slots[0].grid, grid);
  assert.deepEqual(hasil.slots[0].widget?.grid, grid);
});

test('id kartu memakai id slot template supaya kanvas stabil', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 'slot-kpi-1', type: 'kpi', title: 'KPI' }]), [BUTIR_KPI]);
  assert.equal(hasil.slots[0].widget?.id, 'slot-kpi-1');
});

test('kartu narasi tidak diisi otomatis dari angka', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'narasi', title: 'Insight' }]), [BUTIR_KPI]);
  assert.equal(hasil.terisi, 0);
  assert.match(String(hasil.slots[0].alasanKosong), /narasi|admin/i);
});

test('batas sembilan kartu per halaman dipatuhi', () => {
  const banyak = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, type: 'kpi', title: `KPI ${i}` }));
  const butirBanyak = Array.from({ length: 12 }, (_, i) => butir({ nama: `Angka ${i}`, nilai: i + 1 }));
  const hasil = isiSlotTemplate(tpl(banyak), butirBanyak);
  assert.equal(hasil.slots.length, MAKS_WIDGET_PER_HALAMAN);
  assert.equal(hasil.terisi, MAKS_WIDGET_PER_HALAMAN);
  assert.equal(hasil.butirTakTerpakai, 3);
});

test('catatan menyebut jumlah terisi dan yang tidak kebagian slot', () => {
  const hasil = isiSlotTemplate(tpl([{ id: 's1', type: 'kpi', title: 'KPI' }]), [BUTIR_KPI, BUTIR_KPI]);
  assert.match(hasil.catatan, /1 dari 1/);
  assert.match(hasil.catatan, /tidak kebagian slot/);
});

test('daftar slot kosong bisa dibaca admin', () => {
  const hasil = isiSlotTemplate(
    tpl([
      { id: 's1', type: 'kpi', title: 'Total Aset' },
      { id: 's2', type: 'bar', title: 'Tren' },
    ]),
    [BUTIR_KPI]
  );
  const kosong = slotKosong(hasil);
  assert.equal(kosong.length, 1);
  assert.equal(kosong[0].judulSlot, 'Tren');
  assert.ok(kosong[0].alasan.length > 5);
});

test('template tanpa kartu menghasilkan halaman kosong yang jujur', () => {
  const hasil = isiSlotTemplate(tpl([]), [BUTIR_KPI]);
  assert.equal(hasil.slots.length, 0);
  assert.equal(hasil.terisi, 0);
  assert.equal(hasil.butirTakTerpakai, 1);
});

test('hasil stabil: masukan sama, keluaran sama', () => {
  const t = tpl([{ id: 's1', type: 'bar', title: 'Grafik' }]);
  const a = isiSlotTemplate(t, [BUTIR_DERET]);
  const b = isiSlotTemplate(t, [BUTIR_DERET]);
  assert.deepEqual(a.slots.map((s) => s.butirId), b.slots.map((s) => s.butirId));
});
