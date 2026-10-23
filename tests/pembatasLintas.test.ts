import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buatPembatas } from '../src/services/auth/rateLimit';
import {
  buatPembatasLintas,
  CatatanPercobaan,
  PenyimpanPercobaan,
} from '../src/services/auth/pembatasLintas';

/** Penyimpan tiruan yang meniru tabel bersama (dipakai "dua instance"). */
function simpanBersama(): PenyimpanPercobaan & { isi: Map<string, CatatanPercobaan> } {
  const isi = new Map<string, CatatanPercobaan>();
  return {
    isi,
    async baca(kunci) {
      const c = isi.get(kunci);
      return c ? { ...c } : null;
    },
    async naikkan(kunci, jendelaMs) {
      const sekarang = Date.now();
      const ada = isi.get(kunci);
      if (!ada || ada.resetPada <= sekarang) {
        const baru = { jumlah: 1, resetPada: sekarang + jendelaMs };
        isi.set(kunci, baru);
        return { ...baru };
      }
      ada.jumlah += 1;
      return { ...ada };
    },
    async hapus(kunci) {
      isi.delete(kunci);
    },
  };
}

const JENDELA = 15 * 60 * 1000;

test('hitungan dipakai bersama: percobaan di instance A terlihat di instance B', async () => {
  const simpan = simpanBersama();
  const a = buatPembatasLintas({ batas: 3, jendelaMs: JENDELA, simpan, cadangan: buatPembatas(3, JENDELA) });
  const b = buatPembatasLintas({ batas: 3, jendelaMs: JENDELA, simpan, cadangan: buatPembatas(3, JENDELA) });

  await a.gagalLintas('akun:x');
  await b.gagalLintas('akun:x');
  await a.gagalLintas('akun:x');

  const cekB = await b.cekLintas('akun:x');
  assert.equal(cekB.boleh, false, 'instance B harus ikut terkunci setelah 3 percobaan lintas instance');
  assert.ok(cekB.tungguDetik > 0);
});

test('tanpa percobaan, masih boleh masuk', async () => {
  const simpan = simpanBersama();
  const p = buatPembatasLintas({ batas: 3, jendelaMs: JENDELA, simpan, cadangan: buatPembatas(3, JENDELA) });
  const cek = await p.cekLintas('akun:baru');
  assert.equal(cek.boleh, true);
  assert.equal(cek.sisa, 3);
});

test('login berhasil membersihkan hitungan bersama', async () => {
  const simpan = simpanBersama();
  const p = buatPembatasLintas({ batas: 3, jendelaMs: JENDELA, simpan, cadangan: buatPembatas(3, JENDELA) });
  await p.gagalLintas('akun:x');
  await p.gagalLintas('akun:x');
  await p.bersihkanLintas('akun:x');
  assert.equal(await simpan.baca('akun:x'), null);
  assert.equal((await p.cekLintas('akun:x')).boleh, true);
});

test('jendela lewat → hitungan dimulai ulang', async () => {
  const simpan = simpanBersama();
  await simpan.naikkan('akun:x', 1);
  await new Promise((r) => setTimeout(r, 5));
  const c = await simpan.naikkan('akun:x', 1);
  assert.equal(c.jumlah, 1, 'jendela sudah lewat, harus mulai dari 1 lagi');
});

test('database gagal → jatuh ke pembatas memori (login tetap dibatasi, tidak terbuka)', async () => {
  const cadangan = buatPembatas(2, JENDELA);
  const rusak: PenyimpanPercobaan = {
    async baca() {
      throw new Error('MySQL mati');
    },
    async naikkan() {
      throw new Error('MySQL mati');
    },
    async hapus() {
      throw new Error('MySQL mati');
    },
  };
  const p = buatPembatasLintas({ batas: 2, jendelaMs: JENDELA, simpan: rusak, cadangan, catat: () => {} });

  await p.gagalLintas('akun:y');
  await p.gagalLintas('akun:y');
  const cek = await p.cekLintas('akun:y');
  assert.equal(cek.boleh, false);
  assert.equal(cadangan.ukuran, 1, 'hitungan lokal harus terpakai saat DB gagal');
});

test('bersihkanLintas tetap membersihkan hitungan lokal walau DB gagal', async () => {
  const cadangan = buatPembatas(2, JENDELA);
  const rusak: PenyimpanPercobaan = {
    async baca() {
      throw new Error('mati');
    },
    async naikkan() {
      throw new Error('mati');
    },
    async hapus() {
      throw new Error('mati');
    },
  };
  const p = buatPembatasLintas({ batas: 2, jendelaMs: JENDELA, simpan: rusak, cadangan, catat: () => {} });
  await p.gagalLintas('akun:z');
  await p.bersihkanLintas('akun:z');
  assert.equal(cadangan.ukuran, 0);
});
