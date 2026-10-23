import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daftarBerubah,
  gabungKonfig,
  kunciKonfigBerubah,
} from '../src/services/store/sinkronKonfig';

test('kunciKonfigBerubah: tidak ada perubahan → daftar kosong', () => {
  const lama = { ragApiUrl: 'https://a', ragApiKey: 'enc:v1:x', smtpPort: 587 };
  const baru = { ragApiUrl: 'https://a', ragApiKey: 'enc:v1:x', smtpPort: 587 };
  assert.deepEqual(kunciKonfigBerubah(lama, baru), []);
});

test('kunciKonfigBerubah: hanya kunci yang berubah yang dilaporkan', () => {
  const lama = { ragApiUrl: 'https://lama', ragApiKey: 'enc:v1:x', smtpPort: 587 };
  const baru = { ragApiUrl: 'https://baru', ragApiKey: 'enc:v1:x', smtpPort: 587 };
  assert.deepEqual(kunciKonfigBerubah(lama, baru), ['ragApiUrl']);
});

test('kunciKonfigBerubah: urutan kunci tidak dianggap perubahan', () => {
  const lama = { a: 1, b: 2 };
  const baru = { b: 2, a: 1 };
  assert.deepEqual(kunciKonfigBerubah(lama, baru), []);
});

test('kunciKonfigBerubah: kunci baru dari instance lain terdeteksi', () => {
  const lama = { a: 1 };
  const baru = { a: 1, sessionSecret: 'baru' };
  assert.deepEqual(kunciKonfigBerubah(lama, baru), ['sessionSecret']);
});

test('kunciKonfigBerubah: konfigurasi kosong / bukan objek tidak melempar', () => {
  assert.deepEqual(kunciKonfigBerubah(undefined, undefined), []);
  assert.deepEqual(kunciKonfigBerubah({}, null as any), []);
});

test('gabungKonfig: nilai dari database menimpa, kunci lokal yang tidak ada tetap', () => {
  const lama = { a: 1, lokal: 'x' };
  const baru = { a: 2, b: 3 };
  assert.deepEqual(gabungKonfig(lama, baru), { a: 2, lokal: 'x', b: 3 });
});

test('gabungKonfig: tanpa data baru → salinan konfigurasi lama', () => {
  const lama = { a: 1 };
  const hasil = gabungKonfig(lama, undefined);
  assert.deepEqual(hasil, { a: 1 });
  assert.notEqual(hasil, lama);
});

test('daftarBerubah: urutan baris berbeda bukan perubahan', () => {
  const lama = [{ id: 't1', nama: 'A' }, { id: 't2', nama: 'B' }];
  const baru = [{ id: 't2', nama: 'B' }, { id: 't1', nama: 'A' }];
  assert.equal(daftarBerubah(lama, baru), false);
});

test('daftarBerubah: isi instansi berubah terdeteksi', () => {
  const lama = [{ id: 't1', nama: 'A' }];
  const baru = [{ id: 't1', nama: 'A Baru' }];
  assert.equal(daftarBerubah(lama, baru), true);
});

test('daftarBerubah: instansi baru / terhapus terdeteksi', () => {
  assert.equal(daftarBerubah([{ id: 't1' }], [{ id: 't1' }, { id: 't2' }]), true);
  assert.equal(daftarBerubah([{ id: 't1' }, { id: 't2' }], [{ id: 't1' }]), true);
});
