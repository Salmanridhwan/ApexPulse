import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adalahPermintaanSaran,
  indikatorDariPrompt,
  susunSaranChart,
  widgetPratinjauSaran,
} from '../src/services/chat/saranChart';

test('permintaan rekomendasi tampilan dikenali', () => {
  assert.equal(adalahPermintaanSaran('rekomendasikan chart yang bisa digunakan'), true);
  assert.equal(adalahPermintaanSaran('chart apa yang cocok untuk pendapatan air?'), true);
  assert.equal(adalahPermintaanSaran('kasih saran visualisasi dong'), true);
  assert.equal(adalahPermintaanSaran('grafik mana yang paling tepat untuk NRW'), true);
});

test('permintaan lain tidak dibajak jadi saran', () => {
  assert.equal(adalahPermintaanSaran('tambahkan widget jumlah pelanggan'), false);
  assert.equal(adalahPermintaanSaran('buatkan dashboard kinerja'), false);
  assert.equal(adalahPermintaanSaran('apa itu dashboard?'), false);
  assert.equal(adalahPermintaanSaran(''), false);
  assert.equal(adalahPermintaanSaran(undefined), false);
});

test('indikator diambil dari kalimat pengguna', () => {
  assert.equal(indikatorDariPrompt('rekomendasikan chart untuk pendapatan air'), 'pendapatan air');
  assert.equal(indikatorDariPrompt('chart apa yang cocok untuk NRW?'), 'NRW');
  assert.equal(indikatorDariPrompt('saran grafik tentang jumlah pelanggan aktif'), 'jumlah pelanggan aktif');
  assert.equal(indikatorDariPrompt('rekomendasikan chart'), '', 'tanpa topik → kosong');
});

test('lima pilihan tampilan dengan alasan yang bisa dipahami', () => {
  const saran = susunSaranChart('pendapatan air');
  assert.equal(saran.length, 5);
  const tipe = saran.map((s) => s.tipe);
  assert.deepEqual(tipe, ['bar', 'line', 'donut', 'kpi', 'table']);
  for (const s of saran) {
    assert.ok(s.judul.includes('pendapatan air'), `judul memuat indikator: ${s.judul}`);
    assert.ok(s.alasan.length > 15, 'alasan cukup menjelaskan');
    assert.ok(s.kapan.length > 15, 'kapan dipakai dijelaskan');
    assert.equal(s.indikator, 'pendapatan air');
    assert.ok(!/\brag\b/i.test(s.alasan + s.kapan + s.judul), 'tanpa istilah teknis');
  }
});

test('tanpa indikator tetap memakai sebutan yang masuk akal', () => {
  const saran = susunSaranChart('');
  assert.match(saran[0].judul, /indikator utama instansi/);
  assert.equal(saran[0].indikator, 'indikator utama instansi');
});

test('pratinjau punya bentuk data sesuai tipenya', () => {
  for (const s of susunSaranChart('pendapatan air')) {
    const w = widgetPratinjauSaran(s);
    assert.equal(w.type, s.tipe);
    assert.ok(w.title.includes('pendapatan air'));
    // Pratinjau TIDAK boleh berlabel "sumber" — angkanya contoh, bukan dokumen.
    assert.notEqual(w.confidence, 'sumber', 'pratinjau tidak boleh diakui bersumber dokumen');
    if (s.tipe === 'kpi') assert.ok(w.kpi && typeof w.kpi.value !== 'undefined');
    else if (s.tipe === 'table') assert.ok(w.table && w.table.rows.length > 0);
    else assert.ok(w.chart && Array.isArray(w.chart.series) && w.chart.series.length > 0);
  }
});

test('pratinjau menandai angkanya contoh', () => {
  const w = widgetPratinjauSaran(susunSaranChart('NRW')[1]);
  assert.match(String(w.subtitle || ''), /contoh/i);
});
