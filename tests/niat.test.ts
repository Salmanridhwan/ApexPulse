import assert from 'node:assert/strict';
import { test } from 'node:test';
import { niatBuatDashboard } from '../src/services/chat/niat';

test('konfirmasi singkat setelah tawaran asisten = perintah membuat dashboard', () => {
  const ya = [
    'oke buatkan',
    'Oke buatkan!',
    'ok buatkan ya',
    'ya silakan buatkan',
    'sip gas bikin',
    'boleh buatkan sekarang',
    'baik, tolong buatkan',
    'buatkan',
    'gas',
    'lanjut',
    'oke buatkan, responnya berhenti lagi',
    // menyebut "dokumen di repositori" tapi maksudnya MEMBUAT, bukan menghitung
    'buatkan dashboard lengkap dari semua dokumen di repositori',
  ];
  for (const t of ya) assert.equal(niatBuatDashboard(t), true, `harus true: ${t}`);
});

test('pertanyaan dan obrolan biasa tidak dianggap perintah', () => {
  const tidak = [
    'apa itu dashboard?',
    'bagaimana cara buat dashboard?',
    'kenapa dashboard saya kosong?',
    'berapa jumlah dokumen?',
    'oke terima kasih',
    'oke',
    'rekomendasi chart untuk NRW',
  ];
  for (const t of tidak) assert.equal(niatBuatDashboard(t), false, `harus false: ${t}`);
});

test('perintah dengan objek dashboard tetap dikenali', () => {
  for (const t of ['buatkan dashboard', 'oke buatkan saya dashboardnya', 'bikin kanvas baru', 'perbarui dashboard']) {
    assert.equal(niatBuatDashboard(t), true, `harus true: ${t}`);
  }
});
