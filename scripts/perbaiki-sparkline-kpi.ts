/**
 * Perbaikan sekali jalan: kartu KPI pada dashboard yang SUDAH ADA diberi grafik tren
 * (sparkline hijau) memakai aturan yang sama dengan gerbang tipe (`lengkapiSparklineKpi`).
 * Hanya field `kpi.sparkline`/`sparklineAsal` yang ditambahkan; sisanya tidak disentuh.
 */
import { lengkapiSparklineKpi } from '../src/services/spec/kpiSparkline';
import type { Dashboard, WidgetSpec } from '../src/types';

const BASE = 'http://127.0.0.1:3000';
let cookie = '';

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers || {}) },
  });
  const set = res.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const teks = await res.text();
  return { status: res.status, body: teks ? JSON.parse(teks) : null };
}

const login = await api('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@gmail.com', password: '123' }),
});
if (login.status !== 200) {
  console.error('login gagal', login.status);
  process.exit(1);
}

const list = await api('/api/dashboards');
const dasbor: Dashboard[] = Array.isArray(list.body) ? list.body : list.body?.dashboards || [];
console.log('dashboard diperiksa:', dasbor.length);

for (const d of dasbor) {
  const widgets: WidgetSpec[] = d.widgets || [];
  const baru = widgets.map((w) => lengkapiSparklineKpi(w));
  const berubah = widgets.filter(
    (w, i) =>
      (w.kpi?.sparkline?.length || 0) !== (baru[i].kpi?.sparkline?.length || 0) ||
      w.kpi?.delta !== baru[i].kpi?.delta ||
      (w.kpi?.deltaLabel || '') !== (baru[i].kpi?.deltaLabel || '')
  );
  const kpi = widgets.filter((w) => w.type === 'kpi' || w.type === 'bullet-target');
  console.log(`\n- ${d.id} "${(d.title || '').slice(0, 40)}" | kartu KPI: ${kpi.length} | tanpa grafik: ${kpi.filter((w) => !w.kpi?.sparkline?.length).length} | akan diperbaiki: ${berubah.length}`);
  for (const w of berubah) {
    const w2 = lengkapiSparklineKpi(w);
    console.log(
      `    ${(w.title || '').slice(0, 34)} -> delta ${w2.kpi?.delta ?? '-'}% (${w2.kpi?.deltaLabel || '-'}) | grafik ${JSON.stringify(w2.kpi?.sparkline)} (${w2.kpi?.sparklineAsal})`
    );
  }
  if (berubah.length === 0) continue;
  const upd = await api(`/api/dashboards/${d.id}`, { method: 'PATCH', body: JSON.stringify({ widgets: baru }) });
  console.log('    PATCH:', upd.status);
}

const cek = await api('/api/dashboards');
const akhir: Dashboard[] = Array.isArray(cek.body) ? cek.body : cek.body?.dashboards || [];
let tanpa = 0;
for (const d of akhir) for (const w of d.widgets || []) if ((w.type === 'kpi' || w.type === 'bullet-target') && !w.kpi?.sparkline?.length) tanpa++;
console.log('\nkartu KPI tanpa grafik sesudah perbaikan:', tanpa);
