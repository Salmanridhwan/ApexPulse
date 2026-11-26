import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perintahHapusWidget } from '../src/services/chat/perintahWidget';
import { jawabMetaDashboard } from '../src/services/chat/metaDashboard';
import { niatBuatDashboard } from '../src/services/chat/niat';
import { adalahSapaan, jawabanSapaan } from '../src/services/chat/sapaan';
import { adalahPertanyaanDokumen } from '../src/services/chat/dokumen';
import { perluRiwayat } from '../src/services/chat/riwayat';

/**
 * Regresi uji chat 25 November 2026: empat jawaban ngawur yang ditemukan saat
 * menyapu pertanyaan asisten. Tiap kasus dikunci di sini supaya tidak kembali.
 */

test('hapus kartu dengan penunjuk urutan tidak dianggap judul kartu', () => {
  // Dulu: "hapus kartu pertama di dashboard ini" -> mencari kartu berjudul
  // "pertama di dashboard ini." lalu menjawab "tidak ada widget bernama ...".
  assert.equal(perintahHapusWidget('Hapus kartu pertama di dashboard ini.'), '');
  assert.equal(perintahHapusWidget('hapus widget terakhir'), '');
  assert.equal(perintahHapusWidget('tolong hapus grafik di dashboard ini'), '');
  // Judul sungguhan tetap terbaca.
  assert.equal(perintahHapusWidget('hapus widget Nilai tagihan'), 'nilai tagihan');
  assert.equal(perintahHapusWidget('tolong hapus kartu "Aging 0-30 HARI"'), 'aging 0-30 hari');
  // Bukan perintah hapus.
  assert.equal(perintahHapusWidget('berapa nilai tagihan?'), null);
});

test('pertanyaan jumlah/nama kartu dijawab dari metadata, bukan RAG', () => {
  const dash = {
    id: 'd1',
    title: 'Dashboard Uji',
    widgets: [{ id: 'w0', title: 'Kartu Root', type: 'bar' }],
    halaman: [
      { id: 'h1', judul: 'Ringkasan', widgets: [{ id: 'w1', title: 'Nilai tagihan', type: 'hbar' }, { id: 'w2', title: 'Piutang', type: 'donut' }] },
      { id: 'h2', judul: 'Realisasi', widgets: [{ id: 'w3', title: 'Serapan', type: 'area' }] },
    ],
  } as any;
  const jumlah = jawabMetaDashboard('Berapa jumlah kartu (widget) di dashboard ini?', dash) || '';
  assert.match(jumlah, /3 kartu/);
  assert.match(jumlah, /2 halaman/);
  const daftar = jawabMetaDashboard('Kartu apa saja yang ada di dashboard ini?', dash) || '';
  assert.match(daftar, /Nilai tagihan/);
  // Pertanyaan dokumen tidak boleh dibajak cabang kartu.
  assert.equal(jawabMetaDashboard('berapa kartu dalam dokumen laporan?', dash), null);
});

test('"tampilkan laporan ..." tidak dianggap perintah membuat dashboard', () => {
  // Dulu lolos ke orkestrator: user menunggu beberapa menit lalu ditawari membuat dashboard.
  assert.equal(niatBuatDashboard('Tampilkan laporan keuangan Perumda Air Minum Tirta Moedal.'), false);
  assert.equal(niatBuatDashboard('tampilkan laporan realisasi 2026'), false);
  // Perintah dashboard yang sah tetap dikenali.
  assert.equal(niatBuatDashboard('tampilkan dashboard kinerja keuangan'), true);
  assert.equal(niatBuatDashboard('buatkan dashboard dari dokumen ini'), true);
});

test('pertanyaan tentang asisten dikenali dan dijawab lokal', () => {
  for (const p of ['Kamu model apa?', 'kamu pakai model apa', 'ini aplikasi apa', 'kamu bot apa']) {
    assert.equal(adalahSapaan(p), true, `harus dianggap pertanyaan asisten: "${p}"`);
  }
  const jawab = jawabanSapaan('Kamu model apa?', 'Yayasan Pendidikan Telkom');
  assert.match(jawab, /Asisten Aiones Boards/);
  assert.match(jawab, /Yayasan Pendidikan Telkom/);
  // Sapaan biasa tetap dapat balasan ramah tanpa menyebut dokumen sebagai sumber.
  assert.match(jawabanSapaan('halo'), /Halo!/);
  assert.match(jawabanSapaan('terima kasih'), /Sama-sama/);
});

test('"data apa saja yang kamu punya" dijawab dari inventaris, bukan tafsiran RAG', () => {
  // Dulu jatuh ke RAG dan dijawab "ada dua berkas" (dua LEMBAR dari satu berkas),
  // padahal basis instansi berisi enam dokumen.
  assert.equal(adalahPertanyaanDokumen('Data apa saja yang kamu punya tentang instansi ini?'), true);
  assert.equal(adalahPertanyaanDokumen('data apa saja yang tersedia'), true);
  // Pertanyaan isi tetap bukan inventaris.
  assert.equal(adalahPertanyaanDokumen('berapa rata-rata nilai piutang per dokumen?'), false);
  assert.equal(adalahPertanyaanDokumen('berapa nilai aset di data 2025?'), false);
});

test('riwayat hanya ikut jadi teks pencarian saat dirujuk atau pertanyaannya pendek', () => {
  // Pertanyaan mandiri: riwayat tidak boleh menggeser retrieval.
  assert.equal(perluRiwayat('Berapa nilai non-PPN 11% Tel-U menurut dokumen?'), false);
  assert.equal(perluRiwayat('Total piutang instansi ini Rp999 miliar, benar kan?'), false);
  // Rujukan ke giliran sebelumnya: riwayat wajib ikut.
  assert.equal(perluRiwayat('kalau yang tadi berapa?'), true);
  assert.equal(perluRiwayat('berapa nilai itu?'), true);
  // Pertanyaan sangat pendek tanpa rujukan eksplisit: konteks bisa hilang.
  assert.equal(perluRiwayat('piutang?'), true);
  // Tanpa riwayat tersedia, tidak ada yang dikirim.
  assert.equal(perluRiwayat('berapa nilai itu?', false), false);
});
