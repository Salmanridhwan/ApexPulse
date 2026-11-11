import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_TEMPLATES, varianTemplate } from '../src/services/templates/dashboardTemplates';
import { VARIAN } from '../src/services/chart/gayaVarian';

test('setiap gaya Template Chart punya template dashboard', () => {
  const tema = new Set(DASHBOARD_TEMPLATES.map((t) => t.tema));
  // Pijar, Lensa, Nadi, Kaca memakai kunci tema lama; sisanya kunci varian.
  const lama: Record<string, string> = { ringkasan: 'oranye', analitik: 'analitik', trafik: 'trafik', kaca: 'kaca' };
  for (const v of VARIAN) assert.ok(tema.has(lama[v] ?? v), `template untuk gaya ${v}`);
  // Deck baru (Keuangan & SDM, SDM & Kepegawaian, Kinerja & Target, Outsourcing,
  // Procurement, Construction, Asrama, Marketing) dibuka dengan gaya Korporat,
  // sama seperti deck rapat bagian; gayanya bisa diganti di galeri.
  assert.equal(DASHBOARD_TEMPLATES.length, 20);
  assert.ok(
    DASHBOARD_TEMPLATES.filter((t) => t.id.startsWith('tpl-deck-')).every((t) => t.tema === 'korporat'),
    'deck baru wajib punya tema gaya'
  );
});

test('varianTemplate membaca id template bergaya, termasuk halaman 2/3', () => {
  assert.equal(varianTemplate('tpl-gaya-koran'), 'koran');
  assert.equal(varianTemplate('tpl-gaya-blok#2'), 'blok');
  assert.equal(varianTemplate('tpl-ringkasan'), undefined);
  assert.equal(varianTemplate('tpl-gaya-tidakada'), undefined);
});
