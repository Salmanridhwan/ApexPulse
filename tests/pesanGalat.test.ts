import test from 'node:test';
import assert from 'node:assert/strict';
import { pesanGalatRamah } from '../src/services/ui/pesanGalat';

const TEKNIS = /\b(rag|http|api|fetch|timeout|json|econn|socket|502|500)\b/i;

test('kegagalan jaringan jadi kalimat yang bisa dipahami', () => {
  const pesan = pesanGalatRamah(new TypeError('Failed to fetch'));
  assert.equal(pesan, 'Koneksi ke server terputus. Periksa jaringan Anda, lalu coba lagi.');
  assert.doesNotMatch(pesan, TEKNIS);
});

test('pesan teknis layanan dokumen tidak diteruskan ke pengguna', () => {
  const pesan = pesanGalatRamah(new Error('Layanan dokumen tidak dapat dihubungi: RAG HTTP 502'));
  assert.equal(pesan, 'Terjadi gangguan saat membuat dashboard. Coba lagi beberapa saat lagi.');
  assert.doesNotMatch(pesan, TEKNIS);
});

test('galat waktu habis tidak menyebut istilah teknis', () => {
  const pesan = pesanGalatRamah(new Error('Timeout — RAG tidak merespons tepat waktu'));
  assert.doesNotMatch(pesan, TEKNIS);
  assert.match(pesan, /coba lagi/i);
});

test('pesan yang sudah jelas tetap dipakai', () => {
  assert.equal(pesanGalatRamah(new Error('Template tidak dikenal.')), 'Template tidak dikenali. Silakan pilih template lain.');
  assert.equal(
    pesanGalatRamah(new Error('Instansi tidak ditemukan.')),
    'Instansi belum dipilih atau tidak ditemukan.'
  );
});

test('sesi berakhir diminta masuk lagi', () => {
  assert.equal(pesanGalatRamah(new Error('Sesi login berakhir (401)')), 'Sesi Anda sudah berakhir. Silakan masuk kembali.');
});

test('tanpa pesan tetap ada penjelasan', () => {
  assert.match(pesanGalatRamah(undefined), /gangguan/i);
  assert.match(pesanGalatRamah(''), /gangguan/i);
  assert.match(pesanGalatRamah(new Error('   ')), /gangguan/i);
});

test('pesan kepanjangan dipersingkat', () => {
  const panjang = 'x'.repeat(300);
  assert.equal(pesanGalatRamah(new Error(panjang)), 'Terjadi gangguan saat membuat dashboard. Coba lagi beberapa saat lagi.');
});
