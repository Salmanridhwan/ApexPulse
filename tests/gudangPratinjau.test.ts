import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aturBerkasGudang,
  ambilPratinjau,
  masihBerlaku,
  siapkanPratinjau,
  basiikanTenant,
} from '../src/services/templates/gudangPratinjau';

/**
 * Gudang pratinjau = tempat angka template disiapkan SEBELUM tombol ditekan.
 * Yang diuji di sini adalah janji-janji yang membuat alur baru aman:
 *  - hasil siap dipakai ulang (tidak memanggil dokumen lagi),
 *  - versi basis pengetahuan berubah → entri lama tidak dipakai (basi),
 *  - dua permintaan bersamaan tidak menumpuk pekerjaan,
 *  - kegagalan dicatat sebagai `gagal`, bukan menggantung di `proses`.
 */

const widget = (judul: string) =>
  ({ id: judul, type: 'kpi', title: judul, grid: { x: 0, y: 0, w: 3, h: 2 } }) as any;

aturBerkasGudang('');

test('hasil yang sudah siap dipakai ulang tanpa memanggil pekerja lagi', async () => {
  let panggilan = 0;
  const pekerja = async () => {
    panggilan += 1;
    return { widgets: [widget('Satu')], terisi: 1, kosong: 0, catatan: [] };
  };
  const dasar = { tenantId: 't1', templateId: 'tpl-a', kbId: 'kb-a', versiKb: 'v1', total: 1, pekerja };

  const pertama = await siapkanPratinjau(dasar);
  assert.equal(pertama.status, 'siap');
  assert.equal(pertama.terisi, 1);

  const kedua = await siapkanPratinjau(dasar);
  assert.equal(kedua.status, 'siap');
  assert.equal(panggilan, 1, 'pekerjaan tidak boleh diulang kalau sudah siap');
  assert.equal(masihBerlaku(kedua, 'v1'), true);
});

test('dokumen berubah (versi KB baru) membuat entri lama dianggap basi', async () => {
  let panggilan = 0;
  const pekerja = async () => {
    panggilan += 1;
    return { widgets: [widget('Satu')], terisi: 1, kosong: 0, catatan: [] };
  };
  const dasar = { tenantId: 't2', templateId: 'tpl-b', kbId: 'kb-b', versiKb: 'v1', total: 1, pekerja };
  const lama = await siapkanPratinjau(dasar);
  assert.equal(masihBerlaku(lama, 'v2'), false, 'versi berbeda = tidak boleh dipakai');

  const baru = await siapkanPratinjau({ ...dasar, versiKb: 'v2' });
  assert.equal(baru.status, 'siap');
  assert.equal(panggilan, 2, 'versi baru harus disiapkan ulang');
  assert.equal(masihBerlaku(baru, 'v2'), true);
});

test('dua permintaan bersamaan berbagi satu pekerjaan', async () => {
  let panggilan = 0;
  const pekerja = async () => {
    panggilan += 1;
    await new Promise((r) => setTimeout(r, 30));
    return { widgets: [widget('Satu')], terisi: 1, kosong: 0, catatan: [] };
  };
  const dasar = { tenantId: 't3', templateId: 'tpl-c', kbId: 'kb-c', versiKb: 'v1', total: 1, pekerja };
  const [a, b] = await Promise.all([siapkanPratinjau(dasar), siapkanPratinjau(dasar)]);
  assert.equal(a.status, 'siap');
  assert.equal(b.status, 'siap');
  assert.equal(panggilan, 1);
});

test('kegagalan dicatat sebagai gagal, bukan menggantung di proses', async () => {
  const pekerja = async () => {
    throw new Error('layanan dokumen mati');
  };
  const hasil = await siapkanPratinjau({
    tenantId: 't4',
    templateId: 'tpl-d',
    kbId: 'kb-d',
    versiKb: 'v1',
    total: 1,
    pekerja,
  });
  assert.equal(hasil.status, 'gagal');
  assert.match(String(hasil.galat), /layanan dokumen mati/);
  assert.equal(masihBerlaku(hasil, 'v1'), false);
});

test('basiikanTenant menandai entri satu instansi saja', async () => {
  const pekerja = async () => ({ widgets: [widget('Satu')], terisi: 1, kosong: 0, catatan: [] });
  await siapkanPratinjau({ tenantId: 't5', templateId: 'tpl-e', kbId: 'kb-e', versiKb: 'v1', total: 1, pekerja });
  await siapkanPratinjau({ tenantId: 't6', templateId: 'tpl-e', kbId: 'kb-f', versiKb: 'v1', total: 1, pekerja });

  basiikanTenant('t5');
  assert.equal(ambilPratinjau('t5', 'tpl-e', 'kb-e')?.status, 'belum');
  assert.equal(ambilPratinjau('t6', 'tpl-e', 'kb-f')?.status, 'siap');
});
