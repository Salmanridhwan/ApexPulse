import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_TEMPLATES, varianTemplate } from '../src/services/templates/dashboardTemplates';
import { VARIAN } from '../src/services/chart/gayaVarian';

test('setiap gaya Template Chart punya template dashboard', () => {
  const tema = new Set(DASHBOARD_TEMPLATES.map((t) => t.tema));
  // Pijar, Lensa, Nadi, Kaca memakai kunci tema lama; sisanya kunci varian.
  const lama: Record<string, string> = { ringkasan: 'oranye', analitik: 'analitik', trafik: 'trafik', kaca: 'kaca' };
  for (const v of VARIAN) assert.ok(tema.has(lama[v] ?? v), `template untuk gaya ${v}`);
  assert.equal(DASHBOARD_TEMPLATES.length, 12);
});

test('varianTemplate membaca id template bergaya, termasuk halaman 2/3', () => {
  assert.equal(varianTemplate('tpl-gaya-koran'), 'koran');
  assert.equal(varianTemplate('tpl-gaya-blok#2'), 'blok');
  assert.equal(varianTemplate('tpl-ringkasan'), undefined);
  assert.equal(varianTemplate('tpl-gaya-tidakada'), undefined);
});
