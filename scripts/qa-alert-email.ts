/**
 * QA kanal email alert (Fase 3, Task 3.1) — dua bagian:
 *
 *  A. Evaluasi ambang (murni, tanpa server): aturan hanya menyala kalau nilai
 *     indikator di dokumen benar-benar melanggar ambang. Aturan seed (NRW >= 25,
 *     NPL >= 5, BOR >= 85) TIDAK menyala karena nilai dokumen masih aman.
 *  B. Jaminan "tanpa email palsu": saat SMTP_* belum diisi, mailer nonaktif,
 *     antrean dilewati, dan `sentEmail` tidak pernah di-set true.
 *  C. End-to-end HTTP (dilewati otomatis kalau server belum hidup): login →
 *     /api/alerts/evaluate → cek notifikasi in-app + status email apa adanya.
 *
 * Jalankan: npx tsx scripts/qa-alert-email.ts
 *     atau: API_BASE=http://localhost:3000 npx tsx scripts/qa-alert-email.ts
 */
import assert from 'node:assert';
import { AlertRule } from '../src/types';
import { bandingkan, buatNotifikasi, evaluasiAturan } from '../src/services/alerts';
import { antreEmail, mailerAktif, penerimaAlert, statusMailer } from '../src/services/mailer';

const BASE = process.env.API_BASE || 'http://localhost:3000';

const aturan = (sebagian: Partial<AlertRule>): AlertRule => ({
  id: 'qa-rule',
  tenantId: 'tenant-pdam',
  title: 'QA',
  metricKey: 'nrw',
  metricName: 'Tingkat NRW',
  operator: '>=',
  threshold: 0,
  unit: '%',
  channels: ['in_app'],
  severity: 'warning',
  isActive: true,
  ...sebagian,
});

let gagal = 0;
function cek(nama: string, ok: boolean, catatan = '') {
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${nama}${catatan ? ` — ${catatan}` : ''}`);
  if (!ok) gagal++;
}

function bagianA() {
  console.log('\n[A] Perbandingan ambang & pencocokan nilai dokumen');

  cek('22,4 >= 20 terlampaui', bandingkan(22.4, '>=', 20));
  cek('2,42 >= 5 tidak terlampaui', !bandingkan(2.42, '>=', 5));
  cek('78,5 < 80 terlampaui', bandingkan(78.5, '<', 80));
  cek('22,4 > 22,4 tidak terlampaui', !bandingkan(22.4, '>', 22.4));

  const seed: Array<[string, string, Partial<AlertRule>, string]> = [
    ['pdam', 'NRW >= 25', { tenantId: 'tenant-pdam', metricKey: 'nrw', metricName: 'Tingkat Kehilangan Air (NRW)', threshold: 25 }, 'aman'],
    ['bank', 'NPL >= 5', { tenantId: 'tenant-bank', metricKey: 'npl', metricName: 'Rasio NPL Gross', threshold: 5, severity: 'critical' }, 'aman'],
    ['rsud', 'BOR >= 85', { tenantId: 'tenant-rsud', metricKey: 'bor', metricName: 'Bed Occupancy Rate (BOR)', threshold: 85 }, 'aman'],
    ['pdam', 'NRW >= 20 (peringatan dini)', { tenantId: 'tenant-pdam', metricKey: 'nrw', metricName: 'Tingkat NRW', threshold: 20 }, 'terlampaui'],
    ['pdam', 'indikator tak ada di dokumen', { tenantId: 'tenant-pdam', metricKey: 'xyz', metricName: 'Indikator Tak Ada', threshold: 1 }, 'tanpa-data'],
  ];

  for (const [sektor, label, sebagian, harapan] of seed) {
    const hasil = evaluasiAturan(aturan(sebagian), sektor as any);
    const nilai = hasil.status === 'tanpa-data' ? '-' : `${hasil.indikator.nilai} ${hasil.indikator.satuan} (${hasil.indikator.docName} hal. ${hasil.indikator.page})`;
    cek(`seed ${sektor}: ${label} -> ${harapan}`, hasil.status === harapan, nilai);
  }

  const melampaui = evaluasiAturan(aturan({ metricKey: 'nrw', threshold: 20 }), 'pdam');
  assert(melampaui.status === 'terlampaui', 'prasyarat: aturan NRW >= 20 harus terlampaui');
  const notif = buatNotifikasi(
    aturan({ id: 'alert-qa-nrw', metricKey: 'nrw', threshold: 20, channels: ['in_app', 'email'] }),
    'tenant-pdam',
    melampaui.indikator
  );
  cek('notifikasi memuat nilai & ambang yang nyata', notif.metricValue === 22.4 && notif.threshold === 20);
  cek('judul notifikasi memuat nilai dokumen', /22\.4/.test(notif.title));
  cek(
    'pesan menyebut dokumen & halaman sumber',
    /Laporan_Teknis_Distribusi_Maret_2026\.pdf hal\. 28/.test(notif.message)
  );
  cek('sentEmail belum diklaim sebelum SMTP menerima', notif.sentEmail === false);
}

async function bagianB() {
  console.log('\n[B] Jaminan tanpa email palsu (SMTP belum dikonfigurasi)');
  cek('mailerAktif() = false tanpa SMTP_HOST/ALERT_EMAIL_TO', !mailerAktif());
  cek('penerimaAlert() kosong', penerimaAlert().length === 0);

  let diklaimTerkirim = false;
  antreEmail({
    subject: 'QA: uji antrean tanpa SMTP',
    text: 'tidak boleh terkirim',
    html: '<p>tidak boleh terkirim</p>',
    onSent: () => {
      diklaimTerkirim = true;
    },
  });
  await new Promise((r) => setTimeout(r, 80));
  cek('onSent tidak dipanggil saat SMTP nonaktif', !diklaimTerkirim);
  cek('jumlahTerkirim tetap 0', statusMailer().jumlahTerkirim === 0);

  // Parsing daftar penerima diuji tanpa mengubah host (host tetap kosong -> tetap nonaktif).
  const simpan = process.env.ALERT_EMAIL_TO;
  process.env.ALERT_EMAIL_TO = 'direksi@bumd.go.id, bpkp@bumd.go.id';
  cek('penerimaAlert() memisah daftar dengan koma', penerimaAlert().length === 2);
  cek('mailer tetap nonaktif tanpa SMTP_HOST', !mailerAktif());
  if (simpan === undefined) delete process.env.ALERT_EMAIL_TO;
  else process.env.ALERT_EMAIL_TO = simpan;
}

async function bagianC() {
  console.log('\n[C] End-to-end HTTP /api/alerts/evaluate');
  try {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.QA_EMAIL || 'admin@gmail.com',
        password: process.env.QA_PASSWORD || '123',
      }),
    });
    if (!login.ok) {
      console.log(`  DILEWATI — login gagal (${login.status}). Set QA_EMAIL/QA_PASSWORD kalau berbeda.`);
      return;
    }
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

    const res = await fetch(`${BASE}/api/alerts/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ tenantId: 'tenant-pdam' }),
    });
    assert(res.ok, `evaluate gagal: ${res.status}`);
    const data: any = await res.json();

    cek('respons punya notifications & tidakTerlampaui', Array.isArray(data.notifications) && Array.isArray(data.tidakTerlampaui));
    cek('status email dilaporkan apa adanya', data.email && typeof data.email.aktif === 'boolean');
    cek('aturan NRW aman dilaporkan di tidakTerlampaui', data.tidakTerlampaui.some((r: any) => /NRW/i.test(r.metricName || '')));
    cek('tidak ada notifikasi yang mengaku email terkirim saat SMTP nonaktif', data.notifications.every((n: any) => n.sentEmail !== true));
    console.log(`  info: evaluated=${data.evaluated} triggered=${data.triggeredCount} email.aktif=${data.email?.aktif} diantre=${data.email?.diantre}`);
  } catch (err: any) {
    const pesan = String(err?.message || err);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(pesan)) {
      console.log('  DILEWATI — server belum hidup (jalankan `npm run dev` lalu ulangi dengan API_BASE).');
      return;
    }
    throw err;
  }
}

async function main() {
  console.log('QA kanal email alert ApexPulse');
  bagianA();
  await bagianB();
  await bagianC();
  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
  if (gagal > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('QA error:', err);
  process.exitCode = 1;
});
