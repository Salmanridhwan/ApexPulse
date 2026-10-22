import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_KINERJA, MENU_KINERJA_KEYS, menuTampil } from '../src/components/menuKinerja';

test('menu Kinerja: instansi baru (semua key disembunyikan) tampil 0 dari 7', () => {
  const sembunyi = [...MENU_KINERJA_KEYS];
  const tampil = MENU_KINERJA.filter((m) => menuTampil(sembunyi, m.key));
  assert.equal(tampil.length, 0);
  assert.equal(MENU_KINERJA_KEYS.length, 7);
});

test('menu Kinerja: instansi lama tanpa field menuSembunyi tampil semua', () => {
  for (const m of MENU_KINERJA) {
    assert.equal(menuTampil(undefined, m.key), true, m.key);
    assert.equal(menuTampil(null, m.key), true, m.key);
  }
});

test('menu Kinerja: hanya key yang disembunyikan yang hilang', () => {
  const sembunyi = ['risiko', 'lkjip'];
  assert.equal(menuTampil(sembunyi, 'risiko'), false);
  assert.equal(menuTampil(sembunyi, 'lkjip'), false);
  assert.equal(menuTampil(sembunyi, 'pelaporan'), true);
});

test('menu Kinerja: key tidak dobel (satu sumber sidebar & panel admin)', () => {
  assert.equal(new Set(MENU_KINERJA_KEYS).size, MENU_KINERJA_KEYS.length);
});
