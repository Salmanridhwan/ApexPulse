/**
 * PENYARING JEJAK AUDIT.
 *
 * Admin Aiones perlu menjawab pertanyaan seperti "apa saja yang dilakukan
 * instansi X minggu lalu". Tanpa penyaring, satu-satunya cara adalah mengunduh
 * seluruh log lalu menyortirnya di Excel — dan itu berarti jejak audit instansi
 * lain ikut terbaca.
 *
 * Fungsi murni: tidak menyentuh Express maupun database, supaya batas
 * kewenangannya bisa diuji.
 */

export interface BarisAudit {
  tenantId?: string;
  action?: string;
  userName?: string;
  target?: string;
  details?: string;
  timestamp?: string;
}

export interface OpsiAudit {
  /** `'semua'` atau kosong = lintas instansi. Pemanggil yang menentukan boleh/tidaknya. */
  tenantId?: string;
  /** Potongan nama aksi, tanpa membedakan huruf besar/kecil. */
  aksi?: string;
  /** Potongan nama pengguna. */
  pengguna?: string;
  /** Batas bawah waktu (ISO). */
  dari?: string;
  /** Batas atas waktu (ISO). */
  sampai?: string;
  /** Jumlah baris maksimum yang dikembalikan. */
  batas?: number;
}

export const BATAS_AUDIT_BAWAAN = 500;

function waktu(nilai?: string): number {
  if (!nilai) return 0;
  const t = new Date(nilai).getTime();
  return Number.isFinite(t) ? t : 0;
}

function memuat(nilai: string | undefined, cari: string | undefined): boolean {
  if (!cari) return true;
  const jarum = cari.trim().toLowerCase();
  if (!jarum) return true;
  return String(nilai || '').toLowerCase().includes(jarum);
}

/**
 * Saring dan urutkan jejak audit: terbaru dulu, dibatasi jumlah baris.
 *
 * `tenantId: 'semua'` berarti lintas instansi. Ini TIDAK memeriksa siapa yang
 * meminta — pemeriksaan kewenangan ada di route, karena hanya di sana sesi
 * pengguna diketahui.
 */
export function saringAudit<T extends BarisAudit>(logs: T[], opsi: OpsiAudit = {}): T[] {
  const batas = Number.isFinite(opsi.batas) && (opsi.batas as number) > 0 ? Math.floor(opsi.batas as number) : BATAS_AUDIT_BAWAAN;
  const lintas = !opsi.tenantId || opsi.tenantId === 'semua';
  const dari = waktu(opsi.dari);
  const sampai = waktu(opsi.sampai);

  return logs
    .filter((l) => (lintas ? true : l.tenantId === opsi.tenantId))
    .filter((l) => memuat(l.action, opsi.aksi))
    .filter((l) => memuat(l.userName, opsi.pengguna))
    .filter((l) => (dari ? waktu(l.timestamp) >= dari : true))
    .filter((l) => (sampai ? waktu(l.timestamp) <= sampai : true))
    .sort((a, b) => waktu(b.timestamp) - waktu(a.timestamp))
    .slice(0, batas);
}

/**
 * Instansi mana yang boleh dipilih pada penyaring.
 *
 * Admin Instansi hanya boleh melihat instansinya sendiri — pilihannya satu,
 * bukan daftar. Admin Aiones boleh memilih instansi mana pun atau `'semua'`.
 */
export function pilihanInstansiAudit(
  peran: unknown,
  tenantSendiri: string | undefined,
  semuaInstansi: Array<{ id: string; name?: string }>
): Array<{ id: string; nama: string }> {
  if (peran === 'superadmin') {
    return [{ id: 'semua', nama: 'Semua instansi' }, ...semuaInstansi.map((t) => ({ id: t.id, nama: t.name || t.id }))];
  }
  if (!tenantSendiri) return [];
  const milik = semuaInstansi.find((t) => t.id === tenantSendiri);
  return [{ id: tenantSendiri, nama: milik?.name || tenantSendiri }];
}
