import { test } from 'node:test';
import assert from 'node:assert/strict';
import { putusanJawaban, pesanTanpaSumber } from '../src/services/chat/jawaban';

test('jawaban dengan sitasi ditampilkan', () => {
  const p = putusanJawaban({ citationsCount: 3, jumlahPotongan: 3, sapaan: false });
  assert.equal(p.tampilkan, true);
  assert.equal(p.alasan, 'bersumber');
});

test('jawaban tanpa sitasi tapi ada potongan dokumen tetap ditampilkan', () => {
  const p = putusanJawaban({ citationsCount: 0, jumlahPotongan: 2, sapaan: false });
  assert.equal(p.tampilkan, true);
});

test('jawaban tanpa sitasi dan tanpa potongan TIDAK ditampilkan', () => {
  const p = putusanJawaban({ citationsCount: 0, jumlahPotongan: 0, sapaan: false });
  assert.equal(p.tampilkan, false);
  assert.equal(p.alasan, 'tanpa-sumber');
  assert.ok(p.pesan && p.pesan.length > 40);
});

test('layanan menyatakan grounded=false → jawaban tidak ditampilkan', () => {
  const p = putusanJawaban({ citationsCount: 2, jumlahPotongan: 2, grounded: false, sapaan: false });
  assert.equal(p.tampilkan, false);
  assert.equal(p.alasan, 'tanpa-sumber');
});

test('grounded=true tanpa sitasi tetap dianggap tanpa sumber (tidak ada rujukan)', () => {
  const p = putusanJawaban({ citationsCount: 0, jumlahPotongan: 0, grounded: true, sapaan: false });
  assert.equal(p.tampilkan, false);
});

test('sapaan boleh dijawab tanpa rujukan', () => {
  const p = putusanJawaban({ citationsCount: 0, jumlahPotongan: 0, sapaan: true });
  assert.equal(p.tampilkan, true);
  assert.equal(p.alasan, 'sapaan');
});

test('grounded undefined (layanan tidak melaporkan) tidak memblokir jawaban bersumber', () => {
  const p = putusanJawaban({ citationsCount: 1, jumlahPotongan: 1, grounded: undefined, sapaan: false });
  assert.equal(p.tampilkan, true);
});

test('pesan tanpa sumber menyebut instansi bila diberikan', () => {
  const pesan = pesanTanpaSumber('Perumda Air Minum Jaya');
  assert.ok(pesan.includes('Perumda Air Minum Jaya'));
  assert.ok(pesan.includes('tidak menampilkan jawaban tanpa rujukan'));
  assert.ok(pesanTanpaSumber().includes('dokumen resmi'));
});
