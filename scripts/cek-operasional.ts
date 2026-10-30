import fs from 'node:fs';
import { nilaiOperasionalDariWidgets, ringkasOperasional, CONTOH_OPERASIONAL } from '../src/services/templates/nilaiOperasional';

const KATA = /target|realisasi|anggaran|volume|m³|m3|nrw|kehilangan air|cakupan|kualitas/i;
const gudang = JSON.parse(fs.readFileSync('data/template-pratinjau.json', 'utf8'));
const ringkasan = gudang.find((e: any) => e.templateId === 'tpl-ringkasan');
const dipakai = new Set<string>((ringkasan.widgets || []).map((w: any) => String(w.title || '').trim().toLowerCase()));

const calon: any[] = [];
for (const e of gudang) {
  if (e.templateId === 'tpl-ringkasan' || e.status !== 'siap') continue;
  for (const w of e.widgets || []) {
    const judul = String(w.title || '').trim().toLowerCase();
    if (dipakai.has(judul)) continue;
    if (w.type === 'narasi') continue;
    const seri = Array.isArray(w.chart?.series) ? w.chart.series : [];
    if (!seri.some((s: any) => KATA.test(String(s?.name || '')))) continue;
    dipakai.add(judul);
    calon.push(w);
  }
}

console.log('widget halaman 2:', calon.map((w) => `${w.type}:${w.title}`).join(' | '));
const n = nilaiOperasionalDariWidgets(calon);
console.log('volume:', n.volume?.kategori, n.volume?.data);
console.log('pelayanan:', n.pelayanan?.indikator.map((i) => `${i.nama} ${i.realisasi}/${i.target}`));
console.log('mutu:', n.mutu?.indikator.map((i) => `${i.nama} ${i.realisasi}/${i.target}`));
console.log('anggaran:', n.anggaran?.bagian.length, 'bagian');
console.log('KPI:', ringkasOperasional(n.kpi.airTerjual, 'm³'), '|', n.kpi.nrw + '%', '|', n.kpi.sla + '%', '|', ringkasOperasional(n.kpi.anggaran, 'miliar Rp'));
console.log('CONTOH KPI:', ringkasOperasional(CONTOH_OPERASIONAL.kpi.airTerjual, 'm³'), '|', CONTOH_OPERASIONAL.kpi.nrw + '%', '|', CONTOH_OPERASIONAL.kpi.sla + '%', '|', ringkasOperasional(CONTOH_OPERASIONAL.kpi.anggaran, 'miliar Rp'));

console.log('SUMBER volume:', n.sumber.volume.map((x) => `${x.dokumen} h${x.halaman}`));
console.log('SUMBER nrw:', n.sumber.nrw.map((x) => `${x.dokumen} h${x.halaman}`));
console.log('SUMBER indikator:', n.sumber.indikator.map((x) => `${x.dokumen} h${x.halaman}`));
console.log('SUMBER anggaran:', n.sumber.anggaran.map((x) => `${x.dokumen} h${x.halaman}`));
