/**
 * INSIGHT AI PER HALAMAN.
 *
 * Semua yang di sini MURNI (tanpa jaringan): menyidik isi halaman, menyusun
 * konteks ringkas untuk model, dan merapikan jawaban model. Panggilan ke layanan
 * AI-nya ada di `ragClient.insightHalaman`, endpoint-nya di `server.ts`.
 *
 * Aturan yang dipegang: model hanya menafsirkan angka yang SUDAH tampil di kartu
 * halaman. Karena itu konteks yang dikirim berisi angka kartu apa adanya, dan
 * tidak pernah menyuruh model menghitung angka baru.
 */
import type { HalamanDashboard, InsightHalaman, WidgetSpec } from '../../types';

/** Batas panjang konteks yang dikirim ke model (karakter). */
export const BATAS_KONTEKS = 4500;
/** Batas panjang tiap bagian jawaban model. */
export const BATAS_RINGKASAN = 400;
export const BATAS_BUTIR = 180;
export const MAKS_BUTIR = 3;

/** Angka ringkas: 15800000000 -> "15,8 M". Desimal pendek supaya konteks tidak bengkak. */
function angkaRingkas(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const tulis = (v: number) => {
    const teks = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
    return teks.replace('.', ',');
  };
  if (abs >= 1e12) return `${tulis(n / 1e12)} T`;
  if (abs >= 1e9) return `${tulis(n / 1e9)} M`;
  if (abs >= 1e6) return `${tulis(n / 1e6)} jt`;
  if (abs >= 1e3) return `${tulis(n / 1e3)} rb`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

/** Sidik isi halaman (djb2). Berubah bila judul, jenis, atau angka kartu berubah. */
export function sidikHalaman(h?: HalamanDashboard | null): string {
  const bagian: string[] = [String(h?.judul || '')];
  for (const w of h?.widgets || []) {
    bagian.push(`${w.id}|${w.title}|${w.type}|${w.chartId || ''}`);
    if (w.kpi) bagian.push(`k:${w.kpi.value}|${w.kpi.delta ?? ''}|${w.kpi.target ?? ''}`);
    for (const s of w.chart?.series || []) bagian.push(`s:${s.name}:${s.data.join(',')}`);
    for (const baris of w.table?.rows || []) bagian.push(`t:${baris.join(',')}`);
    if (w.narasi?.text) bagian.push(`n:${w.narasi.text}`);
  }
  let hash = 5381;
  const teks = bagian.join('\n');
  for (let i = 0; i < teks.length; i += 1) hash = ((hash << 5) + hash + teks.charCodeAt(i)) | 0;
  return `h${(hash >>> 0).toString(16)}-${teks.length.toString(16)}`;
}

/** Ringkas satu seri: jumlah titik + awal/akhir/min/maks, bukan seluruh titiknya. */
function ringkasSeri(name: string, data: number[]): string {
  const isi = (data || []).filter((v) => Number.isFinite(v));
  if (isi.length === 0) return `Seri "${name}": belum ada angka`;
  const akhir = isi[isi.length - 1];
  const awal = isi[0];
  const min = Math.min(...isi);
  const maks = Math.max(...isi);
  const ekor = isi.length === 1 ? '' : `, awal ${angkaRingkas(awal)}, akhir ${angkaRingkas(akhir)}, min ${angkaRingkas(min)}, maks ${angkaRingkas(maks)}`;
  const arah = isi.length > 1 ? (akhir > awal ? ', cenderung naik' : akhir < awal ? ', cenderung turun' : ', datar') : '';
  return `Seri "${name}": ${isi.length} titik${ekor}${arah}`;
}

/** Daftar kategori sumbu-x yang dipotong supaya konteks tetap pendek. */
function ringkasSumbu(xAxis: string[]): string {
  const bersih = (xAxis || []).map((x) => String(x));
  if (bersih.length === 0) return '';
  if (bersih.length <= 6) return bersih.join(', ');
  return `${bersih.slice(0, 3).join(', ')} … ${bersih.slice(-3).join(', ')}`;
}

/** Satu kartu jadi beberapa baris teks konteks. */
export function barisKartu(w: WidgetSpec, nomor: number): string {
  const baris: string[] = [`${nomor}. ${w.title}${w.subtitle ? ` (${w.subtitle})` : ''} [${w.chartId || w.type}]`];
  if (w.kpi) {
    const satuan = w.kpi.unit ? ` ${w.kpi.unit}` : '';
    const nilai = typeof w.kpi.value === 'number' ? angkaRingkas(w.kpi.value) : String(w.kpi.value ?? '-');
    let kpi = `   Nilai: ${nilai}${satuan}`;
    if (typeof w.kpi.target === 'number') kpi += `, target ${angkaRingkas(w.kpi.target)}${satuan}`;
    if (typeof w.kpi.delta === 'number') kpi += `, perubahan ${w.kpi.delta > 0 ? '+' : ''}${w.kpi.delta.toFixed(1)}%`;
    baris.push(kpi);
  }
  if (w.chart) {
    const satuan = w.chart.unit ? ` (satuan ${w.chart.unit})` : '';
    const sumbu = ringkasSumbu(w.chart.xAxis);
    baris.push(`   Grafik${satuan}${sumbu ? `, kategori: ${sumbu}` : ''}`);
    for (const s of w.chart.series || []) baris.push(`   ${ringkasSeri(s.name, s.data as number[])}`);
  }
  if (w.table) {
    baris.push(`   Tabel ${w.table.columns.length} kolom x ${w.table.rows.length} baris`);
    for (const r of (w.table.rows || []).slice(0, 3)) baris.push(`   - ${r.join(' | ')}`);
  }
  if (w.narasi?.text) baris.push(`   Catatan: ${w.narasi.text.slice(0, 200)}`);
  if (w.dataKosong) baris.push('   Angka belum ada di dokumen instansi (kartu kosong).');
  return baris.join('\n');
}

/**
 * Konteks halaman untuk model. Dipotong di `BATAS_KONTEKS`; kartu yang tidak muat
 * disebut jumlahnya supaya model tahu datanya tidak lengkap, bukan menganggap
 * halaman hanya berisi sedikit kartu.
 */
export function ringkasHalamanInsight(h: HalamanDashboard, batas = BATAS_KONTEKS): string {
  const widgets = h.widgets || [];
  const kepala = `Halaman "${h.judul}" berisi ${widgets.length} kartu.`;
  const potongan: string[] = [];
  let terpakai = kepala.length;
  let tertampil = 0;
  for (let i = 0; i < widgets.length; i += 1) {
    const blok = barisKartu(widgets[i], i + 1);
    if (terpakai + blok.length + 1 > batas) break;
    potongan.push(blok);
    terpakai += blok.length + 1;
    tertampil += 1;
  }
  const sisa = widgets.length - tertampil;
  return [
    kepala,
    ...potongan,
    ...(sisa > 0 ? [`(${sisa} kartu lain di halaman ini tidak ditampilkan karena batas panjang.)`] : []),
  ].join('\n');
}

/** Insight belum ada dan halaman punya kartu -> perlu dibuat. */
export function perluBuatInsight(h?: HalamanDashboard | null): boolean {
  return !!h && (h.widgets?.length || 0) > 0 && !h.insight;
}

/** Insight sudah ada tetapi kartunya berubah sejak insight dibuat. */
export function insightUsang(h?: HalamanDashboard | null): boolean {
  if (!h?.insight) return false;
  return h.insight.sidik !== sidikHalaman(h);
}

/** Ambil objek JSON pertama dari jawaban model (tahan ```json dan kalimat pembuka). */
function ambilJson(jawaban: unknown): any {
  if (jawaban && typeof jawaban === 'object') return jawaban;
  const teks = String(jawaban ?? '');
  const pagar = /```(?:json)?\s*([\s\S]*?)```/i.exec(teks);
  const bahan = (pagar ? pagar[1] : teks).trim();
  const coba = (t: string) => {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };
  const langsung = coba(bahan);
  if (langsung) return langsung;
  const awal = bahan.indexOf('{');
  if (awal < 0) return null;
  let dalam = 0;
  for (let i = awal; i < bahan.length; i += 1) {
    if (bahan[i] === '{') dalam += 1;
    else if (bahan[i] === '}') {
      dalam -= 1;
      if (dalam === 0) return coba(bahan.slice(awal, i + 1));
    }
  }
  return null;
}

/** Satu butir jawaban dirapikan: tanpa penanda daftar, satu baris, dipotong. */
function butirRapi(nilai: unknown): string {
  return String(nilai ?? '')
    .replace(/^[\s\-*•·]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BATAS_BUTIR);
}

/**
 * Rapikan jawaban model jadi isi siap simpan (tanpa `dibuatPada`/`sidik`).
 * Mengembalikan `null` bila tidak ada isi yang bisa dipakai — pemanggil yang
 * memberi pesan jujur ke pengguna, bukan menampilkan kotak kosong.
 */
export function rapikanJawabanInsight(
  jawaban: unknown
): Pick<InsightHalaman, 'ringkasan' | 'temuan' | 'saran'> | null {
  const data = ambilJson(jawaban);
  if (!data || typeof data !== 'object') return null;
  const daftar = (x: unknown): string[] =>
    (Array.isArray(x) ? x : typeof x === 'string' ? [x] : [])
      .map(butirRapi)
      .filter((t) => t.length > 3)
      .slice(0, MAKS_BUTIR);
  const ringkasan = butirRapi((data as any).ringkasan).slice(0, BATAS_RINGKASAN);
  const temuan = daftar((data as any).temuan);
  const saran = daftar((data as any).saran);
  if (!ringkasan && temuan.length === 0 && saran.length === 0) return null;
  return { ringkasan, temuan, saran };
}
