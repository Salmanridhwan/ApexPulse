import dotenv from 'dotenv';
// Default produksi: .env menang atas variabel shell (perilaku lama, dipakai Kroombox).
// Untuk skrip QA lokal yang butuh port lain: set HONOR_SHELL_ENV=1 agar PORT dari shell menang.
dotenv.config({ override: process.env.HONOR_SHELL_ENV !== '1' });
import express, { NextFunction, Request, Response } from 'express';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { daftarHalaman, denganHalamanAktif, dokumenKonteksDashboard, semuaWidget } from './src/services/dashboard/halaman';
import { normJudul } from './src/services/builder/permintaanWidget';
import { skorCocok } from './src/services/builder/halamanDiminta';
import { WIDGET_CATALOG } from './src/services/builder/catalog';
import { generateDashboard } from './src/services/builder/generate';
import { namaiDariIsi } from './src/services/analisis/namaDariIsi';
import { kunciKembarWidget, labelJumlahWidget } from './src/services/builder/permintaanWidget';
import {
  bagianSumber,
  bagianTujuan,
  judulWidgetMirip,
  perintahHapusWidget,
  tipeGrafikDariTeks,
} from './src/services/chat/perintahWidget';
import { ConfigurableRagClient, RagServiceError, jelaskanError, maskKey } from './src/services/rag/http';
import {
  hitungRingkasanKatalog,
  kelompokkanKatalog,
  saringKatalog,
  tandaiKatalog,
} from './src/services/rag/kbKatalog';
import { kbUntukInstansi } from './src/services/rag/kbDefaults';
import { ambilHalaman, kumpulkanPotongan } from './src/services/rag/potonganDokumen';
import { halamanPaket, halamanSyarat } from './src/services/http/halamanPublik';
import { uraiTabelWilayah, uraiCatatanWilayah, widgetWilayah } from './src/services/templates/wilayahLayanan';
import {
  niatBuatDashboard,
  niatTambahWidget,
  niatRingkas,
  indikatorKosong,
  indikatorTambahWidget,
  hanyaKeteranganPeriode,
} from './src/services/chat/niat';
import { putusanJawaban } from './src/services/chat/jawaban';
import { adalahSapaan } from './src/services/chat/sapaan';
import { angkaTakBersumber, pesanAngkaTakBersumber } from './src/services/chat/angka';
import { db, SafeUser } from './src/services/store/inMemoryDb';
import { daftarBarisRusak } from './src/services/store/mysqlStore';
import {
  clearSessionCookieHeader,
  hashPassword,
  parseSessionCookie,
  sessionCookieHeader,
  signSession,
  verifyPassword,
  verifySession,
  setSecretSesi,
  SessionPayload,
} from './src/services/auth/session';
import { BumdSector, ChatMessage, Dashboard, LampiranPermintaan, NotificationItem, OrganisasiKMS, PermintaanData, ProgressStep, StatusPermintaan, Tenant, TIPE_SERI, UserRole, WidgetGrid, WidgetSpec } from './src/types';
import {
  SEMUA_STATUS,
  bolehMelihat,
  bolehSuntingIsi,
  bolehUbahStatus,
  normalisasiBidang,
  normalisasiPrioritas,
  normalisasiTanggal,
  ringkasPermintaan,
  validasiPermintaanBaru,
} from './src/services/permintaan/aturan';
import { KUOTA_ANALISIS_BAWAAN, sisaKuota } from './src/services/analisis/antrean';
import { jalankanAnalisis, pemakaianHariIni, petakanKeluaranRag } from './src/services/analisis/jalankan';
import {
  antreAnalisisOtomatis,
  pasangKetergantunganAntrean,
  statusAntreanOtomatis,
} from './src/services/analisis/otomatis';
import type { Ekstraktor } from './src/services/analisis/ekstrakButir';
import { perluSegarKarenaKb, putusanCache, sidikDokumen, sidikKb } from './src/services/analisis/cache';
import { kuotaPerInstansi, ringkasPlatform } from './src/services/admin/platform';
import { bolehPindahInstansi, bolehTurunkanSuperadmin, isSuperadmin } from './src/services/auth/peran';
import { butirKeHalaman, butirKeWidget, ringkasHalaman, tataGrid } from './src/services/analisis/butirKeWidget';
import { cekAturanDashboard, saranTerkait, MIN_CHART_DASHBOARD } from './src/services/analisis/aturanDashboard';
import { jumlahPerBulan, kolomTanggal } from './src/services/analisis/tanggalSerial';
import {
  bacaRencana,
  buatPrompt,
  katalogUntukAi,
  SKEMA_RENCANA,
  susunDariRencana,
  tataRapiHalaman,
  MODE_REKO,
  modeRekoSah,
} from './src/services/analisis/rekomendasiAi';
import { isiSlotTemplate, slotKosong, widgetTerisi } from './src/services/analisis/butirKeSlotTemplate';
import {
  butirSiapPakai,
  halamanDari,
  ringkasUsulan,
  terapkanPerubahan,
  validasiPerubahan,
  pangkasTambahan,
  MAKS_WIDGET_HALAMAN,
} from './src/services/analisis/usulan';
import { WidgetSpecSchema } from './src/services/spec/widgetSpec';
import { buatPembatas } from './src/services/auth/rateLimit';
import { buatPembatasLintas } from './src/services/auth/pembatasLintas';
import { kataSandiSementara, masalahKataSandi } from './src/services/auth/password';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dekripsiNilai } from './src/services/config/rahasia';
import {
  mulaiBackupTerjadwal,
  statusCadangan,
  statusUnggahanOffsite,
} from './src/services/ops/backupTerjadwal';
import { adaLagiHalaman, potongUrut } from './src/services/http/halaman';
import { adalahDokumenSambutan, gabungDokumenBasis } from './src/services/berkas/gabungBasis';
import type { DokumenBasis } from './src/services/berkas/gabungBasis';
import { buatPemeriksaKetersediaan } from './src/services/widgets/ketersediaan';
import { antreEmail, mailerAktif } from './src/services/mailer';
import { DASHBOARD_TEMPLATES, widgetDariTemplate } from './src/services/templates/dashboardTemplates';
import { dokumenDariPermintaan, namaTanpaEkstensi } from './src/services/builder/dokumenDiminta';
import { kumpulkanPotonganLembar, lembarDariBerkas, lembarDariPotongan, widgetDariSumber, type SumberLembar } from './src/services/builder/dashboardLembar';
import { bagianDariPermintaan, halamanTemplateBagian } from './src/services/templates/templateBagian';
import {
  nilaiAnalitikDariWidgets,
  nilaiDariWidgets,
  nilaiTrafikDariWidgets,
} from './src/services/templates/nilaiTemplate';
import { nilaiOperasionalDariWidgets } from './src/services/templates/nilaiOperasional';
import { gayaDariPermintaan, pilihChart, susunDashboardBerhalaman } from './src/services/builder/susunHalaman';
import { pakaiChartKatalog } from './src/services/chart/katalogCocok';
import { pastikanChartKatalog, type ChartKustom } from './src/services/chart/katalogKustom';
import { MIN_WIDGET_HALAMAN } from './src/services/builder/halamanDiminta';
import { GAYA, VARIAN, type Varian } from './src/services/chart/gayaVarian';
import { isiTemplateDariRag } from './src/services/templates/isiDariRag';
import {
  ambilPratinjau,
  aturBerkasGudang,
  basiikanTenant,
  daftarPratinjau,
  masihBerlaku,
  siapkanPratinjau,
  type EntriPratinjau,
} from './src/services/templates/gudangPratinjau';
import { adalahPermintaanSaran, dataDariWidget, indikatorDariPrompt, susunSaranChart } from './src/services/chat/saranChart';
import { adalahPertanyaanDokumen, susunJawabanDokumen } from './src/services/chat/dokumen';
import { generateInsightPresentasi } from './src/services/presentasi/generateInsight';
import { susunSlide, VERSI_PRESENTASI } from './src/services/presentasi/slide';
import { GoogleAuthError, verifikasiIdTokenGoogle } from './src/services/auth/google';
import {
  bacaTabel,
  bangunWidgetImpor,
  ringkasPratinjau,
  KonfigImpor,
} from './src/services/impor/tabel';
import { KmsClient, KmsServiceError } from './src/services/berkas/kmsClient';
import type { BerkasKMS } from './src/types';
import type { AnalisisDokumen } from './src/types';
import type { ButirData } from './src/types';
import { CHART_DEFAULT } from './src/services/chart/chartDefault';
import {
  BATAS_UKURAN_BYTE,
  cariProjectKmsDariKb,
  cariProjectKmsDariNama,
  hitungRingkasanBerkas,
  saringBerkas,
  validasiBerkas,
  validasiMetadata,
} from './src/services/berkas/kms';

/**
 * Persona chatbot Aiones Boards. Disisipkan ke setiap query percakapan supaya
 * jawaban terasa seperti chatbot LLM yang ramah, TETAP bersandar dokumen resmi,
 * dan TIDAK mengarang angka saat dokumen tidak memuatnya.
 */
const CHATBOT_PERSONA =
  'Kamu adalah "Asisten Aiones Boards", asisten AI ramah untuk instansi BUMD (Badan Usaha Milik Daerah). ' +
  'Jawab dalam Bahasa Indonesia yang natural, ringkas, dan profesional. ' +
  'ATURAN WAJIB: (1) Untuk pertanyaan tentang data, angka, kinerja, atau isi dokumen instansi, jawab HANYA berdasarkan ' +
  'dokumen resmi di knowledge base ini dan sebutkan sumbernya; kalau dokumen tidak memuat, katakan jujur bahwa datanya ' +
  'tidak ditemukan — JANGAN mengarang angka. (2) Untuk sapaan atau obrolan ringan (halo, terima kasih, siapa kamu), ' +
  'balas hangat dan tawarkan bantuan seputar dokumen instansi. (3) Jangan pernah menampilkan data contoh atau angka karangan.';

/**
 * Bangun ringkasan riwayat percakapan (multi-turn) untuk dikirim ke layanan RAG.
 * Dibatasi beberapa giliran terakhir agar prompt tetap ringkas dan relevan.
 */
function rangkaiRiwayat(messages: ChatMessage[], maksGiliran = 6): string {
  const relevan = messages
    .filter((m) => m.text && !/^Halo! Saya asisten orkestrator/i.test(m.text))
    .slice(-maksGiliran * 2);
  if (relevan.length === 0) return '';
  const baris = relevan.map((m) => {
    const peran = m.sender === 'user' ? 'Pengguna' : 'Asisten';
    const teks = m.text.replace(/\s+/g, ' ').trim().slice(0, 500);
    return `${peran}: ${teks}`;
  });
  return `Riwayat percakapan sebelumnya (konteks, jangan diulang apa adanya):\n${baris.join('\n')}`;
}

// ============ AUTH HELPERS ============

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

function requireAuth(req: Request, res: Response): SessionPayload | null {
  const session = verifySession(parseSessionCookie(req));
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login ulang.' });
    return null;
  }
  // Akun yang belum/tidak disetujui tidak boleh memakai sesi lama: kalau admin
  // menonaktifkan atau menolak akun, cookie yang masih hidup harus langsung mati.
  // User yang tidak ditemukan di memori dibiarkan lewat (bisa berasal dari instance
  // lain yang belum tersinkron) supaya tidak memutus sesi yang sah.
  const user = db.users.find((u) => u.id === session.userId);
  if (user && (user.status || 'active') !== 'active') {
    const menunggu = (user.status || 'active') === 'pending';
    res.status(403).json({
      error: menunggu
        ? 'Akun Anda masih menunggu persetujuan admin instansi.'
        : 'Akses akun Anda tidak aktif. Hubungi admin instansi.',
      kode: menunggu ? 'PENDING_APPROVAL' : 'ACCOUNT_REJECTED',
    });
    return null;
  }
  // Akun dengan sandi sementara/bawaan hanya boleh mengakses endpoint auth
  // sampai kata sandinya diganti — kalau tidak, sandi bersama tetap dipakai
  // untuk memakai seluruh aplikasi.
  if (session.mustChange && !req.path.startsWith('/api/auth/')) {
    res.status(403).json({
      error: 'Ganti kata sandi Anda dulu sebelum memakai aplikasi.',
      kode: 'MUST_CHANGE_PASSWORD',
    });
    return null;
  }
  (req as AuthedRequest).session = session;
  return session;
}

/**
 * Peran yang boleh mengelola data (dashboard, impor, tautan bagikan).
 *
 * `superadmin` (Admin Aiones) dan `admin` (Admin Instansi) sama-sama boleh.
 * `pengguna` (User) hanya boleh mengajukan permintaan data dan mengunggah
 * dokumen, jadi seluruh endpoint tulis harus memakai `butuhPenulis`.
 */
function isAdminRole(role: unknown): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Gerbang admin. Mengembalikan `true` bila boleh lanjut; bila tidak, respons 403
 * sudah dikirim sehingga pemanggil cukup `if (!requireAdmin(...)) return;`.
 *
 * Semua route admin memakai ini supaya bentuk penolakan seragam dan cakupannya
 * bisa diaudit dengan satu grep, bukan 41 salinan blok if yang gampang terlewat.
 */
function requireAdmin(session: SessionPayload, res: Response, pesan = 'Hanya administrator yang boleh melakukan tindakan ini.'): boolean {
  if (isAdminRole(session.role)) return true;
  res.status(403).json({ error: pesan });
  return false;
}

/**
 * Gerbang khusus fitur lintas instansi (tab Instansi & KB, RAG, Kuota). Menyembunyikan tabnya saja tidak cukup: Admin Instansi yang
 * memanggil endpoint-nya langsung lewat HTTP tetap dilayani `requireAdmin`.
 */
function requireSuperadmin(session: SessionPayload, res: Response, pesan = 'Hanya Admin Aiones yang boleh mengakses fitur lintas instansi ini.'): boolean {
  if (isSuperadmin(session.role)) return true;
  res.status(403).json({ error: pesan });
  return false;
}

/**
 * Gerbang tulis untuk data dashboard. Dipakai endpoint yang MENGUBAH data:
 * buat/ubah/hapus dashboard, halaman, duplikat, presentasi, impor, tautan
 * bagikan, dan penyegaran template.
 *
 * Pesannya menyebut jalan keluar, bukan hanya melarang: pengguna yang mencoba
 * membuat dashboard diarahkan ke menu Permintaan Data.
 */
function butuhPenulis(req: Request, res: Response): SessionPayload | null {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (
    !requireAdmin(
      session,
      res,
      'Menyusun dashboard hanya bisa dilakukan admin instansi. Ajukan permintaan data lewat menu Permintaan Data.'
    )
  ) {
    return null;
  }
  return session;
}

/**
 * Tenant efektif untuk request.
 *
 * KUNCI KETAT (model jual 1 akun = 1 BUMD): pengguna NON-admin SELALU memakai
 * instansi miliknya sendiri. Parameter `?tenantId=` / `body.tenantId` yang
 * dikirim non-admin DIABAIKAN sepenuhnya — dulu parameter itu dipercaya apa
 * adanya, sehingga siapa pun yang menambahkannya di URL bisa membaca dashboard
 * instansi BUMD lain. Hanya `admin` yang boleh berpindah konteks instansi,
 * karena dialah pengelola seluruh instansi pada instalasi ini.
 */
function effectiveTenantId(req: Request, session: SessionPayload): string {
  if (!bolehPindahInstansi(session.role)) {
    // Admin Instansi dan User: kunci ke instansinya sendiri, titik. Parameter
    // `tenantId` dari klien DIABAIKAN, bukan dipercaya — dulu Admin Instansi bisa
    // membaca dashboard instansi lain hanya dengan menambahkan ?tenantId=...,
    // padahal satu akun Admin Instansi hanya memegang satu instansi.
    return session.tenantId;
  }
  const requested = (req.query.tenantId as string) || (req.body?.tenantId as string | undefined);
  if (requested) return requested;
  return session.tenantId;
}

function safeUser(u: SafeUser | undefined): SafeUser | null {
  if (!u) return null;
  const { passwordHash: _ph, ...safe } = u as SafeUser & { passwordHash?: string };
  return safe;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  /**
 * Anggaran waktu pengisian angka template dari dokumen.
 *
 * ponytail: tiap kartu bisa memakan 30-60 detik (dokumen laporan tahunan ribuan
 * halaman). Anggaran 35 detik ternyata terlalu pendek: 18 kartu tidak mungkin
 * selesai, sehingga SELURUH kanvas tampil "Belum ada di dokumen". Sekarang
 * 900 detik (15 menit). Pengguna meminta: kalau angkanya ADA di dokumen, tunggu
 * sampai semua kartu terisi. Kartu yang gagal karena layanan sibuk (429/timeout)
 * diulang satu per satu sampai berhasil; yang dokumennya memang tidak memuat
 * indikator itu berhenti lebih awal, jadi batas ini hanya jaring pengaman.
 */
const BATAS_ISI_TEMPLATE_MS = 2_700_000;

/**
 * Kartu template diisi bertahap sampai habis, bukan sekali jalan.
 *
 * Dulu jatahnya 15 menit dengan 2 kartu serentak. Template deck punya 58-78
 * kartu, jadi baru sekitar 10 kartu yang sempat dicoba dan sisanya ditandai
 * "belum terisi" - pengguna melihat dashboard yang hampir seluruhnya kosong.
 * Sekarang anggarannya 45 menit, 4 kartu serentak, dan sisa kartu dilanjutkan
 * pada putaran berikutnya sampai habis (lihat `pekerja` di siapkanTemplateTenant).
 */
const PUTARAN_ISI_TEMPLATE = 4;
const KONKURENSI_ISI_TEMPLATE = 4;

/**
 * Progres pengisian template per pekerjaan (jobId), dibaca UI lewat polling.
 *
 * Pengisian bisa 5–15 menit; tanpa progres, halaman tampak menggantung dan
 * pengguna menutupnya di tengah jalan — kartu jadi kosong.
 */
const progresTemplate = new Map<
  string,
  { selesai: number; total: number; terisi: number; judul: string; mulai: number }
>();

/**
 * Versi basis pengetahuan instansi. Berubah setiap kali dokumen disinkronkan, jadi
 * pratinjau template yang dibuat sebelum dokumen baru masuk otomatis dianggap basi.
 */
/**
 * Sidik jari susunan template: id, tipe, judul, dan ukuran tiap kartu. Dipakai
 * supaya pratinjau yang tersimpan dari susunan template LAMA otomatis dianggap
 * basi ketika desain template diubah — tanpa ini, pengguna tetap melihat
 * pratinjau bergaya lama walau templatenya sudah diganti.
 */
function tandaTemplate(template: any): string {
  const inti = (template?.widgets || [])
    .map((w: any) => `${w?.id}:${w?.type}:${w?.title}:${w?.grid?.w}x${w?.grid?.h}`)
    .join('|');
  let h = 5381;
  for (let i = 0; i < inti.length; i += 1) h = ((h * 33) ^ inti.charCodeAt(i)) >>> 0;
  return `${template?.id || 'tpl'}-${h.toString(36)}`;
}

/**
 * Versi PEMETAAN widget (kategori, unit kerja, angka). Naikkan angka ini setiap
 * kali cara mengisi widget berubah, supaya pratinjau lama tidak terus dipakai.
 */
/**
 * Naikkan angka ini setiap kali cara mengisi kartu berubah. Entri pratinjau
 * lama otomatis basi dan diisi ulang dengan aturan baru.
 *
 * filter-2: kartu yang kehabisan waktu ditandai `dataTertunda` (bukan "tidak
 * ada di dokumen"), pengisian dilanjutkan bertahap sampai habis.
 */
const VERSI_PEMETAAN = 'filter-2';

/**
 * PILIH WIDGET HALAMAN 2 — hanya data operasional & pelayanan.
 *
 * Halaman 1 template Ringkasan berisi keuangan. Halaman 2 mengisi sisanya:
 * air terjual, air terdistribusi, NRW, pengaduan, dan anggaran. Widget yang
 * serinya tidak menyebut salah satu kata itu DIBUANG, supaya halaman 2 tidak
 * berisi angka keuangan yang sama dengan halaman 1 atau metrik lain yang tidak
 * berhubungan.
 */
const KATA_OPERASIONAL = /target|realisasi|anggaran|volume|m³|m3|nrw|kehilangan air|cakupan|kualitas/i;

function pilihWidgetOperasional(calon: any[], judulDipakai: Set<string>, batas = 12): any[] {
  const hasil: any[] = [];
  let narasi: any | null = null;
  for (const w of calon) {
    const judul = String(w.title || '').trim().toLowerCase();
    if (judul && judulDipakai.has(judul)) continue;

    if (w.type === 'narasi') {
      const teks = String(w.narasi?.text || '');
      // Narasi ikut hanya kalau memang membahas operasional/pelayanan.
      if (!narasi && /air|nrw|pengaduan|pelayanan|operasional/i.test(teks)) narasi = w;
      continue;
    }

    const seri = Array.isArray(w.chart?.series) ? w.chart.series : [];
    const cocok = seri.some((s: any) => KATA_OPERASIONAL.test(String(s?.name || '')));
    if (!cocok) continue;
    if (hasil.length >= batas) continue;

    if (judul) judulDipakai.add(judul);
    hasil.push(w);
  }
  if (narasi && hasil.length < batas) hasil.push(narasi);
  return hasil;
}

function versiKbTenant(tenant: any, template?: any): string {
  const dasar = `${VERSI_PEMETAAN}:${String(tenant?.kbTersinkronPada || tenant?.kbDiperbaruiPada || '0')}`;
  return template ? `${dasar}#${tandaTemplate(template)}` : dasar;
}

/**
 * Siapkan angka satu template untuk satu instansi (isi dari dokumen), hasilnya
 * disimpan di gudang pratinjau. Dipanggil di latar belakang — bukan saat tombol
 * ditekan — supaya pratinjau bisa tampil seketika.
 */
function siapkanTemplateTenant(tenant: any, template: any): Promise<EntriPratinjau> {
  const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
  const dasar = widgetDariTemplate(template, Date.now());
  return siapkanPratinjau({
    tenantId: tenant.id,
    templateId: template.id,
    kbId,
    versiKb: versiKbTenant(tenant, template),
    total: dasar.length,
    pekerja: async (onProgres, simpanSebagian) => {
      /**
       * PENGISIAN BERTAHAP.
       *
       * Putaran 1 mengisi semua kartu. Kalau ada kartu yang kehabisan waktu
       * (bukan "tidak ada di dokumen"), putaran berikutnya hanya mengerjakan
       * kartu itu - kartu yang sudah berisi tidak dipanggilkan lagi. Tiap kartu
       * yang terisi langsung disimpan (`simpanSebagian`), jadi kalau server
       * sempat mati pun pengisian melanjutkan yang belum selesai (kartu
       * ber-`confidence: 'sumber'` dilewati), bukan mengulang dari nol.
       */
      const sebelumnya = ambilPratinjau(tenant.id, template.id, kbId);
      const awal =
        Array.isArray(sebelumnya?.widgets) && sebelumnya!.widgets.length === dasar.length
          ? sebelumnya!.widgets
          : dasar;
      let widgets = awal.map((w) => ({ ...w, grid: { ...w.grid } }));
      let terisi = widgets.filter((w) => !w.dataKosong).length;
      let kosong = widgets.length - terisi;
      let tertunda = widgets.filter((w) => w.dataTertunda).length;
      const catatan: string[] = [];
      const batasAkhir = Date.now() + BATAS_ISI_TEMPLATE_MS;

      for (let putaran = 1; putaran <= PUTARAN_ISI_TEMPLATE; putaran += 1) {
        const sisaMs = batasAkhir - Date.now();
        if (sisaMs < 60_000) break;
        const sudahTerisi = (w: any) => w.confidence === 'sumber' && !w.dataKosong;
        const target =
          putaran === 1
            ? widgets.filter((w) => !sudahTerisi(w))
            : widgets.filter((w) => w.dataTertunda || (w.dataKosong && !w.catatanData));
        if (target.length === 0) break;

        const hasil = await isiTemplateDariRag(
          { ...template, widgets: target },
          {
            sector: tenant.sector as BumdSector,
            instansi: tenant.name,
            kbId,
            rag: ragClient,
            konkurensi: KONKURENSI_ISI_TEMPLATE,
            batasMs: sisaMs,
            putaranMaks: 6,
            onKartu: (kartu) => {
              widgets = widgets.map((w) => (w.id === kartu.id ? kartu : w));
              simpanSebagian(widgets);
            },
            onProgres: (info) =>
              onProgres({
                selesai: Math.min(info.selesai, info.total),
                total: info.total,
                judul: `${putaran > 1 ? `Lanjutan ${putaran}/${PUTARAN_ISI_TEMPLATE}: ` : ''}${info.judul}`,
              }),
          }
        );

        const peta = new Map(hasil.widgets.map((w) => [w.id, w]));
        widgets = widgets.map((w) => peta.get(w.id) ?? w);
        catatan.push(...hasil.catatan);
        terisi = widgets.filter((w) => !w.dataKosong).length;
        kosong = widgets.length - terisi;
        tertunda = widgets.filter((w) => w.dataTertunda).length;
        if (tertunda === 0) break;
      }

      return { widgets, terisi, kosong, tertunda, catatan };
    },
  });
}

/**
 * Pemicu analisis otomatis, dipasang oleh pembuat app (butuh db & RAG).
 * Dipisah begini karena `segarkanSetelahDokumen` hidup di luar pembuat app.
 */
type PemicuAnalisisOtomatis = (
  tenantId: string,
  dokumenBaru?: { berkasId: string; judulBerkas: string }
) => void;
let pemicuAnalisisOtomatis: PemicuAnalisisOtomatis | null = null;

/**
 * DOKUMEN INSTANSI BERUBAH (unggah, hapus, impor).
 *
 * Geser penanda versi DULU, baru siapkan ulang semua template sekali dengan
 * instansi versi baru. Dulu template dihangatkan dengan versi lama lalu versi
 * digeser, sehingga hasil pertama langsung basi dan penyiapan berjalan dua kali.
 *
 * `dokumenBaru` = berkas yang baru masuk; dokumen itu langsung dianalisis di
 * antrean, dan analisis lama yang jadi basi ikut diantrekan (batasnya diatur
 * `AUTO_SEGARKAN_MAKS` supaya kuota harian tidak habis oleh satu unggahan).
 */
function segarkanSetelahDokumen(
  tenantId: string,
  dokumenBaru?: { berkasId: string; judulBerkas: string }
): void {
  void (async () => {
    try {
      const segar = await db.updateTenant(tenantId, { kbTersinkronPada: new Date().toISOString() });
      if (segar) hangatkanTemplateTenant(segar);
    } catch (err: any) {
      console.warn('[pratinjau] gagal menyegarkan setelah dokumen berubah:', err?.message || err);
    }
    try {
      pemicuAnalisisOtomatis?.(tenantId, dokumenBaru);
    } catch (err: any) {
      console.warn('[analisis-otomatis] gagal mengantrekan analisis:', err?.message || err);
    }
  })();
}

/**
 * Hangatkan SEMUA template untuk satu instansi, berurutan di latar belakang.
 * Dipanggil saat server hidup, saat dokumen baru disinkronkan, dan saat galeri
 * template dibuka — jadi pengguna tidak pernah menunggu di depan tombol.
 */
function hangatkanTemplateTenant(tenant: any): void {
  if (!tenant?.id) return;
  const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
  if (!kbId) return;
  // Instansi tanpa KB sendiri dan tanpa dokumen tidak punya angka untuk diisi;
  // menyiapkannya hanya membuang kuota layanan dokumen.
  if (!String(tenant.knowledgeBaseId || '').trim() && !(Number(tenant.documentCount) > 0)) return;
  void (async () => {
    // Template rapat bagian disiapkan saat dibuka saja: kartunya banyak dan
    // topiknya khusus, jadi tidak perlu menghabiskan kuota layanan dokumen.
    for (const t of DASHBOARD_TEMPLATES.filter((x) => !x.bagian && !x.legacy)) {
      try {
        await siapkanTemplateTenant(tenant, t);
      } catch (err) {
        console.error(
          `[pratinjau] gagal menyiapkan ${t.id} untuk ${tenant.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  })();
}

/**
 * ponytail: tab yang dibiarkan terbuka terus menjalankan bundel JS lama, jadi
 * fitur baru (mis. tombol Pratinjau saran chart) tidak muncul walau server sudah
 * diperbarui — pengguna mengira fiturnya tidak ada sama sekali. Versi bundel di
 * bawah dipakai klien untuk mendeteksi tab seperti itu dan menawarkan muat ulang.
 */
/**
 * Folder berkas UI yang disajikan ke browser.
 *
 * Panel hosting bisa menyimpan hasil build di dua tempat sekaligus:
 * `releases/<stempel-waktu>/` (dirujuk symlink `current`) dan `dist/` di root.
 * Keduanya tidak selalu kompak — pernah `dist/` tertinggal berhari-hari
 * sementara `current` baru, dan sebaliknya setelah satu host dibangun ulang.
 * Karena itu dipilih yang `index.html`-nya PALING BARU, bukan salah satu tetap:
 * begitu bundel lama disajikan, pengguna mengira deploy tidak membawa perubahan.
 * Di mesin pengembang tidak ada `current`, jadi `dist/` yang dipakai.
 */
function folderDist(): string {
  const kandidat = [path.join(__dirname, 'current'), path.join(__dirname, 'dist')];
  let terpilih = '';
  let waktuTerbaru = -1;
  for (const folder of kandidat) {
    const berkas = path.join(folder, 'index.html');
    try {
      const waktu = fs.statSync(berkas).mtimeMs;
      if (waktu > waktuTerbaru) {
        waktuTerbaru = waktu;
        terpilih = folder;
      }
    } catch {
      /* kandidat ini tidak punya index.html */
    }
  }
  return terpilih || path.join(__dirname, 'dist');
}

/**
 * Peringatan pengembangan: `dist/` lebih tua dari kode di `src/`. Server
 * menyajikan antarmuka dari `dist/`, jadi uji UI tanpa `npm run build`
 * mengukur kode lama (laporan QA F-09). Hanya peringatan, tidak menghentikan server.
 */
function peringatkanBundelUsang(): void {
  try {
    const waktuBundel = fs.statSync(path.join(folderDist(), 'index.html')).mtimeMs;
    let terbaru = 0;
    const telusuri = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) telusuri(p);
        else terbaru = Math.max(terbaru, fs.statSync(p).mtimeMs);
      }
    };
    telusuri(path.join(__dirname, 'src'));
    if (terbaru > waktuBundel) {
      console.warn(
        '[ui] PERINGATAN: dist/ lebih tua dari src/ — antarmuka yang disajikan adalah bundel lama. ' +
          'Jalankan `npm run build` (atau pakai `npm run dev`) sebelum menguji UI.'
      );
    }
  } catch {
    // Folder sumber tidak ada (mis. di server produksi): tidak perlu diperiksa.
  }
}

function versiBundelSaatIni(): string {
  try {
    const html = fs.readFileSync(path.join(folderDist(), 'index.html'), 'utf8');
    const cocok = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
    if (cocok) return cocok[1];
  } catch {
    /* saat dev dist belum ada */
  }
  return 'dev';
}

const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Sembunyikan versi framework dari header respons (memudahkan penyerang
  // mencocokkan eksploit ke versi Express yang dipakai).
  app.disable('x-powered-by');
  // ponytail: di produksi aplikasi berada di balik reverse proxy Kroombox.
  // Tanpa ini `req.ip` selalu alamat proxy, sehingga pembatas percobaan login
  // per-IP menghitung SEMUA pengguna sebagai satu orang (satu salah sandi
  // memblokir seluruh instansi). Satu lapis proxy saja — jangan lebih, supaya
  // header X-Forwarded-For tidak bisa dipalsukan bebas.
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  /**
   * Header keamanan dasar. Tanpa ini browser bebas menyisipkan halaman kita di
   * iframe pihak lain, dan tidak ada batasan dari mana skrip/gaya dimuat.
   *
   * CSP sengaja masih mengizinkan gaya inline (React + ECharts memakai style
   * atribut) dan Google Sign-In (accounts.google.com). `object-src 'none'`
   * mematikan plugin lama yang tidak dipakai aplikasi ini.
   */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
        // index.html memuat Inter/JetBrains Mono dari Google Fonts. Tanpa izin
        // di sini, CSP memblokir stylesheet DAN berkas font-nya, sehingga font
        // bermerek tidak pernah terpakai dan browser diam-diam jatuh ke font
        // sistem.
        // accounts.google.com ikut diizinkan karena tombol Google Sign-In
        // menyisipkan stylesheet sendiri (accounts.google.com/gsi/style).
        // Tanpa origin itu, tombolnya tampil rusak walau skripnya jalan.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https:",
        "frame-src https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  /**
   * Log satu baris per permintaan API: metode, jalur, status, durasi.
   * Tanpa ini, gangguan di produksi tidak meninggalkan jejak apa pun selain
   * console.log yang tersebar. /health dilewati agar tidak membanjiri log.
   */
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const mulai = Date.now();
    // Id permintaan: dipakai untuk mencocokkan keluhan pengguna ("muncul pesan
    // galat") dengan baris log yang tepat. Dikirim balik di header & pesan galat.
    const idPermintaan = randomUUID().slice(0, 8);
    (req as any).idPermintaan = idPermintaan;
    res.setHeader('X-Request-Id', idPermintaan);
    // Data instansi tidak boleh disimpan di cache proxy/browser bersama.
    if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      if (req.path === '/health') return;
      const sesi = verifySession(parseSessionCookie(req));
      const siapa = sesi ? ` user=${sesi.userId}` : '';
      console.log(
        `[api] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - mulai}ms${siapa} req=${idPermintaan}`
      );
    });
    next();
  });

  // RAG client: baca konfigurasi dari panel admin (systemConfig) secara live.
  // Default provider/url/key diambil dari env, lalu bisa dioverride admin via UI.
  const ragClient = new ConfigurableRagClient(() => ({
    provider: db.systemConfig.ragProvider,
    baseUrl: db.systemConfig.ragApiUrl,
    apiKey: dekripsiNilai(db.systemConfig.ragApiKey),
    // Batas tunggu & jalur pengambilan sengaja TIDAK lagi jadi setelan admin:
    // aplikasi selalu mencoba /extract lebih dulu (angka nyata + halaman sumber)
    // dan otomatis jatuh ke retrieval biasa kalau layanan tidak punya /extract.
    timeoutMs: 90,
    kbId: (db.systemConfig as any).ragKnowledgeBaseId || '',
  }));
  // Seed awal dari env (kalau ada) — admin tetap bisa override via panel.
  if (process.env.RAG_PROVIDER === 'http') db.systemConfig.ragProvider = 'http';
  if (process.env.RAG_API_URL) db.systemConfig.ragApiUrl = process.env.RAG_API_URL;
  if (process.env.RAG_API_KEY) db.systemConfig.ragApiKey = process.env.RAG_API_KEY;
  if (process.env.RAG_KB_ID) (db.systemConfig as any).ragKnowledgeBaseId = process.env.RAG_KB_ID;

  // Klien KMS (repositori berkas) — dibuat per-permintaan dari systemConfig
  // supaya perubahan Base URL/API key di panel admin langsung berlaku.
  if (process.env.KMS_API_URL) (db.systemConfig as any).kmsApiUrl = process.env.KMS_API_URL;
  if (process.env.KMS_API_KEY) (db.systemConfig as any).kmsApiKey = process.env.KMS_API_KEY;
  const klienKms = () =>
    new KmsClient({
      baseUrl: (db.systemConfig as any).kmsApiUrl || 'https://ragkms.aiones.app',
      apiKey: dekripsiNilai((db.systemConfig as any).kmsApiKey),
      timeoutMs: (db.systemConfig as any).kmsTimeoutSeconds || 120,
    });

  /**
   * Jangan pernah menyimpan nilai BERSETOPENG sebagai kredensial asli.
   *
   * GET /api/admin/config mengirim key ter-mask ke browser, jadi kolom isian
   * berisi topeng seperti "kms_*********b2f". Kalau topeng itu ikut tersimpan,
   * kredensial asli HANCUR. Dua kasus: (a) nilai sama dengan topeng saat ini →
   * pertahankan key lama; (b) nilai SUDAH BERBENTUK TOPENG (topeng basi) → juga
   * pertahankan key lama. Nilai yang benar-benar baru dipakai apa adanya.
   */
  function lindungiKunci(nilaiDikirim: unknown, kunciSekarang: string): string {
    if (typeof nilaiDikirim !== 'string') return kunciSekarang;
    const berbentukMask = /[*•·]{4,}/.test(nilaiDikirim);
    if (berbentukMask || nilaiDikirim === maskKey(kunciSekarang) || nilaiDikirim === '*********') {
      return kunciSekarang;
    }
    return nilaiDikirim;
  }

  // Pemeriksa ketersediaan preset katalog (lihat services/widgets/ketersediaan.ts).
  const pemeriksaKetersediaan = buatPemeriksaKetersediaan({
    ragClient,
    db,
    ambilProvider: () => db.systemConfig.ragProvider,
  });

  // Buang catatan ketersediaan yang tidak sah lagi (KB instansi berganti / kedaluwarsa)
  // supaya katalog tidak mewarisi hasil pemeriksaan dari KB yang sudah tidak dipakai.
  {
    const kbPerTenant: Record<string, string> = {};
    for (const t of db.tenants) {
      kbPerTenant[t.id] = kbUntukInstansi(t, db.systemConfig.ragKnowledgeBaseId) || '';
    }
    const dibuang = db.bersihkanKetersediaan(kbPerTenant);
    if (dibuang > 0) {
      console.log(`[ketersediaan] ${dibuang} catatan lama dibuang (KB berubah / kedaluwarsa)`);
    }
  }

  /**
   * Batas payload: 2 MB untuk JSON biasa, 70 MB HANYA untuk unggah berkas
   * (base64 50 MB membengkak ~33% jadi ~67 MB).
   *
   * ponytail: dulu semua endpoint menerima 70 MB, sehingga satu permintaan
   * besar dari klien mana pun bisa menghabiskan memori server tanpa perlu
   * login sekali pun.
   */
  const jsonKecil = express.json({ limit: '2mb' });
  const jsonBesar = express.json({ limit: '70mb' });
  // Impor Excel/CSV mengirim berkas base64 (maks 25 MB -> ~34 MB). Dulu ikut
  // batas 2 MB sehingga berkas kecil pun ditolak "request entity too large".
  const jsonImpor = express.json({ limit: '36mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const lanjut = (err?: any) => {
      if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Berkas terlalu besar untuk dikirim ke server.' });
      }
      next(err);
    };
    if (req.path === '/api/berkas/unggah') return jsonBesar(req, res, lanjut);
    if (req.path.startsWith('/api/impor/')) return jsonImpor(req, res, lanjut);
    return jsonKecil(req, res, lanjut);
  });

  /**
   * Tolak permintaan pengubah data yang datang dari domain lain (CSRF).
   *
   * ponytail: cookie sesi sudah HttpOnly + SameSite=Lax, tapi itu belum menutup
   * semua jalur (POST JSON lintas situs). Cukup bandingkan Origin dengan Host —
   * tanpa paket tambahan. Klien non-browser (skrip/curl) tidak mengirim Origin,
   * jadi tetap boleh (tidak ada cookie yang bisa dicuri di sana).
   */
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const asal = req.headers.origin;
    if (!asal) return next();
    try {
      if (new URL(asal).host !== req.headers.host) {
        return res.status(403).json({ error: 'Permintaan dari domain lain ditolak.' });
      }
    } catch {
      return res.status(403).json({ error: 'Asal permintaan tidak sah.' });
    }
    next();
  });

  /**
   * Pembatas percobaan login. Dua lapis:
   * - per IP  : 30 percobaan / 15 menit (menahan satu penyerang menyapu banyak email)
   * - per akun: 10 percobaan / 15 menit (menahan tebakan pada satu email)
   * In-memory; kalau nanti banyak instance, batas ini berlaku per instance.
   */
  const pembatasIp = buatPembatas(30, 15 * 60 * 1000);
  const pembatasAkun = buatPembatas(10, 15 * 60 * 1000);
  const pembatasDaftar = buatPembatas(5, 60 * 60 * 1000);
  // Permintaan lupa sandi: 5 per IP dan 2 per akun tiap jam, supaya admin tidak dibanjiri notifikasi.
  const pembatasLupa = buatPembatas(5, 60 * 60 * 1000);
  const pembatasLupaAkun = buatPembatas(2, 60 * 60 * 1000);
  // Unggah berkas memakan memori + kuota penyimpanan: 20 berkas/jam per akun.
  const pembatasUnggah = buatPembatas(20, 60 * 60 * 1000);
  // PIN tautan hanya 6 angka (1 juta kemungkinan). Tanpa batas percobaan,
  // PIN bisa ditebak otomatis dalam hitungan menit — batas ini yang membuatnya
  // tidak praktis. Kunci: tautan + IP, supaya satu tautan bocor tidak bisa
  // ditebak beramai-ramai dari banyak alamat.
  const pembatasPin = buatPembatas(10, 15 * 60 * 1000);

  /**
   * Pembatas yang DIPAKAI route: hitungan bersama di MySQL (tabel
   * `percobaan_akses`) supaya batas berlaku lintas instance, dengan pembatas
   * memori di atas sebagai cadangan saat database tidak bisa dihubungi.
   */
  const simpanPercobaan = {
    baca: (kunci: string) => db.percobaanBaca(kunci),
    naikkan: async (kunci: string, jendelaMs: number) =>
      (await db.percobaanNaikkan(kunci, jendelaMs)) || { jumlah: 0, resetPada: 0 },
    hapus: (kunci: string) => db.percobaanHapus(kunci),
  };
  const pembatasIpLintas = buatPembatasLintas({
    batas: 30,
    jendelaMs: 15 * 60 * 1000,
    simpan: simpanPercobaan,
    cadangan: pembatasIp,
  });
  const pembatasAkunLintas = buatPembatasLintas({
    batas: 10,
    jendelaMs: 15 * 60 * 1000,
    simpan: simpanPercobaan,
    cadangan: pembatasAkun,
  });
  const pembatasPinLintas = buatPembatasLintas({
    batas: 10,
    jendelaMs: 15 * 60 * 1000,
    simpan: simpanPercobaan,
    cadangan: pembatasPin,
  });
  setInterval(() => {
    pembatasIp.sapu();
    pembatasAkun.sapu();
    pembatasDaftar.sapu();
    pembatasLupa.sapu();
    pembatasLupaAkun.sapu();
    pembatasUnggah.sapu();
  }, 10 * 60 * 1000).unref();

  /**
   * Sinkronisasi multi-instance: produksi berjalan di >1 instance backend yang
   * berbagi MySQL. Tanpa ini, data yang ditulis satu instance (dashboard, chat,
   * tenant) tidak terlihat di instance lain — daftar dashboard/riwayat "berkedip"
   * tergantung instance mana yang melayani permintaan. Segarkan dibatasi TTL agar
   * tidak satu SELECT per permintaan, dan dilewati saat ada tulis lokal yang belum
   * selesai (lihat InMemoryDb.segarkanMultiInstance).
   */
  let segarTerakhir = 0;
  const SEGAR_TTL_MS = 1000;
  app.use('/api', async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      if (Date.now() - segarTerakhir >= SEGAR_TTL_MS) {
        segarTerakhir = Date.now();
        await db.segarkanMultiInstance();
      }
    } catch {
      // Kegagalan sinkronisasi tidak boleh menggagalkan permintaan.
    }
    next();
  });

  // Health Check
  /**
   * Penanda versi bundel frontend. Klien membandingkannya dengan versi saat
   * halaman dimuat; kalau berbeda, tab itu masih menjalankan JS lama dan diberi
   * tawaran muat ulang. Tidak rahasia, jadi tanpa login.
   */
  app.get('/api/versi', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    // Dibaca ulang tiap permintaan (index.html ~2 KB): `dist` bisa dibangun ulang
    // tanpa server dimulai ulang, dan tab yang masih memakai bundel lama harus
    // diberi tahu. Dulu versi dihitung sekali saat start, jadi tab lama terus
    // memakai kode lama tanpa pemberitahuan (uji 3 Nov 2026).
    res.json({ versi: versiBundelSaatIni() });
  });

  app.get('/health', async (_req: Request, res: Response) => {
    // Cadangan terakhir dibaca dari folder (murah: hanya stat berkas).
    let daftarCadangan: { nama: string; waktu: number }[] = [];
    try {
      const dir = process.env.BACKUP_DIR || 'backups';
      daftarCadangan = readdirSync(dir).map((nama) => ({
        nama,
        waktu: statSync(join(dir, nama)).mtimeMs,
      }));
    } catch {
      daftarCadangan = [];
    }
    res.json({
      status: 'ok',
      db: db.persistenceActive,
      persistence: db.persistenceActive ? 'mysql' : 'file',
      persistenceGalat: db.galatPersistence,
      // Baris database yang gagal diurai — supaya kerusakan data tidak senyap.
      barisRusak: daftarBarisRusak().map((b) => ({ ...b, cuplikan: b.cuplikan.slice(0, 16) })),
      uptimeDetik: Math.round(process.uptime()),
      memoriMB: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      dbMs: await db.pingMysql(),
      cadangan: statusCadangan(daftarCadangan, Date.now(), 26, process.uptime() / 3600),
      sinkronKonfigDetik: Number(process.env.CONFIG_REFRESH_SECONDS ?? 30),
      cadanganOffsite: statusUnggahanOffsite(),
      timestamp: Date.now(),
    });
  });

  // ================= TENANT & AUTH ROUTES =================
  app.get('/api/tenants', async (req: Request, res: Response) => {
    // WAJIB login: daftar instansi bukan informasi publik. Dulu endpoint ini
    // terbuka tanpa autentikasi sehingga siapa pun bisa membaca daftar instansi.
    const session = requireAuth(req, res);
    if (!session) return;
    // Segarkan dari tabel khusus dulu supaya instance mana pun melihat daftar
    // instansi yang sama (produksi punya >1 instance backend).
    await db.segarkanTenantDariMysql();
    // Kunci ketat 1 akun = 1 BUMD. Hanya Admin Aiones (superadmin) yang mengelola
    // lintas instansi; Admin Instansi dan User selalu menerima satu instansi saja,
    // yaitu miliknya sendiri. Dulu `isAdminRole` dipakai di sini, sehingga Admin
    // Instansi ikut menerima keenam instansi dan bisa berpindah konteks.
    if (!isSuperadmin(session.role)) {
      return res.json(db.tenants.filter((t) => t.id === session.tenantId));
    }
    res.json(db.tenants);
  });

  /**
   * Lupa kata sandi. Aplikasi belum mengirim email ke pengguna, jadi permintaan
   * diteruskan ke admin instansi (notifikasi, dan email ke
   * ALERT_EMAIL_TO bila SMTP aktif). Admin lalu memakai "Reset kata sandi" di
   * panel Admin, yang membuat sandi sementara wajib-ganti.
   *
   * Jawaban SELALU sama, terdaftar atau tidak, supaya halaman ini tidak bisa
   * dipakai menebak email mana yang punya akun.
   */
  app.post('/api/auth/lupa-sandi', async (req: Request, res: Response) => {
    const jawaban = {
      ok: true,
      pesan:
        'Jika email tersebut terdaftar, permintaan Anda sudah diteruskan ke admin instansi. Admin akan memberikan kata sandi sementara.',
    };
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.length > 200) {
      return res.status(400).json({ error: 'Masukkan email akun Anda.' });
    }
    const kunciIp = `lupa-ip:${req.ip || 'lokal'}`;
    const cek = pembatasLupa.cek(kunciIp);
    if (!cek.boleh) {
      res.setHeader('Retry-After', String(cek.tungguDetik));
      return res.status(429).json({
        error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(cek.tungguDetik / 60)} menit.`,
      });
    }
    pembatasLupa.gagal(kunciIp);

    const user = await db.findUserForLogin(email);
    const kunciAkun = `lupa-akun:${email}`;
    // Akun Google tidak punya sandi untuk direset; permintaan berulang diabaikan diam-diam.
    if (!user || user.googleSub || !pembatasLupaAkun.cek(kunciAkun).boleh) return res.json(jawaban);
    pembatasLupaAkun.gagal(kunciAkun);

    const waktu = new Date().toISOString();
    const judul = `Permintaan atur ulang kata sandi: ${user.name}`;
    const isi = `${user.name} (${user.email}) lupa kata sandi. Buka Admin > Pengguna, lalu pilih Reset kata sandi untuk akun ini.`;
    const notif: NotificationItem = {
      id: `notif-${Date.now()}-lupa-${user.id}`,
      tenantId: user.tenantId,
      title: judul,
      message: isi,
      severity: 'warning',
      timestamp: waktu,
      isRead: false,
      sentEmail: false,
    };
    db.notifications.unshift(notif);
    db.simpanNotifikasi(notif);
    if (mailerAktif()) {
      const aman = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
      antreEmail({
        subject: `[Aiones Boards] ${judul}`,
        text: isi,
        html: `<p>${aman(isi)}</p>`,
        onSent: () => {
          notif.sentEmail = true;
        },
      });
    }
    res.json(jawaban);
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Batas percobaan: tanpa ini, kata sandi bisa ditebak otomatis tanpa henti.
    const kunciIp = `ip:${req.ip || 'lokal'}`;
    const kunciAkun = `akun:${cleanEmail}`;
    const cekIp = await pembatasIpLintas.cekLintas(kunciIp);
    const cekAkun = await pembatasAkunLintas.cekLintas(kunciAkun);
    if (!cekIp.boleh || !cekAkun.boleh) {
      const tunggu = Math.max(cekIp.tungguDetik, cekAkun.tungguDetik);
      res.setHeader('Retry-After', String(tunggu));
      return res.status(429).json({
        error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(tunggu / 60)} menit.`,
        kode: 'TERLALU_BANYAK_PERCOBAAN',
        tungguDetik: tunggu,
      });
    }

    // findUserForLogin menyegarkan dari tabel auth khusus dulu, supaya user yang
    // didaftarkan di instance backend lain tetap bisa login di instance ini.
    const user = await db.findUserForLogin(cleanEmail);

    // Verifikasi scrypt terhadap kredensial terpisah; pesan error identik
    // untuk email tak dikenal & password salah (anti user-enumeration).
    const storedHash = user ? db.credentials[user.id] : undefined;
    if (!user || !storedHash || !verifyPassword(password, storedHash)) {
      await pembatasIpLintas.gagalLintas(kunciIp);
      await pembatasAkunLintas.gagalLintas(kunciAkun);
      return res.status(401).json({
        error: 'Email atau kata sandi tidak sesuai dengan kredensial instansi.',
      });
    }
    await pembatasIpLintas.bersihkanLintas(kunciIp);
    await pembatasAkunLintas.bersihkanLintas(kunciAkun);

    // Status keanggotaan diperiksa SETELAH kata sandi benar, supaya pesan
    // "menunggu persetujuan" tidak bisa dipakai menebak email mana yang terdaftar.
    const statusAkun = user.status || 'active';
    if (statusAkun !== 'active') {
      const namaInstansi = db.tenants.find((t) => t.id === (user!.requestedTenantId || user!.tenantId))?.name;
      return res.status(403).json({
        error:
          statusAkun === 'pending'
            ? `Akun Anda masih menunggu persetujuan admin ${namaInstansi || 'instansi'}.`
            : 'Pendaftaran akun Anda ditolak. Hubungi admin instansi untuk informasi lebih lanjut.',
        kode: statusAkun === 'pending' ? 'PENDING_APPROVAL' : 'ACCOUNT_REJECTED',
        tenantName: namaInstansi || null,
      });
    }

    // Kewajiban ganti sandi DIHAPUS (permintaan pemilik aplikasi): akun admin
    // memakai sandi bawaan tetap dan langsung bisa dipakai, termasuk akun lama
    // yang dulu ditandai mustChangePassword.
    const wajibGanti = false;

    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      mustChange: wajibGanti,
    });


    // Token dikirim via cookie HttpOnly — tidak bisa dicuri JS browser.
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    res.json({
      user: { ...(safeUser(user) as any), mustChangePassword: wajibGanti },
      mustChangePassword: wajibGanti,
    });
  });

  /**
   * Konfigurasi auth yang boleh diketahui klien (TANPA rahasia).
   * Dipakai halaman login untuk menampilkan tombol "Masuk dengan Google" hanya
   * saat Client ID tersedia.
   */
  app.get('/api/auth/config', (_req: Request, res: Response) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      googleAktif: !!process.env.GOOGLE_CLIENT_ID,
    });
  });

  /**
   * Daftar instansi untuk FORM PENDAFTARAN saja.
   *
   * Berbeda dari /api/tenants (yang kini wajib login dan mengembalikan data
   * lengkap), endpoint ini sengaja:
   *  - hanya mengembalikan id + nama (tanpa jumlah dokumen, KB ID, dll.),
   *  - hanya hidup saat pendaftaran mandiri terbuka (ALLOW_REGISTRATION).
   * Kalau pendaftaran ditutup, endpoint mengembalikan daftar kosong — tidak ada
   * alasan membocorkan daftar instansi ke publik.
   */
  app.get('/api/auth/tenants', (_req: Request, res: Response) => {
    if (process.env.ALLOW_REGISTRATION === 'false') {
      return res.json([]);
    }
    res.json(db.tenants.map((t) => ({ id: t.id, name: t.name })));
  });

  /** Terbitkan sesi untuk user yang sudah lolos verifikasi. */
  function terbitkanSesi(res: Response, user: SafeUser, cara: string) {
    // Kewajiban ganti sandi DIHAPUS (permintaan pemilik aplikasi), juga untuk
    // akun yang masuk lewat Google.
    const wajibGanti = false;

    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      mustChange: wajibGanti,
    });
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    return res.json({ user: safeUser(user) });
  }

  /**
   * REGISTRASI akun baru (email + kata sandi).
   *
   * Akun baru dibuat dengan peran 'pengguna' dan instansi default. Untuk mencegah
   * penyalahgunaan, pendaftaran bisa ditutup lewat env `ALLOW_REGISTRATION=false`.
   */
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    // Pendaftaran massal dari satu IP = pembuatan akun sampah; batasi 5/jam.
    const cekDaftar = pembatasDaftar.cek(`ip:${req.ip || 'lokal'}`);
    if (!cekDaftar.boleh) {
      res.setHeader('Retry-After', String(cekDaftar.tungguDetik));
      return res.status(429).json({
        error: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
        kode: 'TERLALU_BANYAK_PERCOBAAN',
      });
    }
    pembatasDaftar.gagal(`ip:${req.ip || 'lokal'}`);

    if (process.env.ALLOW_REGISTRATION === 'false') {
      return res.status(403).json({ error: 'Pendaftaran akun sedang ditutup. Hubungi admin instansi.' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim() || 'tenant-pdam';

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Format email tidak valid.' });
    }
    const masalahSandi = masalahKataSandi(password, email);
    if (masalahSandi) return res.status(400).json({ error: masalahSandi });
    // Segarkan dari tabel auth khusus dulu agar email yang sudah didaftarkan di
    // instance backend lain tidak dibuat dobel (multi-instance).
    const sudahAda = await db.findUserForLogin(email);
    if (sudahAda) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Silakan masuk, atau gunakan tombol "Masuk dengan Google".',
      });
    }
    if (!db.tenants.some((t) => t.id === tenantId)) {
      return res.status(400).json({ error: 'Instansi yang dipilih tidak dikenal.' });
    }

    // Akun TIDAK langsung aktif. Pendaftaran mandiri hanya membuat permintaan
    // `pending` yang harus disetujui admin instansi; sesi baru terbit setelah itu.
    const newUser: SafeUser = {
      id: `user-${Date.now()}`,
      email,
      name,
      role: 'pengguna',
      tenantId,
      avatar: '👤',
      status: 'pending',
      requestedTenantId: tenantId,
      requestedAt: new Date().toISOString(),
    };
    db.createUser(newUser, hashPassword(password));
    const instansiTujuan = db.tenants.find((t) => t.id === tenantId);
    return res.status(202).json({
      status: 'pending',
      email,
      tenantId,
      tenantName: instansiTujuan?.name || null,
      message: `Pendaftaran diterima. Akun Anda menunggu persetujuan admin ${instansiTujuan?.name || 'instansi'}.`,
    });
  });

  /**
   * LOGIN / REGISTRASI dengan GOOGLE.
   *
   * Klien mengirim ID token dari Google Identity Services; server memverifikasi
   * tanda tangannya ke kunci publik Google. Bila email belum terdaftar, akun
   * dibuat otomatis (peran 'pengguna', instansi default) — jadi "Masuk dengan
   * Google" sekaligus berfungsi sebagai pendaftaran.
   */
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const idToken = String(req.body?.credential || req.body?.idToken || '');
    if (!idToken) {
      return res.status(400).json({ error: 'Token Google tidak dikirim.' });
    }

    let profil;
    try {
      profil = await verifikasiIdTokenGoogle(idToken, process.env.GOOGLE_CLIENT_ID || '');
    } catch (err) {
      const pesan =
        err instanceof GoogleAuthError
          ? err.message
          : 'Verifikasi login Google gagal.';
      return res.status(401).json({ error: pesan });
    }

    // Segarkan dari tabel auth khusus dulu (multi-instance), lalu cocokkan.
    let user = await db.findUserForLogin(profil.email);
    if (!user) {
      user = db.users.find((u) => u.googleSub === profil.sub);
    }

    if (!user) {
      // Pendaftaran otomatis via Google (bisa ditutup dengan ALLOW_REGISTRATION=false).
      if (process.env.ALLOW_REGISTRATION === 'false') {
        return res.status(403).json({
          error: 'Akun Google ini belum terdaftar dan pendaftaran sedang ditutup. Hubungi admin instansi.',
        });
      }
      // Instansi WAJIB dipilih. Dulu server diam-diam memakai 'tenant-pdam' atau
      // instansi pertama, sehingga akun Google bisa mendarat di BUMD yang salah
      // tanpa sepengetahuan pendaftar.
      const tenantId = String(req.body?.tenantId || '').trim();
      const instansiTujuan = db.tenants.find((t) => t.id === tenantId);
      if (!instansiTujuan) {
        return res.status(400).json({
          error: 'Pilih instansi Anda sebelum mendaftar dengan Google.',
          kode: 'BUTUH_INSTANSI',
          email: profil.email,
          instansiTersedia: db.tenants.map((t) => ({ id: t.id, name: t.name })),
        });
      }
      const baru: SafeUser = {
        id: `user-g-${profil.sub || Date.now()}`,
        email: profil.email,
        name: profil.name,
        role: 'pengguna',
        tenantId: instansiTujuan.id,
        avatar: profil.picture || '👤',
        googleSub: profil.sub,
        viaGoogle: true,
        emailVerified: profil.emailVerified,
        status: 'pending',
        requestedTenantId: instansiTujuan.id,
        requestedAt: new Date().toISOString(),
      };
      db.createUser(baru);
      return res.status(202).json({
        status: 'pending',
        email: baru.email,
        tenantId: baru.tenantId,
        tenantName: instansiTujuan.name,
        message: `Pendaftaran diterima. Akun Anda menunggu persetujuan admin ${instansiTujuan.name}.`,
      });
    } else if (!user.googleSub) {
      // Akun lokal dengan email sama: tautkan ke Google agar login berikutnya mulus.
      const updated = db.updateUser(user.id, { googleSub: profil.sub } as any);
      if (updated) user = updated;
    }

    const statusGoogle = user.status || 'active';
    if (statusGoogle !== 'active') {
      /**
       * Akun yang masih MENUNGGU PERSETUJUAN boleh memperbaiki instansi tujuan.
       *
       * Tanpa ini, pilihan "Instansi BUMD" pada tombol Google tampak tidak
       * berpengaruh untuk akun pending: server selalu membalas instansi lama,
       * sehingga pendaftar yang salah pilih tidak punya jalan keluar selain
       * meminta admin menghapus akunnya. Hanya berlaku selama status `pending`
       * (belum aktif), jadi tidak ada data instansi yang bisa dipindah sembarangan.
       */
      if (statusGoogle === 'pending') {
        const tenantIdBaru = String(req.body?.tenantId || '').trim();
        const instansiBaru = tenantIdBaru ? db.tenants.find((t) => t.id === tenantIdBaru) : undefined;
        const tenantSekarang = user.requestedTenantId || user.tenantId;
        if (instansiBaru && instansiBaru.id !== tenantSekarang) {
          const diperbarui = db.updateUser(user.id, {
            tenantId: instansiBaru.id,
            requestedTenantId: instansiBaru.id,
            requestedAt: new Date().toISOString(),
          } as any);
          if (diperbarui) user = diperbarui;
          return res.status(202).json({
            status: 'pending',
            email: user.email,
            tenantId: instansiBaru.id,
            tenantName: instansiBaru.name,
            message: `Instansi pendaftaran Anda diperbarui menjadi ${instansiBaru.name}. Akun masih menunggu persetujuan admin instansi tersebut.`,
          });
        }
      }
      const namaInstansiG = db.tenants.find((t) => t.id === (user!.requestedTenantId || user!.tenantId))?.name;
      return res.status(403).json({
        error:
          statusGoogle === 'pending'
            ? `Akun Google Anda terdaftar dan masih menunggu persetujuan admin ${namaInstansiG || 'instansi'}.`
            : 'Pendaftaran akun Anda ditolak. Hubungi admin instansi untuk informasi lebih lanjut.',
        kode: statusGoogle === 'pending' ? 'PENDING_APPROVAL' : 'ACCOUNT_REJECTED',
        email: user!.email,
        tenantName: namaInstansiG || null,
        tenantId: user!.requestedTenantId || user!.tenantId || null,
      });
    }

    return terbitkanSesi(res, user, 'Google Sign-In');
  });

  /**
   * Ganti kata sandi sendiri (wajib untuk sandi bawaan/sementara).
   * Perlu kata sandi lama → cookie yang dicuri tidak cukup untuk mengambil alih akun.
   */
  app.post('/api/auth/ganti-password', async (req: Request, res: Response) => {
    const session = verifySession(parseSessionCookie(req));
    if (!session) {
      return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login ulang.' });
    }
    const lama = String(req.body?.lama || '');
    const baru = String(req.body?.baru || '');
    const ulangi = req.body?.ulangi === undefined ? baru : String(req.body.ulangi);

    if (baru !== ulangi) {
      return res.status(400).json({ error: 'Kata sandi baru dan ulangannya tidak sama.' });
    }
    const user = db.users.find((u) => u.id === session.userId);
    const hash = user ? db.credentials[user.id] : undefined;
    if (!user || !hash) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    if (!verifyPassword(lama, hash)) {
      return res.status(401).json({ error: 'Kata sandi lama tidak sesuai.' });
    }
    const masalah = masalahKataSandi(baru, user.email);
    if (masalah) return res.status(400).json({ error: masalah });
    if (lama === baru) {
      return res.status(400).json({ error: 'Kata sandi baru harus berbeda dari yang lama.' });
    }

    db.setUserPassword(user.id, hashPassword(baru), false);

    // Sesi ditandatangani ulang tanpa penanda wajib-ganti.
    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      mustChange: false,
    });
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    res.json({ ok: true, user: safeUser(user) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const session = verifySession(parseSessionCookie(req));
    if (session) {
      const user = db.users.find((u) => u.id === session.userId);
      if (user) {
      }
    }
    res.setHeader('Set-Cookie', clearSessionCookieHeader());
    res.json({ success: true, message: 'Sesi berhasil diakhiri.' });
  });

  app.get('/api/me', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Akun tidak ditemukan.' });
    }
    res.json(safeUser(user));
  });

  // ================= CATALOG ROUTES =================
  app.get('/api/widget-catalog', (req: Request, res: Response) => {
    const sector = req.query.sector as BumdSector | undefined;
    if (sector) {
      const filtered = WIDGET_CATALOG.filter(
        (p) => p.sektor.includes(sector) || p.sektor.includes('universal')
      );
      return res.json(filtered);
    }
    res.json(WIDGET_CATALOG);
  });

  // ================= DASHBOARD CRUD ROUTES =================
  app.get('/api/dashboards', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const dashboards = db.getDashboards(effectiveTenantId(req, session));
    res.json(dashboards);
  });

  app.get('/api/dashboards/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const dashboard = db.getDashboardById(req.params.id, effectiveTenantId(req, session));
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan atau akses ditolak.' });
    }
    res.json(dashboard);
  });

  /**
   * GERBANG TEMPLATE CHART.
   *
   * Aturan produk: chart di kanvas selalu diambil dari Template Chart. Setiap
   * widget yang disimpan lewat API dilewatkan di sini:
   *  - sudah punya chart bawaan yang sah → dibiarkan;
   *  - belum cocok dengan chart bawaan mana pun → dibuatkan entri Template Chart
   *    baru (`kustom-…`) yang menunjuk chart bawaan terdekat, lalu widget memakai
   *    entri itu (`chartId` = entri, `chartDasar` = chart penggambarnya).
   * Entri baru disimpan di `systemConfig.chartKatalogKustom` supaya muncul di
   * halaman Template Chart dan dipakai ulang oleh bentuk data yang sama.
   */
  const katalogKustom = (): ChartKustom[] => {
    const daftar = (db.systemConfig as any).chartKatalogKustom;
    return Array.isArray(daftar) ? (daftar as ChartKustom[]) : [];
  };

  const pastikanKatalogWidget = (
    widgets: any[],
    session: SessionPayload,
    tenantId: string
  ): { widgets: any[]; baru: ChartKustom[] } => {
    if (!Array.isArray(widgets) || widgets.length === 0) return { widgets: widgets || [], baru: [] };
    const hasil = pastikanChartKatalog(widgets as WidgetSpec[], { ada: katalogKustom() });
    if (hasil.baru.length > 0) {
      db.updateSystemConfig({ chartKatalogKustom: [...katalogKustom(), ...hasil.baru] } as any);
      for (const entri of hasil.baru) {
      }
    }
    return hasil;
  };

  /** Entri Template Chart buatan sendiri — ditampilkan bersama chart bawaan. */
  app.get('/api/chart/kustom', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    res.json(katalogKustom());
  });

  app.post('/api/dashboards', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const chart = pastikanKatalogWidget(req.body.widgets || [], session, tenantId);
    const newDash: Dashboard = {
      id: `dash-${Date.now()}`,
      tenantId,
      title: req.body.title || 'Dashboard Baru',
      description: req.body.description || 'Dashboard kustom BUMD',
      sector: req.body.sector || 'pdam',
      // Tema visual opsional (dipakai dashboard hasil template agar tampil sama
      // dengan pratinjau template). Tanpa tema, dashboard ikut tema aplikasi.
      ...(req.body.tema ? { tema: String(req.body.tema) } : {}),
      widgets: chart.widgets,
      globalFilters: req.body.globalFilters || {
        periode: '2026-Q1',
        unitKerja: 'Semua',
        kategori: 'Semua',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createDashboard(newDash);
    res.status(201).json(newDash);
  });

  app.patch('/api/dashboards/:id', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    // Setiap widget yang disimpan WAJIB memakai chart dari Template Chart.
    // Tanpa gerbang ini, widget dari RAG/impor bisa tersimpan tanpa `chartId` dan
    // kanvas menggambar chart internal yang tidak terdaftar di Template Chart.
    const badan = { ...req.body };
    if (Array.isArray(badan.widgets)) {
      badan.widgets = pastikanKatalogWidget(badan.widgets, session, tenantId).widgets;
    }
    const updated = db.updateDashboard(req.params.id, badan, tenantId);
    if (!updated) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    res.json(updated);
  });

  /**
   * SIAPKAN MODE PRESENTASI — generate narasi insight tiap widget lewat RAG, lalu
   * susun rencana slide, dan SIMPAN ke dashboard (`dashboard.presentasi`).
   *
   * Dipanggil sekali (bukan tiap membuka presentasi) supaya:
   *  - tidak memanggil layanan RAG berulang (mahal & lambat),
   *  - narasi bisa disunting manual dan tetap tersimpan.
   *
   * Body: { tenantId?, dashboardId?, segarkan? }
   *  - segarkan=false (default): pakai insight yang sudah ada; hanya generate
   *    widget yang BELUM punya insight.
   *  - segarkan=true: generate ulang semua (kecuali yang diedit manual).
   *
   * SSE: mengirim progres per widget agar UI menampilkan kemajuan.
   */
  app.post('/api/dashboards/:id/presentasi', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);

    const dash = db.getDashboardById(req.params.id, tenantId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    if (!dash.widgets?.length) {
      return res.status(400).json({ error: 'Dashboard ini belum punya widget untuk dipresentasikan.' });
    }

    const segarkan = req.body?.segarkan === true;
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const sector = (req.body?.sector || dash.sector || tenant?.sector || 'pdam') as BumdSector;

    // SSE: progres per widget (jumlah widget bisa belasan → generate bisa lama).
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Tanpa segarkan, widget yang sudah punya insight dipertahankan (tidak
      // dipanggil ulang) — menghemat panggilan RAG. Dengan segarkan, insight
      // dikosongkan supaya ditulis ulang dari RAG (editan manual tetap dijaga).
      const perlu = dash.widgets.map((w) =>
        segarkan && w.insightAsal !== 'manual'
          ? { ...w, insight: undefined, insightAsal: undefined }
          : !segarkan && w.insight
            ? { ...w, insightAsal: w.insightAsal || ('rag' as const) }
            : w
      );

      sendEvent('mulai', { total: perlu.length });

      const hasil = await generateInsightPresentasi(perlu, {
        sector,
        instansi: tenant?.name,
        kbId,
        rag: ragClient,
        konkurensi: 3,
        onProgres: (p) => sendEvent('progres', p),
      });

      const presentasi = { slides: hasil.slides, disusunAt: new Date().toISOString(), versi: VERSI_PRESENTASI };
      const updated = db.updateDashboard(dash.id, { widgets: hasil.widgets, presentasi }, tenantId);


      sendEvent('selesai', {
        dashboard: updated,
        jumlahSlide: hasil.slides.length,
        dariRag: hasil.dariRag,
        dariData: hasil.dariData,
        catatan: hasil.catatan,
      });
      res.end();
    } catch (err) {
      sendEvent('galat', { pesan: err instanceof Error ? err.message : 'Gagal menyiapkan presentasi.' });
      res.end();
    }
  });

  /**
   * Pakai TEMPLATE DASHBOARD dengan angka dari DOKUMEN RAG (bukan angka contoh).
   *
   * Memakai SUSUNAN kartu template, tetapi setiap kartu diisi angka NYATA dari
   * dokumen instansi. Kartu yang indikatornya tidak ada di dokumen dikosongkan
   * dengan penanda jujur — tidak ada angka contoh yang ditampilkan.
   */
  /**
   * STATUS PRATINJAU DATA ASLI satu template.
   *
   * `status`:
   *  - `siap`   → widgets berisi angka dokumen (boleh langsung ditampilkan)
   *  - `proses` → masih disiapkan; `progres` memberi tahu sudah berapa kartu
   *  - `belum`  → belum pernah disiapkan; permintaan ini akan memulainya
   *  - `gagal`  → penyiapan gagal (mis. layanan dokumen mati)
   */
  /**
   * HALAMAN 3 — KINERJA PER WILAYAH LAYANAN.
   *
   * Angkanya diurai LANGSUNG dari teks tabel dokumen (Tabel 3 Kinerja per
   * wilayah layanan), bukan dari ekstraksi model bahasa. Tujuannya supaya angka
   * yang tampil sama persis dengan dokumen dan bisa ditelusuri ke halamannya.
   * Hasilnya disimpan 10 menit supaya pindah tab tidak memanggil RAG terus.
   */
  const cacheWilayah = new Map<string, { waktu: number; data: any }>();
  /** Buang cache halaman 3 satu instansi (dipanggil saat dokumen berubah). */
  const basiikanWilayah = (tenantId: string) => {
    for (const k of [...cacheWilayah.keys()]) if (k.startsWith(`${tenantId}|`)) cacheWilayah.delete(k);
  };
  async function ambilWilayah(tenant: Tenant): Promise<any> {
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    if (!kbId) {
      return { status: 'kosong', catatan: 'Dokumen instansi belum dihubungkan.' };
    }
    const kunci = `${tenant.id}|${kbId}`;
    const ada = cacheWilayah.get(kunci);
    if (ada && Date.now() - ada.waktu < 10 * 60_000) return ada.data;

    const cari = await ragClient.cariPotongan(
      kbId,
      'kinerja per wilayah layanan pelanggan air terjual NRW pengaduan Jakarta Pusat Utara Barat Selatan Timur',
      20
    );
    const kandidat = cari.potongan.filter((p) => /Kinerja per wilayah layanan/i.test(p.isi));
    if (!kandidat.length) {
      const kosong = {
        status: 'kosong',
        catatan: 'Tabel kinerja per wilayah tidak ditemukan di dokumen instansi.',
      };
      cacheWilayah.set(kunci, { waktu: Date.now(), data: kosong });
      return kosong;
    }

    const p = kandidat[0];
    const { baris, total } = uraiTabelWilayah(p.isi);
    const catatan = uraiCatatanWilayah(p.isi);
    const data = {
      status: baris.length ? 'siap' : 'kosong',
      baris,
      total,
      catatan,
      satuanAir: 'm³',
      sumber: baris.length
        ? [
            {
              dokumen: p.docName || 'Laporan Kinerja Operasional dan Pelayanan PAM JAYA 2024',
              halaman: p.halaman,
              cuplikan: 'Tabel 3. Kinerja per wilayah layanan, 2024',
              keyakinan: 1,
            },
          ]
        : [],
    };
    cacheWilayah.set(kunci, { waktu: Date.now(), data });
    return data;
  }
  app.get('/api/templates/wilayah', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    try {
      return res.json(await ambilWilayah(tenant));
    } catch (err) {
      return res.json({ status: 'gagal', catatan: err instanceof Error ? err.message : 'Dokumen tidak bisa dibaca.' });
    }
  });

  /**
   * HALAMAN 2 TEMPLATE — angka dokumen yang belum dipakai halaman 1.
   *
   * Diambil dari data siap pakai template LAIN (sudah diekstrak dari dokumen
   * instansi), dibuang bila judulnya sudah muncul di halaman 1. Dipakai galeri
   * dan saat menyimpan dashboard, jadi isinya sama persis.
   */
  function widgetHalaman2(tenant: Tenant, template: (typeof DASHBOARD_TEMPLATES)[number], kbId: string, seed: number): any[] {
    const judulDipakai = new Set(
      template.widgets.map((w: any) => String(w.title || '').trim().toLowerCase()).filter(Boolean)
    );
    const calon: any[] = [];
    for (const t of DASHBOARD_TEMPLATES) {
      if (t.id === template.id) continue;
      const e = ambilPratinjau(tenant.id, t.id, kbId);
      if (!e || e.status !== 'siap' || !Array.isArray(e.widgets)) continue;
      calon.push(...e.widgets);
    }
    return pilihWidgetOperasional(calon, judulDipakai).map((w, i) => ({
      ...w,
      id: `tpl2-${seed}-${i + 1}`,
      grid: { ...(w.grid || {}) },
    }));
  }

  app.get('/api/templates/pratinjau', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const templateId = String(req.query.templateId || '').trim();
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return res.status(400).json({ error: 'Template tidak dikenal.' });

    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const versi = versiKbTenant(tenant, template);
    const entri = ambilPratinjau(tenant.id, template.id, kbId);
    const siap = masihBerlaku(entri, versi);

    // Belum siap dan tidak sedang diproses → mulai sekarang (di latar belakang).
    // Setelah gagal, beri jeda 2 menit sebelum mencoba lagi: tanpa jeda, tiap
    // kunjungan halaman memicu pengisian baru dan layanan dokumen makin sibuk.
    const jedaGagal = entri?.status === 'gagal' && Date.now() - (entri.selesai ?? 0) < 120_000;
    if (!siap && entri?.status !== 'proses' && !jedaGagal) {
      void siapkanTemplateTenant(tenant, template);
    }

    /**
     * HALAMAN 2 TEMPLATE — angka dokumen yang belum dipakai template ini.
     *
     * Diambil dari data siap pakai template LAIN (sudah diekstrak dari dokumen
     * instansi), dibuang bila judulnya sudah muncul di template ini. Desainnya
     * tetap desain template yang sedang dibuka; yang berbeda hanya isinya.
     */
    if (String(req.query.halaman || '1') === '2') {
      const dipakai = widgetHalaman2(tenant, template, kbId, Date.now());
      return res.json({
        templateId: template.id,
        halaman: 2,
        status: dipakai.length > 0 ? 'siap' : 'kosong',
        widgets: dipakai,
      });
    }

    return res.json({
      templateId: template.id,
      status: siap ? 'siap' : entri?.status ?? 'belum',
      progres: entri?.progres ?? { selesai: 0, total: template.widgets.length, judul: 'Menunggu…' },
      terisi: entri?.terisi ?? 0,
      kosong: entri?.kosong ?? 0,
      tertunda: entri?.tertunda ?? 0,
      total: template.widgets.length,
      selesaiPada: entri?.selesai ?? null,
      galat: entri?.galat ?? null,
      // Belum siap tapi sudah ada kartu terisi: kirim sebagian supaya tampil bertahap.
      widgets: siap ? entri!.widgets : entri?.terisi ? entri.widgets : null,
      sebagian: !siap && !!entri?.terisi,
    });
  });

  /** Minta penyiapan ulang (mis. setelah dokumen berubah atau pengguna ingin coba lagi). */
  app.post('/api/templates/siapkan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    const templateId = String(req.body?.templateId || '').trim();
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return res.status(400).json({ error: 'Template tidak dikenal.' });

    basiikanTenant(tenant.id);
    basiikanWilayah(tenant.id);
    void siapkanTemplateTenant(tenant, template);
    return res.status(202).json({ status: 'proses' });
  });

  /** Ringkasan status semua template satu instansi (badge di galeri). */
  /**
   * Segarkan pratinjau template atas permintaan pengguna. Dipakai tombol
   * "Perbarui" di halaman template: dokumen bisa sudah berubah tanpa unggahan
   * baru, dan pengguna tidak perlu menunggu penanda versi bergeser sendiri.
   */
  app.post('/api/templates/segarkan', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const segar = await db.updateTenant(tenant.id, { kbTersinkronPada: new Date().toISOString() });
    if (!segar) return res.status(500).json({ error: 'Gagal menandai pembaruan dokumen.' });
    for (const tpl of DASHBOARD_TEMPLATES.filter((x) => !x.bagian && !x.legacy)) void siapkanTemplateTenant(segar, tpl);
    return res.json({ ok: true, template: DASHBOARD_TEMPLATES.map((t) => t.id) });
  });

  app.get('/api/templates/status', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const versi = versiKbTenant(tenant);
    const entri = daftarPratinjau(tenant.id);
    const sekarang = Date.now();
    const daftar = DASHBOARD_TEMPLATES.filter((t) => !t.legacy);
    const entriDari = (t: any) => entri.find((x) => x.templateId === t.id && x.kbId === kbId);
    const siapDari = (t: any) => masihBerlaku(entriDari(t) ?? null, versiKbTenant(tenant, t));

    /**
     * PERKIRAAN KAPAN KARTU TERISI.
     *
     * Laju (ms per kartu) diukur dari pengisian yang sudah selesai, atau dari
     * yang sedang berjalan bila belum ada riwayat. Template galeri biasa diisi
     * BERURUTAN oleh `hangatkanTemplateTenant`, jadi template yang menunggu
     * giliran ikut menanggung sisa kartu template di depannya. Template rapat
     * bagian tidak masuk antrean itu: ia mulai diisi saat dibuka.
     */
    const lajuSelesai = entri
      .filter((x) => x.kbId === kbId && x.selesai && x.mulai && x.progres?.total > 0 && x.status !== 'gagal')
      .map((x) => (x.selesai! - x.mulai) / x.progres.total)
      .filter((v) => v > 0);
    const berjalanKini = entri.find((x) => x.kbId === kbId && x.status === 'proses' && x.progres?.selesai >= 3);
    const laju = lajuSelesai.length
      ? lajuSelesai.reduce((a, b) => a + b, 0) / lajuSelesai.length
      : berjalanKini
        ? (sekarang - berjalanKini.mulai) / berjalanKini.progres.selesai
        : 25_000;
    const sisaKartu = (t: any): number => {
      const e = entriDari(t);
      if (siapDari(t)) return 0;
      if (e?.status === 'proses' && e.progres?.total > 0) return Math.max(0, e.progres.total - e.progres.selesai);
      return t.widgets.length;
    };
    const perkiraan = new Map<string, number>();
    let kumulatif = 0;
    for (const t of daftar.filter((x) => !x.bagian)) {
      const sisa = sisaKartu(t);
      if (sisa === 0) continue;
      kumulatif += sisa * laju;
      perkiraan.set(t.id, kumulatif);
    }
    const perkiraanSemuaMs = kumulatif > 0 ? Math.round(kumulatif) : null;
    for (const t of daftar.filter((x) => x.bagian)) {
      const sisa = sisaKartu(t);
      if (sisa > 0) perkiraan.set(t.id, sisa * laju);
    }

    return res.json({
      perkiraanSemuaMs,
      templates: daftar.map((t) => {
        const e = entriDari(t);
        const siap = siapDari(t);
        const p = perkiraan.get(t.id);
        return {
          // Sisa waktu (ms) sampai semua kartu template ini berisi data asli.
          perkiraanMs: siap || p == null ? null : Math.round(p),
          // true = masih menunggu template lain selesai lebih dulu.
          menungguGiliran: !siap && e?.status !== 'proses' && !t.bagian,
          templateId: t.id,
          status: siap ? 'siap' : e?.status ?? 'belum',
          terisi: e?.terisi ?? 0,
          kosong: e?.kosong ?? 0,
          tertunda: e?.tertunda ?? 0,
          total: t.widgets.length,
          progres: e?.progres ?? null,
          // Dipakai UI untuk perkiraan sisa waktu pengisian.
          mulaiPada: e?.status === 'proses' ? e.mulai : null,
          selesaiPada: e?.selesai ?? null,
        };
      }),
    });
  });

  app.post('/api/dashboards/dari-template', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const templateId = String(req.body?.templateId || '').trim();
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return res.status(400).json({ error: 'Template tidak dikenal.' });

    /**
     * GAYA TERPISAH DARI TEMPLATE: galeri mengirim gaya Template Chart yang
     * dipilih pengguna (mis. `koran`). Susunan kartu tetap milik template,
     * sedangkan desain/warna chart disimpan di dashboard sebagai `gaya.desain`.
     * Gaya tak dikenal diabaikan (dashboard memakai gaya bawaan template).
     */
    const gayaDiminta = String(req.body?.gaya || '').trim();
    const gaya: Varian | undefined = VARIAN.includes(gayaDiminta as Varian)
      ? (gayaDiminta as Varian)
      : undefined;

    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const versi = versiKbTenant(tenant, template);
    const entri = ambilPratinjau(tenant.id, template.id, kbId);

    /**
     * Data template sudah disiapkan lebih dulu (lihat `hangatkanTemplateTenant`).
     * Kalau belum siap, jangan menahan pengguna 5–15 menit: siapkan di latar
     * belakang dan beri tahu UI bahwa datanya masih loading.
     */
    if (!masihBerlaku(entri, versi)) {
      if (entri?.status !== 'proses') void siapkanTemplateTenant(tenant, template);
      return res.status(409).json({
        error: 'Data template masih disiapkan dari dokumen. Coba lagi sebentar lagi.',
        status: entri?.status ?? 'belum',
        progres: entri?.progres ?? null,
      });
    }

    /**
     * ENTRI "SIAP" TAPI SELURUH KARTU KOSONG.
     *
     * Dokumen instansi bisa tidak memuat satu pun indikator template (mis.
     * template outsourcing dibuka di instansi yang dokumennya soal pendidikan).
     * Tanpa gerbang ini pengguna tetap bisa menyimpan dashboard berisi 58 kartu
     * "tidak ditemukan" — terlihat seperti fitur rusak. Lebih jujur menolak dan
     * meminta dokumen dilengkapi, sama seperti saat data belum disiapkan.
     */
    /**
     * ENTRI YANG MASIH ADA KARTU TERTUNDA.
     *
     * Kartu tertunda = belum sempat diisi (waktu/layanan), bukan "tidak ada di
     * dokumen". Dulu entri seperti ini dianggap siap dan penerapannya menghasilkan
     * dashboard dengan puluhan kartu kosong. Sekarang ditolak dengan progres yang
     * jujur, dan pengisian lanjutan sudah berjalan di latar.
     */
    if ((entri!.tertunda ?? 0) > 0) {
      return res.status(409).json({
        error: `Data template belum lengkap: ${entri!.terisi} dari ${entri!.widgets.length} kartu terisi, ${entri!.tertunda} sedang diisi dari dokumen. Coba lagi beberapa saat.`,
        status: 'proses',
        progres: entri!.progres ?? null,
        terisi: entri!.terisi,
        tertunda: entri!.tertunda,
        total: entri!.widgets.length,
      });
    }

    if (!entri!.widgets.some((w) => !w.dataKosong)) {
      return res.status(409).json({
        error: 'Dokumen instansi belum memuat angka untuk template ini. Lengkapi dokumen lalu coba lagi.',
        status: 'kosong',
        progres: entri!.progres ?? null,
      });
    }

    // Salin widget siap pakai dengan id baru; definisi template tidak boleh berubah.
    const seed = Date.now();
    const widgets = entri!.widgets.map((w, i) => ({
      ...w,
      id: `tpl-${template.id}-${seed}-${i + 1}`,
      grid: { ...w.grid },
    }));

    // Judul dashboard: buang penanda "(Contoh)" karena angkanya dari dokumen.
    const judulBersih = template.judulDashboard.replace(/\s*\(Contoh\)\s*/i, '').trim();

    /**
     * TIGA HALAMAN, sama persis dengan galeri: halaman 1 ringkasan, halaman 2
     * operasional & pelayanan (angka dokumen yang belum dipakai halaman 1),
     * halaman 3 kinerja per wilayah. Tiap halaman menyimpan replika desainnya
     * sendiri sehingga kanvas menggambar tampilan yang sama dengan pratinjau.
     */
    const nilaiHal1 =
      template.id === 'tpl-analitik'
        ? nilaiAnalitikDariWidgets(widgets)
        : template.id === 'tpl-trafik'
          ? nilaiTrafikDariWidgets(widgets)
          : nilaiDariWidgets(widgets);
    // Template rapat bagian tidak memakai halaman operasional & wilayah Pijar.
    const widgets2 = template.bagian ? [] : widgetHalaman2(tenant, template, kbId, seed);
    let wilayah: any = null;
    try {
      wilayah = template.bagian ? null : await ambilWilayah(tenant);
    } catch {
      wilayah = null;
    }
    const nilaiHal3 = {
      baris: Array.isArray(wilayah?.baris) ? wilayah.baris : [],
      total: wilayah?.total ?? null,
      catatan: Array.isArray(wilayah?.catatan) ? wilayah.catatan : [],
      satuanAir: wilayah?.satuanAir || 'm³',
      sumber: Array.isArray(wilayah?.sumber) ? wilayah.sumber : [],
    };
    // Kartu template memakai chart katalog (chartId) seperti dashboard asisten;
    // dulu kartu template lama tersimpan tanpa chartId sama sekali.
    const denganKatalog = (ws: WidgetSpec[]) =>
      ws.map((w) => {
        if (w.chartId) return w;
        const pilih = pilihChart(w);
        // Tipe kartu tidak diubah: angka replika (nilaiDariWidgets) dibaca dari kartu yang sama.
        return pilih.chartId && pilih.type === w.type ? { ...w, chartId: pilih.chartId } : w;
      });
    const halamanMentah = template.bagian
      ? // Satu halaman dashboard = satu kelompok slide deck, desainnya `DashboardBagian`.
        halamanTemplateBagian(template, widgets).map((h, i) => ({
          id: `hlm-${i + 1}`,
          judul: h.judul,
          widgets: h.widgets,
          replika: { templateId: `${template.id}#${i + 1}`, nilai: {} },
        }))
      : [
      { id: 'hlm-1', judul: 'Ringkasan', widgets, replika: { templateId: template.id, nilai: nilaiHal1 } },
      {
        id: 'hlm-2',
        judul: 'Operasional & Pelayanan',
        widgets: widgets2,
        replika: { templateId: `${template.id}#2`, nilai: nilaiOperasionalDariWidgets(widgets2) },
      },
      {
        id: 'hlm-3',
        judul: 'Kinerja per Wilayah',
        // Angka wilayah yang sama dengan replika, sebagai grafik: halaman ini dulu tanpa kartu.
        widgets: widgetWilayah(nilaiHal3.baris, nilaiHal3.sumber, `tpl-${template.id}-${seed}-wil`),
        replika: { templateId: `${template.id}#3`, nilai: nilaiHal3 },
      },
    ];
    const halaman = halamanMentah.map((h) => ({ ...h, widgets: denganKatalog(h.widgets) }));

    const newDash: Dashboard = {
      id: `dash-${Date.now()}`,
      tenantId,
      title: judulBersih,
      description: template.deskripsiDashboard.replace(
        /Angka bersifat contoh[^.]*\./i,
        'Angka diambil dari dokumen resmi instansi; kartu yang indikatornya belum ada di dokumen ditandai kosong.'
      ),
      sector: tenant.sector,
      // Tema template dibawa ke dashboard nyata: latar, warna kartu, dan aksen
      // harus sama dengan pratinjau yang dilihat pengguna.
      // Template bagian (gaya Korporat) ikut mode terang/gelap aplikasi, tanpa tema kanvas.
      tema: template.bagian ? undefined : template.tema,
      // Gaya Template Chart yang dipilih pengguna, DIPISAH dari template:
      // susunan kartu milik template, desain/warna chart milik pilihan ini.
      ...(gaya ? { gaya: { desain: gaya } } : {}),
      // Angka dokumen dipetakan ke slot replika template: dipakai kanvas
      // dashboard nyata supaya desainnya identik dengan pratinjau data asli.
      replika: halaman[0].replika,
      widgets: halaman[0]?.widgets ?? widgets,
      halaman,
      halamanAktifId: 'hlm-1',
      globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createDashboard(newDash);

    return res.status(201).json({
      dashboard: newDash,
      terisi: entri!.terisi,
      kosong: entri!.kosong,
      total: widgets.length,
      catatan: entri!.catatan,
      kedaluwarsa: false,
    });
  });

  /**
   * Progres pengisian template (polling dari UI).
   *
   * Pengisian bisa 5–15 menit karena kartu yang gagal (429/timeout) diulang
   * sampai terisi. Tanpa endpoint ini halaman hanya menampilkan detik berjalan
   * tanpa tahu sudah berapa kartu yang berisi angka.
   */
  app.get('/api/dashboards/dari-template/progres/:jobId', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    // Buang entri lama supaya peta tidak tumbuh tanpa batas.
    for (const [id, p] of progresTemplate) {
      if (Date.now() - p.mulai > 3_600_000) progresTemplate.delete(id);
    }
    const p = progresTemplate.get(String(req.params.jobId || ''));
    if (!p) return res.json({ aktif: false });
    return res.json({
      aktif: true,
      selesai: p.selesai,
      total: p.total,
      terisi: p.terisi,
      judul: p.judul,
      detik: Math.round((Date.now() - p.mulai) / 1000),
    });
  });

  /**
   * Tambahkan kartu ke kanvas dari salah satu saran chart di percakapan.
   *
   * Pratinjau di klien hanya memperlihatkan BENTUK; angka baru diambil dari
   * dokumen instansi di sini, saat pengguna menekan "Oke, tambahkan". Kalau
   * dokumen tidak memuat indikatornya, kartu tidak dipasang dan pengguna diberi
   * tahu dengan kalimat biasa (tanpa istilah teknis).
   */
  app.post('/api/dashboards/:id/widget-dari-saran', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const dash = db.getDashboardById(req.params.id, tenantId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });

    const indikator = String(req.body?.indikator || '').trim();
    const tipe = String(req.body?.tipe || 'bar').trim();
    if (!indikator) return res.status(400).json({ error: 'Sebutkan dulu indikator yang ingin ditampilkan.' });

    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    if (db.systemConfig.ragProvider === 'http' && !kbId) {
      return res.status(409).json({
        error: `Instansi "${tenant.name}" belum punya basis dokumen sendiri, jadi angkanya belum bisa diambil. Hubungi admin untuk menautkannya.`,
      });
    }

    try {
      const hasil = await ragClient.ambilDataWidget(
        `Ambil angka indikator "${indikator}" dari dokumen resmi instansi ini. ` +
          `Gunakan angka yang BENAR-BENAR ada di dokumen beserta sumbernya (nama dokumen & halaman). ` +
          `Kalau indikator ini tidak ada di dokumen, katakan tidak ada — jangan mengarang.`,
        tenant.sector,
        tipe,
        tenant.name,
        kbId
      );

      if (!hasil || !hasil.data) {
        return res.status(422).json({
          error: `Dokumen instansi ini belum memuat angka untuk "${indikator}".`,
          alasan: hasil?.alasan || null,
        });
      }

      const d = hasil.data as any;
      const widgetBaru: WidgetSpec = {
        id: `w-saran-${Date.now()}`,
        type: d.type || tipe,
        title: d.title || hasil.judul || indikator,
        subtitle: d.subtitle,
        category: d.category || 'Operasional',
        confidence: 'sumber',
        grid: d.grid || { x: 0, y: 0, w: 6, h: 4 },
        kpi: d.kpi,
        chart: d.chart,
        table: d.table,
        narasi: d.narasi,
        citations: d.citations || [],
        unitKerja: d.unitKerja,
        periode: d.periode,
        lastUpdated: new Date().toISOString(),
      } as WidgetSpec;

      // Jangan pasang kartu kembar: kalau isinya sudah ada di kanvas, beri tahu.
      const kembar =
        dash.widgets.find((w) => kunciKembarWidget(w) === kunciKembarWidget(widgetBaru)) ||
        dash.widgets.find((w) => judulWidgetMirip(w.title, widgetBaru.title));
      if (kembar) {
        return res.status(409).json({
          error: `Kartu "${kembar.title}" sudah ada di kanvas dengan isi yang sama.`,
        });
      }

      const widgets = [widgetBaru, ...dash.widgets];
      db.updateDashboard(dash.id, { widgets }, tenantId);

      return res.status(201).json({ dashboard: { ...dash, widgets }, widget: widgetBaru });
    } catch (err) {
      console.error('[saran] gagal menambah kartu dari dokumen:', jelaskanError(err));
      return res.status(503).json({
        error: 'Layanan dokumen sedang tidak tersedia. Coba lagi beberapa saat lagi.',
      });
    }
  });

  app.delete('/api/dashboards/:id', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const success = db.deleteDashboard(req.params.id, tenantId);
    if (!success) {
      return res.status(404).json({ error: 'Gagal menghapus dashboard.' });
    }
    res.json({ success: true });
  });

  /**
   * TAMBAH HALAMAN — mengisi halaman baru dengan angka dokumen yang BELUM dipakai
   * halaman lain.
   *
   * Sumbernya widget yang sudah disiapkan dari dokumen untuk template lain
   * (`ambilPratinjau`), jadi tidak ada panggilan RAG baru dan tidak ada angka
   * contoh. Widget dibuang bila indikatornya (presetId) atau judulnya sudah
   * dipakai halaman sebelumnya. Desain halaman baru mengikuti template dashboard
   * ini, hanya isinya yang berbeda.
   */
  app.post('/api/dashboards/:id/halaman', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const dash = db.getDashboardById(req.params.id, tenantId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan atau akses ditolak.' });

    const semua = daftarHalaman(dash);
    const presetDipakai = new Set<string>();
    const judulDipakai = new Set<string>();
    for (const h of semua) {
      for (const w of h.widgets || []) {
        if (w.presetId) presetDipakai.add(w.presetId);
        const judul = String(w.title || '').trim().toLowerCase();
        if (judul) judulDipakai.add(judul);
      }
    }

    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const templateAsal = dash.replika?.templateId;
    const calon: any[] = [];
    for (const t of DASHBOARD_TEMPLATES) {
      if (t.id === templateAsal) continue;
      const entri = ambilPratinjau(tenant.id, t.id, kbId);
      if (!entri || entri.status !== 'siap' || !Array.isArray(entri.widgets)) continue;
      calon.push(...entri.widgets);
    }

    const seed = Date.now();
    const dipakaiBaru = pilihWidgetOperasional(calon, judulDipakai).map((w, i) => ({
      ...w,
      id: `hlm-${seed}-${i + 1}`,
      grid: { ...(w.grid || {}) },
    }));

    const acuan = semua[0];
    const halamanBaru = {
      id: `hlm-${seed}`,
      judul: String(req.body?.judul || '').trim() || `Halaman ${semua.length + 1}`,
      widgets: dipakaiBaru,
      // Desain sama dengan halaman pertama, angka dihitung dari widget halaman ini.
      replika: templateAsal ? { templateId: templateAsal, nilai: {} } : undefined,
      tataLetak: acuan?.tataLetak ? { ...acuan.tataLetak } : undefined,
      globalFilters: acuan?.globalFilters ? { ...acuan.globalFilters } : undefined,
    };

    const hasil = db.updateDashboard(
      dash.id,
      { halaman: [...semua, halamanBaru], halamanAktifId: halamanBaru.id },
      tenantId
    );

    res.json({
      dashboard: hasil,
      halaman: halamanBaru,
      jumlahWidget: dipakaiBaru.length,
      peringatan:
        dipakaiBaru.length === 0
          ? 'Tidak ada angka dokumen lain yang belum dipakai. Halaman dibuat kosong.'
          : undefined,
    });
  });

  app.post('/api/dashboards/:id/duplicate', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const dup = db.duplicateDashboard(req.params.id, effectiveTenantId(req, session));
    if (!dup) {
      return res.status(404).json({ error: 'Dashboard sumber tidak ditemukan.' });
    }
    res.json(dup);
  });

  // ================= RIWAYAT CHAT (satu chat per dashboard) =================
  // Riwayat menempel pada dashboard-nya dan dibuat MALAS saat dashboard pertama
  // kali dibuka — dashboard lama tidak perlu migrasi data apa pun.
  app.get('/api/dashboards/:id/chat', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const dashboard = db.getDashboardById(req.params.id, tenantId);
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan atau akses ditolak.' });
    }
    const chat = db.ensureChatForDashboard(dashboard.id, tenantId, session.userId, dashboard.title);
    res.json({ chat, dashboard });
  });

  // Riwayat chat UMUM (dipakai saat belum ada dashboard terbuka). Tanpa ini,
  // pertanyaan bebas tidak tersimpan dan riwayat tampak "hilang" saat panel dibuka lagi.
  app.get('/api/chat/umum', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const chat = db.ensureGeneralChat(tenantId, session.userId);
    res.json({ chat });
  });

  // Ringkasan (tanpa isi pesan) — untuk indikator riwayat di kartu dashboard.
  app.get('/api/chats', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const ringkas = db.getChats(effectiveTenantId(req, session)).map((c) => ({
      id: c.id,
      dashboardId: c.dashboardId,
      title: c.title,
      messageCount: c.messages.length,
      updatedAt: c.updatedAt,
    }));
    res.json(ringkas);
  });

  app.patch('/api/chats/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'Judul chat wajib diisi.' });
    const updated = db.updateChat(req.params.id, { title }, effectiveTenantId(req, session));
    if (!updated) return res.status(404).json({ error: 'Chat tidak ditemukan.' });
    res.json(updated);
  });

  // Hapus riwayat chat SAJA — dashboard-nya sengaja dibiarkan hidup.
  app.delete('/api/chats/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const ok = db.deleteChat(req.params.id, effectiveTenantId(req, session));
    if (!ok) return res.status(404).json({ error: 'Chat tidak ditemukan.' });
    res.json({ success: true });
  });

  // ================= KETERSEDIAAN PRESET KATALOG =================
  // Menjawab dari cache hasil pemeriksaan NYATA ke dokumen instansi yang sedang
  // dibuka, sekaligus memulai pemeriksaan latar untuk preset yang belum diperiksa.
  // Dipakai katalog "Tambah Widget" agar hanya preset yang bisa diisi yang tampil.
  app.get('/api/widgets/ketersediaan', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';

    // Pemeriksaan atas permintaan: dipakai saat pengguna berganti tipe chart
    // pada satu kartu, supaya tipe itu pun dinilai dengan dokumen yang sama.
    const mintaan = String(req.query.periksa || '').trim();
    if (mintaan && kbId) {
      const pasangan = mintaan
        .split(',')
        .map((s) => s.split(':'))
        .filter((p) => p[0])
        .slice(0, 3);
      for (const [presetId, tipe] of pasangan) {
        try {
          await pemeriksaKetersediaan.periksaPasangan(tenant, kbId, presetId);
        } catch (err) {
          console.error('[ketersediaan] periksaPasangan gagal:', err);
        }
      }
    }

    res.json(pemeriksaKetersediaan.ringkas(tenant, kbId));
  });

  // Semua angka dokumen untuk katalog preset, diambil SEKALIGUS.
  // Sumbernya catatan ketersediaan yang sudah diverifikasi saat katalog dibuka,
  // jadi tidak ada panggilan RAG baru dan tidak ada angka contoh.
  app.get('/api/widgets/data-katalog', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';

    const data: Record<string, unknown> = {};
    for (const preset of WIDGET_CATALOG) {
      if (!preset.sektor.includes(tenant.sector) && !preset.sektor.includes('universal')) continue;
      const daftarTipe = preset.tipeChart?.length ? preset.tipeChart : ['kpi'];
      for (const tipe of daftarTipe) {
        const catatan = kbId
          ? pemeriksaKetersediaan.ambilDariCache(tenant.id, kbId, preset.id, tipe)
          : null;
        if (catatan?.data) data[`${preset.id}|${tipe}`] = catatan.data;
      }
    }

    res.json({ total: Object.keys(data).length, data });
  });

  // ================= CHAT & SSE STREAMING ROUTE =================
  // Ambil data NYATA satu indikator untuk widget dari katalog preset.
  // Tidak ada angka contoh: kalau dokumen tidak memuat indikatornya, balas 502.
  app.post('/api/widgets/ambil-data', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const { query, tipe } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length < 10) {
      return res.status(400).json({ error: 'Kueri indikator terlalu pendek (minimal 10 karakter).' });
    }
    // Validasi tipe SEBELUM memanggil RAG. Tanpa ini, tipe ngawur (mis. "grafik" atau
    // "tabel") diteruskan ke gerbang bentuk dan ditolak dengan pesan "bukan berbentuk
    // grafik" — menyesatkan, karena masalahnya nama tipe yang tidak dikenal.
    const TIPE_WIDGET_SAH = [...TIPE_SERI, 'kpi', 'gauge', 'bullet-target', 'table', 'narasi'];
    if (tipe !== undefined && !TIPE_WIDGET_SAH.includes(String(tipe))) {
      return res.status(400).json({
        error: `Tipe widget "${String(tipe)}" tidak dikenal.`,
        tipeSah: TIPE_WIDGET_SAH,
      });
    }

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const sector = (req.body.sector || tenant?.sector || 'universal') as BumdSector;
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const mulai = Date.now();

    // Kalau preset ini sudah diverifikasi untuk instansi ini, pakai hasil itu:
    // angka yang masuk ke dashboard sama persis dengan yang ada di katalog.
    const presetId = typeof req.body?.presetId === 'string' ? req.body.presetId.trim() : '';
    const dariCache =
      presetId && tenant
        ? pemeriksaKetersediaan.ambilDariCache(tenant.id, kbId, presetId, String(tipe || 'kpi'))
        : null;
    if (dariCache) {
      return res.json({
        widget: dariCache.data,
        judul: dariCache.judul,
        deskripsi: dariCache.deskripsi,
        sector,
        dariCache: true,
        latencyMs: Date.now() - mulai,
      });
    }

    try {
      const hasil = await ragClient.ambilDataWidget(
        String(query).trim(),
        sector,
        String(tipe || 'kpi'),
        tenant?.name,
        kbId
      );
      if (!hasil) {
        return res.status(502).json({
          error:
            'Dokumen resmi tidak memuat indikator ini, atau layanan RAG tidak menjawab. Tidak ada angka contoh yang ditambahkan.',
        });
      }
      // Data ADA tetapi tipe yang dipilih tidak bisa dibuat dari bentuk datanya
      // (mis. peta tanpa rincian wilayah). Katakan apa adanya.
      if (!hasil.data) {
        return res.status(409).json({
          error: hasil.alasan || 'Tipe tampilan ini tidak bisa dibuat dari data dokumen ini.',
        });
      }
      return res.json({
        widget: hasil.data,
        judul: hasil.judul,
        deskripsi: hasil.deskripsi,
        sector,
        latencyMs: Date.now() - mulai,
      });
    } catch (err) {
      return res.status(500).json({ error: jelaskanError(err) });
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const { prompt, activeDashboardId } = req.body;
    // Dashboard milik chat ini. `activeDashboardId` lama tetap didukung sebagai alias.
    const dashboardId: string | undefined = req.body.dashboardId || activeDashboardId;
    const tenantId = effectiveTenantId(req, session);
    const tenantChat = db.tenants.find((t) => t.id === tenantId);
    // Sektor ikut instansi aktif; 'pdam' hanya jaring terakhir kalau tenant tak dikenal.
    const sector = (req.body.sector || tenantChat?.sector || 'pdam') as BumdSector;
    // KB milik instansi aktif — dipakai SEMUA jalur (QA bebas maupun generate),
    // supaya jawaban tidak pernah diambil dari dokumen instansi lain.
    const kbChat = kbUntukInstansi(tenantChat, db.systemConfig.ragKnowledgeBaseId);

    /**
     * Isi tabel dokumen spreadsheet: berkas asli di repositori bila ada (semua
     * baris), potongan teks basis dokumen bila tidak.
     */
    const bacaLembarDokumen = async (namaDokumen: string): Promise<SumberLembar | null> => {
      // 1. Berkas asli di repositori: semua baris terbaca.
      try {
        const { organizationId } = await konteksBerkas(req, session);
        if (organizationId) {
          const daftar = await klienKms().daftarBerkas(organizationId);
          const cocok = daftar.find((b: any) => normalJudul(b?.title || b?.fileName || '') === normalJudul(namaDokumen));
          if (cocok?.id) {
            const { isi } = await klienKms().ambilIsiBerkas(String(cocok.id), 'download');
            return { jenis: 'berkas' as const, lembar: lembarDariBerkas(isi), lengkap: true };
          }
        }
      } catch (err: any) {
        console.warn('[chat] berkas asli tidak bisa diambil:', err?.message || err);
      }
      // 2. Potongan teks basis dokumen.
      const kb = kbUntukInstansi(tenantChat, db.systemConfig.ragKnowledgeBaseId) || '';
      if (!kb) return null;
      const dok = (await ragClient.daftarDokumen(kb).catch(() => null))?.dokumen.find((d) => d.nama === namaDokumen);
      const potongan = await kumpulkanPotonganLembar(
        async (q) => (await ragClient.cariPotongan(kb, q, 50)).potongan.map((p) => ({ docName: p.docName, isi: p.isi })),
        namaDokumen,
        { targetPotongan: dok?.potongan }
      );
      return potongan.length ? { jenis: 'potongan' as const, lembar: lembarDariPotongan(potongan), lengkap: false } : null;
    };

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt wajib disertakan.' });
    }

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // Generasi dashboard bisa berjalan beberapa menit. Tanpa denyut, koneksi
    // yang menganggur lama bisa diputus browser/proxy sehingga balasan hilang
    // di tengah jalan padahal server sudah selesai.
    const denyut = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* koneksi sudah tertutup */
      }
    }, 15000);
    res.on('close', () => clearInterval(denyut));

    // Dipakai juga oleh `catch` di bawah: kegagalan harus tetap meninggalkan
    // balasan di riwayat, bukan pertanyaan yang menggantung.
    let catatAsisten: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void = () => {};

    try {
      const lower = prompt.toLowerCase();
      const activeDash = dashboardId ? db.getDashboardById(dashboardId, tenantId) : undefined;

      // Riwayat menempel pada dashboard-nya; dibuat kalau belum ada (lazy).
      // Kalau BELUM ada dashboard terbuka, pakai chat UMUM supaya pertanyaan tetap
      // tersimpan (dulu: tidak disimpan sama sekali → riwayat tampak hilang).
      let chat = activeDash
        ? db.ensureChatForDashboard(activeDash.id, tenantId, session.userId, activeDash.title)
        : db.ensureGeneralChat(tenantId, session.userId);
      let pesanUserTercatat = false;
      const pesanBaru = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const simpan = (id: string) =>
          db.addChatMessage(
            id,
            {
              ...msg,
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
            },
            tenantId
          );
        const buatChat = () =>
          activeDash
            ? db.ensureChatForDashboard(activeDash.id, tenantId, session.userId, activeDash.title)
            : db.ensureGeneralChat(tenantId, session.userId);
        if (!chat) chat = buatChat();
        if (!chat) {
          console.error('[chat] tidak ada chat untuk menyimpan pesan — pesan dibuang:', msg.sender);
          return;
        }
        try {
          if (simpan(chat.id)) return;
          // Chat hilang dari memori (mis. tersinkron ulang dari tabel oleh proses
          // sinkron 30 dtk) -> buat lagi lalu simpan. Dulu pesan DIBUANG diam-diam
          // sehingga balasan asisten lenyap dari riwayat padahal sudah tampil.
          chat = buatChat();
          if (chat && simpan(chat.id)) {
            console.warn('[chat] chat tidak ditemukan saat menyimpan; dibuat ulang:', chat.id);
            return;
          }
          console.error('[chat] pesan gagal disimpan:', msg.sender);
        } catch (err: any) {
          console.error('[chat] galat saat menyimpan pesan:', err?.message || err);
        }
      };
      const catatPesanUser = () => {
        if (pesanUserTercatat) return;
        pesanUserTercatat = true;
        pesanBaru({ sender: 'user', text: prompt });
      };
      /** Balasan asisten — urutannya dijamin setelah prompt user. */
      catatAsisten = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        catatPesanUser();
        pesanBaru(msg);
      };

      // Role User tidak menyusun dashboard. Kalau niatnya membuat atau menambah
      // widget, jawab dengan ARAHAN (bukan 403): user perlu tahu jalan keluarnya,
      // yaitu mengajukan permintaan data dan membiarkan admin instansi menyusun
      // halamannya. Pertanyaan biasa tetap dilayani seperti sekarang.
      if (!isAdminRole(session.role) && (niatBuatDashboard(prompt) || niatTambahWidget(prompt))) {
        const pesan =
          'Penyusunan dashboard dilakukan admin instansi. Ajukan permintaan data lewat menu Permintaan Data: ' +
          'sebutkan bidang, data yang Anda minta, dan arah dashboard yang diinginkan. Dokumen pendukung bisa ' +
          'Anda unggah pada permintaan itu, lalu admin instansi yang menyusun halamannya.';
        catatAsisten({ sender: 'system', text: pesan, actionTaken: 'arahan_permintaan', modeUsed: 'Chatbot RAG' });
        sendEvent('result', { actionTaken: 'arahan_permintaan', message: pesan, modeUsed: 'Chatbot RAG' });
        sendEvent('done', { ok: true });
        return res.end();
      }

      // Case 0a-0: pengguna menanyakan ISI REPOSITORI ("ada berapa dokumen?",
      // "dokumen apa saja?"). Model bahasa hanya melihat potongan teks yang
      // terambil, jadi kalau ditanya jumlah ia menjawab dari potongan itu —
      // pernah "5 dokumen" padahal basis berisi 8. Jawab dari daftar nyata.
      // Perintah membuat dashboard tidak boleh dibajak pertanyaan inventaris:
      // "buatkan dashboard lengkap dari semua dokumen di repositori" menyebut
      // "dokumen di repositori" tetapi maksudnya MEMBUAT, bukan menghitung.
      if (!niatBuatDashboard(prompt) && adalahPertanyaanDokumen(prompt)) {
        sendEvent('step', {
          id: 'dokumen-basis',
          title: 'Membaca daftar dokumen instansi',
          status: 'in_progress',
        });
        let pesan: string;
        try {
          const hasil = await ragClient.daftarDokumen(kbChat || '', 15000);
          pesan = susunJawabanDokumen(hasil, tenantChat?.name);
          sendEvent('step', {
            id: 'dokumen-basis',
            title:
              hasil.jumlah > 0
                ? `${hasil.jumlah} dokumen di basis dokumen instansi`
                : 'Daftar dokumen belum bisa dibaca',
            status: hasil.jumlah > 0 ? 'completed' : 'failed',
          });
        } catch (err: any) {
          console.warn('[chat] gagal membaca daftar dokumen:', err?.message || err);
          pesan = susunJawabanDokumen(null, tenantChat?.name);
          sendEvent('step', { id: 'dokumen-basis', title: 'Layanan dokumen tidak tersedia', status: 'failed' });
        }
        catatAsisten({ sender: 'system', text: pesan, actionTaken: 'daftar_dokumen', modeUsed: 'Chatbot RAG' });
        sendEvent('result', { actionTaken: 'daftar_dokumen', message: pesan, modeUsed: 'Chatbot RAG' });
        sendEvent('done', { ok: true });
        return res.end();
      }

      // Case 0a: pengguna minta REKOMENDASI tampilan chart → tawarkan pilihan
      // beserta pratinjau berisi ANGKA NYATA dari dokumen instansi. Kartu TIDAK
      // langsung dipasang: pengguna melihat bentuknya di kanvas dulu, lalu
      // menekan "Oke, tambahkan". Angka diambil SEKALI lalu dipakai semua bentuk.
      if (adalahPermintaanSaran(prompt)) {
        const indikator = indikatorDariPrompt(prompt);
        const topik = indikator || 'indikator utama instansi';
        sendEvent('step', {
          id: 'saran-data',
          title: `Mengambil angka "${topik}" dari dokumen instansi`,
          status: 'in_progress',
        });

        let saran = susunSaranChart(indikator);
        let pesan: string;
        let modeSaran: 'Chatbot RAG' | 'Gagal (Layanan RAG)' = 'Chatbot RAG';
        try {
          const kbId = kbChat || '';
          const bolehRag = db.systemConfig.ragProvider === 'http' && !!kbId;
          const hasil = bolehRag
            ? await ragClient.ambilDataWidget(
                `Ambil angka indikator "${topik}" dari dokumen resmi instansi ini. ` +
                  `Gunakan angka yang BENAR-BENAR ada di dokumen beserta sumbernya (nama dokumen & halaman). ` +
                  `Kalau indikator ini tidak ada di dokumen, katakan tidak ada — jangan mengarang.`,
                sector,
                'bar',
                tenantChat?.name,
                kbId,
                // Bedakan "dokumen tidak memuat" dari "layanan bermasalah":
                // galat HTTP harus naik ke catch, bukan menyamar jadi data kosong.
                { lemparSaatGagal: true }
              )
            : null;
          const data = dataDariWidget(hasil?.data);
          if (data) {
            saran = susunSaranChart(indikator, data);
            const titik = data.series[0]?.data.length || 0;
            const seri = data.series.length;
            pesan =
              `Berikut ${saran.length} pilihan tampilan untuk **${topik}**. ` +
              `Semua pratinjau memakai angka yang benar-benar ada di dokumen instansi ini` +
              `${data.sumber ? ` (${data.sumber})` : ''} — ${titik} titik data` +
              `${seri > 1 ? ` dalam ${seri} seri` : ''}. ` +
              `Tekan **Pratinjau** untuk melihat bentuknya, lalu **Oke, tambahkan ke kanvas** kalau sudah cocok.`;
            sendEvent('step', {
              id: 'saran-data',
              title: `Angka ditemukan: ${titik} titik data${data.sumber ? ` — ${data.sumber}` : ''}`,
              status: 'completed',
            });
          } else {
            pesan =
              `Saya belum menemukan angka **${topik}** di dokumen instansi ini, jadi pratinjau di bawah hanya memperlihatkan bentuk tampilan — angkanya belum bisa saya isi. ` +
              `Tambahkan atau rapikan dokumen instansi ini, lalu minta lagi.`;
            sendEvent('step', {
              id: 'saran-data',
              title: 'Angka tidak ditemukan di dokumen',
              status: 'failed',
            });
          }
        } catch (err: any) {
          modeSaran = 'Gagal (Layanan RAG)';
          console.warn('[chat] gagal mengambil angka untuk rekomendasi chart:', err?.message || err);
          pesan =
            `Saya belum bisa mengambil angka **${topik}** karena **layanan dokumen sedang tidak tersedia**. ` +
            `Pilihan bentuk tampilan di bawah tetap bisa dilihat, tetapi angkanya belum terisi. Silakan coba lagi beberapa saat lagi.`;
          sendEvent('step', { id: 'saran-data', title: 'Layanan dokumen tidak tersedia', status: 'failed' });
        }

        catatAsisten({ sender: 'system', text: pesan, actionTaken: 'saran_chart', saran });
        sendEvent('result', { actionTaken: 'saran_chart', message: pesan, saran, modeUsed: modeSaran });
        sendEvent('done', { ok: true });
        return res.end();
      }

      // Check if this is a conversational EDIT instruction

      // Case 0 (LAMA) DIHAPUS: dulu "rekomendasi chart"/"tambah widget" dijawab
      // SENDIRI oleh aplikasi dari WIDGET_CATALOG kita — tanpa menanyakan RAG
      // sama sekali. Sesuai permintaan user, chat TIDAK lagi menjawab sendiri:
      // permintaan itu kini diteruskan ke RAG (lihat routing di bawah).

      // Case 0b: "tambahkan widget <indikator>" → WIDGETNYA DIBUAT RAG.
      // Aplikasi TIDAK memakai katalog preseten sendiri di sini; ia hanya
      // meneruskan indikatornya ke layanan RAG (`/extract`) dan memasang kartu
      // dari data yang RAG kembalikan. Kalau RAG tidak memuat indikator itu,
      // pesan jujur — bukan angka contoh.
      //
      // Deteksi memakai `niatTambahWidget` (murni, teruji): regex lama memakai
      // `\bwidget\b` yang GAGAL pada imbuhan Indonesia — "buatkan widgetnya"
      // tidak dikenali, sehingga pesan jatuh ke jalur chatbot dan dijawab prosa
      // (bahkan kode HTML mentah) alih-alih menambah widget ke kanvas.
      // Dokumen yang disebut ("1 chart dari dokumen Piutang 2026"): jalur tambah
      // widget bertanya ke RAG tanpa saringan dokumen dan mengambil dokumen lain.
      // Kalimat seperti ini diserahkan ke pembuat dashboard, yang membaca dokumen
      // itu saja (tabelnya langsung untuk spreadsheet) dan menghormati jumlahnya.
      // "Buatkan saya 1 chart aja" saat dashboard terbuka = RINGKAS dashboard ini
      // menjadi N grafik terpenting, bukan menambah kartu baru dari dokumen lain.
      const jumlahRingkas = activeDash ? niatRingkas(prompt) : null;
      if (activeDash && jumlahRingkas) {
        const halamanAsal: any[] = activeDash.halaman?.length ? activeDash.halaman : [{ id: 'hlm-1', judul: 'Ringkasan', widgets: activeDash.widgets ?? [] }];
        const semuaKartu: WidgetSpec[] = halamanAsal.flatMap((h: any) => h.widgets ?? []);
        const bukanGrafik = (w: WidgetSpec) => ['kpi', 'narasi', 'table'].includes(w.type);
        const urut = [...semuaKartu.filter((w) => !bukanGrafik(w)), ...semuaKartu.filter(bukanGrafik)];
        const dipilih = urut.slice(0, jumlahRingkas).map((w) => ({
          ...w,
          // Satu atau dua grafik mengisi kanvas, bukan kartu sempit di pojok.
          grid: jumlahRingkas === 1 ? { ...w.grid, w: 12, h: 6 } : jumlahRingkas === 2 ? { ...w.grid, w: 6, h: 6 } : w.grid,
        }));
        if (dipilih.length === 0) {
          const pesan = 'Dashboard ini belum punya kartu untuk diringkas.';
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
          sendEvent('result', { actionTaken: 'none', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
        const halamanBaru = [{ ...(halamanAsal[0] ?? {}), id: halamanAsal[0]?.id ?? 'hlm-1', judul: halamanAsal[0]?.judul ?? 'Ringkasan', widgets: dipilih }];
        const diperbarui =
          db.updateDashboard(activeDash.id, { widgets: dipilih, halaman: halamanBaru, halamanAktifId: halamanBaru[0].id } as any, tenantId) || activeDash;
        const pesan =
          `Dashboard **"${activeDash.title}"** diringkas menjadi **${dipilih.length} ${dipilih.length === 1 ? 'grafik' : 'kartu'}**: ` +
          dipilih.map((w) => `**${w.title}**`).join(', ') +
          `. ${semuaKartu.length - dipilih.length} kartu lain dihapus dari dashboard ini.`;
        sendEvent('step', { id: 's0', title: 'Dashboard diringkas', status: 'completed' });
        catatAsisten({ sender: 'system', text: pesan, actionTaken: 'update_widget' } as any);
        sendEvent('result', { actionTaken: 'update_widget', message: pesan, dashboard: diperbarui });
        sendEvent('done', { ok: true });
        return res.end();
      }
      const niatWidgetAsli = niatTambahWidget(prompt);
      let dokumenDisebut: string | undefined;
      const mintaBuatAsli = niatBuatDashboard(prompt);
      if ((niatWidgetAsli || mintaBuatAsli) && kbChat && /(?:^|[^a-z])(?:dokumen|file|berkas|excel|xlsx|pdf)(?:nya)?(?:[^a-z]|$)/i.test(prompt)) {
        try {
          const daftar = await ragClient.daftarDokumen(kbChat);
          // Dicocokkan dengan SEMUA dokumen, termasuk yang gagal diindeks: dulu dokumen
          // gagal (Sheet1.pdf, 0 potongan) tidak dikenali, lalu asisten diam-diam
          // memakai dokumen lain.
          const disebut = dokumenDariPermintaan(prompt, daftar.dokumen.map((d) => d.nama));
          const dok = daftar.dokumen.find((d) => d.nama === disebut);
          const siap = !!dok && (!dok.status || /complete|indexed|ready|selesai/i.test(dok.status)) && (dok.potongan ?? 1) > 0;
          if (dok && !siap) {
            const pesan =
              `Dokumen **"${dok.nama}"** belum bisa dibaca: status di basis dokumen ${dok.status ? `**${dok.status}**` : 'belum siap'}` +
              `${dok.potongan === 0 ? ', tanpa teks yang terbaca (0 potongan)' : ''}. Saya tidak memakai dokumen lain sebagai gantinya. ` +
              `Biasanya ini PDF hasil pindai/ekspor gambar atau berkas yang terlalu besar; unggah ulang versi aslinya (mis. .xlsx), lalu coba lagi.`;
            catatAsisten({ sender: 'system', text: pesan, actionTaken: 'no_source' } as any);
            sendEvent('result', { actionTaken: 'no_source', message: pesan });
            sendEvent('done', { ok: false });
            return res.end();
          }
          if (niatWidgetAsli) dokumenDisebut = disebut;
        } catch (err: any) {
          console.warn('[chat] daftar dokumen gagal:', err?.message || err);
          dokumenDisebut = undefined;
        }
      }
      const mintaTambahWidget = niatWidgetAsli && !dokumenDisebut;
      if (mintaTambahWidget) {
        // Instansi tanpa KB sendiri tidak boleh menembak RAG tanpa scope KB —
        // hasilnya bisa bercampur dengan dokumen instansi lain.
        if (db.systemConfig.ragProvider === 'http' && !kbChat) {
          const pesan =
            `Instansi "${tenantChat?.name || tenantId}" belum punya Knowledge Base RAG sendiri, ` +
            `jadi saya tidak bisa mengambil data untuk widget baru. Hubungi admin untuk menautkan KB ` +
            `instansi ini (Admin → Instansi → Knowledge Base ID), lalu coba lagi.`;
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'no_kb' } as any);
          sendEvent('result', { actionTaken: 'no_kb', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
        // Tanpa dashboard terbuka, "buat chart pendapatan" membuat dashboard baru
        // berisi chart itu saja (bukan dashboard penuh, bukan penolakan).
        // Indikator = sisa kalimat setelah kata kunci, tanpa embel-embel tujuan.
        let indikator = indikatorTambahWidget(prompt);
        // Perintah lanjutan seperti "buatkan widgetnya untuk kurun waktu
        // 2021-2024 saja" tidak menyebut indikatornya — subjeknya ada di pesan
        // sebelumnya. Kalau sisa kalimat hanya keterangan periode, ambil subjek
        // dari pesan USER terakhir yang benar-benar berisi indikator.
        if (hanyaKeteranganPeriode(indikator) && chat) {
          const pesanUserSebelumnya = [...chat.messages]
            .reverse()
            .filter((m) => m.sender === 'user' && m.text.trim() !== prompt.trim())
            .map((m) => indikatorTambahWidget(m.text))
            .find((k) => k.length >= 2 && !hanyaKeteranganPeriode(k));
          if (pesanUserSebelumnya) {
            // Gabungkan subjek lama + keterangan periode baru, mis.
            // "laba tahun berjalan" + "kurun waktu 2021-2024 saja".
            indikator = `${pesanUserSebelumnya} ${indikator}`.trim();
          }
        }
        // Konteks dokumen: dashboard yang kartunya bersumber dari SATU dokumen
        // ("Dashboard Piutang 2026") menambah chart dari dokumen itu juga, kecuali
        // kalimatnya menyebut dokumen lain. Dulu "Tambahkan 1 chart" dikirim mentah
        // ke RAG dan mengambil grafik dari laporan PAM JAYA.
        const dokKonteks = activeDash ? dokumenKonteksDashboard(activeDash) : undefined;
        if (activeDash && dokKonteks && /\.(xlsx|xlsm|xls|csv|ods)$/i.test(dokKonteks)) {
          const sumber = await bacaLembarDokumen(dokKonteks).catch(() => null);
          const kandidat = sumber
            ? widgetDariSumber(sumber, dokKonteks, `w-lbr-${Date.now()}`).widgets.filter((w) => !['kpi', 'narasi', 'table'].includes(w.type))
            : [];
          const adaJudul = new Set(semuaWidget(activeDash).map((w) => normJudul(w.title)));
          const kosongIndikator = indikatorKosong(indikator);
          const cocok =
            (!kosongIndikator && kandidat.find((w) => skorCocok(indikator, w.title) >= 0.5 && !adaJudul.has(normJudul(w.title)))) ||
            (kosongIndikator ? kandidat.find((w) => !adaJudul.has(normJudul(w.title))) : undefined);
          if (cocok || kosongIndikator) {
            if (!cocok) {
              const pesan = `Semua grafik yang bisa disusun dari dokumen **"${dokKonteks}"** sudah ada di dashboard ini. Sebutkan indikator lain, atau sebut dokumen lain bila ingin memakai sumber berbeda.`;
              catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
              sendEvent('result', { actionTaken: 'none', message: pesan });
              sendEvent('done', { ok: false });
              return res.end();
            }
            const pilih = pilihChart(cocok);
            const kartu = { ...(pilih.chartId ? pakaiChartKatalog(cocok, pilih.chartId) : cocok), grid: { ...cocok.grid, w: 6, h: 4 } };
            const isi = denganHalamanAktif(activeDash, [...(activeDash.widgets ?? []), kartu]);
            const diperbarui = db.updateDashboard(activeDash.id, isi as any, tenantId) || activeDash;
            const pesan = `Grafik **"${kartu.title}"** ditambahkan dari dokumen **${dokKonteks}** (sumber yang sama dengan dashboard ini).`;
            sendEvent('step', { id: 's0', title: 'Grafik ditambahkan dari dokumen yang sama', status: 'completed' });
            catatAsisten({ sender: 'system', text: pesan, actionTaken: 'add_widget' } as any);
            sendEvent('result', { actionTaken: 'add_widget', message: pesan, dashboard: diperbarui });
            sendEvent('done', { ok: true });
            return res.end();
          }
        }
        if (indikator.length < 2 || indikatorKosong(indikator)) {
          const pesan =
            'Indikatornya apa yang mau ditambahkan? Sebutkan, misalnya *"tambahkan widget jumlah pelanggan"*. ' +
            'Saya akan meminta datanya ke dokumen instansi Anda.';
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
          sendEvent('result', { actionTaken: 'none', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
        const tipeDiminta = /\b(grafik|chart|diagram|batang|garis|line|area|donut|donat|pie|bar)\b/i.test(lower)
          ? 'bar'
          : /\btabel\b/i.test(lower)
            ? 'table'
            : /\bnarasi\b/i.test(lower)
              ? 'narasi'
              : 'kpi';

        sendEvent('step', { id: 's0', title: `Meminta data "${indikator}" ke layanan RAG...`, status: 'in_progress' });
        try {
          const hasil = await ragClient.ambilDataWidget(
            indikator,
            sector,
            tipeDiminta,
            tenantChat?.name,
            kbChat
          );
          if (!hasil || !hasil.data) {
            const pesan =
              `Dokumen instansi ini tidak memuat data untuk **"${indikator}"**, jadi widget tidak ditambahkan. ` +
              `${hasil?.alasan ? `Alasan: ${hasil.alasan} ` : ''}` +
              `Saya tidak menambahkan angka contoh. Coba sebutkan indikator lain yang ada di dokumen Anda.`;
            sendEvent('step', { id: 's0', title: 'Dokumen tidak memuat indikator tersebut', status: 'failed' });
            catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
            sendEvent('result', { actionTaken: 'none', message: pesan });
            sendEvent('done', { ok: false });
            return res.end();
          }
          const d = hasil.data as any;
          let widgetBaru: WidgetSpec = {
            id: `w-rag-${Date.now()}`,
            type: d.type || (tipeDiminta === 'bar' ? 'bar' : tipeDiminta),
            title: d.title || hasil.judul || indikator,
            subtitle: d.subtitle,
            category: d.category || 'Operasional',
            confidence: 'sumber',
            grid: d.grid || { x: 0, y: 0, w: 6, h: 4 },
            kpi: d.kpi,
            chart: d.chart,
            table: d.table,
            narasi: d.narasi,
            citations: d.citations || [],
            unitKerja: d.unitKerja,
            periode: d.periode,
            lastUpdated: new Date().toISOString(),
          } as WidgetSpec;
          // Kartu dari chat juga memakai chart katalog (chartId), sama dengan pembuat
          // dashboard — dulu kartu ini tersimpan tanpa chartId.
          {
            const pilih = pilihChart(widgetBaru);
            if (pilih.chartId) widgetBaru = pakaiChartKatalog(widgetBaru, pilih.chartId);
          }
          // Tolak KEMBARAN: kalau kanvas sudah punya widget dengan isi yang sama
          // (judul + subjudul + periode + tipe), jangan tambah duplikat. Menambah
          // kartu kedua yang menanyakan hal sama membuat jumlah widget menipu.
          if (!activeDash) {
            const sekarang = new Date().toISOString();
            const desainDiminta = gayaDariPermintaan(prompt) ?? (bagianDariPermintaan(prompt) ? 'korporat' : undefined);
            const dashBaru = db.createDashboard({
              id: `dash-${Date.now()}`,
              tenantId,
              title: widgetBaru.title,
              description: `Dibuat asisten dari permintaan: "${prompt.slice(0, 120)}"`,
              sector,
              gaya: desainDiminta ? { desain: desainDiminta } : undefined,
              // Disimpan sebagai halaman (bukan daftar kartu datar), sama dengan dashboard lain.
              ...(() => {
                const kartu = { ...widgetBaru, grid: { x: 0, y: 0, w: widgetBaru.type === 'kpi' ? 4 : 8, h: widgetBaru.type === 'kpi' ? 2 : 4 } };
                return { widgets: [kartu], halaman: [{ id: 'hlm-1', judul: 'Ringkasan', widgets: [kartu] }], halamanAktifId: 'hlm-1' };
              })(),
              globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
              createdAt: sekarang,
              updatedAt: sekarang,
            } as Dashboard);
            chat = db.ensureChatForDashboard(dashBaru.id, tenantId, session.userId, dashBaru.title);
            pesanUserTercatat = false;
            const pesan = `Dashboard baru **"${dashBaru.title}"** dibuat berisi satu widget dari data dokumen instansi. Minta widget lain kapan saja untuk menambahkannya.`;
            sendEvent('step', { id: 's0', title: 'Widget dibuat dari dokumen', status: 'completed' });
            catatAsisten({ sender: 'system', text: pesan, actionTaken: 'create_dashboard' } as any);
            sendEvent('result', { actionTaken: 'create_dashboard', message: pesan, dashboard: dashBaru });
            sendEvent('done', { ok: true });
            return res.end();
          }
          const kunciBaru = kunciKembarWidget(widgetBaru);
          // Kunci kembar butuh subjudul & periode identik, sehingga indikator yang
          // sama dengan judul sedikit berbeda ("Kepuasan Pengguna Penanganan" vs
          // "Kepuasan pengguna atas penanganan") lolos jadi kartu kedua. Bandingkan
          // juga judulnya; periode berbeda tetap dianggap widget berbeda.
          const periodeSama = (a?: string, b?: string) => {
            const x = String(a || '').toLowerCase().trim();
            const y = String(b || '').toLowerCase().trim();
            return !x || !y || x === y;
          };
          const kembar =
            activeDash.widgets.find((w) => kunciKembarWidget(w) === kunciBaru) ||
            activeDash.widgets.find(
              (w) => judulWidgetMirip(w.title, widgetBaru.title) && periodeSama(w.periode, widgetBaru.periode)
            );
          if (kembar) {
            const pesan =
              `Widget **"${kembar.title}"** sudah ada di kanvas dengan isi yang sama, jadi tidak saya tambahkan lagi. ` +
              `Kalau mau diubah, sebutkan perubahannya (mis. "ubah jadi grafik garis" atau "ganti ke periode lain").`;
            sendEvent('step', {
              id: 's0',
              title: 'Widget dengan isi sama sudah ada — tidak ditambahkan',
              status: 'failed',
            });
            catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
            sendEvent('result', { actionTaken: 'none', message: pesan });
            sendEvent('done', { ok: false });
            return res.end();
          }
          const updatedWidgets = [widgetBaru, ...activeDash.widgets];
          // ID widget dari RAG bisa berulang (mis. `w-kpi-1` lagi). Kanvas memakai
          // `id` sebagai React key, jadi duplikat membuat kartu tidak muncul atau
          // tertukar. Beri ID unik tanpa mengubah isinya.
          {
            const terpakai = new Set<string>();
            for (let i = 0; i < updatedWidgets.length; i++) {
              const w = updatedWidgets[i];
              let id = String(w.id || '').trim();
              if (!id || terpakai.has(id)) {
                const dasar = id || `w-${w.type || 'widget'}`;
                let n = 1;
                let kandidat = `${dasar}-${n}`;
                while (terpakai.has(kandidat)) kandidat = `${dasar}-${++n}`;
                id = kandidat;
                updatedWidgets[i] = { ...w, id };
              }
              terpakai.add(id);
            }
          }
          db.updateDashboard(activeDash.id, denganHalamanAktif(activeDash, updatedWidgets) as any, tenantId);
          const pesan = `Widget **"${widgetBaru.title}"** ditambahkan ke kanvas dari data dokumen instansi.`;
          sendEvent('step', { id: 's0', title: 'Widget ditambahkan dari dokumen', status: 'completed' });
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'add_widget' } as any);
          sendEvent('result', {
            actionTaken: 'add_widget',
            message: pesan,
            dashboard: { ...activeDash, widgets: updatedWidgets },
          });
          sendEvent('done', { ok: true });
          return res.end();
        } catch (err: any) {
          const detail =
            err instanceof RagServiceError ? err.detail || err.message : err?.message || 'kesalahan jaringan';
          console.warn('[chat] tambah widget gagal:', detail);
          // Pesan untuk pengguna: tanpa istilah teknis (RAG, kode HTTP, detail jaringan).
          const pesan =
            `⚠️ Belum bisa menambahkan widget karena **layanan dokumen sedang tidak tersedia**.\n\nSilakan coba lagi beberapa saat lagi.`;
          sendEvent('step', { id: 's0', title: 'Layanan dokumen tidak tersedia', status: 'failed' });
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'rag_error' } as any);
          sendEvent('result', { actionTaken: 'rag_error', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
      }

      // Case 1: Hapus widget
      // Deteksi lewat pola, bukan awalan kalimat: "tolong hapus widget X" dulu
      // lolos ke jalur tanya-jawab karena hanya `startsWith('hapus widget')`
      // yang dikenali.
      const kueriHapus = perintahHapusWidget(prompt);
      if (kueriHapus !== null) {
        sendEvent('step', { id: 's1', title: 'Menganalisis widget yang akan dihapus...', status: 'in_progress' });
        await new Promise((r) => setTimeout(r, 400));

        if (activeDash && activeDash.widgets.length > 0) {
          const query = kueriHapus;
          const targetIdx = query
            ? activeDash.widgets.findIndex(
                (w) =>
                  judulWidgetMirip(w.title, query) ||
                  w.title.toLowerCase().includes(query) ||
                  (w.category && w.category.toLowerCase().includes(query))
              )
            : -1;

          if (targetIdx !== -1) {
            const removed = activeDash.widgets[targetIdx];
            activeDash.widgets.splice(targetIdx, 1);
            db.updateDashboard(activeDash.id, { widgets: activeDash.widgets }, tenantId);


            sendEvent('step', { id: 's1', title: `Widget "${removed.title}" berhasil dihapus`, status: 'completed' });
            catatAsisten({
              sender: 'system',
              text: `Widget "${removed.title}" telah dihapus dari dashboard.`,
              actionTaken: 'remove_widget',
            });
            sendEvent('result', {
              actionTaken: 'remove_widget',
              message: `Widget "${removed.title}" telah dihapus dari dashboard.`,
              dashboard: activeDash,
            });
            sendEvent('done', { ok: true });
            return res.end();
          }

          // Sasaran tidak ketemu: beri tahu, jangan diam lalu dijawab jalur lain.
          const daftarJudul = activeDash.widgets.slice(0, 6).map((w) => `"${w.title}"`).join(', ');
          const pesan = query
            ? `Tidak ada widget bernama **"${query}"** di dashboard ini. Yang ada: ${daftarJudul}.`
            : `Sebutkan widget yang ingin dihapus, misalnya: hapus widget "${activeDash.widgets[0]?.title || 'Ringkasan Kinerja'}".`;
          sendEvent('step', { id: 's1', title: 'Widget tidak ditemukan', status: 'failed' });
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
          sendEvent('result', { actionTaken: 'none', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
      }

      // Case 2: Ubah tipe visualisasi chart
      if (
        lower.includes('ganti') ||
        lower.includes('ubah') ||
        lower.includes('diagram batang') ||
        lower.includes('diagram garis') ||
        lower.includes('diagram donat')
      ) {
        sendEvent('step', { id: 's1', title: 'Menyesuaikan konfigurasi visualisasi widget...', status: 'in_progress' });
        await new Promise((r) => setTimeout(r, 400));

        // Tipe TUJUAN hanya dibaca dari bagian SETELAH "menjadi/jadi/ke". Jenis
        // yang disebut sebelumnya adalah SASARAN: "ubah grafik donat menjadi
        // batang" berarti donat yang diubah menjadi batang — dulu kebalikannya
        // (grafik garis pertama diubah jadi donat).
        const tipeTujuan = tipeGrafikDariTeks(bagianTujuan(prompt));
        const newType = (tipeTujuan || 'bar') as WidgetSpec['type'];
        const tipeSumber = tipeGrafikDariTeks(bagianSumber(prompt));

        if (activeDash && activeDash.widgets.length > 0) {
          const disebut = bagianSumber(prompt);
          // Urutan sasaran: judul yang disebut → tipe sumber yang disebut
          // ("grafik donat") → grafik pertama → widget pertama.
          const target =
            activeDash.widgets.find(
              (w) =>
                String(w.title || '').trim().length > 2 &&
                disebut.includes(String(w.title || '').toLowerCase().trim())
            ) ||
            (tipeSumber ? activeDash.widgets.find((w) => w.type === tipeSumber) : undefined) ||
            activeDash.widgets.find((w) => ['line', 'area', 'bar', 'donut'].includes(w.type)) ||
            activeDash.widgets[0];

          if (target) {
            target.type = newType;
            db.updateDashboard(activeDash.id, { widgets: activeDash.widgets }, tenantId);


            sendEvent('step', { id: 's1', title: `Tipe visualisasi widget "${target.title}" diubah ke ${newType.toUpperCase()}`, status: 'completed' });
            catatAsisten({
              sender: 'system',
              text: `Visualisasi widget "${target.title}" telah diubah menjadi ${newType.toUpperCase()}.`,
              actionTaken: 'update_widget',
            });
            sendEvent('result', {
              actionTaken: 'update_widget',
              message: `Visualisasi widget "${target.title}" telah diubah menjadi ${newType.toUpperCase()}.`,
              dashboard: activeDash,
            });
            sendEvent('done', { ok: true });
            return res.end();
          }
        }
      }

      // Instansi tanpa KB sendiri (mis. RSUD, Transportasi) TIDAK boleh diam-diam
      // memakai KB campur atau data contoh — itu sumber kebocoran antar-instansi.
      // Beri pesan jelas supaya admin menautkan KB untuk instansi tersebut.
      // (Ditaruh setelah kasus edit widget/rekomendasi yang tidak butuh RAG.)
      if (db.systemConfig.ragProvider === 'http' && !kbChat) {
        const pesan =
          `Instansi "${tenantChat?.name || tenantId}" belum punya Knowledge Base RAG sendiri, ` +
          `jadi saya tidak bisa mengambil data resminya. Hubungi admin untuk menautkan KB ` +
          `instansi ini (Admin → Instansi → Knowledge Base ID), lalu coba lagi.`;
        catatAsisten({ sender: 'system', text: pesan, actionTaken: 'no_kb' } as any);
        sendEvent('step', { id: 'kb0', title: 'Knowledge Base instansi belum ditautkan', status: 'completed' });
        sendEvent('result', { actionTaken: 'no_kb', message: pesan });
        sendEvent('done', { ok: false });
        return res.end();
      }

      // Case 2.5: ROUTING — dashboard command vs chatbot.
      // Perintah membuat/memperbarui dashboard (kata kerja eksplisit + objeknya)
      // masuk jalur orkestrator; SEMUA pesan lain dijawab sebagai chatbot LLM
      // (sapaan, tanya data, obrolan) lewat /query RAG dengan persona + riwayat.
      //
      // Deteksi niat dipindah ke `niatBuatDashboard` (murni, teruji) karena
      // regex `\b` DULU gagal pada imbuhan bahasa Indonesia: `\bdashboard\b`
      // tidak cocok "dashboardnya", `\bbuatkan\b` tidak cocok "membuatkan" —
      // sehingga "oke buatkan saya dashboardnya" salah dijawab sebagai obrolan.
      const isGenerateDash = niatBuatDashboard(prompt) || !!dokumenDisebut;

      // Deteksi obrolan ringan (sapaan/terima kasih) → persona boleh membalas
      // natural tanpa strict grounding. Pertanyaan data tetap grounded.
      // Sapaan dihitung oleh fungsi murni `adalahSapaan` (teruji). Versi lama
      // memakai `lower.includes('apa ini')` sehingga pertanyaan data seperti
      // "berapa nilai aset dan apa ini sudah diaudit?" ikut dianggap sapaan —
      // dan sapaan melewati strict grounding, jadi model bebas menjawab tanpa
      // dokumen. Persis kebocoran yang ingin ditutup.
      const isSapaan = adalahSapaan(prompt);

      if (!isGenerateDash) {
        // ---- CHATBOT LLM (multi-turn, grounded ke dokumen instansi) ----
        sendEvent('step', { id: 'sc0', title: 'Menyiapkan jawaban dari dokumen resmi...', status: 'in_progress' });

        // Riwayat percakapan: utamakan yang tersimpan di server (per dashboard);
        // kalau tidak ada, pakai riwayat yang dikirim klien (untuk mode tanpa dashboard).
        const riwayatServer = chat ? rangkaiRiwayat(chat.messages) : '';
        const riwayatKlien = Array.isArray(req.body.history)
          ? rangkaiRiwayat(
              (req.body.history as Array<{ sender?: string; text?: string }>)
                .filter((m) => m && typeof m.text === 'string')
                .map((m, i) => ({
                  id: `h-${i}`,
                  sender: m.sender === 'user' ? 'user' : 'system',
                  text: m.text as string,
                  timestamp: '',
                })) as ChatMessage[]
            )
          : '';
        const riwayat = riwayatServer || riwayatKlien;

        try {
          const ragResult = await ragClient.query({
            prompt,
            sector,
            mode: 'prose',
            instansi: tenantChat?.name,
            kbId: kbChat,
            riwayat,
            persona: CHATBOT_PERSONA,
            strictGrounding: !isSapaan,
          });

          sendEvent('step', { id: 'sc0', title: 'Jawaban siap', status: 'completed' });

          const answer = ragResult.answer || 'Maaf, saya tidak menemukan jawabannya di dokumen yang tersedia.';
          const citationsCount = ragResult.citations?.length || 0;

          // Buang token template yang kadang "bocor" dari LLM (mis. `{-chart-}`)
          // supaya tidak tampil sebagai teks aneh di jawaban.
          const answerBersih = answer
            .replace(/\{-[^}]*-\}/g, '')
            // Tanda rujukan inline dari layanan dokumen ("[2]", "[16]") tidak perlu
            // ditampilkan: pengguna cukup membaca jawabannya.
            .replace(/\[\d{1,3}\]/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

          // Daftar sitasi TIDAK ditempel ke balasan: pengguna hanya butuh jawabannya.
          // Jumlah sitasi tetap dihitung dan dikirim sebagai metadata untuk log.

          // Pemeriksaan angka: penjaga sumber memastikan ADA potongan dokumen,
          // bukan bahwa angka di jawaban berasal dari potongan itu. Angka yang tak
          // tertelusur diberi catatan jujur — tidak diblokir, karena sebagian angka
          // sah hasil hitungan model (selisih/persentase) yang tak muncul apa adanya.
          const angkaLepas = isSapaan
            ? []
            : angkaTakBersumber({
                jawaban: answerBersih,
                potongan: (ragResult.chunks || []).map((c: any) => c?.snippet || c?.text || c?.content || ''),
                pertanyaan: prompt,
              });
          const replyText = answerBersih + pesanAngkaTakBersumber(angkaLepas);

          // Penjaga sumber: jawaban TANPA rujukan dokumen tidak ditampilkan untuk
          // pertanyaan data. Tanpa ini, model tetap bisa membalas kalimat umum saat
          // retrieval kosong (`sources: []`) dan pengguna mengira itu fakta instansi.
          const putusan = putusanJawaban({
            citationsCount,
            jumlahPotongan: ragResult.chunks?.length || 0,
            grounded: ragResult.grounded,
            sapaan: isSapaan,
            instansi: tenantChat?.name,
          });
          if (!putusan.tampilkan) {
            const pesan = putusan.pesan || 'Dokumen instansi ini tidak memuat jawabannya.';
            catatAsisten({
              sender: 'system',
              text: pesan,
              actionTaken: 'no_source',
              modeUsed: 'Chatbot RAG',
              citationsCount: 0,
            } as any);
            sendEvent('result', {
              actionTaken: 'no_source',
              message: pesan,
              modeUsed: 'Chatbot RAG',
              citationsCount: 0,
              latencyMs: ragResult.latencyMs,
            });
            sendEvent('done', { ok: true });
            return res.end();
          }

          catatAsisten({
            sender: 'system',
            text: replyText,
            actionTaken: 'qa_answer',
            modeUsed: 'Chatbot RAG',
            citationsCount,
            angkaTanpaSumber: angkaLepas.map((a) => a.teks),
          } as any);

          sendEvent('result', {
            actionTaken: 'qa_answer',
            message: replyText,
            modeUsed: 'Chatbot RAG',
            citationsCount,
            angkaTanpaSumber: angkaLepas.map((a) => a.teks),
            latencyMs: ragResult.latencyMs,
          });
          sendEvent('done', { ok: true });
          return res.end();
        } catch (err: any) {
          // Layanan RAG gagal / belum dikonfigurasi: tampilkan galat jujur.
          // JANGAN jatuh ke data contoh atau ke generate dashboard.
          const detail =
            err instanceof RagServiceError
              ? err.detail || err.message
              : err?.message || 'kesalahan jaringan';
          const pesanGalat =
            `⚠️ Maaf, saya belum bisa menjawab saat ini karena **layanan dokumen sedang tidak tersedia**.\n\n` +
            `Silakan coba lagi beberapa saat lagi. ` +
            `Saya tidak menampilkan data contoh agar jawaban tidak menyesatkan.`;
          console.warn('[chat] chatbot RAG gagal:', detail);

          catatAsisten({
            sender: 'system',
            text: pesanGalat,
            actionTaken: 'rag_error',
            modeUsed: 'Gagal (Layanan RAG)',
          } as any);

          sendEvent('step', { id: 'sc0', title: 'Layanan dokumen tidak tersedia', status: 'failed' });
          sendEvent('result', {
            actionTaken: 'rag_error',
            message: pesanGalat,
            modeUsed: 'Gagal (Layanan RAG)',
          });
          sendEvent('done', { ok: false });
          return res.end();
        }
      }

      // Case 3: DEFAULT -> Generate / Perbarui Dashboard via RAG Orchestrator
      const mulaiGenerate = Date.now();
      const onProgress = (step: ProgressStep) => {
        sendEvent('step', step);
      };

      // Nama instansi + KB-nya diteruskan ke RAG supaya dokumen instansi lain yang
      // kebetulan ada di layanan RAG yang sama tidak dipakai menyusun dashboard.
      const tenantAktif = db.tenants.find((t) => t.id === tenantId);
      const genResult = await generateDashboard({
        userPrompt: prompt,
        sector,
        tenantId,
        instansi: tenantAktif?.name,
        kbId: kbUntukInstansi(tenantAktif, db.systemConfig.ragKnowledgeBaseId),
        // Snapshot dashboard contoh hanya untuk mode demo tanpa RAG nyata.
        izinkanSnapshotDemo: db.systemConfig.ragProvider !== 'http',
        onProgress,
        ragClient,
        ambilLembarDokumen: bacaLembarDokumen,
      });

      // Tidak ada angka sah dari dokumen instansi ini: JANGAN simpan/tampilkan
      // dashboard. Menampilkan template contoh di sini membuat kanvas terlihat
      // resmi padahal angkanya karangan.
      if (!genResult.ok) {
        const gagalLayanan = genResult.modeUsed === 'Gagal (Layanan RAG)';
        // Alasan teknis hanya untuk log server — pengguna cukup tahu layanannya
        // sedang tidak tersedia dan apa yang bisa dilakukan.
        if (genResult.alasanGagal) console.warn('[chat] dashboard gagal:', genResult.alasanGagal);
        const pesanGagal = gagalLayanan
          ? `⚠️ Saya belum bisa membuat dashboard untuk instansi "${tenantAktif?.name || tenantId}" karena **layanan dokumen sedang tidak tersedia**.\n\n` +
            `Silakan coba lagi beberapa saat lagi. ` +
            `Saya tidak membuat dashboard dari data contoh agar tidak menyesatkan.`
          : `Saya belum bisa membuat dashboard untuk instansi "${tenantAktif?.name || tenantId}". ` +
            `Dokumen instansi ini belum memadai untuk angka yang bisa dipertanggungjawabkan. ` +
            `Yang bisa dilakukan: tambahkan atau rapikan dokumen instansi ini, lalu coba lagi.`;
        catatAsisten({
          sender: 'system',
          text: pesanGagal,
          actionTaken: gagalLayanan ? 'rag_error' : 'none',
          modeUsed: genResult.modeUsed,
        } as any);
        sendEvent('result', {
          actionTaken: gagalLayanan ? 'rag_error' : 'none',
          message: pesanGagal,
          modeUsed: genResult.modeUsed,
        });
        sendEvent('done', { ok: false });
        return res.end();
      }

      /**
       * Data dokumen -> chart katalog -> beberapa halaman tanpa data kembar,
       * judul mengikuti isi. Gaya bisa diminta di kalimat ("gaya lensa").
       */
      // Rapat bagian (procurement, outsourcing, ...) tanpa gaya disebut = gaya Korporat seperti deck-nya.
      const desainDiminta = gayaDariPermintaan(prompt) ?? (bagianDariPermintaan(prompt) ? 'korporat' : undefined);
      const judulDokumen = genResult.dokumenTarget ? `Dashboard ${namaTanpaEkstensi(genResult.dokumenTarget)}` : undefined;
      const susun =
        genResult.modeUsed === 'Tabel Dokumen'
          ? // Tabel dokumen: tiap lembar disusun sendiri menjadi halamannya, supaya
            // kartu lembar berbeda (judul mirip: "Jumlah Transaksi") tidak dianggap kembar.
            (() => {
              const idAwal = `ast-${Date.now()}`;
              const halaman = genResult.halamanDiminta.flatMap((h, i) => {
                const milik = genResult.dashboard.widgets.filter((w) => genResult.halamanWidget[w.id] === i);
                const s = susunDashboardBerhalaman(milik, { desain: desainDiminta, idAwal: `${idAwal}-${i}`, chartTemplate: true });
                return s.halaman.map((p, j) => ({ ...p, id: `${p.id}-${i}`, judul: s.halaman.length > 1 ? `${h.judul} (${j + 1})` : h.judul }));
              });
              return { title: judulDokumen!, halaman, halamanKosong: [] as string[] };
            })()
          : susunDashboardBerhalaman(genResult.dashboard.widgets, {
              instansi: tenantAktif?.name,
              judul: judulDokumen,
              desain: desainDiminta,
              idAwal: `ast-${Date.now()}`,
              halamanDiminta: genResult.halamanDiminta,
              halamanWidget: genResult.halamanWidget,
              // Semua grafik memakai chart dari menu Template Chart (chartId katalog), supaya
              // kanvas bisa mengganti satu, beberapa, atau semua chart dengan desain katalog.
              chartTemplate: true,
            });
      const isiBaru = {
        title: susun.title,
        description: genResult.dashboard.description,
        widgets: susun.halaman[0]?.widgets ?? [],
        halaman: susun.halaman,
        halamanAktifId: susun.halaman[0]?.id,
        // Dashboard asisten bukan replika template: kanvas widget biasa.
        replika: undefined,
        tataLetak: undefined,
        presentasi: undefined,
        gaya: desainDiminta ? { desain: desainDiminta } : undefined,
        sector,
      };
      // Setiap permintaan membuat dashboard BARU. Dashboard yang sedang dibuka
      // hanya ditimpa bila pengguna jelas meminta memperbarui.
      const mintaPerbarui = /(?:^|[^a-z])(?:perbarui|perbaharui|update|refresh|segarkan)/i.test(prompt);

      let dashboardTersimpan: Dashboard;
      if (activeDash && mintaPerbarui) {
        dashboardTersimpan = db.updateDashboard(activeDash.id, isiBaru, tenantId) || activeDash;
      } else {
        dashboardTersimpan = db.createDashboard({ ...genResult.dashboard, ...isiBaru });
        chat = db.ensureChatForDashboard(
          dashboardTersimpan.id,
          tenantId,
          session.userId,
          dashboardTersimpan.title
        );
        pesanUserTercatat = false;
      }


      // Balasan ringkas dalam bahasa pengguna: apa yang dibuat dan di halaman mana.
      const daftarHalaman = (dashboardTersimpan.halaman ?? []).length ? dashboardTersimpan.halaman! : [{ judul: 'Halaman 1', widgets: dashboardTersimpan.widgets } as any];
      const narasiWidget = daftarHalaman.flatMap((h: any) => h.widgets).find((w: any) => w.type === 'narasi');
      const kpis = daftarHalaman.flatMap((h: any) => h.widgets).filter((w: any) => w.type === 'kpi');
      const kpiItems = kpis.slice(0, 3).map((k: any) => `• **${k.title}**: ${k.kpi?.value} ${k.kpi?.unit || ''}`).join('\n');
      const isiHalaman = daftarHalaman
        .map((h: any, i: number) => `${i + 1}. **${h.judul}** — ${h.widgets.map((w: any) => w.title).slice(0, 4).join(', ')}${h.widgets.length > 4 ? ', …' : ''}`)
        .join('\n');

      let replyText = `Dashboard **"${dashboardTersimpan.title}"** sudah ${activeDash && mintaPerbarui ? 'diperbarui' : 'dibuat'} ${
        genResult.modeUsed === 'Fallback (Template Snapshot)'
          ? 'dari TEMPLATE CONTOH (bukan dokumen instansi)'
          : genResult.modeUsed === 'Tabel Dokumen'
            ? `dari tabel dokumen **${genResult.dokumenTarget}**`
            : 'dari dokumen resmi instansi'
      }, terbagi dalam **${daftarHalaman.length} halaman**:
${isiHalaman}
\n`;
      for (const c of genResult.catatanDokumen ?? []) replyText += `ℹ️ ${c}\n\n`;

      if (genResult.halamanBawaan && susun.halaman.length > 0) {
        replyText += `Halaman disusun per segmen (satu topik per halaman). Untuk susunan sendiri, tulis daftarnya, mis. "1. Halaman Keuangan – pendapatan, laba, arus kas".

`;
      }

      // Butir yang tidak terisi disebut apa adanya: kartunya tidak dibuat,
      // BUKAN diisi angka indikator lain.
      const { tidakAda, ditolak, gagalLayanan } = genResult.laporanButir;
      if (tidakAda.length) {
        replyText += `Tidak ditemukan di dokumen (kartunya tidak dibuat): ${tidakAda.join(', ')}.\n\n`;
      }
      if (ditolak.length) {
        replyText += `Ada angka di dokumen tetapi bukan indikator yang diminta, jadi tidak dipakai: ${ditolak.join(', ')}.\n\n`;
      }
      if (genResult.laporanButir.areaSapuanSibuk > 0) {
        replyText += `⚠️ ${genResult.laporanButir.areaSapuanSibuk} bagian dokumen gagal dibaca karena layanan dokumen sedang sibuk, jadi dashboard mungkin belum lengkap. Minta ulang beberapa saat lagi.

`;
      }
      if (gagalLayanan.length) {
        replyText += `⚠️ ${gagalLayanan.length} indikator gagal diambil karena layanan dokumen sedang sibuk: ${gagalLayanan.join(', ')}. Minta ulang beberapa saat lagi untuk melengkapinya.\n\n`;
      }

      if (susun.halamanKosong.length) {
        replyText += `Halaman **${susun.halamanKosong.join('**, **')}** tidak dibuat karena dokumen instansi tidak memuat datanya.

`;
      }
      // Isi minimal per halaman: yang tetap kurang disebut apa adanya, bukan diisi angka indikator lain.
      const halamanKurang = susun.halaman.filter((h) => (h.widgets?.length ?? 0) < MIN_WIDGET_HALAMAN);
      if (halamanKurang.length) {
        replyText += `Halaman yang isinya kurang dari ${MIN_WIDGET_HALAMAN} widget karena dokumen tidak memuat indikator lain untuk topiknya: ${halamanKurang.map((h) => `**${h.judul}** (${h.widgets?.length ?? 0})`).join(', ')}.

`;
      }

      if (narasiWidget?.narasi?.text) {
        replyText += `📋 **Ringkasan temuan:**
${narasiWidget.narasi.text}
\n`;
      }

      if (kpiItems) {
        replyText += `🎯 **Angka utama:**
${kpiItems}
\n`;
      }

      replyText += `Semua grafik memakai chart dari menu Template Chart${desainDiminta ? ` dengan gaya **${GAYA[desainDiminta].nama}**` : ''}. Gayanya bisa diganti lewat tombol **Gaya Semua**, dan chart tiap kartu lewat menu ⋮ → **Ganti Template Chart**.
`;

      replyText +=
        genResult.modeUsed === 'Jalur A (LLM JSON)' || genResult.modeUsed === 'Tabel Dokumen'
          ? `Angka diambil dari dokumen instansi ini; sumber tiap kartu bisa dilihat di kartunya.\n`
          : `⚠️ **DATA CONTOH:** dashboard ini berasal dari template demo, bukan dari dokumen instansi ini. Jangan dipakai untuk laporan atau presentasi resmi.\n`;

      // JUJUR soal jumlah widget: kalau pengguna meminta jumlah tertentu
      // ("dashboard dengan 15-20 widget"), katakan berapa yang benar-benar
      // tersusun — jangan menjanjikan angka yang tidak ada di kanvas.
      // Dihitung dari halaman FINAL: genResult.jumlahWidget dihitung sebelum
      // penyusun halaman membuang widget kembar / tanpa halaman.
      const jumlahFinal = daftarHalaman.reduce((n: number, h: any) => n + (h.widgets?.length ?? 0), 0);
      if (genResult.permintaanJumlah) {
        const diminta = labelJumlahWidget(genResult.permintaanJumlah);
        if (jumlahFinal < genResult.permintaanJumlah.max) {
          replyText +=
            `⚠️ Anda meminta **${diminta} widget**, tetapi dokumen instansi ini baru memuat data untuk **${jumlahFinal} widget**. ` +
            `Sisanya tidak ditambahkan supaya tidak ada angka contoh. Tambahkan/rapikan dokumen di knowledge base lalu minta lagi.\n`;
        } else {
          replyText += `Dashboard berisi **${jumlahFinal} widget** sesuai permintaan Anda.\n`;
        }
      } else {
        replyText += `Dashboard berisi **${jumlahFinal} widget** di ${daftarHalaman.length} halaman, dari dokumen instansi ini.\n`;
      }
      // Durasi nyata penyusunan — melengkapi estimasi yang tampil saat proses
      // berjalan, supaya pengguna tahu berapa lama sebenarnya.
      {
        const totalDetik = Math.round((Date.now() - mulaiGenerate) / 1000);
        const menit = Math.floor(totalDetik / 60);
        const sisaDetik = totalDetik % 60;
        const durasi = menit > 0 ? `${menit} mnt ${sisaDetik} dtk` : `${sisaDetik} dtk`;
        replyText += `⏱️ Waktu penyusunan: **${durasi}** — ${genResult.citationsCount} potongan dokumen dibaca.
`;
      }

      replyText += `Anda bisa meminta penyesuaian lebih lanjut (misalnya: *"rekomendasi chart"*, *"ubah grafik ke diagram garis"*, atau *"hapus widget [nama]"*).`;

      catatAsisten({
        sender: 'system',
        text: replyText,
        actionTaken: 'create_dashboard',
        modeUsed: genResult.modeUsed,
        citationsCount: genResult.citationsCount,
      });

      sendEvent('result', {
        actionTaken: 'create_dashboard',
        message: replyText,
        dashboard: dashboardTersimpan,
        modeUsed: genResult.modeUsed,
        citationsCount: genResult.citationsCount,
        latencyMs: genResult.latencyMs,
        // Nasib tiap butir halaman (tidak ada / ditolak / layanan sibuk) supaya
        // klien dan pengujian bisa membedakannya tanpa membaca log server.
        laporanButir: genResult.laporanButir,
      });

      sendEvent('done', { ok: true });
      res.end();

    } catch (err: any) {
      // JANGAN biarkan pertanyaan pengguna menggantung tanpa balasan tersimpan:
      // dulu cabang ini hanya mengirim event `error` lalu berhenti, sehingga
      // setelah riwayat dimuat ulang balasan (dan sebab kegagalannya) hilang —
      // terlihat seperti "respon berhenti". Sekarang kegagalan ikut dicatat.
      const sebab = String(err?.message || 'Terjadi kesalahan sistem saat pemrosesan RAG.');
      const pesanGalat =
        `⚠️ Maaf, permintaan ini belum bisa saya selesaikan: **${sebab}**\n\n` +
        `Dashboard Anda tidak diubah. Silakan coba lagi. Kalau permintaannya besar ` +
        `(mis. belasan widget sekaligus), pecah jadi beberapa langkah — mis. minta 4–5 kartu dulu, ` +
        `lalu "tambahkan grafik keuangan", dan seterusnya.`;
      console.error('[chat] galat tak tertangani:', sebab);
      try {
        catatAsisten({
          sender: 'system',
          text: pesanGalat,
          actionTaken: 'rag_error',
          modeUsed: 'Gagal (Layanan RAG)',
        } as any);
      } catch (e: any) {
        console.error('[chat] gagal menyimpan pesan galat:', e?.message || e);
      }
      sendEvent('result', { actionTaken: 'rag_error', message: pesanGalat, modeUsed: 'Gagal (Layanan RAG)' });
      sendEvent('error', { message: sebab });
      sendEvent('done', { ok: false });
      res.end();
    }
  });

  // ================= RAG PROBE & DIAGNOSTICS =================
  app.post('/api/rag-probe', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    // Probe menyentuh layanan RAG (Base URL/API key) — hanya admin yang boleh.
    // Non-admin (pengguna) dilarang menyentuh konfigurasi RAG sama sekali.
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh menguji koneksi RAG.')) return;
    const cfg = db.systemConfig;
    try {
      const probeRes = await ragClient.probe();
      const sehat = probeRes.canOutputJson || probeRes.hasMetadata;
      // Jebakan yang paling sering terjadi: Base URL & API key sudah diisi, tapi
      // dropdown Provider masih "mock" -> aplikasi tetap memakai data contoh.
      const konfigTapiMock =
        cfg.ragProvider !== 'http' && !!(cfg.ragApiUrl || cfg.ragApiKey);
      res.json({
        timestamp: new Date().toISOString(),
        status: sehat ? 'healthy' : 'degraded',
        latencyMs: probeRes.latencyMs,
        modeDetected: probeRes.detectedMode,
        hasLlmStructuredJson: probeRes.canOutputJson,
        hasDocumentMetadata: probeRes.hasMetadata,
        sampleChunksCount: probeRes.sampleChunksCount,
        zodValidationPassed: probeRes.canOutputJson,
        baseDipakai: probeRes.baseDipakai,
        providerAktif: cfg.ragProvider,
        peringatan: konfigTapiMock
          ? 'Provider masih "mock" padahal Base URL/API Key terisi. Pengaturan ini TIDAK dipakai aplikasi. Ubah Provider ke "HTTP" lalu Simpan.'
          : undefined,
        details: [
          `RAG API Endpoint aktif dan merespons dalam ${probeRes.latencyMs}ms (provider: ${cfg.ragProvider})`,
          ...(konfigTapiMock
            ? ['PERINGATAN: provider masih "mock" — Base URL & API Key tersimpan tetapi tidak dipakai. Pilih provider "HTTP".']
            : []),
          ...(probeRes.baseDipakai ? [`Base URL aktif: ${probeRes.baseDipakai}${probeRes.baseDisesuaikan ? ' (disesuaikan otomatis)' : ''}`] : []),
          `Mode yang terdeteksi dari sampel query: ${probeRes.detectedMode}`,
          `Potongan dokumen terambil dari sampel: ${probeRes.sampleChunksCount}`,
          `Jalur A (/extract) dicoba lebih dulu; retrieval biasa dipakai otomatis bila layanan tidak punya /extract`,
          `Ketersediaan metadata angka per dokumen: ${probeRes.hasMetadata ? `${probeRes.sampleChunksCount} potongan siap diambil` : 'tidak ada'}`,
          `Dukungan keluaran JSON terstruktur: ${probeRes.canOutputJson ? 'Tersedia' : 'Tidak tersedia'}`,
          ...(probeRes.catatan || []),
        ],
      });
    } catch (err: any) {
      res.json({
        timestamp: new Date().toISOString(),
        status: 'error',
        latencyMs: 0,
        modeDetected: 'Fallback',
        hasLlmStructuredJson: false,
        hasDocumentMetadata: false,
        sampleChunksCount: 0,
        zodValidationPassed: false,
        details: [
          `RAG provider (${cfg.ragProvider}) tidak merespons: ${err?.message || 'kesalahan tidak diketahui'}`, 
          `Cek Base URL & API Key di Panel Admin → Konfigurasi RAG`, 
          `Generate dashboard tetap berjalan dengan data contoh (fallback)`, 
        ],
      });
    }
  });

  /* ================= PERMINTAAN DATA (User → Admin Instansi) ================= */

  /** Notifikasi alur permintaan — penerimanya selalu jelas, tidak menyebar ke seisi instansi. */
  const notifPermintaan = (args: {
    tenantId: string;
    judul: string;
    isi: string;
    permintaanId: string;
    untukUserId?: string;
    untukRole?: 'admin';
  }) => {
    const notif: NotificationItem = {
      id: `notif-${Date.now()}-prm-${Math.random().toString(36).slice(2, 7)}`,
      tenantId: args.tenantId,
      title: args.judul,
      message: args.isi,
      severity: 'info',
      timestamp: new Date().toISOString(),
      isRead: false,
      sentEmail: false,
      jenis: 'permintaan',
      permintaanId: args.permintaanId,
      untukUserId: args.untukUserId,
      untukRole: args.untukRole,
    };
    db.notifications.unshift(notif);
    db.simpanNotifikasi(notif);
  };

  /** Lampiran yang dikirim UI: rujukan ke berkas KMS yang sudah diunggah lebih dulu. */
  const bacaLampiran = (mentah: unknown): LampiranPermintaan[] => {
    if (!Array.isArray(mentah)) return [];
    const bersih: LampiranPermintaan[] = [];
    for (const item of mentah.slice(0, 20)) {
      const berkasId = String((item as any)?.berkasId || '').trim();
      if (!berkasId) continue;
      if (bersih.some((b) => b.berkasId === berkasId)) continue;
      bersih.push({
        berkasId,
        nama: String((item as any)?.nama || 'Dokumen').trim().slice(0, 200),
        ukuranKb: Number((item as any)?.ukuranKb) || undefined,
        tipe: String((item as any)?.tipe || '').trim().slice(0, 40) || undefined,
        diunggahPada: new Date().toISOString(),
      });
    }
    return bersih;
  };

  app.get('/api/permintaan/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const admin = isAdminRole(session.role);
    const daftar = db.getPermintaanData(tenantId, admin ? undefined : { pemohonId: session.userId });
    const perStatus: Record<string, number> = {};
    for (const s of SEMUA_STATUS) perStatus[s] = 0;
    for (const p of daftar) perStatus[p.status] = (perStatus[p.status] || 0) + 1;
    res.json({
      total: daftar.length,
      perStatus,
      perluTindakan: daftar.filter((p) => p.status === 'baru' || p.status === 'perlu_data').length,
    });
  });

  app.get('/api/permintaan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const admin = isAdminRole(session.role);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (status && !SEMUA_STATUS.includes(status as StatusPermintaan)) {
      return res.status(400).json({ error: 'Status permintaan tidak dikenal.' });
    }
    const daftar = db.getPermintaanData(tenantId, {
      status,
      bidang: typeof req.query.bidang === 'string' ? req.query.bidang : undefined,
      // User hanya melihat permintaannya sendiri; admin melihat seluruh instansi.
      pemohonId: admin ? undefined : session.userId,
    });
    res.json(daftar.map((p) => ({ ...p, ringkasan: ringkasPermintaan(p) })));
  });

  app.post('/api/permintaan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const hasil = validasiPermintaanBaru(req.body || {});
    if (hasil.galat || !hasil.nilai) return res.status(400).json({ error: hasil.galat });
    const baru = db.createPermintaanData({
      tenantId,
      pemohonId: session.userId,
      pemohonNama: session.name,
      bidang: hasil.nilai.bidang,
      dataDiminta: hasil.nilai.dataDiminta,
      arahDashboard: hasil.nilai.arahDashboard,
      prioritas: hasil.nilai.prioritas,
      targetSelesai: hasil.nilai.targetSelesai,
      lampiran: bacaLampiran(req.body?.lampiran),
    });
    notifPermintaan({
      tenantId,
      judul: `Permintaan data baru: ${baru.bidang}`,
      isi: `${baru.pemohonNama} meminta data: ${baru.dataDiminta.slice(0, 140)}${baru.dataDiminta.length > 140 ? '…' : ''}`,
      permintaanId: baru.id,
      untukRole: 'admin',
    });
    tautkanLampiranKePermintaan(tenantId, baru.id, baru.lampiran);
    res.status(201).json(baru);
  });

  app.get('/api/permintaan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const permintaan = db.getPermintaanDataById(req.params.id, tenantId);
    if (!permintaan) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    if (!bolehMelihat(permintaan, session.userId, isAdminRole(session.role))) {
      return res.status(403).json({ error: 'Permintaan ini bukan milik Anda.' });
    }
    res.json({ ...permintaan, ringkasan: ringkasPermintaan(permintaan) });
  });

  app.patch('/api/permintaan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const permintaan = db.getPermintaanDataById(req.params.id, tenantId);
    if (!permintaan) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    const admin = isAdminRole(session.role);

    if (!admin) {
      if (permintaan.pemohonId !== session.userId) {
        return res.status(403).json({ error: 'Permintaan ini bukan milik Anda.' });
      }
      // Periksa niat mengubah status lebih dulu: pesannya harus jujur menyebut
      // sebab yang sebenarnya, bukan "terkunci" yang membuat pemohon bingung.
      if (req.body?.status) {
        return res.status(403).json({ error: 'Status permintaan hanya bisa diubah admin instansi.' });
      }
      if (!bolehSuntingIsi(permintaan, session.userId)) {
        return res.status(409).json({
          error: 'Permintaan sudah dikerjakan admin, isinya tidak bisa diubah lagi. Tambahkan catatan bila ada data susulan.',
          kode: 'TERKUNCI',
        });
      }
      const ubah: Partial<PermintaanData> = {};
      if (req.body?.bidang !== undefined) ubah.bidang = normalisasiBidang(req.body.bidang);
      if (req.body?.dataDiminta !== undefined) {
        const teks = String(req.body.dataDiminta || '').trim();
        if (teks.length < 10) return res.status(400).json({ error: 'Uraian data minimal 10 karakter.' });
        ubah.dataDiminta = teks.slice(0, 2000);
      }
      if (req.body?.arahDashboard !== undefined) {
        ubah.arahDashboard = String(req.body.arahDashboard || '').trim().slice(0, 2000) || undefined;
      }
      if (req.body?.prioritas !== undefined) ubah.prioritas = normalisasiPrioritas(req.body.prioritas);
      if (req.body?.targetSelesai !== undefined) ubah.targetSelesai = normalisasiTanggal(req.body.targetSelesai);
      if (req.body?.lampiran !== undefined) {
        // Lampiran digabung, bukan ditimpa: dokumen lama tetap jadi rujukan admin.
        const tambahan = bacaLampiran(req.body.lampiran).filter(
          (b) => !permintaan.lampiran.some((l) => l.berkasId === b.berkasId)
        );
        ubah.lampiran = [...permintaan.lampiran, ...tambahan];
      }
      const diperbarui = db.updatePermintaanData(permintaan.id, tenantId, ubah);
      tautkanLampiranKePermintaan(tenantId, permintaan.id, ubah.lampiran || []);
      return res.json(diperbarui);
    }

    // Admin instansi: status, penugasan, alasan penolakan, tautan dashboard hasil.
    const ubah: Partial<PermintaanData> = {};
    const statusBaru = req.body?.status as StatusPermintaan | undefined;
    if (statusBaru !== undefined) {
      if (!SEMUA_STATUS.includes(statusBaru)) {
        return res.status(400).json({ error: 'Status permintaan tidak dikenal.' });
      }
      if (!bolehUbahStatus(permintaan.status, statusBaru)) {
        return res.status(409).json({
          error: `Status ${permintaan.status} tidak bisa langsung menjadi ${statusBaru}.`,
          kode: 'TRANSISI_TIDAK_SAH',
        });
      }
      const alasan = String(req.body?.alasanPenolakan || permintaan.alasanPenolakan || '').trim();
      if (statusBaru === 'ditolak' && !alasan) {
        return res.status(400).json({ error: 'Alasan penolakan wajib diisi supaya pemohon tahu sebabnya.' });
      }
      ubah.status = statusBaru;
      if (statusBaru === 'ditolak') ubah.alasanPenolakan = alasan.slice(0, 500);
      if (statusBaru === 'selesai') ubah.selesaiPada = new Date().toISOString();
      if (statusBaru === 'diproses') ubah.ditanganiOleh = session.name;
    }
    if (req.body?.prioritas !== undefined) ubah.prioritas = normalisasiPrioritas(req.body.prioritas);
    if (req.body?.ditanganiOleh !== undefined) {
      ubah.ditanganiOleh = String(req.body.ditanganiOleh || '').trim().slice(0, 120) || session.name;
    }
    if (req.body?.dashboardId !== undefined) {
      ubah.dashboardId = String(req.body.dashboardId || '').trim() || undefined;
    }
    const diperbarui = db.updatePermintaanData(permintaan.id, tenantId, ubah);
    if (statusBaru && statusBaru !== permintaan.status) {
      notifPermintaan({
        tenantId,
        judul: `Permintaan ${permintaan.bidang} kini ${statusBaru.replace('_', ' ')}`,
        isi:
          statusBaru === 'ditolak'
            ? `Ditolak: ${ubah.alasanPenolakan}`
            : `Ditangani ${session.name}. ${statusBaru === 'perlu_data' ? 'Ada data yang perlu Anda lengkapi.' : ''}`.trim(),
        permintaanId: permintaan.id,
        untukUserId: permintaan.pemohonId,
      });
    }
    res.json(diperbarui);
  });

  app.post('/api/permintaan/:id/catatan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const permintaan = db.getPermintaanDataById(req.params.id, tenantId);
    if (!permintaan) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    const admin = isAdminRole(session.role);
    if (!bolehMelihat(permintaan, session.userId, admin)) {
      return res.status(403).json({ error: 'Permintaan ini bukan milik Anda.' });
    }
    const pesan = String(req.body?.pesan || '').trim();
    if (!pesan) return res.status(400).json({ error: 'Catatan tidak boleh kosong.' });
    if (pesan.length > 2000) return res.status(400).json({ error: 'Catatan terlalu panjang (maksimal 2000 karakter).' });

    // Bola berpindah: pemohon melengkapi → kembali ke admin; admin menanggapi → dikerjakan.
    const patch: Partial<PermintaanData> = {};
    let memindahkan = false;
    if (!admin && permintaan.status === 'perlu_data') {
      patch.status = 'diproses';
      memindahkan = true;
    } else if (admin && permintaan.status === 'baru') {
      patch.status = 'diproses';
      patch.ditanganiOleh = session.name;
      memindahkan = true;
    }
    const lampiranBaru = bacaLampiran(req.body?.lampiran);
    if (lampiranBaru.length > 0) {
      patch.lampiran = [
        ...permintaan.lampiran,
        ...lampiranBaru.filter((b) => !permintaan.lampiran.some((l) => l.berkasId === b.berkasId)),
      ];
    }
    const diperbarui = db.tambahCatatanPermintaan(
      permintaan.id,
      tenantId,
      {
        id: `ctt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        olehUserId: session.userId,
        olehNama: session.name,
        olehRole: session.role as UserRole,
        pesan: pesan.slice(0, 2000),
        pada: new Date().toISOString(),
        mengubahStatus: memindahkan,
      },
      patch
    );
    tautkanLampiranKePermintaan(tenantId, permintaan.id, lampiranBaru);
    notifPermintaan({
      tenantId,
      judul: `Catatan baru: ${permintaan.bidang}`,
      isi: `${session.name}: ${pesan.slice(0, 140)}${pesan.length > 140 ? '…' : ''}`,
      permintaanId: permintaan.id,
      ...(admin ? { untukUserId: permintaan.pemohonId } : { untukRole: 'admin' as const }),
    });
    res.status(201).json(diperbarui);
  });

  app.delete('/api/permintaan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const permintaan = db.getPermintaanDataById(req.params.id, tenantId);
    if (!permintaan) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    const admin = isAdminRole(session.role);
    if (!admin) {
      if (permintaan.pemohonId !== session.userId) {
        return res.status(403).json({ error: 'Permintaan ini bukan milik Anda.' });
      }
      // Setelah admin menyentuh permintaan, penghapusan hanya lewat admin agar jejaknya tetap ada.
      if (permintaan.status !== 'baru') {
        return res.status(409).json({ error: 'Permintaan yang sudah diproses tidak bisa dihapus sendiri.' });
      }
    }
    db.deletePermintaanData(permintaan.id, tenantId);
    // Notifikasi yang menunjuk permintaan ini ikut dibuang supaya lonceng tidak
    // menyisakan tautan mati.
    for (const n of db.notifications.filter((x) => x.permintaanId === permintaan.id)) {
      db.hapusNotifikasi(n.id);
    }
    res.json({ success: true });
  });

  /* ================= ANALISIS DOKUMEN & BUTIR DATA (Fase 2) ================= */

  /**
   * Sidik basis dokumen instansi (untuk mendeteksi dokumen BARU). Satu panggilan
   * daftar berkas — bukan panggilan RAG, jadi tidak memakan token. Gagal
   * mengambil daftar bukan alasan menggagalkan analisis: sidiknya saja yang
   * tidak dipakai.
   */
  const sidikKbInstansi = async (req: Request, session: SessionPayload): Promise<string | undefined> =>
    sidikKbUntukTenant(effectiveTenantId(req, session));

  /** Kuota analisis instansi ini — dipakai UI untuk memberi tahu sisa hari ini. */
  app.get('/api/analisis/kuota', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kuota = (db.systemConfig as any).kuotaAnalisisHarian ?? KUOTA_ANALISIS_BAWAAN;
    const terpakai = pemakaianHariIni(db.getAnalisisDokumen(tenantId));
    res.json({ kuota, terpakai, sisa: sisaKuota(terpakai, kuota) });
  });

  /**
   * Analisis mana yang perlu dibaca ulang karena ada dokumen baru di basis
   * instansi. Ditampilkan sebagai pemberitahuan — tidak disegarkan diam-diam,
   * karena analisis ulang memakan kuota.
   */
  app.get('/api/analisis/kesegaran', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh memeriksa kesegaran analisis.')) return;
    const tenantId = effectiveTenantId(req, session);
    const sidikSekarang = await sidikKbInstansi(req, session);
    if (!sidikSekarang) {
      return res.json({
        sidikKb: '',
        jumlahDokumen: 0,
        perluDibacaUlang: [],
        catatan:
          'Instansi ini belum dipetakan ke repositori berkas, jadi dokumen baru belum bisa dipantau otomatis.',
      });
    }
    const analisis = db.getAnalisisDokumen(tenantId).filter((a) => a.status === 'selesai');
    // Satu baris per berkas: baris lama yang sudah digantikan tidak dihitung basi.
    const perlu = perluSegarTerbaru(tenantId, sidikSekarang);
    res.json({
      sidikKb: sidikSekarang,
      jumlahDokumen: new Set(analisis.map((a) => a.berkasId)).size,
      perluDibacaUlang: perlu.map((a) => ({ id: a.id, judulBerkas: a.judulBerkas, berkasId: a.berkasId })),
      catatan:
        perlu.length === 0
          ? 'Semua hasil analisis masih sesuai dengan dokumen yang ada.'
          : `${perlu.length} analisis dibuat sebelum ada dokumen baru. Baca ulang bila indikator barunya dibutuhkan.`,
    });
  });

  /**
   * DAFTAR BUTIR DATA INSTANSI — bahan layar "pilih data" saat dashboard dibuat
   * dari permintaan pengguna.
   *
   * Tanpa endpoint ini pemilih hanya bisa melihat butir SATU permintaan (lewat
   * `/api/analisis`), sehingga dari Workspace terlihat seolah belum ada data
   * sama sekali. Non-admin hanya melihat butir dari permintaannya sendiri.
   */
  /**
   * GABUNG BUTIR LINTAS DOKUMEN (dihitung setiap kali daftar dibaca).
   *
   * Satu indikator bisa tersebar di beberapa berkas: "Anggaran Jan 2026" di
   * dokumen anggaran dan "Anggaran Okt 2026" di berkas susulan. Selama nama
   * indikatornya sama dan periodenya berbeda, keduanya adalah data yang sama
   * beda waktu — jadi ditampilkan sebagai SATU butir dengan deret per periode.
   *
   * Penggabungan dilakukan saat membaca, bukan disimpan, supaya otomatis ikut
   * begitu ada dokumen baru: tidak perlu analisis ulang dokumen lama dan tidak
   * ada duplikasi data di basis. Butir yang tidak punya periode dibiarkan apa
   * adanya, dan kelompok yang periodenya sama persis tidak digabung.
   */
  function gabungButirLintasDokumen(daftar: ButirData[]): ButirData[] {
    const normal = (t: unknown) =>
      String(t || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    /**
     * NAMA INTI — nama butir tanpa keterangan waktu.
     *
     * "Pendapatan Jan 2026", "Pendapatan Feb 2026", dan "Pendapatan Mar 2026"
     * adalah indikator yang sama pada periode berbeda. Tanpa membuang bagian
     * waktu dari namanya, ketiganya tidak pernah bertemu dan muncul sebagai
     * kartu terpisah — persis keluhan "ini kan masih satu kesatuan".
     *
     * Ekor angka (mis. "· 15231281407.649996") juga dibuang: itu nilai total
     * kolom yang terpakai sebagai judul, bukan bagian dari nama indikator.
     */
    const buangPeriode = (nama: unknown): string => {
      let s = ` ${String(nama || ' ')} `;
      /**
       * Bulan hanya dibuang kalau berpasangan dengan tahun ("Jan 2026"). Bulan
       * yang berdiri sendiri bisa jadi nama wilayah ("FEB" = Fakultas Ekonomi
       * dan Bisnis), dan membuangnya membuat nama butir kehilangan awalan.
       */
      s = s.replace(
        /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|aug|sep|sept|okt|oct|nov|des|dec)\b[\s,./-]*(19|20)\d{2}\b/gi,
        ' '
      );
      s = s.replace(/\b(19|20)\d{2}\b/g, ' ');
      s = s.replace(/\s*[·]\s*[-+]?\d[\d.,]*\s*$/g, ' ');
      // Keterangan kolom bukan bagian nama indikator; ia jadi identitas sendiri.
      s = s.replace(/\s*\(?kol(?:om)?\s+[A-Z]{1,2}\)?\s*$/gi, ' ');
      // "per periode" menerangkan cara ekstraksi, bukan nama indikator.
      s = s.replace(/\s*[·]?\s*per\s+periode\s*$/gi, ' ');
      s = s.replace(/\s+/g, ' ').trim();
      return s.replace(/[·\-\s]+$/, '').trim() || String(nama || '').trim();
    };

    /**
     * Huruf kolom bila namanya menyebutkannya, mis. "… (kol B)" atau "· kolom H".
     * Dipakai sebagai identitas kolom supaya kolom B Januari dan kolom B Februari
     * bertemu di butir yang sama, sementara kolom H tetap terpisah.
     */
    const kolomDariNama = (nama: unknown): string => {
      const m = String(nama || '').match(/kol(?:om)?\s+([A-Z]{1,2})\)?\s*$/i);
      return m ? m[1].toUpperCase() : '';
    };

    /** Nomor urut id butir, dipakai mengurutkan kolom yang namanya tidak jelas. */
    const nomorId = (b: ButirData): number => {
      const m = String(b.id).match(/(\d+)$/);
      return m ? Number(m[1]) : 0;
    };

    const URUT = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
    const kunciPeriode = (p: string): number => {
      const m = String(p || '').match(/^([A-Za-z]+)\s*(\d{4})?/);
      if (!m) return Number.MAX_SAFE_INTEGER;
      const i = URUT.indexOf(m[1].slice(0, 3).toLowerCase());
      const tahun = m[2] ? Number(m[2]) : 0;
      return (i < 0 ? 99 : i) + tahun * 12;
    };
    const periodeDari = (b: ButirData): string[] => {
      const set = new Set<string>();
      if (b.periode) set.add(b.periode);
      for (const p of b.periodeTersedia || []) set.add(p);
      return [...set];
    };

    /**
     * Deret 1, 2, 3, … persis: kolom nomor urut yang ikut teranalisis.
     * Butir seperti ini tidak pernah berarti apa pun sebagai grafik.
     */
    const deretNomorUrut = (b: ButirData): boolean => {
      const seri = b.seri || [];
      if (seri.length === 0) return false;
      return seri.every((s) => {
        const d = s.data || [];
        if (d.length < 3) return false;
        // Nomor urut: 1, 2, 3, …
        const nomor = d.every((v, i) => Number.isInteger(v) && (i === 0 ? v <= 2 : v - d[i - 1] === 1));
        if (nomor) return true;
        // Kode akun: bilangan bulat besar yang naik rapat (410201, 410302, …).
        const bulat = d.every((v) => Number.isInteger(v));
        if (!bulat || d[0] < 10000) return false;
        const naik = d.every((v, i) => i === 0 || v > d[i - 1]);
        return naik && Math.max(...d.slice(1).map((v, i) => v - d[i])) <= 2000;
      });
    };

    const kelompok = new Map<string, ButirData[]>();
    const tanpaPeriode: ButirData[] = [];
    for (const b of daftar) {
      if (deretNomorUrut(b)) continue;
      const periode = periodeDari(b);
      if (periode.length === 0) {
        tanpaPeriode.push(b);
        continue;
      }
      const kunci = `${normal(buangPeriode(b.nama))}|${kolomDariNama(b.nama)}`;
      const isi = kelompok.get(kunci) ?? [];
      isi.push(b);
      kelompok.set(kunci, isi);
    }

    /**
     * PECAH KELOMPOK YANG PERIODENYA BERTUMPUK.
     *
     * Satu lembar bulanan biasanya punya beberapa kolom angka (anggaran,
     * realisasi, selisih). Setelah keterangan waktu dibuang, ketiganya jatuh ke
     * kelompok yang sama dan periodenya bertabrakan. Butir seperti itu dipisah
     * menurut urutan kolomnya, sehingga "kolom ke-1" Jan sampai Agu menjadi satu
     * butir dengan filter periode, dan begitu pula kolom ke-2 dan ke-3.
     */
    /** Nama akhir sebuah kelompok: inti + identitas kolom bila ada. */
    const namaKelompok = (kunci: string, utama: ButirData): string => {
    const dasar = buangPeriode(utama.nama);
    if (!dasar) return String(utama.nama || '').trim();
      /** Nama yang sudah menyebut kolom ("Kolom M", "… (kol B)") tidak perlu tambahan. */
      const sudahSebutKolom = /kol(?:om)?\s+[A-Z]{1,2}\b/i.test(dasar);
      const [inti, sisa] = kunci.split('|');
      const huruf = (sisa || '').split('#')[0];
      const posisi = (sisa || '').split('#')[1];
      if (sudahSebutKolom) return dasar;
      if (huruf) return `${dasar} · kolom ${huruf}`;
      /**
       * Penanda posisi TIDAK ditempelkan ke nama: nomornya urutan internal, bukan
       * huruf kolom, dan menyesatkan. Butir yang namanya jadi kembar dibedakan
       * lewat nama dokumennya (lihat `bedakanDokumen`).
       */
      void posisi;
      void inti;
      return dasar;
    };

    const kelompokAkhir = new Map<string, ButirData[]>();
    for (const [kunci, anggota] of kelompok) {
      const perPeriode = new Map<string, ButirData[]>();
      for (const a of anggota) {
        for (const p of periodeDari(a)) {
          const k = normal(p);
          const isi = perPeriode.get(k) ?? [];
          isi.push(a);
          perPeriode.set(k, isi);
        }
      }
      const bertumpuk = [...perPeriode.values()].some((isi) => isi.length > 1);
      if (!bertumpuk) {
        kelompokAkhir.set(kunci, anggota);
        continue;
      }
      const posisi = new Map<ButirData, number>();
      for (const [, isi] of perPeriode) {
        isi.sort((a, b) => nomorId(a) - nomorId(b));
        isi.forEach((a, i) => {
          if (!posisi.has(a)) posisi.set(a, i);
        });
      }
      for (const a of anggota) {
        const pos = posisi.get(a) ?? 0;
        const k = `${kunci}#${pos}`;
        const isi = kelompokAkhir.get(k) ?? [];
        isi.push(a);
        kelompokAkhir.set(k, isi);
      }
    }

    const hasil: ButirData[] = [];
    for (const [kunciKelompok, anggota] of kelompokAkhir) {
      const semuaPeriode = new Set<string>();
      for (const a of anggota) for (const p of periodeDari(a)) semuaPeriode.add(p);
      // Satu anggota saja, atau periodenya sama persis (hasil analisis ulang):
      // tidak ada yang perlu digabung.
      if (anggota.length < 2 || semuaPeriode.size < 2) {
        const utama = anggota[0];
        // Kelompok yang dipecah per kolom tetap memakai nama bersih + identitas kolom.
        const namaBaru = namaKelompok(kunciKelompok, utama);
        hasil.push({
          ...utama,
          nama: namaBaru,
          ...(semuaPeriode.size > 1
            ? { periodeTersedia: [...semuaPeriode].sort((a, b) => kunciPeriode(a) - kunciPeriode(b)) }
            : {}),
        });
        continue;
      }
      const urut = [...anggota].sort((a, b) => String(a.dibuatPada).localeCompare(String(b.dibuatPada)));
      const utama = urut[0];
      const seri: any[] = [];
      const terpakai = new Set<string>();
      for (const a of urut) {
        const daftarSeri = a.seri && a.seri.length > 0 ? a.seri : [];
        const periodeAnggota = periodeDari(a);
        for (let i = 0; i < daftarSeri.length; i += 1) {
          const sr = daftarSeri[i];
          // Nama deret dijadikan label periode supaya legenda dan filter cocok.
          const label = daftarSeri.length === periodeAnggota.length ? periodeAnggota[i] : sr.nama || periodeAnggota[i];
          const kunci = `${normal(label)}|${(sr.data || []).join(',')}`;
          if (terpakai.has(kunci)) continue;
          terpakai.add(kunci);
          seri.push({ ...sr, nama: String(label || sr.nama || '') });
        }
      }
      if (seri.length < 2) {
        hasil.push(utama);
        continue;
      }
      const dokumen = [...new Set(urut.map((a) => a.sitasi?.dokumen).filter(Boolean))];
      hasil.push({
        ...utama,
        seri,
        periodeTersedia: [...semuaPeriode].sort((a, b) => kunciPeriode(a) - kunciPeriode(b)),
        sitasi: {
          dokumen: dokumen.join(' · ') || utama.sitasi?.dokumen || '',
          ...(utama.sitasi?.halaman ? { halaman: utama.sitasi.halaman } : {}),
          kutipan: `${semuaPeriode.size} periode dari ${urut.length} butir: ${[...semuaPeriode].slice(0, 6).join(', ')}${semuaPeriode.size > 6 ? ' dan lainnya' : ''}`,
        },
        // Nama tanpa keterangan waktu: periodenya sudah jadi filter di kartu.
        nama: namaKelompok(kunciKelompok, utama),
        // Jejak anggota dipakai saat menyusun halaman supaya angka tiap periode ikut.
        ...({ anggotaIds: urut.map((a) => a.id) } as any),
      });
    }
    /**
     * Nama kembar dari dokumen berbeda (mis. lembar "FEB" ada di Sipil SPM dan
     * di Tim Pengadaan) dibedakan dengan nama dokumennya, bukan dengan huruf
     * kolom yang tidak ada hubungannya.
     */
    const singkatDok = (d: unknown): string =>
      String(d || '')
        .replace(/\.(xlsx|xlsm|xls|csv|pdf|docx)$/i, '')
        .split('·')[0]
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 28);
    const dipakai = new Map<string, Set<string>>();
    const bedakanDokumen = (b: ButirData): ButirData => {
      const dasar = String(b.nama || '').trim();
      const dok = singkatDok(b.sitasi?.dokumen);
      const set = dipakai.get(dasar) ?? new Set<string>();
      if (set.size > 0 && dok && !set.has(dok)) {
        const namaBaru = `${dasar} (${dok})`;
        const setBaru = dipakai.get(namaBaru) ?? new Set<string>();
        setBaru.add(dok);
        dipakai.set(namaBaru, setBaru);
        return { ...b, nama: namaBaru };
      }
      set.add(dok);
      dipakai.set(dasar, set);
      return b;
    };
    // Huruf kolom ("· kolom D", "(kol Q)") diganti keterangan dari isi angkanya.
    return namaiDariIsi([...hasil, ...tanpaPeriode]).map(bedakanDokumen);
  }

  app.get('/api/butir-data', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const status = String(req.query.status || '').trim() || undefined;
    const kategori = String(req.query.kategori || '').trim() || undefined;

    let butir = db.getButirData(tenantId, { status, kategori });
    if (!isAdminRole(session.role)) {
      const milik = new Set(
        db.permintaanData.filter((p) => p.tenantId === tenantId && p.pemohonId === session.userId).map((p) => p.id)
      );
      butir = butir.filter((b) => b.permintaanId && milik.has(b.permintaanId));
    }

    // Data yang sama beda periode (termasuk dari dokumen berbeda) tampil sebagai
    // satu butir. Dihitung di sini supaya dokumen baru langsung ikut tergabung.
    butir = gabungButirLintasDokumen(butir);

    const perKategori: Record<string, number> = {};
    for (const b of butir) {
      const k = b.kategori || 'Umum';
      perKategori[k] = (perKategori[k] ?? 0) + 1;
    }

    /**
     * RINGKASAN SUMBER DATA — dipakai halaman Pilih Data untuk menjawab "kenapa
     * kosong". Tanpa ini, dokumen yang sudah diunggah tetapi analisisnya gagal
     * terlihat sama persis dengan instansi yang memang belum punya dokumen.
     */
    const semuaButir = db.getButirData(tenantId);
    const menunggu = semuaButir.filter((b) => b.status !== 'disetujui').length;
    const analisis = db.getAnalisisDokumen(tenantId);
    /**
     * Kegagalan yang SUDAH TERGANTIKAN tidak lagi ditampilkan.
     *
     * Dulu kotak peringatan terus berbunyi "dokumen gagal dianalisis" padahal
     * dokumen yang sama sudah berhasil dibaca sesudahnya — admin lalu menekan
     * tombol ulang untuk masalah yang sudah beres. Sekarang yang dihitung hanya
     * kegagalan terakhir per berkas.
     */
    const suksesTerbaru = new Map<string, string>();
    for (const a of analisis) {
      if (a.status !== 'selesai') continue;
      const t = suksesTerbaru.get(a.berkasId);
      if (!t || a.dibuatPada > t) suksesTerbaru.set(a.berkasId, a.dibuatPada);
    }
    const gagal = analisis
      .filter((a) => a.status === 'gagal')
      .filter((a) => {
        const t = suksesTerbaru.get(a.berkasId);
        return !t || t < a.dibuatPada;
      })
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        berkasId: a.berkasId,
        judul: a.judulBerkas,
        galat: a.galat || 'Analisis gagal tanpa keterangan.',
        dibuatPada: a.dibuatPada,
      }));

    res.json({
      total: butir.length,
      perKategori,
      butir,
      ringkas: {
        dokumen: new Set(analisis.map((a) => a.berkasId)).size,
        selesai: suksesTerbaru.size,
        berjalan: analisis.filter((a) => a.status === 'antri' || a.status === 'proses').length,
        gagal,
        menunggu,
        diperbaruiPada: new Date().toISOString(),
      },
    });
  });

  app.get('/api/analisis', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const permintaanId = String(req.query.permintaanId || '').trim() || undefined;
    let daftar = db.getAnalisisDokumen(tenantId, {
      permintaanId,
      status: String(req.query.status || '').trim() || undefined,
    });
    // Analisis otomatis bisa selesai SEBELUM lampirannya menempel ke permintaan.
    // Barisnya tetap ditampilkan di panel permintaan itu — kalau tidak, admin
    // melihat "belum dianalisis" padahal dokumennya sudah dibaca dan butirnya ada.
    if (permintaanId) {
      const permintaan = db.getPermintaanDataById(permintaanId, tenantId);
      const berkas = new Set((permintaan?.lampiran || []).map((l) => l.berkasId));
      if (berkas.size > 0) {
        const sudahAda = new Set(daftar.map((a) => a.id));
        for (const a of db.getAnalisisDokumen(tenantId)) {
          if (sudahAda.has(a.id) || !berkas.has(a.berkasId)) continue;
          if (req.query.status && a.status !== String(req.query.status)) continue;
          daftar = [...daftar, a];
        }
      }
    }
    // User hanya boleh melihat analisis untuk permintaannya sendiri.
    if (!isAdminRole(session.role)) {
      const milikSaya = new Set(
        db.permintaanData.filter((p) => p.tenantId === tenantId && p.pemohonId === session.userId).map((p) => p.id)
      );
      daftar = daftar.filter((a) => a.permintaanId && milikSaya.has(a.permintaanId));
    }
    res.json(daftar.map((a) => ({ ...a, butir: undefined })));
  });

  /**
   * Jalankan analisis satu dokumen. Sinkron: admin menunggu hasilnya, dan satu
   * dokumen biasanya selesai di bawah satu menit.
   */
  /**
   * Sidik basis dokumen untuk satu instansi, tanpa perlu `req`. Dipakai jalur
   * otomatis (antrean) yang tidak punya permintaan HTTP.
   */
  const sidikKbUntukTenant = async (tenantId: string): Promise<string | undefined> => {
    try {
      const tenant = db.tenants.find((t) => t.id === tenantId);
      const { organizationId } = await projectKmsEfektif(tenant);
      if (!organizationId) return undefined;
      const daftar = await klienKms().daftarBerkas(organizationId);
      return sidikKb(Array.isArray(daftar) ? daftar : []);
    } catch {
      return undefined;
    }
  };

  /**
   * INTI ANALISIS SATU DOKUMEN.
   *
   * Dipakai dua jalur: admin menekan tombol (`POST /api/analisis`) dan antrean
   * otomatis setelah dokumen masuk. Karena itu fungsi ini tidak memeriksa peran
   * — pemanggil yang menentukan siapa boleh memicu. Yang dijaga di sini: kuota
   * harian, cache (dokumen tak berubah tidak dibaca ulang ke RAG), dan audit.
   */
  async function analisisSatuBerkas(masukan: {
    tenantId: string;
    berkasId: string;
    judulBerkas: string;
    permintaanId?: string;
    ukuranKb?: number;
    tipe?: string;
    segarkan?: boolean;
    abaikanKuota?: boolean;
    sumber: 'manual' | 'otomatis';
    pelaku?: { userId: string; name: string };
  }): Promise<{ kode: number; body: any }> {
    const { tenantId, berkasId, judulBerkas } = masukan;

    const permintaanId = masukan.permintaanId;
    const permintaan = permintaanId
      ? db.permintaanData.find((p) => p.id === permintaanId && p.tenantId === tenantId)
      : undefined;
    if (permintaanId && !permintaan) {
      return { kode: 404, body: { error: 'Permintaan tidak ditemukan di instansi ini.' } };
    }

    const tenant = db.tenants.find((t) => t.id === tenantId);
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const sector = (permintaan ? tenant?.sector : tenant?.sector) || 'pdam';

    // ---- CACHE ----
    // Dokumen yang isinya belum berubah tidak dibaca ulang ke RAG. Yang membuat
    // cache batal hanya: berkasnya diganti, ada dokumen baru di basis instansi,
    // cache terlalu tua, atau admin minta segarkan.
    //
    // Lampiran dicari di SELURUH permintaan instansi, bukan hanya yang sedang
    // dibuka: analisis otomatis berjalan beberapa saat setelah unggah, ketika
    // berkasnya belum tentu sudah menempel ke permintaan. Kalau sidiknya dihitung
    // dari konteks yang berbeda-beda, dokumen yang sama dianggap "berubah" dan
    // dibaca ulang — kuota habis tanpa ada isi dokumen yang berubah.
    const lampiran =
      permintaan?.lampiran.find((l) => l.berkasId === berkasId) ??
      db.permintaanData
        .filter((p) => p.tenantId === tenantId)
        .flatMap((p) => p.lampiran || [])
        .find((l) => l.berkasId === berkasId);
    const sidikSekarang = sidikDokumen({
      berkasId,
      ukuranKb: lampiran?.ukuranKb ?? masukan.ukuranKb,
      tipe: lampiran?.tipe ?? masukan.tipe,
      diunggahPada: lampiran?.diunggahPada,
    });
    const sidikKbSekarang = await sidikKbUntukTenant(tenantId);
    const paksa = masukan.segarkan === true;
    const putusan = putusanCache(db.getAnalisisDokumen(tenantId, { berkasId }), {
      berkasId,
      sidikDokumen: sidikSekarang,
      sidikKb: sidikKbSekarang,
      paksa,
    });

    if (putusan.pakai) {
      const tersimpan = db.getAnalisisDokumenById(putusan.analisisId, tenantId);
      if (tersimpan) {
        const kuotaKini = (db.systemConfig as any).kuotaAnalisisHarian ?? KUOTA_ANALISIS_BAWAAN;
        const terpakai = pemakaianHariIni(db.getAnalisisDokumen(tenantId));
        return {
          kode: 200,
          body: {
            analisis: tersimpan,
            butir: db.getButirData(tenantId, { analisisId: tersimpan.id }),
            rekomendasi: tersimpan.rekomendasiTemplate || [],
            dibuang: 0,
            sisaKuota: sisaKuota(terpakai, kuotaKini),
            dariCache: true,
            catatanCache: putusan.alasan,
          },
        };
      }
    }

    const ekstraktor: Ekstraktor = async ({ prompt }) => {
      // Spreadsheet dibaca langsung dari berkasnya: isi sel tidak bisa diandalkan
      // lewat pencarian vektor RAG.
      const lembar = await ekstrakLembarBerkas(tenant, berkasId, judulBerkas);
      if (lembar) return { ringkasan: lembar.ringkasan, butir: lembar.butir, metode: 'tabel-lokal' as const };
      const hasil = await ragClient.query({
        prompt,
        sector: sector as BumdSector,
        instansi: tenant?.name,
        kbId,
        mode: 'structured',
        strictGrounding: true,
        dokumenTarget: judulBerkas,
        sapuanPenuh: true,
        timeoutMs: 240_000,
      });
      const mentah = petakanKeluaranRag(hasil.structuredJson, judulBerkas);
      const ringkasan =
        (hasil.structuredJson && (hasil.structuredJson as any).description) || hasil.answer || undefined;
      return { ringkasan, butir: mentah };
    };

    const konteks = {
      tenantId,
      analisisId: '',
      berkasId,
      ...(permintaanId ? { permintaanId } : {}),
      judulBerkas,
      bidang: permintaan?.bidang,
      dataDiminta: permintaan?.dataDiminta,
      arahDashboard: permintaan?.arahDashboard,
      instansi: tenant?.name,
    };

    try {
      const hasil = await jalankanAnalisis({
        penyimpanan: db as any,
        ekstraktor,
        konteks,
        abaikanKuota: masukan.abaikanKuota === true,
        sidik: { dokumen: sidikSekarang, kb: sidikKbSekarang },
      });
      return {
        kode: hasil.analisis.status === 'gagal' ? 422 : 201,
        body: {
          analisis: hasil.analisis,
          butir: hasil.butir,
          rekomendasi: hasil.rekomendasi,
          dibuang: hasil.dibuang,
          sisaKuota: hasil.sisaKuota,
          dariCache: false,
          catatanCache: putusan.alasan,
        },
      };
    } catch (err) {
      return { kode: 500, body: { error: jelaskanError(err) } };
    }
  }

  /**
   * ANTREAN OTOMATIS.
   *
   * Dokumen yang baru masuk langsung dibaca di latar belakang, jadi admin tidak
   * perlu menekan tombol apa pun untuk melihat "data apa saja yang ada".
   * Analisis lama yang basi karena dokumen baru ikut diantrekan, tetapi dibatasi
   * `AUTO_SEGARKAN_MAKS` (bawaan 2) supaya satu unggahan tidak menghabiskan
   * kuota 20 analisis/hari. Isi 0 untuk mematikan penyegaran otomatis.
   */
  const AUTO_SEGARKAN_MAKS = Math.max(0, Number(process.env.AUTO_SEGARKAN_MAKS ?? 2) || 0);

  pasangKetergantunganAntrean({
    jalankan: async (pekerjaan) => {
      // Tautan permintaan dicari lagi saat pekerjaan mulai: berkas diunggah
      // lebih dulu, lampirannya menempel beberapa saat kemudian. Tanpa ini,
      // analisis berjalan tanpa konteks bidang/data yang diminta.
      const tertaut = db.permintaanData.find(
        (p) => p.tenantId === pekerjaan.tenantId && p.lampiran?.some((l) => l.berkasId === pekerjaan.berkasId)
      );
      const hasil = await analisisSatuBerkas({
        tenantId: pekerjaan.tenantId,
        berkasId: pekerjaan.berkasId,
        judulBerkas: pekerjaan.judulBerkas,
        permintaanId: pekerjaan.permintaanId || tertaut?.id,
        segarkan: pekerjaan.sebab === 'segarkan',
        sumber: 'otomatis',
      });
      const status = hasil.body?.analisis?.status || (hasil.kode < 400 ? 'selesai' : 'gagal');
      // Tautan permintaan bisa muncul SAAT analisis berjalan (berkas diunggah
      // dulu, lampirannya menempel beberapa detik kemudian). Setelah selesai,
      // barisnya diarahkan ke permintaan itu — kalau tidak, panel permintaan
      // menampilkan "belum dianalisis" padahal hasilnya sudah ada di DB.
      const analisisId = hasil.body?.analisis?.id;
      if (analisisId) {
        const taut = db.permintaanData.find(
          (p) => p.tenantId === pekerjaan.tenantId && p.lampiran?.some((l) => l.berkasId === pekerjaan.berkasId)
        );
        const baris = db.getAnalisisDokumenById(analisisId, pekerjaan.tenantId);
        if (taut && baris && !baris.permintaanId) {
          db.updateAnalisisDokumen(analisisId, pekerjaan.tenantId, { permintaanId: taut.id });
          for (const b of db.getButirData(pekerjaan.tenantId, { analisisId })) {
            if (!b.permintaanId) db.updateButirData(b.id, pekerjaan.tenantId, { permintaanId: taut.id });
          }
        }
      }
      return { status, pesan: hasil.body?.analisis?.pesanGalat || hasil.body?.error };
    },
    log: (pesan) => console.log(pesan),
  });

  /**
   * Analisis basi, DIBATASI satu baris per berkas (yang terbaru).
   *
   * `perluSegarKarenaKb` menandai setiap baris lama yang sidiknya berbeda. Kalau
   * dipakai apa adanya, satu dokumen yang sudah dibaca ulang tetap "basi" lewat
   * baris lamanya, sehingga setiap unggahan berikutnya membaca ulang dokumen yang
   * sama — kuota habis tanpa data baru.
   */
  const perluSegarTerbaru = (tenantId: string, sidikSekarang: string): AnalisisDokumen[] => {
    const terbaru = new Map<string, AnalisisDokumen>();
    for (const a of db.getAnalisisDokumen(tenantId)) {
      if (a.status !== 'selesai') continue;
      const lama = terbaru.get(a.berkasId);
      if (!lama || String(a.dibuatPada).localeCompare(String(lama.dibuatPada)) > 0) terbaru.set(a.berkasId, a);
    }
    /**
     * Angka yang dibaca langsung dari sel berkas (`tabel-lokal`) tidak
     * bergantung pada indeks basis dokumen. Dokumen baru masuk tidak membuat
     * hasilnya basi, jadi tidak perlu diantrekan ulang — kalau ikut diantrekan,
     * butir dokumen lain sempat terhapus dan dibangun ulang hanya karena ada
     * satu unggahan baru.
     */
    return perluSegarKarenaKb([...terbaru.values()], sidikSekarang).filter((a) => a.metode !== 'tabel-lokal');
  };

  /**
   * Antrekan dokumen baru + analisis yang basi. Tidak menunggu hasil: pemanggil
   * (`segarkanSetelahDokumen`) berjalan di latar belakang.
   */
  const antrePenyegaranAnalisis = async (
    tenantId: string,
    dokumenBaru?: { berkasId: string; judulBerkas: string }
  ): Promise<number> => {
    let diantrekan = 0;
    if (dokumenBaru?.berkasId && dokumenBaru.judulBerkas) {
      // Kalau berkas ini terlampir di sebuah permintaan, analisisnya ditautkan ke
      // permintaan itu supaya panel permintaan langsung menampilkan hasilnya.
      const tertaut = db.permintaanData.find(
        (p) => p.tenantId === tenantId && p.lampiran?.some((l) => l.berkasId === dokumenBaru.berkasId)
      );
      if (
        antreAnalisisOtomatis({
          tenantId,
          berkasId: dokumenBaru.berkasId,
          judulBerkas: dokumenBaru.judulBerkas,
          permintaanId: tertaut?.id,
          sebab: 'unggah',
        })
      ) {
        diantrekan += 1;
      }
    }
    if (AUTO_SEGARKAN_MAKS === 0) return diantrekan;
    const sidikSekarang = await sidikKbUntukTenant(tenantId);
    if (!sidikSekarang) return diantrekan;
    const perlu = perluSegarTerbaru(tenantId, sidikSekarang);
    for (const a of perlu.slice(0, AUTO_SEGARKAN_MAKS)) {
      if (
        antreAnalisisOtomatis({
          tenantId,
          berkasId: a.berkasId,
          judulBerkas: a.judulBerkas,
          permintaanId: a.permintaanId,
          sebab: 'segarkan',
        })
      ) {
        diantrekan += 1;
      }
    }
    return diantrekan;
  };

  /**
   * Lampiran menempel ke sebuah permintaan: analisisnya ikut ditautkan.
   *
   * Dokumen biasanya sudah dibaca otomatis saat diunggah. Membacanya ulang di
   * sini hanya membakar kuota tanpa menambah data, jadi yang dilakukan:
   * arahkan analisis & butir yang ada ke `permintaanId`, dan hanya mengantrekan
   * kalau dokumen itu memang belum pernah dibaca.
   */
  const tautkanLampiranKePermintaan = (
    tenantId: string,
    permintaanId: string,
    lampiran: LampiranPermintaan[]
  ): void => {
    for (const l of lampiran) {
      if (!l?.berkasId) continue;
      const ada = db.getAnalisisDokumen(tenantId, { berkasId: l.berkasId });
      const selesai = ada.filter((a) => a.status === 'selesai');
      // Hasil yang sudah ada — berhasil maupun gagal — diarahkan ke permintaan
      // ini. Analisis yang gagal pun perlu tampil di panel supaya admin tahu
      // dokumen ini sudah dicoba dibaca dan bisa mengulanginya.
      const target = selesai.find((a) => !a.permintaanId) || ada.find((a) => !a.permintaanId);
      if (target) {
        db.updateAnalisisDokumen(target.id, tenantId, { permintaanId });
        for (const b of db.getButirData(tenantId, { analisisId: target.id })) {
          if (!b.permintaanId) db.updateButirData(b.id, tenantId, { permintaanId });
        }
        continue;
      }
      if (ada.length > 0) continue;
      antreAnalisisOtomatis({
        tenantId,
        berkasId: l.berkasId,
        judulBerkas: l.nama || l.berkasId,
        permintaanId,
        sebab: 'unggah',
      });
    }
  };

  pemicuAnalisisOtomatis = (tenantId, dokumenBaru) => {
    void antrePenyegaranAnalisis(tenantId, dokumenBaru).catch((err: any) =>
      console.warn('[analisis-otomatis] gagal menyiapkan antrean:', err?.message || err)
    );
  };

  /** Keadaan antrean analisis otomatis — dipakai panel admin & skrip QA. */
  app.get('/api/analisis/otomatis', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh melihat antrean analisis.')) return;
    res.json(statusAntreanOtomatis());
  });

  /**
   * Jalankan analisis satu dokumen. Sinkron: admin menunggu hasilnya, dan satu
   * dokumen biasanya selesai di bawah satu menit. Kalau dokumen itu sudah
   * dibaca otomatis, jawabannya `dariCache: true` tanpa memanggil RAG.
   */
  app.post('/api/analisis', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh menganalisis dokumen.')) return;
    const tenantId = effectiveTenantId(req, session);

    const berkasId = String(req.body?.berkasId || '').trim();
    const judulBerkas = String(req.body?.judulBerkas || '').trim();
    if (!berkasId || !judulBerkas) {
      return res.status(400).json({ error: 'berkasId dan judulBerkas wajib diisi.' });
    }

    const hasil = await analisisSatuBerkas({
      tenantId,
      berkasId,
      judulBerkas,
      permintaanId: String(req.body?.permintaanId || '').trim() || undefined,
      ukuranKb: typeof req.body?.ukuranKb === 'number' ? req.body.ukuranKb : undefined,
      tipe: req.body?.tipe ? String(req.body.tipe) : undefined,
      segarkan: req.body?.segarkan === true,
      abaikanKuota: req.body?.abaikanKuota === true,
      sumber: 'manual',
      pelaku: { userId: session.userId, name: session.name },
    });
    return res.status(hasil.kode).json(hasil.body);
  });

  app.get('/api/analisis/:id/butir', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const analisis = db.getAnalisisDokumenById(req.params.id, tenantId);
    if (!analisis) return res.status(404).json({ error: 'Analisis tidak ditemukan.' });
    if (!isAdminRole(session.role)) {
      const milik = analisis.permintaanId
        ? db.permintaanData.find((p) => p.id === analisis.permintaanId && p.tenantId === tenantId)
        : undefined;
      if (!milik || milik.pemohonId !== session.userId) {
        return res.status(403).json({ error: 'Analisis ini bukan milik Anda.' });
      }
    }
    res.json({
      analisis,
      butir: db.getButirData(tenantId, { analisisId: analisis.id }),
    });
  });

  app.get('/api/analisis/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const analisis = db.getAnalisisDokumenById(req.params.id, effectiveTenantId(req, session));
    if (!analisis) return res.status(404).json({ error: 'Analisis tidak ditemukan.' });
    res.json(analisis);
  });

  /**
   * Setujui semua butir yang masih `draf` di instansi ini.
   *
   * Butir baru sudah otomatis disetujui bila angkanya terbaca dari sel dokumen
   * dengan sitasi (lihat `statusButirAwal`). Ini untuk butir lama yang sudah
   * terlanjur tersimpan sebagai draf sebelum aturan itu berlaku — supaya admin
   * tidak perlu mengklik puluhan angka satu per satu.
   */
  app.post('/api/analisis/butir/setujui-semua', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh menyetujui butir data.')) return;
    const tenantId = effectiveTenantId(req, session);
    const draf = db.butirData.filter((b) => b.tenantId === tenantId && b.status === 'draf');
    let jumlah = 0;
    for (const b of draf) {
      if (db.updateButirData(b.id, tenantId, { status: 'disetujui' })) jumlah += 1;
    }
    if (jumlah > 0) {
    }
    res.json({ disetujui: jumlah });
  });

  /** Setujui / tolak / kembalikan butir ke draf. Hanya admin instansi. */
  app.patch('/api/analisis/butir/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh menyetujui butir data.')) return;
    const tenantId = effectiveTenantId(req, session);
    const status = String(req.body?.status || '');
    if (!['draf', 'disetujui', 'ditolak'].includes(status)) {
      return res.status(400).json({ error: 'Status butir harus draf, disetujui, atau ditolak.' });
    }
    const butir = db.butirData.find((b) => b.id === req.params.id && b.tenantId === tenantId);
    if (!butir) return res.status(404).json({ error: 'Butir tidak ditemukan.' });
    const diperbarui = db.updateButirData(butir.id, tenantId, { status: status as any });
    res.json(diperbarui);
  });

  /** Ulangi analisis yang gagal atau tertunda kuota. */
  app.post('/api/analisis/:id/ulang', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh mengulang analisis.')) return;
    const tenantId = effectiveTenantId(req, session);
    const lama = db.getAnalisisDokumenById(req.params.id, tenantId);
    if (!lama) return res.status(404).json({ error: 'Analisis tidak ditemukan.' });
    /**
     * Dokumen spreadsheet dibaca langsung dari selnya (`tabel-lokal`): tidak ada
     * kuota model yang dipakai, jadi membangun ulang butirnya selalu aman dan
     * justru perlu — perbaikan cara membaca nama kolom hanya berlaku pada
     * pembacaan ulang. Dokumen jalur RAG tetap dikunci supaya kuota tidak habis
     * tanpa sengaja.
     */
    const bolehUlang = lama.metode === 'tabel-lokal';
    if (lama.status === 'selesai' && (lama.jumlahButir ?? 0) > 0 && !bolehUlang) {
      return res.status(409).json({ error: 'Analisis ini sudah selesai. Hapus dulu bila ingin menganalisis ulang.' });
    }
    // Analisis "selesai" yang tidak menghasilkan satu butir pun TETAP boleh dibaca
    // ulang: hasil kosong seperti itu biasanya gejala layanan sibuk (429) atau
    // dokumen yang baru selesai diindeks — bukan alasan mengunci admin.

    const permintaan = lama.permintaanId
      ? db.permintaanData.find((p) => p.id === lama.permintaanId && p.tenantId === tenantId)
      : undefined;
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    const sector = (tenant?.sector || 'pdam') as BumdSector;

    const ekstraktor: Ekstraktor = async ({ prompt }) => {
      // Spreadsheet dibaca langsung dari berkasnya: isi sel tidak bisa diandalkan
      // lewat pencarian vektor RAG.
      const lembar = await ekstrakLembarBerkas(tenant, lama.berkasId, lama.judulBerkas);
      if (lembar) return { ringkasan: lembar.ringkasan, butir: lembar.butir, metode: 'tabel-lokal' as const };
      const hasil = await ragClient.query({
        prompt,
        sector,
        instansi: tenant?.name,
        kbId,
        mode: 'structured',
        strictGrounding: true,
        dokumenTarget: lama.judulBerkas,
        /**
         * SAPUAN PER DOKUMEN.
         *
         * Skema tunggal ("baca dokumen ini, ambil indikator angka") ternyata
         * dikembalikan kosong oleh layanan RAG untuk berkas spreadsheet, padahal
         * isinya penuh angka. Sapuan memecah pembacaan menjadi lima bagian
         * (angka utama, deret periode, rincian kategori, perbandingan, tabel) dan
         * tiap bagian diminta terpisah — cara yang sama dipakai saat mengisi
         * template dan terbukti mengembalikan angka.
         */
        sapuanPenuh: true,
        timeoutMs: 240_000,
      });
      return {
        ringkasan: (hasil.structuredJson && (hasil.structuredJson as any).description) || hasil.answer || undefined,
        butir: petakanKeluaranRag(hasil.structuredJson, lama.judulBerkas),
      };
    };

    try {
      const hasil = await jalankanAnalisis({
        penyimpanan: db as any,
        ekstraktor,
        sidik: {
          dokumen:
            lama.sidikDokumen ||
            sidikDokumen({
              berkasId: lama.berkasId,
              ukuranKb: permintaan?.lampiran.find((l) => l.berkasId === lama.berkasId)?.ukuranKb,
              tipe: permintaan?.lampiran.find((l) => l.berkasId === lama.berkasId)?.tipe,
              diunggahPada: permintaan?.lampiran.find((l) => l.berkasId === lama.berkasId)?.diunggahPada,
            }),
          kb: await sidikKbInstansi(req, session),
        },
        konteks: {
          tenantId,
          analisisId: '',
          berkasId: lama.berkasId,
          ...(lama.permintaanId ? { permintaanId: lama.permintaanId } : {}),
          judulBerkas: lama.judulBerkas,
          bidang: permintaan?.bidang,
          dataDiminta: permintaan?.dataDiminta,
          arahDashboard: permintaan?.arahDashboard,
          instansi: tenant?.name,
        },
        abaikanKuota: req.body?.abaikanKuota === true,
      });
      if (hasil.analisis.status === 'selesai') db.deleteAnalisisDokumen(lama.id, tenantId);
      return res.status(hasil.analisis.status === 'gagal' ? 422 : 201).json({
        analisis: hasil.analisis,
        butir: hasil.butir,
        rekomendasi: hasil.rekomendasi,
        dibuang: hasil.dibuang,
        sisaKuota: hasil.sisaKuota,
      });
    } catch (err) {
      return res.status(500).json({ error: jelaskanError(err) });
    }
  });

  app.delete('/api/analisis/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh menghapus analisis.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ada = db.getAnalisisDokumenById(req.params.id, tenantId);
    if (!ada) return res.status(404).json({ error: 'Analisis tidak ditemukan.' });
    db.deleteAnalisisDokumen(ada.id, tenantId);
    res.json({ success: true });
  });

  /**
   * Susun halaman dari butir data yang disetujui admin.
   *
   * Angka diambil dari butir — bukan dari model — sehingga tidak ada satu pun
   * nilai di halaman ini yang bisa berubah karena halusinasi. Butir yang ditolak
   * atau tidak punya angka dilewati, dan jumlahnya dilaporkan apa adanya.
   */
  app.post('/api/dashboards/dari-butir', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);

    const ids: string[] = Array.isArray(req.body?.butirIds) ? req.body.butirIds.map((x: unknown) => String(x)) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu butir data.' });
    }

    /**
     * Butir gabungan lintas dokumen hanya ada di tampilan, bukan di basis data.
     * Karena itu pilihan disaring dari daftar hasil penggabungan; anggotanya
     * tetap butir asli di dalam basis, dan seluruh deret periodenya ikut.
     */
    const semuaButir = db.getButirData(tenantId);
    const digabung = gabungButirLintasDokumen(semuaButir.filter((b) => b.status === 'disetujui'));
    let dipilih = digabung.filter((b) => ids.includes(b.id));
    if (dipilih.length === 0) dipilih = semuaButir.filter((b) => ids.includes(b.id));
    if (dipilih.length === 0) {
      return res.status(404).json({ error: 'Butir yang dipilih tidak ditemukan di instansi ini.' });
    }

    const permintaanId = String(req.body?.permintaanId || '').trim() || undefined;
    const permintaan = permintaanId
      ? db.permintaanData.find((p) => p.id === permintaanId && p.tenantId === tenantId)
      : undefined;
    if (permintaanId && !permintaan) {
      return res.status(404).json({ error: 'Permintaan tidak ditemukan di instansi ini.' });
    }

    const judul =
      String(req.body?.judul || '').trim() ||
      (permintaan ? `Data ${permintaan.bidang}` : 'Halaman dari dokumen');
    // Dua cara menyusun: memakai susunan template (kalau admin memilih satu),
    // atau pengelompokan otomatis per kategori. Template dipakai bila ada, karena
    // admin sudah memilih bentuk halaman yang ia inginkan.
    const templateId = String(req.body?.templateId || '').trim();
    let catatanTemplate = '';
    let slotKosongTemplate: Array<{ judulSlot: string; alasan: string }> = [];
    let halamanBaru: Array<{ judul: string; widgets: any[] }>;

    if (templateId) {
      const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return res.status(404).json({ error: 'Template tidak ditemukan.' });
      const hasilSlot = isiSlotTemplate(template, dipilih);
      const widgetsSlot = widgetTerisi(hasilSlot);
      catatanTemplate = hasilSlot.catatan;
      slotKosongTemplate = slotKosong(hasilSlot);
      if (widgetsSlot.length === 0) {
        return res.status(422).json({
          error: `Template "${template.nama}" tidak bisa diisi dari butir yang dipilih — ${hasilSlot.catatan}.`,
        });
      }
      halamanBaru = [{ judul, widgets: widgetsSlot }];
    } else if (Array.isArray(req.body?.halaman) && req.body.halaman.length > 0) {
      /**
       * SUSUNAN DARI KANVAS PILIH DATA.
       *
       * Pengguna sudah menyusun sendiri: beberapa halaman, tiap kartu dengan
       * bentuk chart pilihannya. Susunan itu dipakai apa adanya, tidak
       * dikelompokkan ulang per kategori. Bentuk yang tidak ada di katalog
       * diabaikan (kartu memakai bentuk pilihan sistem).
       */
      const petaButir = new Map(dipilih.map((b) => [b.id, b]));
      // Id kartu unik di SELURUH dashboard, bukan per halaman: butir yang sama
      // boleh muncul di beberapa halaman, sedangkan editor memilih widget lewat id.
      const idTerpakai = new Set<string>();
      halamanBaru = (req.body.halaman as any[]).slice(0, 30).map((h, i) => {
        const kartu = Array.isArray(h?.kartu) ? h.kartu : [];
        const widgets = kartu
          .map((k: any, j: number) => {
            const b = petaButir.get(String(k?.butirId || ''));
            if (!b) return null;
            const diminta = String(k?.chartId || '').trim();
            const chartId = Object.prototype.hasOwnProperty.call(CHART_DEFAULT, diminta) ? diminta : undefined;
            const w = butirKeWidget(b, j + 1, chartId ? { chartId } : undefined);
            if (!w) return null;
            // Butir yang sama boleh tampil dua kali dengan bentuk berbeda; id kartu harus tetap unik.
            let id = w.id;
            for (let n = 2; idTerpakai.has(id); n += 1) id = `${w.id}-${n}`;
            idTerpakai.add(id);
            return { ...w, id };
          })
          .filter(Boolean);
        return {
          judul: String(h?.judul || '').trim().slice(0, 80) || `Halaman ${i + 1}`,
          widgets: tataGrid(widgets),
        };
      }).filter((h) => h.widgets.length > 0);
    } else {
      /**
       * Bentuk chart pilihan pengguna.
       *
       * `chartId` menunjuk entri katalog Template Chart (mis. `bar-kapsul`);
       * hanya id yang benar-benar ada di katalog yang diterima. `bentuk` masih
       * diterima untuk pemanggil lama (tipe dasar tanpa chart katalog). Yang
       * tidak dikenal diabaikan, bukan ditolak — dashboard tetap terbentuk
       * dengan bentuk pilihan sistem.
       */
      const BENTUK_DIIZINKAN = ['kpi', 'bar', 'hbar', 'line', 'area', 'pie', 'donut', 'table'] as const;
      const bentukDiminta = String(req.body?.bentuk || '').trim() as (typeof BENTUK_DIIZINKAN)[number];
      const bentuk = BENTUK_DIIZINKAN.includes(bentukDiminta) ? bentukDiminta : undefined;
      const chartDiminta = String(req.body?.chartId || '').trim();
      const chartId = Object.prototype.hasOwnProperty.call(CHART_DEFAULT, chartDiminta) ? chartDiminta : undefined;
      halamanBaru = butirKeHalaman(dipilih, {
        judul,
        ...(bentuk ? { bentuk } : {}),
        ...(chartId ? { chartId } : {}),
      });
    }
    if (halamanBaru.every((h) => h.widgets.length === 0)) {
      return res.status(422).json({
        error:
          'Butir terpilih tidak punya angka yang bisa ditampilkan. Setujui butir yang berisi nilai, deret, atau tabel lebih dulu.',
      });
    }

    const tenant = db.tenants.find((t) => t.id === tenantId);
    const dashId = String(req.body?.dashboardId || '').trim();

    if (dashId) {
      const lama = db.dashboards.find((d) => d.id === dashId && d.tenantId === tenantId);
      if (!lama) return res.status(404).json({ error: 'Dashboard tujuan tidak ditemukan.' });
      const halamanLama =
        lama.halaman && lama.halaman.length > 0
          ? lama.halaman
          : [{ id: 'hlm-1', judul: 'Ringkasan', widgets: lama.widgets }];
      const tambahan = halamanBaru.map((h, i) => ({
        id: `hlm-${Date.now()}-${i + 1}`,
        judul: h.judul,
        widgets: h.widgets,
      }));
      const diperbarui = db.updateDashboard(
        lama.id,
        {
          halaman: [...halamanLama, ...tambahan],
          halamanAktifId: tambahan[0].id,
          widgets: tambahan[0].widgets,
        },
        tenantId
      );
      return res.status(201).json({
        dashboard: diperbarui,
        jumlahHalaman: tambahan.length,
        ringkasan: catatanTemplate || ringkasHalaman(dipilih, halamanBaru),
        ...(slotKosongTemplate.length > 0 ? { slotKosong: slotKosongTemplate } : {}),
      });
    }

    /**
     * ATURAN DASHBOARD BARU: minimal 3 chart dan semuanya berhubungan
     * (lihat `aturanDashboard.ts`). Tidak ada chart yang ditambahkan diam-diam:
     * pengguna melengkapinya sendiri dari Pilih Data.
     */
    const petaWidgetButir = new Map(dipilih.map((b) => [`w-${b.id}`, b]));
    const kartuAturan = halamanBaru
      .flatMap((h) => h.widgets)
      .map((w: any) => petaWidgetButir.get(String(w.id)) ?? petaWidgetButir.get(String(w.id).replace(/-\d+$/, '')))
      .filter((b): b is ButirData => Boolean(b));
    const aturan = cekAturanDashboard(kartuAturan);
    if (!aturan.boleh) {
      return res.status(422).json({
        error: aturan.pesan,
        kode: 'ATURAN_DASHBOARD',
        kurang: aturan.kurang,
        tidakTerkait: aturan.tidakTerkait.map((b) => b.id),
      });
    }

    const halaman = halamanBaru.map((h, i) => ({
      id: `hlm-${i + 1}`,
      judul: h.judul,
      widgets: h.widgets,
    }));
    const baru: Dashboard = {
      id: `dash-${Date.now()}`,
      tenantId,
      title: judul,
      description: `Disusun dari ${dipilih.length} butir data dokumen.`,
      sector: (tenant?.sector || 'pdam') as BumdSector,
      widgets: halaman[0].widgets,
      globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
      halaman,
      halamanAktifId: halaman[0].id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const dibuat = db.createDashboard(baru);

    if (permintaan) db.updatePermintaanData(permintaan.id, tenantId, { dashboardId: dibuat.id });

    return res.status(201).json({
      dashboard: dibuat,
      jumlahHalaman: halaman.length,
      ringkasan: catatanTemplate || ringkasHalaman(dipilih, halamanBaru),
      ...(slotKosongTemplate.length > 0 ? { slotKosong: slotKosongTemplate } : {}),
    });
  });

  /**
   * REKOMENDASI AI — dashboard lengkap yang disusun oleh model RAG.
   *
   * DUA TAHAP supaya pengguna bisa MENONTON prosesnya:
   * 1. Permintaan ini langsung membuat dashboard kosong berstatus `menyusun` dan
   *    membalasnya. Aplikasi pindah ke kanvas saat itu juga.
   * 2. Pekerjaan model berjalan di latar. Setiap kemajuan ditulis ke dashboard —
   *    butir yang dikirim, kategori yang tersedia, halaman yang selesai disusun —
   *    sehingga kanvas bisa menampilkan apa yang sedang diambil AI, bukan layar
   *    tunggu yang kosong.
   *
   * Butir yang dipakai tetap butir asli; model hanya menunjuk id dan chart.
   */
  app.post('/api/dashboards/rekomendasi', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const sector = (tenant?.sector || 'pdam') as BumdSector;

    const semua = gabungButirLintasDokumen(db.getButirData(tenantId).filter((b) => b.status === 'disetujui'));
    if (semua.length === 0) {
      return res.status(422).json({ error: 'Belum ada butir data yang disetujui. Analisis dokumen lebih dulu.' });
    }
    const ids: string[] = Array.isArray(req.body?.butirIds) ? req.body.butirIds.map((x: unknown) => String(x)) : [];
    const kandidat = ids.length > 0 ? semua.filter((b) => ids.includes(b.id)) : semua;
    if (kandidat.length === 0) {
      return res.status(404).json({ error: 'Butir yang dipilih tidak ditemukan di instansi ini.' });
    }

    /**
     * Rasa penyusunan: `cepat` memangkas katalog supaya model menjawab lebih
     * dulu, `mendalam` menambah satu putaran untuk halaman lanjutan.
     */
    const mode = modeRekoSah(req.body?.mode);
    const profil = MODE_REKO[mode];

    /** Ringkasan kategori: ditampilkan di kanvas sambil AI bekerja. */
    const perKategori = new Map<string, number>();
    for (const b of kandidat) {
      const k = String(b.kategori || 'umum').toLowerCase();
      perKategori.set(k, (perKategori.get(k) || 0) + 1);
    }
    const kategori = [...perKategori.entries()]
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);

    const id = `dash-${Date.now()}`;
    const judulAwal = `AI menyusun dashboard ${tenant?.name || 'instansi'}…`;
    const mulai = new Date().toISOString();
    const shell: Dashboard = {
      id,
      tenantId,
      title: judulAwal,
      description: 'AI sedang menyusun halaman dari butir data dokumen.',
      sector,
      widgets: [],
      halaman: [],
      halamanAktifId: '',
      globalFilters: { periode: 'Semua', unitKerja: 'Semua', kategori: 'Semua' },
      status: 'menyusun',
      ai: {
        tahap: 'menyiapkan',
        pesan: `AI membaca katalog data instansi (mode ${profil.nama.toLowerCase()})`,
        mode,
        mulai,
        kandidat: kandidat.length,
        kategori,
        terpilih: [],
      },
      createdAt: mulai,
      updatedAt: mulai,
    };
    db.createDashboard(shell);

    const ubah = (patch: Partial<Dashboard>) => {
      try {
        db.updateDashboard(id, { ...patch, updatedAt: new Date().toISOString() } as any, tenantId);
      } catch (err: any) {
        console.warn('[rekomendasi] gagal menyimpan kemajuan:', err?.message || err);
      }
    };

    const permintaan = String(req.body?.prompt || '').trim();
    const katalog = katalogUntukAi(kandidat, profil.maksVarian, profil.batasKatalog);
    const prompt = buatPrompt(katalog.teks, katalog.jumlah, permintaan, mode);

    // Pekerjaan model di latar; balasan HTTP sudah dikirim lebih dulu.
    void (async () => {
      try {
        ubah({
          ai: {
            tahap: 'katalog',
            pesan: `${katalog.jumlah} varian dikirim ke AI (mode ${profil.nama}, dari ${kandidat.length} butir disetujui)`,
            mulai,
            kandidat: katalog.jumlah,
            kategori,
            terpilih: [],
          },
        });

        /**
         * Tahap "memilih" ditulis SEBELUM menunggu model. Panggilan model bisa
         * berjalan satu sampai dua menit, dan tanpa ini panel terus berbunyi
         * "membaca katalog" padahal AI sudah lama memilih.
         */
        ubah({
          ai: {
            tahap: 'memilih',
            pesan:
              profil.putaran > 1
                ? `AI menyusun halaman inti (putaran 1 dari ${profil.putaran}, ${profil.perkiraan})`
                : `AI memilih halaman dan kartu (biasanya ${profil.perkiraan})`,
            mulai,
            kandidat: katalog.jumlah,
            kategori,
            terpilih: [],
          },
        });

        const item = await ragClient.rencanaDashboard(prompt, SKEMA_RENCANA, {
          kbId: kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId),
          timeoutMs: 180,
        });
        if (!item) throw new Error('Layanan AI tidak mengembalikan susunan.');

        const rencana = bacaRencana(JSON.stringify(item));
        if (!rencana) throw new Error('Jawaban AI tidak bisa dibaca sebagai susunan halaman.');

        const susun = susunDariRencana(rencana, kandidat);
        if (susun.halaman.length === 0) throw new Error('AI tidak memilih satu pun butir yang dikenal aplikasi.');

        /**
         * ATURAN DASHBOARD BARU (minimal 3 chart, semuanya berhubungan).
         * Pengguna meminta AI menyusun, jadi kekurangan dilengkapi di sini:
         * chart yang tidak berhubungan dibuang, lalu ditambah butir terkait
         * dari kandidat sampai mencapai batas minimal.
         */
        {
          // Pelengkap boleh diambil dari SEMUA data yang disetujui, bukan hanya yang dicentang.
          const petaKandidat = new Map(semua.map((b) => [`w-${b.id}`, b]));
          const butirDari = (w: WidgetSpec) =>
            petaKandidat.get(String(w.id)) ?? petaKandidat.get(String(w.id).replace(/-\d+$/, ''));
          const semuaKartu = () => susun.halaman.flatMap((h) => h.widgets);
          const awal = cekAturanDashboard(semuaKartu().map(butirDari).filter((b): b is ButirData => Boolean(b)));
          if (awal.tidakTerkait.length > 0) {
            const buang = new Set(awal.tidakTerkait.map((b) => b.id));
            for (const h of susun.halaman) h.widgets = h.widgets.filter((w) => !buang.has(butirDari(w)?.id ?? ''));
            susun.halaman = susun.halaman.filter((h) => h.widgets.length > 0);
          }
          const sekarang = semuaKartu().map(butirDari).filter((b): b is ButirData => Boolean(b));
          const kurang = MIN_CHART_DASHBOARD - sekarang.length;
          if (kurang > 0) {
            const tambahan = saranTerkait(sekarang, semua, kurang * 3)
              .map((b, i) => butirKeWidget(b, sekarang.length + i + 1))
              .filter((w): w is WidgetSpec => Boolean(w))
              .slice(0, kurang);
            if (susun.halaman.length === 0) susun.halaman.push({ judul: 'Ringkasan', widgets: [] });
            susun.halaman[0].widgets.push(...tambahan);
          }
          susun.halaman = tataRapiHalaman(susun.halaman);
          const akhir = cekAturanDashboard(semuaKartu().map(butirDari).filter((b): b is ButirData => Boolean(b)));
          if (!akhir.boleh) {
            throw new Error(`Data yang berhubungan tidak cukup untuk dashboard. ${akhir.pesan}`);
          }
        }

        const terpilih: string[] = [];
        const halaman: Array<{ id: string; judul: string; widgets: WidgetSpec[] }> = [];

        /**
         * Satu halaman langsung ditulis ke dashboard begitu siap, supaya kanvas
         * terisi sambil menunggu sisa halaman. Pada mode `mendalam` halaman
         * putaran pertama tampil DULU, baru halaman lanjutan menyusul.
         */
        const tulisHalaman = async (h: { judul: string; widgets: WidgetSpec[] }) => {
          halaman.push({ id: `hlm-${halaman.length + 1}`, judul: h.judul, widgets: h.widgets });
          for (const w of h.widgets) {
            const nama = String(w.title || '').trim();
            if (nama && !terpilih.includes(nama)) terpilih.push(nama);
          }
          ubah({
            title: judulAwal,
            halaman: [...halaman],
            halamanAktifId: halaman[0].id,
            widgets: halaman[0].widgets,
            ai: {
              tahap: 'menyusun',
              pesan: `Halaman ${halaman.length} siap: ${h.judul}`,
              mode,
              mulai,
              kandidat: katalog.jumlah,
              kategori,
              terpilih: [...terpilih],
            },
          });
          // Jeda supaya kanvas sempat menggambar halaman satu per satu (panel
          // kanvas menyegarkan tiap 1,5 detik).
          await new Promise((r) => setTimeout(r, 700));
        };

        for (const h of susun.halaman) await tulisHalaman(h);

        /**
         * PUTARAN LANJUTAN (mendalam 2 putaran, ultra 3 putaran).
         *
         * Putaran pertama hanya menyentuh sebagian katalog karena batas panjang
         * prompt (layanan RAG menolak prompt di atas 8000 karakter). Putaran
         * berikutnya menerima varian yang BELUM terpakai dan menyusun halaman
         * tambahan, jadi jumlah halaman bertambah tanpa mengulang topik.
         *
         * Kalau satu putaran gagal (layanan sibuk) atau model hanya mengulang
         * topik yang sudah ada, pengulangan berhenti dan halaman yang sudah jadi
         * tetap dipakai - pengguna tidak kehilangan hasil sebelumnya.
         */
        for (let putaranKe = 2; putaranKe <= profil.putaran; putaranKe += 1) {
          try {
            // `susun.dipakai` berisi id VARIAN (mis. `btr-1#tren`), bukan id butir.
            const varianTerpakai = new Set<string>(susun.dipakai);
            // Halaman tersimpan memakai `widgets`; id widget = id varian terpakai.
            for (const h of halaman) for (const w of h.widgets || []) varianTerpakai.add(String(w.id));
            const butirTerpakai = new Set([...varianTerpakai].map((v) => v.split('#')[0]));
            const sisaButir = kandidat.filter((b) => !butirTerpakai.has(b.id));
            const katalog2 = katalogUntukAi(
              sisaButir.length > 0 ? sisaButir : kandidat,
              profil.maksVarian,
              profil.batasKatalog,
            );
            const teks2 = katalog2.teks
              .split('\n')
              .filter((baris) => {
                const idVarian = baris.replace(/^-\s*/, '').split('|')[0].trim();
                return idVarian !== '' && !varianTerpakai.has(idVarian);
              })
              .join('\n');

            // Tidak ada varian baru lagi: putaran berikutnya tidak akan menambah apa pun.
            if (teks2.trim() !== '') {
              ubah({
                ai: {
                  tahap: 'memilih',
                  pesan: `Putaran ${putaranKe} dari ${profil.putaran}: menyusun halaman lanjutan`,
                  mode,
                  mulai,
                  kandidat: katalog.jumlah,
                  kategori,
                  terpilih: [...terpilih],
                },
              });
              const item2 = await ragClient.rencanaDashboard(
                buatPrompt(teks2, katalog2.jumlah, permintaan, mode, true, putaranKe),
                SKEMA_RENCANA,
                { kbId: kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId), timeoutMs: 240 },
              );
              const rencana2 = item2 ? bacaRencana(JSON.stringify(item2)) : null;
              if (rencana2) {
                const tambahan = susunDariRencana(rencana2, kandidat);
                const judulAda = new Set(halaman.map((x) => x.judul.toLowerCase()));
                let ditambah = 0;
                for (const h of tambahan.halaman) {
                  if (judulAda.has(h.judul.toLowerCase())) continue;
                  judulAda.add(h.judul.toLowerCase());
                  susun.dipakai.push(...tambahan.dipakai);
                  susun.dibuang.push(...tambahan.dibuang);
                  await tulisHalaman(h);
                  ditambah += 1;
                }
                // Semua halaman putaran ini kembar dengan yang sudah ada: berhenti.
                if (ditambah === 0) break;
              } else {
                console.warn(`[rekomendasi] putaran ${putaranKe} tidak menghasilkan rencana`);
                break;
              }
            } else {
              break;
            }
          } catch (err: any) {
            console.warn(`[rekomendasi] putaran ${putaranKe} dilewati:`, err?.message || err);
            break;
          }
        }

        const judul =
          String(rencana.judul || '').trim().slice(0, 80) ||
          `Dashboard ${tenant?.name || 'Instansi'} — ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
        ubah({
          title: judul,
          description: `Disusun AI dari ${susun.dipakai.length} butir data dokumen.`,
          status: 'siap',
          ai: undefined,
          halaman,
          halamanAktifId: halaman[0].id,
          widgets: halaman[0].widgets,
        });

      } catch (err) {
        const pesan = jelaskanError(err);
        console.warn('[rekomendasi] AI gagal:', pesan);
        ubah({
          status: 'gagal',
          title: `Rekomendasi AI gagal — ${tenant?.name || 'instansi'}`,
          description: 'AI tidak bisa menyusun dashboard saat ini.',
          ai: {
            tahap: 'gagal',
            pesan: 'AI tidak bisa menyusun dashboard saat ini.',
            mulai,
            kandidat: katalog.jumlah,
            kategori,
            terpilih: [],
            galat: pesan,
          },
        });
      }
    })();

    return res.status(201).json({
      dashboard: shell,
      jumlahHalaman: 0,
      jumlahKartu: 0,
      mode,
      ringkasan: `Mode ${profil.nama} (${profil.perkiraan}): AI menyusun dari ${katalog.jumlah} varian. Halaman muncul satu per satu di kanvas.`,
    });
  });

  /* ================= USULAN PERUBAHAN HALAMAN (Fase 3) ================= */

  /**
   * Asisten menyiapkan usulan perubahan untuk SATU halaman.
   *
   * Yang dikirim ke model: halaman mana yang sedang dibuka, kartu apa saja yang
   * ada di sana, dan butir mana yang sudah disetujui admin. Model hanya boleh
   * memakai angka dari butir itu — hasilnya divalidasi, dan usulan yang
   * menyelipkan angka tanpa sumber ditolak sebelum tersimpan.
   *
   * Usulan TIDAK mengubah halaman. Admin menekan Terapkan dulu.
   */
  app.post('/api/usulan/dari-chat', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Menyempurnakan halaman hanya bisa dilakukan admin instansi.')) return;
    const tenantId = effectiveTenantId(req, session);

    const dashboardId = String(req.body?.dashboardId || '').trim();
    const halamanId = String(req.body?.halamanId || '').trim();
    const perintah = String(req.body?.prompt || '').trim();
    if (!dashboardId || !halamanId) {
      return res.status(400).json({ error: 'dashboardId dan halamanId wajib diisi supaya asisten tahu halaman mana yang disunting.' });
    }
    if (!perintah) return res.status(400).json({ error: 'Tulis dulu apa yang ingin diubah.' });

    const dash = db.dashboards.find((d) => d.id === dashboardId && d.tenantId === tenantId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan di instansi ini.' });
    const halaman = halamanDari(dash, halamanId);
    if (!halaman) return res.status(404).json({ error: 'Halaman tidak ditemukan di dashboard ini.' });

    const tenant = db.tenants.find((t) => t.id === tenantId);
    const butir = butirSiapPakai(db.getButirData(tenantId)).slice(0, 40);
    const daftarKartu = halaman.widgets.map((w) => `- id=${w.id} | "${w.title}" | tipe ${w.type}`).join('\n');
    const barisButir = butir.map(
        (b) =>
          `- id=${b.id} | "${b.nama}" | ${b.kategori} | ${
            b.nilai !== undefined && b.nilai !== null ? `nilai ${b.nilai}${b.satuan ? ' ' + b.satuan : ''}` : b.seri ? `deret ${b.seri[0]?.data.join(',')}` : 'tabel'
          } | sumber: ${b.sitasi.dokumen}${b.sitasi.halaman ? ' hlm ' + b.sitasi.halaman : ''}`
    );
    // Layanan RAG menolak `query` di atas 8000 karakter (HTTP 422). Butir
    // ditambahkan sampai anggaran habis supaya seluruh prompt tetap di bawah batas.
    const ANGGARAN_BUTIR = Math.max(0, 7500 - 2200 - daftarKartu.length - perintah.length - halaman.judul.length - dash.title.length);
    const butirMuat: string[] = [];
    let panjangButir = 0;
    for (const baris of barisButir) {
      if (panjangButir + baris.length + 1 > ANGGARAN_BUTIR) break;
      butirMuat.push(baris);
      panjangButir += baris.length + 1;
    }
    const daftarButir = butirMuat.join('\n');

    const prompt = [
      `Halaman yang sedang dibuka: "${halaman.judul}" (id ${halaman.id}) pada dashboard "${dash.title}".`,
      'Kartu yang ada di halaman ini:',
      daftarKartu || '(belum ada kartu)',
      `Halaman ini berisi ${halaman.widgets.length} kartu dari batas ${MAKS_WIDGET_HALAMAN}. Kartu baru paling banyak ${Math.max(0, MAKS_WIDGET_HALAMAN - halaman.widgets.length)}, kecuali ada kartu yang dihapus dalam usulan yang sama.`,
      '',
      'Butir data yang SUDAH DISETUJUI admin (satu-satunya sumber angka yang boleh dipakai):',
      daftarButir || '(belum ada butir yang disetujui)',
      '',
      `Permintaan admin: ${perintah}`,
      '',
      'Balas HANYA dengan JSON tanpa penjelasan lain, bentuk:',
      '{"ringkasan":"satu kalimat tentang usulan ini","perubahan":[',
      '{"aksi":"tambah","widget":{"id":"w-baru-1","type":"kpi","title":"...","confidence":"sumber","grid":{"x":0,"y":0,"w":3,"h":2},"kpi":{"value":123,"unit":"..."},"citations":[{"id":"c1","docName":"...","page":1,"chunkSnippet":"...","confidenceScore":0.9,"date":"..."}]},"alasan":"..."},',
      '{"aksi":"hapus","widgetId":"w-1","alasan":"..."},',
      '{"aksi":"ubah","widgetId":"w-2","widget":{...},"alasan":"..."},',
      '{"aksi":"urutkan","urutan":["w-3","w-1"],"alasan":"..."}]}',
      '',
      'Aturan wajib: JANGAN mengarang angka. Semua nilai harus berasal dari butir di atas, dan setiap kartu baru WAJIB menyertakan citations dengan docName dari butir. Jangan menyentuh halaman lain.',
    ].join('\n');

    let teksJawaban = '';
    try {
      const hasil = await ragClient.query({
        prompt,
        sector: (dash.sector || tenant?.sector || 'pdam') as BumdSector,
        instansi: tenant?.name,
        kbId: kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '',
        mode: 'prose',
        strictGrounding: true,
        timeoutMs: 90_000,
      });
      teksJawaban = String(hasil.answer || '').trim();
    } catch (err) {
      return res.status(502).json({ error: `Asisten tidak bisa dihubungi: ${jelaskanError(err)}` });
    }

    // Model kadang membungkus JSON dengan ```json — dibersihkan, bukan ditolak.
    const bersih = teksJawaban.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const mulai = bersih.indexOf('{');
    const akhir = bersih.lastIndexOf('}');
    if (mulai === -1 || akhir <= mulai) {
      return res.status(422).json({
        error: 'Asisten tidak membalas dalam bentuk yang bisa dibaca. Coba tulis permintaan lebih spesifik, misalnya "hapus kartu X".',
        jawabanAsisten: teksJawaban.slice(0, 400),
      });
    }

    let mentah: any;
    try {
      mentah = JSON.parse(bersih.slice(mulai, akhir + 1));
    } catch {
      return res.status(422).json({
        error: 'Jawaban asisten bukan JSON yang sah, jadi tidak ada yang bisa diterapkan.',
        jawabanAsisten: bersih.slice(0, 400),
      });
    }

    const validasi = validasiPerubahan(mentah?.perubahan, halaman);
    if (!validasi.sah) {
      return res.status(422).json({ error: validasi.galat || 'Usulan tidak bisa dipakai.' });
    }

    // Pratinjau dihitung sekarang, supaya admin melihat hasilnya sebelum menyetujui.
    // Kartu baru yang melewati sisa ruang halaman dibuang, bukan menggagalkan usulan.
    const pangkas = pangkasTambahan(validasi.perubahan, halaman.widgets.length);
    if (pangkas.perubahan.length === 0) {
      return res.status(409).json({
        error: `Halaman "${halaman.judul}" sudah berisi ${halaman.widgets.length} kartu (batas ${MAKS_WIDGET_HALAMAN}). Hapus satu kartu dulu, atau buat halaman baru.`,
        judulHalaman: halaman.judul,
      });
    }
    const perubahanFinal = pangkas.perubahan;
    const pratinjau = terapkanPerubahan(halaman.widgets, perubahanFinal);
    if (!pratinjau.berhasil) {
      return res.status(409).json({ error: pratinjau.galat || 'Usulan tidak bisa diterapkan pada halaman ini.' });
    }

    const usulan = db.createUsulanHalaman({
      tenantId,
      dashboardId,
      halamanId: halaman.id,
      judulHalaman: halaman.judul,
      ringkasan: String(mentah?.ringkasan || ringkasUsulan(perubahanFinal)).slice(0, 300),
      perubahan: perubahanFinal,
      asal: 'chat',
      dibuatOleh: session.userId,
      dibuatOlehNama: session.name,
    });

    res.status(201).json({
      usulan,
      ringkasanPerubahan: ringkasUsulan(perubahanFinal),
      judulHalaman: halaman.judul,
      dipangkas: pangkas.dipangkas,
      jumlahKartuSetelah: pratinjau.jumlahAkhir,
      pratinjauWidgets: pratinjau.widgets,
    });
  });

  app.get('/api/usulan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!isAdminRole(session.role)) {
      return res.status(403).json({ error: 'Usulan halaman hanya untuk admin instansi.' });
    }
    const tenantId = effectiveTenantId(req, session);
    res.json(
      db.getUsulanHalaman(tenantId, {
        dashboardId: String(req.query.dashboardId || '').trim() || undefined,
        halamanId: String(req.query.halamanId || '').trim() || undefined,
        status: String(req.query.status || '').trim() || undefined,
      })
    );
  });

  /** Terapkan usulan — di sinilah halaman benar-benar berubah. */
  app.post('/api/usulan/:id/terapkan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh menerapkan usulan.')) return;
    const tenantId = effectiveTenantId(req, session);

    const usulan = db.getUsulanHalamanById(req.params.id, tenantId);
    if (!usulan) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
    if (usulan.status !== 'menunggu') {
      return res.status(409).json({ error: `Usulan ini sudah ${usulan.status}.` });
    }

    const dash = db.dashboards.find((d) => d.id === usulan.dashboardId && d.tenantId === tenantId);
    if (!dash) return res.status(404).json({ error: 'Dashboard-nya sudah tidak ada.' });
    const halaman = halamanDari(dash, usulan.halamanId);
    if (!halaman) return res.status(404).json({ error: 'Halamannya sudah tidak ada.' });

    const hasil = terapkanPerubahan(halaman.widgets, usulan.perubahan);
    if (!hasil.berhasil) {
      db.updateUsulanHalaman(usulan.id, tenantId, { catatan: hasil.galat });
      return res.status(409).json({ error: hasil.galat || 'Usulan tidak bisa diterapkan.' });
    }

    const daftarHalaman =
      dash.halaman && dash.halaman.length > 0
        ? dash.halaman
        : [{ id: halaman.id, judul: halaman.judul, widgets: halaman.widgets }];
    const halamanBaru = daftarHalaman.map((h) => (h.id === halaman.id ? { ...h, widgets: hasil.widgets } : h));
    const aktif = dash.halamanAktifId || halaman.id;
    const halamanAktif = halamanBaru.find((h) => h.id === aktif) || halamanBaru[0];

    const diperbarui = db.updateDashboard(
      dash.id,
      { halaman: halamanBaru, halamanAktifId: halamanAktif.id, widgets: halamanAktif.widgets },
      tenantId
    );
    const usulanSelesai = db.updateUsulanHalaman(usulan.id, tenantId, {
      status: 'diterapkan',
      diterapkanPada: new Date().toISOString(),
    });


    res.json({ usulan: usulanSelesai, dashboard: diperbarui, jumlahKartu: hasil.jumlahAkhir });
  });

  app.post('/api/usulan/:id/batalkan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin instansi yang boleh membatalkan usulan.')) return;
    const tenantId = effectiveTenantId(req, session);
    const usulan = db.getUsulanHalamanById(req.params.id, tenantId);
    if (!usulan) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
    if (usulan.status !== 'menunggu') {
      return res.status(409).json({ error: `Usulan ini sudah ${usulan.status}.` });
    }
    res.json(db.updateUsulanHalaman(usulan.id, tenantId, { status: 'dibatalkan' }));
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const notifs = db.notifications.filter((n) => {
      if (n.tenantId !== effectiveTenantId(req, session)) return false;
      // Notifikasi lama (alert) tidak punya penerima → berlaku untuk seisi instansi.
      if (!n.untukUserId && !n.untukRole) return true;
      if (n.untukUserId && n.untukUserId === session.userId) return true;
      if (n.untukRole === 'admin' && isAdminRole(session.role)) return true;
      return false;
    });
    res.json(notifs);
  });

  app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const notif = db.notifications.find(
      (n) => n.id === req.params.id && n.tenantId === tenantId
    );
    if (!notif) {
      return res.status(404).json({ error: 'Notifikasi tidak ditemukan atau akses ditolak.' });
    }
    notif.isRead = true;
    db.simpanNotifikasi(notif);
    db.persist();
    res.json({ success: true });
  });

  // ================= MANAJEMEN BERKAS (KMS) ROUTES =================
  /**
   * Manajemen Berkas — repositori berkas instansi di layanan KMS.
   *
   * Berkas TIDAK disimpan di aplikasi ini: penyimpanannya di KMS
   * (`ragkms.aiones.app`), lalu KMS mengindeksnya ke vector store yang sama
   * dengan yang dibaca chat/dashboard. Karena itu daftar berkas selalu dibaca
   * LANGSUNG dari KMS — aplikasi tidak menyimpan salinan yang bisa jadi basi.
   *
   * Satu API key KMS dapat mengakses BANYAK project, jadi tujuan berkas
   * ditentukan `Tenant.kmsOrganizationId` (dipetakan admin per instansi).
   * Instansi yang belum dipetakan TIDAK diberi berkas kosong palsu — balasannya
   * menyebut `terpetakan: false` beserta cara memperbaikinya.
   */
  const berkasKosong = () => ({
    total: 0,
    totalKb: 0,
    terindeks: 0,
    belumTerindeks: 0,
    perTipe: [],
    terbesarKb: 0,
    terbaruPada: null,
  });

  /**
   * Cache singkat daftar project KMS. Halaman Manajemen Berkas memanggil
   * beberapa endpoint sekaligus (daftar + ringkasan + unggah); tanpa cache,
   * tiap panggilan menembak KMS lagi. Daftar project jarang berubah.
   */
  let cacheOrgKms: { pada: number; data: OrganisasiKMS[] } | null = null;
  async function daftarProjectKms(): Promise<OrganisasiKMS[]> {
    const sekarang = Date.now();
    if (cacheOrgKms && sekarang - cacheOrgKms.pada < 60_000) return cacheOrgKms.data;
    const data = await klienKms().daftarOrganisasi();
    cacheOrgKms = { pada: sekarang, data };
    return data;
  }

  /**
   * Project KMS efektif untuk sebuah instansi.
   *
   * Pemetaan eksplisit (`Tenant.kmsOrganizationId`) menang. Bila belum diisi,
   * cari project KMS yang `knowledgeBase`-nya SAMA dengan KB instansi
   * (`Tenant.knowledgeBaseId`) — dicocokkan bentuk-normal, bukan kemiripan teks.
   *
   * PENTING: JANGAN pernah mengirim `knowledgeBaseId` mentah sebagai
   * `organizationId`. KMS diam-diam mengalihkan organizationId yang tidak
   * dikenal ke project DEFAULT — berkas bisa mendarat di repositori instansi
   * lain (terbukti saat uji: kirim `kb_pam_jaya` → tersimpan di project
   * "VibeContent Shared Knowledge"). Karena itu pemetaan otomatis HANYA
   * mengembalikan id project yang benar-benar ada di daftar KMS.
   */
  async function projectKmsEfektif(
    tenant: Tenant | undefined
  ): Promise<{ organizationId: string; otomatis: boolean; projectKms?: string }> {
    const eksplisit = String(tenant?.kmsOrganizationId || '').trim();
    if (eksplisit) return { organizationId: eksplisit, otomatis: false };
    try {
      const orgs = await daftarProjectKms();
      const cocokKb = cariProjectKmsDariKb(orgs, tenant?.knowledgeBaseId);
      if (cocokKb) return { organizationId: cocokKb.id, otomatis: true, projectKms: cocokKb.name };
      // Cadangan: cocokkan NAMA instansi ke nama project KMS. Tanpa ini instansi yang
      // KB-nya belum ditautkan di KMS selalu "belum dipetakan" walau project-nya ada,
      // sehingga unggah/lihat/unduh berkas buntu (400) sampai admin mengisi manual.
      const cocokNama = cariProjectKmsDariNama(orgs, tenant?.name);
      if (cocokNama) return { organizationId: cocokNama.id, otomatis: true, projectKms: cocokNama.name };
    } catch {
      // KMS tak bisa dihubungi — jangan menebak. Pemanggil yang menampilkan galat.
    }
    return { organizationId: '', otomatis: false };
  }

  /**
   * Balasan 400 saat instansi belum terpetakan, LENGKAP dengan daftar project KMS
   * yang tersedia. Pesan lama hanya "belum dipetakan" tanpa jalan keluar, sehingga
   * admin tidak tahu project mana yang harus dipilih.
   */
  async function balasBelumTerpetakan(res: Response) {
    let daftar: { id: string; name: string; knowledgeBase?: string }[] = [];
    try {
      daftar = (await daftarProjectKms()).slice(0, 15).map((o) => ({
        id: o.id,
        name: o.name,
        ...(o.knowledgeBase ? { knowledgeBase: o.knowledgeBase } : {}),
      }));
    } catch {
      // KMS tak bisa dihubungi: tetap balas dengan petunjuk, tanpa daftar.
    }
    return res.status(400).json({
      error: 'Instansi ini belum terhubung ke repositori dokumen.',
      petunjuk:
        'Isi "Repositori Dokumen" pada instansi di panel admin (Instansi & KB). ' +
        'Pencocokan otomatis sudah dicoba lewat basis dokumen dan nama instansi, tetapi tidak ada yang sama.',
      projectTersedia: daftar,
    });
  }

  /** Ambil instansi efektif + project KMS-nya. */
  async function konteksBerkas(req: Request, session: SessionPayload) {
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const { organizationId, otomatis, projectKms } = await projectKmsEfektif(tenant);
    return { tenantId, tenant, organizationId, otomatis, projectKms };
  }

  /**
   * EKSTRAKSI LOKAL UNTUK BERKAS SPREADSHEET (xlsx/xls/csv).
   *
   * Layanan RAG mengindeks isi spreadsheet sebagai teks, dan pencarian vektornya
   * hampir tidak pernah menemukan baris tabel — hasilnya "informasi tidak
   * ditemukan" walau berkasnya penuh angka. Untuk berkas seperti ini isinya
   * dibaca LANGSUNG dari file: setiap lembar diurai, kolom angka dan labelnya
   * diambil, lalu dijadikan butir yang sama bentuknya dengan hasil RAG.
   *
   * Angka tetap berasal dari berkas asli (bukan model), dan sitasinya menyebut
   * lembar asal, jadi bisa diperiksa ulang.
   */
  /**
   * BUTIR PER KOLOM ANGKA — supaya isi dokumen terambil SELURUHNYA.
   *
   * Rangkuman widget hanya mengambil dua kolom angka terkuat per lembar, padahal
   * satu berkas bisa punya ratusan kolom (Sipil SPM: 21 lembar, 275 kolom angka).
   * Fungsi ini membuat satu butir untuk SETIAP kolom angka: nama kolom menjadi
   * judul, label baris menjadi kategori, angkanya menjadi deret. Dengan begitu
   * tidak ada kolom yang hilang, dan tiap butir tetap kecil sehingga halaman
   * Pilih Data tidak berat.
   */
  /**
   * TIMELINE DARI NAMA LEMBAR.
   *
   * Lembar laporan bulanan biasanya bernama "anggaran Biaya Jan 2026" atau
   * "Pendapatan Maret". Bulan/tahun itu dipakai sebagai label periode supaya
   * kolom yang sama dari dua belas lembar bisa disatukan menjadi satu butir.
   *
   * `tanggal: false` berarti lembarnya tidak menyebut waktu; kolom bernama sama
   * di lembar seperti itu TIDAK digabung, karena bisa jadi dua hal berbeda.
   */
  const NAMA_BULAN: Record<string, string> = {
    jan: 'Jan', januari: 'Jan', feb: 'Feb', februari: 'Feb', pebruari: 'Feb',
    mar: 'Mar', maret: 'Mar', apr: 'Apr', april: 'Apr', mei: 'Mei', may: 'Mei',
    jun: 'Jun', juni: 'Jun', jul: 'Jul', juli: 'Jul', agu: 'Agu', agt: 'Agu',
    agus: 'Agu', agustus: 'Agu', sep: 'Sep', sept: 'Sep', september: 'Sep',
    okt: 'Okt', oktober: 'Okt', nov: 'Nov', november: 'Nov', des: 'Des', desember: 'Des',
  };

  function timelineDariNama(lembar: string): { label: string | null; tanggal: boolean } {
    const t = String(lembar || '').toLowerCase();
    const bulan = t.match(/\b(januari|jan|februari|pebruari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|agt|agus|agu|september|sept|sep|oktober|okt|november|nov|desember|des)\b/);
    const tahun = t.match(/\b(20\d{2})\b/);
    if (bulan) {
      const nama = NAMA_BULAN[bulan[1]] || bulan[1];
      return { label: tahun ? `${nama} ${tahun[1]}` : nama, tanggal: true };
    }
    if (tahun) return { label: tahun[1], tanggal: true };
    return { label: null, tanggal: false };
  }

  function butirDariKolomLembar(
    lembar: Array<{ nama: string; baris: Map<number, Array<string | number | null>> }>,
    judulBerkas: string
  ): any[] {
    const BATAS_KOLOM = 400;
    const BATAS_TITIK = 36;
    const BATAS_PERIODE = 24;
    const teks = (v: unknown) => String(v ?? '').trim();
    /**
     * KOLOM YANG BUKAN BESARAN.
     *
     * Nomor urut baris (1, 2, 3, …) dan kolom kode akun (410201, 410302, …) ikut
     * terbaca sebagai angka, padahal bukan nilai yang bisa digrafikkan. Tanpa
     * penyaring ini keduanya muncul sebagai kartu data yang membingungkan.
     */
    const bukanBesaran = (data: number[]): boolean => {
      if (data.length < 3) return false;
      if (!data.every((v) => Number.isInteger(v))) return false;
      const menaik = data.every((v, i) => i === 0 || v > data[i - 1]);
      if (!menaik) return false;
      const selisih = data.slice(1).map((v, i) => v - data[i]);
      const maks = Math.max(...data);
      // Nomor urut: 1,2,3,… atau 1,2,4,… dengan loncatan kecil.
      if (maks <= 5000 && selisih.every((s) => s >= 1 && s <= 3)) return true;
      // Kode akun: angka besar berurutan rapat (selisih ratusan/ribuan kecil).
      if (data[0] >= 10000 && Math.max(...selisih) <= 2000) return true;
      return false;
    };
    const hurufKolom = (c: number) => {
      let hasil = '';
      let n = c;
      do {
        hasil = String.fromCharCode(65 + (n % 26)) + hasil;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      return hasil;
    };

    interface Entri {
      lembar: string;
      kolom: string;
      kolomKe: number;
      timeline: string | null;
      bertanggal: boolean;
      data: number[];
      kategori: string[];
      /** Kolom tanggal: rentang tanggal asli untuk sitasi. */
      rentang?: string | null;
    }
    const entri: Entri[] = [];
    const butirBulananPerLembar: any[] = [];
    const bulanDilewati = new Set<string>();
    const sidikTerpakai = new Set<string>();

    /**
     * Judul kolom yang cuma berisi angka atau terlalu pendek ("0", "-") tidak
     * layak jadi nama butir. Untuk kasus itu nama diambil dari lembarnya.
     */
    /**
     * Nama lembar tanpa keterangan waktu: "Pendapatan Jan 2026" -> "Pendapatan",
     * "anggaran Biaya Maret 2026" -> "anggaran Biaya". Dipakai sebagai awalan
     * nama butir supaya indikator dari lembar berbeda tidak tertukar, sekaligus
     * supaya butir dari bulan berbeda tetap bertemu sebagai satu indikator.
     */
    const namaLembarInti = (nama: string): string => {
      const asli = String(nama || '').trim();
      /**
       * Lembar yang namanya HANYA satu bulan ("FEB", "JAN") biasanya bukan bulan
       * melainkan kode wilayah/fakultas. Jangan dibuang. Yang dibuang hanya bulan
       * pada nama panjang, atau bulan yang berpasangan dengan tahun.
       */
      const sebulan = /^(jan|feb|mar|apr|mei|jun|jul|agu|agt|aug|sep|sept|okt|oct|nov|des|dec)[a-z]*$/i.test(asli);
      if (sebulan && !/\b(19|20)\d{2}\b/.test(asli)) return asli;
      let s = ` ${asli} `;
      s = s.replace(
        /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|aug|sep|sept|okt|oct|nov|des|dec)\b/gi,
        ' '
      );
      s = s.replace(/\b(19|20)\d{2}\b/g, ' ');
      s = s.replace(/[-_/\s]+$/g, '').replace(/^[-_/\s]+/g, '');
      s = s.replace(/\s+/g, ' ').trim();
      return s || String(nama || '').trim();
    };

    const namaDasarKolom = (lembar: string, kolom: string): string => {
      const bersih = String(kolom || '').trim();
      if (bersih.length < 3 || /^[0-9\s.,%()/\-]+$/.test(bersih)) return `${lembar} · per periode`;
      return bersih;
    };

    for (const lb of lembar) {
      const baris = [...lb.baris.entries()].sort((a, b) => a[0] - b[0]).map(([no, sel]) => ({ no, sel: sel || [] }));
      if (baris.length === 0) continue;
      const lebar = Math.max(...baris.map((b) => b.sel.length), 0);
      if (lebar === 0) continue;
      const waktu = timelineDariNama(lb.nama);

      /**
       * Baris judul = baris TERPADAT dalam 20 baris pertama, bukan baris pertama
       * yang berisi dua teks. Laporan sering diawali nama perusahaan dan judul,
       * sehingga aturan lama memilih baris judul yang salah dan kolom bulan
       * (JANUARI, FEBRUARI, …) tidak pernah dikenali.
       */
      /**
       * Baris judul dipilih dari banyaknya SEL TEKS, bukan banyaknya sel berisi.
       * Baris data angka selalu lebih padat daripada baris judul ("Target",
       * "Realisasi", …), sehingga hitungan sel berisi pernah memilih baris angka:
       * judul kolom menjadi nilai total, dan butir diberi nama angka.
       */
      let barisJudul = -1;
      let palingPadat = 0;
      for (let i = 0; i < Math.min(baris.length, 20); i += 1) {
        const isi = baris[i].sel.filter((s) => typeof s === 'string' && teks(s).length > 0).length;
        if (isi > palingPadat) {
          palingPadat = isi;
          barisJudul = i;
        }
      }
      if (palingPadat < 2) barisJudul = -1;
      /**
       * Baris di bawah judul hanya dipakai sebagai sub-judul kalau memang berisi
       * teks semua. Kalau ada angkanya, itu baris DATA — memakainya menghasilkan
       * nama seperti "Vendor · AMAQITA. CV" yang mencampur judul dengan isi.
       */
      const selBawah = barisJudul >= 0 ? baris[barisJudul + 1]?.sel || [] : [];
      const teksBawah = selBawah.filter((s) => typeof s === 'string' && teks(s)).length;
      const angkaBawah = selBawah.filter((s) => typeof s === 'number').length;
      const adaSubJudul = barisJudul >= 0 && teksBawah >= 2 && angkaBawah === 0;
      /**
       * Nama kolom = judul kelompok + sub-judul.
       *
       * Judul tabel sering bertingkat: baris atas "Target / Tahun", "Realisasi",
       * "Sisa Anggaran" (sel gabungan, hanya terisi di kolom pertama), baris
       * bawah "Bulan Berjalan", "S.D Bulan Berjalan". Tanpa menggabungkan
       * keduanya, beberapa kolom berbeda mendapat nama sama ("Bulan Berjalan")
       * dan pembaca tidak tahu itu target, realisasi, atau sisa.
       */
      /**
       * "Target / Tahun + Tahun" dibaca manusia sebagai "Target setahun",
       * bukan "Target / Tahun · Tahun". Bentuk ringkas ini dipakai supaya nama
       * kartu langsung menjelaskan isinya.
       */
      const rapiJudulKolom = (atas: string, sub: string): string => {
        /**
         * Judul 1–2 huruf (mis. sel berisi "A", "I") bukan nama indikator; itu
         * sisa label kolom lembar. Diperlakukan kosong supaya pemanggil memakai
         * nama "Kolom <huruf>" yang jelas asalnya.
         */
        // Hanya SATU huruf yang dianggap sisa label ("A", "I"). "No" dan "Tgl"
        // adalah judul kolom sungguhan, jangan dibuang.
        const pendek = (t: string) => /^[A-Za-z]$/.test(t.trim());
        const grup = pendek(String(atas || ''))
          ? ''
          : String(atas || '')
              .replace(/\s*\/\s*tahun\s*$/i, '')
              .replace(/\s+tahun\s*$/i, '')
              .replace(/\s+/g, ' ')
              .trim();
        // Sub-judul yang ternyata ANGKA (mis. "460649371", "46302") adalah isi
        // sel data, bukan judul — jangan ditempelkan ke nama.
        const anakMentah = String(sub || '').trim();
        const anak = /^[-+]?[\d.,]+$/.test(anakMentah) || pendek(anakMentah) ? '' : anakMentah;
        const kecil = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        if (!anak) return atas.replace(/tahun$/i, 'setahun').trim();
        // "Sisa Anggaran" + "Sisa Anggaran Tahun" jangan jadi berulang.
        if (grup && anak.toLowerCase().includes(grup.toLowerCase())) {
          const t = anak.replace(/tahun$/i, 'setahun').trim();
          return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        }
        if (!grup) return /tahun$/i.test(anak) ? anak.replace(/tahun$/i, 'setahun').trim() : kecil(anak);
        if (/^tahun$/i.test(anak)) return `${grup} setahun`;
        if (/^s\.?d\.?\s*bulan\s+berjalan$/i.test(anak)) return `${grup} s.d. bulan berjalan`;
        if (/^s\.?d\.?\s*tahun$/i.test(anak)) return `${grup} s.d. tahun`;
        if (/^bulan\s+berjalan$/i.test(anak)) return `${grup} bulan berjalan`;
        if (/tahun$/i.test(anak)) return `${grup} ${anak.replace(/tahun$/i, 'setahun').toLowerCase()}`;
        return `${grup} · ${anak}`;
      };
      /**
       * Judul yang berulang seperti "TGL" dan "No" di lembar pengadaan tidak
       * berdiri sendiri: setiap pasangannya mengikuti dokumen di sebelah kirinya
       * (SPPH, SPH, BAKN, SPK, BAST, PAKTA, INV, AMD, SL). Nama seperti
       * "TGL SPH" jauh lebih jelas daripada "TGL (kol S)".
       */
      const GENERIK = /^(tgl\.?|tanggal|no\.?|nomor|nomer)$/i;
      const hitungJudul = (t: string): number => {
        if (barisJudul < 0 || !t) return 0;
        const sel = (baris[barisJudul]?.sel || []) as unknown[];
        const kunci = t.toLowerCase().trim();
        return sel.filter((v) => teks(v).toLowerCase().trim() === kunci).length;
      };
      const namaBerpasangan = (c: number, nama: string): string => {
        const sendiriTxt = teks(baris[barisJudul]?.sel?.[c] ?? '');
        if (!GENERIK.test(sendiriTxt.trim())) return nama;
        if (hitungJudul(sendiriTxt) < 2) return nama;
        for (let k = c - 1; k >= 0; k -= 1) {
          const t = teks(baris[barisJudul]?.sel?.[k] ?? '');
          if (!t || GENERIK.test(t.trim())) continue;
          if (t.toLowerCase() === sendiriTxt.toLowerCase()) continue;
          return `${sendiriTxt} ${t}`.replace(/\s+/g, ' ').slice(0, 60);
        }
        return nama;
      };

      const judulKolom = (c: number): string => {
        const sub = adaSubJudul ? teks(baris[barisJudul + 1]?.sel?.[c]) : '';
        let induk = '';
        if (barisJudul >= 0) {
          for (let k = c; k >= 0; k -= 1) {
            const t = teks(baris[barisJudul]?.sel?.[k]);
            if (t) {
              induk = t;
              break;
            }
          }
        }
        const sendiri = barisJudul >= 0 ? teks(baris[barisJudul]?.sel?.[c]) : '';
        const atas = sendiri || induk;
        if (atas || sub) {
          const rapi = rapiJudulKolom(atas, sub).slice(0, 60);
          // Judul yang ternyata angka (nilai sel) atau terlalu pendek tidak layak
          // jadi nama kolom; huruf kolom lebih jujur.
          if (!/^[-+]?[\d.,]+$/.test(rapi.trim()) && rapi.replace(/[^A-Za-z]/g, '').length >= 2) return namaBerpasangan(c, rapi);
          return `Kolom ${hurufKolom(c)}`;
        }
        const kandidat = [barisJudul, barisJudul + 1, barisJudul - 1].filter((i) => i >= 0 && i < baris.length);
        for (const i of kandidat) {
          const t = teks(baris[i]?.sel?.[c]);
          // Angka di sini isi sel, bukan judul kolom.
          if (t && !/^[-+]?[\d.,]+$/.test(t) && t.replace(/[^A-Za-z]/g, '').length >= 2) return t.slice(0, 60);
        }
        return `Kolom ${hurufKolom(c)}`;
      };
      const jumlahTeksPerKolom = new Array(lebar).fill(0);
      for (const b of baris) {
        for (let c = 0; c < lebar; c += 1) {
          const sel = b.sel[c];
          if (typeof sel === 'string' && teks(sel)) jumlahTeksPerKolom[c] += 1;
        }
      }
      const kolomLabel = jumlahTeksPerKolom.indexOf(Math.max(...jumlahTeksPerKolom));
      const mulai = barisJudul >= 0 ? barisJudul + 1 : 0;

      /**
       * KOLOM BERISI PERIODE (Jan, Feb, … Des) dalam satu lembar.
       *
       * Banyak laporan menaruh bulan di kolom, bukan di lembar terpisah. Deret
       * seperti itu bukan dua belas indikator berbeda, melainkan satu indikator
       * dengan dua belas periode — jadi digabung menjadi satu butir dan
       * periodenya bisa dipilih di halaman Pilih Data.
       */
      const kolomBulan: Array<{ c: number; label: string }> = [];
      const POLA_BULAN = /\b(januari|jan|februari|pebruari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|agt|agus|agu|september|sept|sep|oktober|okt|november|nov|desember|des)\b/;
      for (let c = 0; c < lebar; c += 1) {
        if (c === kolomLabel) continue;
        // Judul bulan dicari di sekitar baris judul, bukan hanya tepat di baris
        // itu: laporan sering punya baris judul bertingkat (judul tabel di atas,
        // nama bulan di bawahnya).
        let judulBulan = '';
        const dari = Math.max(0, (barisJudul < 0 ? 0 : barisJudul) - 3);
        const sampai = Math.min(baris.length, (barisJudul < 0 ? 6 : barisJudul) + 4);
        for (let i = dari; i < sampai; i += 1) {
          const kandidat = teks(baris[i]?.sel?.[c]);
          if (kandidat && POLA_BULAN.test(kandidat.toLowerCase())) {
            judulBulan = kandidat;
            break;
          }
        }
        if (!judulBulan) continue;
        const m = judulBulan.toLowerCase().match(POLA_BULAN);
        if (!m) continue;
        const tahun = judulBulan.match(/\b(20\d{2})\b/);
        kolomBulan.push({ c, label: `${NAMA_BULAN[m[1]] || m[1]}${tahun ? ` ${tahun[1]}` : ''}` });
      }
      if (kolomBulan.length >= 3) {
        const seriPeriode = kolomBulan.slice(0, BATAS_PERIODE).map(({ c, label }) => {
          const data: number[] = [];
          const kategori: string[] = [];
          for (let i = mulai; i < baris.length; i += 1) {
            const v = baris[i].sel[c];
            if (typeof v !== 'number' || !Number.isFinite(v)) continue;
            data.push(v);
            kategori.push((teks(baris[i].sel[kolomLabel]) || `baris ${baris[i].no}`).slice(0, 44));
            if (data.length >= BATAS_TITIK) break;
          }
          return { nama: label, data, kategori };
        }).filter((s) => s.data.length >= 3);
        if (seriPeriode.length >= 3) {
          butirBulananPerLembar.push({
            nama: `${namaDasarKolom(lb.nama, '')}`,
            seri: seriPeriode,
            periodeTersedia: seriPeriode.map((s) => s.nama),
            sitasi: {
              dokumen: judulBerkas,
              kutipan: `Lembar "${lb.nama}", kolom periode ${seriPeriode.map((s) => s.nama).join(', ')}`,
            },
            keyakinan: 'tinggi',
          });
          // Kolom bulan sudah diwakili butir gabungan di atas.
          for (const { c } of kolomBulan) bulanDilewati.add(`${lb.nama}#${c}`);
        }
      }

      for (let c = 0; c < lebar; c += 1) {
        if (c === kolomLabel) continue;
        if (bulanDilewati.has(`${lb.nama}#${c}`)) continue;
        const data: number[] = [];
        const kategori: string[] = [];
        for (let i = mulai; i < baris.length; i += 1) {
          const v = baris[i].sel[c];
          if (typeof v !== 'number' || !Number.isFinite(v)) continue;
          const label = teks(baris[i].sel[kolomLabel]) || `baris ${baris[i].no}`;
          data.push(v);
          kategori.push(label.slice(0, 44));
          if (data.length >= BATAS_TITIK) break;
        }
        if (data.length < 3) continue;
        /**
         * Kolom tanggal (nomor seri Excel 46093, …) diperiksa SEBELUM penyaring
         * `bukanBesaran`: deret tanggal yang menaik rapat ikut terbuang sebagai
         * "kode akun". Isinya diganti jumlah baris per bulan dari SEMUA baris,
         * bukan hanya BATAS_TITIK baris pertama.
         */
        const judulMentah = judulKolom(c);
        if (kolomTanggal(judulMentah, data)) {
          const semuaNilai: number[] = [];
          for (let i = mulai; i < baris.length; i += 1) {
            const v = baris[i].sel[c];
            if (typeof v === 'number' && Number.isFinite(v)) semuaNilai.push(v);
          }
          const per = jumlahPerBulan(semuaNilai);
          if (per.data.length === 0) continue;
          const namaTgl = `${judulMentah} · jumlah per bulan`;
          const sidikTgl = `${lb.nama}|${namaTgl}|${per.data.join(',')}`;
          if (sidikTerpakai.has(sidikTgl)) continue;
          sidikTerpakai.add(sidikTgl);
          entri.push({
            lembar: lb.nama,
            kolom: namaTgl,
            kolomKe: c,
            timeline: waktu.label,
            bertanggal: waktu.tanggal,
            data: per.data.slice(0, BATAS_TITIK),
            kategori: per.kategori.slice(0, BATAS_TITIK),
            rentang: per.rentang,
          });
          if (entri.length >= BATAS_KOLOM) break;
          continue;
        }
        if (bukanBesaran(data)) continue;
        const namaKolom = judulMentah;
        if (/^(no|nomor|kode)$/i.test(namaKolom)) continue;
        const sidik = `${lb.nama}|${namaKolom}|${data.join(',')}`;
        if (sidikTerpakai.has(sidik)) continue;
        sidikTerpakai.add(sidik);
        entri.push({
          lembar: lb.nama,
          kolom: namaKolom,
          kolomKe: c,
          timeline: waktu.label,
          bertanggal: waktu.tanggal,
          data,
          kategori,
        });
        if (entri.length >= BATAS_KOLOM) break;
      }
      if (entri.length >= BATAS_KOLOM) break;
    }

    /**
     * PENGGABUNGAN PER TIMELINE.
     *
     * Indikator yang sama muncul di banyak lembar bulanan (Januari sampai
     * Desember). Semuanya disatukan menjadi satu butir: `seri` berisi satu deret
     * per periode, `periodeTersedia` menyimpan daftarnya. Angka tidak dijumlah
     * dan tidak dirata-ratakan, hanya deret yang sudah ada yang dikumpulkan.
     */
    const namaTerpakai = new Set<string>();
    const namaButirUnik = (dasar: string, kolomKe: number): string => {
      let nama = dasar.slice(0, 140);
      if (namaTerpakai.has(nama.toLowerCase())) nama = `${dasar.slice(0, 128)} (kol ${hurufKolom(kolomKe)})`.slice(0, 140);
      let n = 2;
      while (namaTerpakai.has(nama.toLowerCase())) {
        nama = `${dasar.slice(0, 132)} (${n})`;
        n += 1;
      }
      namaTerpakai.add(nama.toLowerCase());
      return nama;
    };

    const perKelompok = new Map<string, Entri[]>();
    for (const e of entri) {
      /**
       * Indikator dibedakan per LEMBAR INTI, bukan hanya nama kolom. Lembar
       * "anggaran Biaya Jan 2026" dan "Pendapatan Jan 2026" punya judul kolom
       * yang sama (Target setahun, Realisasi, …); tanpa awalan lembar, keduanya
       * jatuh ke satu butir dan angkanya bercampur.
       */
      const kunci = `${namaLembarInti(e.lembar).toLowerCase()}|${e.kolom.toLowerCase()}`;
      const daftar = perKelompok.get(kunci) ?? [];
      daftar.push(e);
      perKelompok.set(kunci, daftar);
    }

    const hasil: any[] = [...butirBulananPerLembar];
    const sudahGabung = new Set<Entri>();
    for (const [, daftar] of perKelompok) {
      const bertanggal = daftar.filter((e) => e.bertanggal && e.timeline);
      const periodeUnik = [...new Set(bertanggal.map((e) => String(e.timeline)))];
      if (periodeUnik.length < 2) continue;
      const dipakai = bertanggal.slice(0, BATAS_PERIODE);
      for (const e of dipakai) sudahGabung.add(e);
      const kolom = daftar[0].kolom;
      // Awalan nama lembar (tanpa bulan) menjaga indikator antarlembar tidak tercampur.
      const dasarKolom = /^(no|nomor|kode|kolom)\b/i.test(kolom)
        ? namaDasarKolom(namaLembarInti(daftar[0].lembar), kolom)
        : `${namaLembarInti(daftar[0].lembar)} · ${kolom}`;
      hasil.push({
        nama: namaButirUnik(dasarKolom, daftar[0].kolomKe),
        seri: dipakai.map((e) => ({ nama: String(e.timeline), data: e.data, kategori: e.kategori })),
        periodeTersedia: periodeUnik.slice(0, BATAS_PERIODE),
        sitasi: {
          dokumen: judulBerkas,
          kutipan: `Kolom "${kolom}" pada ${dipakai.length} periode: ${periodeUnik.slice(0, 6).join(', ')}${periodeUnik.length > 6 ? ' dan lainnya' : ''}`,
        },
        keyakinan: 'tinggi',
      });
    }

    for (const e of entri) {
      if (sudahGabung.has(e)) continue;
      /**
       * Lembar yang menyebut waktunya ("Anggaran Okt 2026") memakai nama kolom
       * saja sebagai nama butir, karena periodenya sudah tercatat di `periode`.
       * Dengan begitu berkas susulan satu bulan otomatis bergabung dengan
       * indikator yang sama di berkas lain (penggabungan lintas dokumen).
       */
      /**
       * Nama kolom pendek ("Saldo", "Total", "Bayar") tidak menjelaskan apa pun
       * kalau berdiri sendiri; lembarnya dipakai sebagai awalan. Nama panjang
       * dibiarkan tanpa awalan supaya butir bulan berbeda tetap bisa bergabung.
       */
      const perluAwalan = !(e.bertanggal && e.timeline) || String(e.kolom).trim().length <= 12;
      // Nama lembar yang hanya berisi bulan ("Januari") habis saat bulan dibuang;
      // pakai nama aslinya supaya nama butir tidak dimulai dengan "·".
      const lembarNama = namaLembarInti(e.lembar) || String(e.lembar || '').trim() || 'Lembar';
      const dasarNama = perluAwalan ? `${lembarNama} · ${e.kolom}` : e.kolom;
      hasil.push({
        nama: namaButirUnik(namaDasarKolom(e.lembar, dasarNama), e.kolomKe),
        seri: [{ nama: e.timeline || e.kolom, data: e.data, kategori: e.kategori }],
        ...(e.timeline ? { periode: e.timeline } : {}),
        sitasi: {
          dokumen: judulBerkas,
          kutipan: e.rentang
            ? `Lembar "${e.lembar}", kolom ${e.kolom}: tanggal ${e.rentang}, ${e.data.reduce((a, b) => a + b, 0)} baris dihitung per bulan`
            : `Lembar "${e.lembar}", kolom ${e.kolom}, ${e.data.length} baris angka terbaca`,
        },
        keyakinan: 'tinggi',
      });
    }
    return hasil;
  }

  /**
   * EKSTRAKSI LOKAL UNTUK BERKAS SPREADSHEET (xlsx/xls/csv).
   *
   * Layanan RAG mengindeks isi spreadsheet sebagai teks, dan pencarian vektornya
   * hampir tidak pernah menemukan baris tabel — hasilnya "informasi tidak
   * ditemukan" walau berkasnya penuh angka. Untuk berkas seperti ini isinya
   * dibaca LANGSUNG dari file: setiap lembar diurai, kolom angka dan labelnya
   * diambil, lalu dijadikan butir yang sama bentuknya dengan hasil RAG.
   *
   * Angka tetap berasal dari berkas asli (bukan model), dan sitasinya menyebut
   * lembar asal, jadi bisa diperiksa ulang.
   */
  async function ekstrakLembarBerkas(
    tenant: any,
    berkasId: string,
    judulBerkas: string
  ): Promise<{ butir: unknown[]; ringkasan?: string } | null> {
    try {
      const { organizationId } = await projectKmsEfektif(tenant);
      if (!organizationId || !berkasId) return null;
      /**
       * Berkas yang BARU diunggah belum tentu langsung muncul di daftar
       * repositori (layanan KMS memperbarui daftarnya beberapa saat kemudian).
       * Kalau namanya tidak ditemukan, isinya tetap dicoba diunduh: bentuk
       * lembarnya sendiri sudah cukup untuk memastikan itu spreadsheet.
       */
      const daftar = await klienKms().daftarBerkas(organizationId).catch(() => [] as any[]);
      const berkas = daftar.find((b: any) => String(b?.id) === String(berkasId));
      const namaBerkas = String((berkas as any)?.fileName || berkas?.title || judulBerkas || '');
      const jenisBerkas = String((berkas as any)?.fileType || '').toUpperCase();
      /**
       * Hanya jenis yang JELAS bukan lembar angka yang dilewati. Judul berkas di
       * repositori sering tanpa ekstensi ("Anggaran 2026 FIX"), jadi "tidak
       * diketahui" harus diperlakukan sebagai mungkin-spreadsheet — kalau tidak,
       * dokumen baru jatuh ke jalur RAG yang tidak bisa membaca isi sel.
       */
      const jelasBukanLembar =
        /\.(pdf|docx?|pptx?|jpe?g|png|gif|txt|md|zip|rar)$/i.test(namaBerkas) ||
        ['PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'JPG', 'JPEG', 'PNG', 'TXT', 'ZIP'].includes(jenisBerkas);
      if (jelasBukanLembar) return null;
      const { isi } = await klienKms().ambilIsiBerkas(String(berkas?.id || berkasId), 'download');
      const lembar = lembarDariBerkas(isi);
      if (lembar.length === 0) return null;
      const hasil = widgetDariSumber({ jenis: 'berkas', lembar, lengkap: true } as any, judulBerkas);
      /**
       * Ringkasan widget bersifat tambahan, bukan syarat. Berkas kecil (dua
       * lembar, empat baris) sering tidak menghasilkan widget apa pun, padahal
       * kolom angkanya tetap bisa dibaca per sel. Jadi hasil kosong di sini tidak
       * menggagalkan analisis — butir per kolom tetap dibuat di bawah.
       */
      const butir: any[] = petakanKeluaranRag({ widgets: hasil.widgets }, judulBerkas) as any[];
      if (butir.length === 0 && hasil.widgets.length === 0) {
        console.log('[lembar] tidak ada widget ringkasan, lanjut ke butir per kolom');
      }
      /**
       * Angka di sini dibaca dari SEL berkas, bukan dikarang model, dan tiap
       * butir membawa sitasi lembar asalnya. Karena itu keyakinannya tinggi
       * sehingga langsung disetujui (lihat `statusButirAwal`) — admin tidak
       * perlu mencentang puluhan angka satu per satu.
       */
      for (const b of butir as any[]) b.keyakinan = 'tinggi';
      // Seluruh kolom angka ikut disimpan, bukan hanya dua kolom terkuat per lembar.
      const perKolom = butirDariKolomLembar(lembar as any, judulBerkas);
      const sudah = new Set((butir as any[]).map((b) => String(b.nama || '').toLowerCase()));
      const tambahan = perKolom.filter((b) => !sudah.has(String(b.nama).toLowerCase()));
      butir.push(...tambahan);
      if (butir.length === 0) {
        console.warn('[lembar] tidak ada butir yang bisa dibentuk dari', namaBerkas);
        return null;
      }
      console.log(
        `[analisis] ${judulBerkas}: dibaca langsung dari berkas (${lembar.length} lembar) → ${butir.length} butir`
      );
      return {
        butir,
        ringkasan:
          `Dibaca langsung dari berkas ${namaBerkas}: ${lembar.length} lembar, ` +
          `${hasil.widgets.length} rangkuman angka, ${tambahan.length} kolom angka. ` +
          'Sumber angkanya isi sel, bukan model.',
      };
    } catch (err: any) {
      console.warn('[analisis] gagal membaca lembar berkas:', err?.message || err);
      return null;
    }
  }

  /** Terjemahkan kegagalan KMS jadi balasan HTTP yang jujur. */
  function balasGalatKms(res: Response, err: any) {
    const status = err instanceof KmsServiceError && err.status ? err.status : 502;
    const kode = status >= 400 && status < 500 && status !== 404 ? status : 502;
    return res.status(kode).json({
      error: err?.message || 'Gagal menghubungi KMS.',
      detail: err instanceof KmsServiceError ? err.detail : undefined,
    });
  }

  /**
   * ponytail: dokumen yang sudah ada di basis dokumen instansi (yang dibaca
   * asisten) tetapi belum pernah masuk repositori tetap ditampilkan, supaya
   * angka di halaman sama dengan isi basis — bukan cuma isi repositori.
   * Dokumen seperti ini belum punya salinan berkas, jadi tanpa pratinjau/unduh.
   */
  /** Batas tunggu daftar dokumen basis di halaman berkas (ms). */
  const BATAS_DAFTAR_BASIS_MS = 10_000;
  /**
   * Ambil daftar dokumen basis sekali jalan.
   *
   * `null` = basis tidak terbaca (lambat/timeout/endpoint tidak ada). Pemanggil
   * tetap menampilkan isi repositori + catatan jujur, bukan menunggu 30 detik.
   */
  async function ambilDokumenBasis(tenant: any): Promise<DokumenBasis[] | null> {
    const kb = String(tenant?.knowledgeBaseId || '').trim();
    if (!kb) return null;
    try {
      const hasil = await ragClient.daftarDokumen(kb, BATAS_DAFTAR_BASIS_MS);
      // `catatan` diisi layanan saat gagal/timeout — jangan dianggap "basis kosong".
      if (hasil.catatan) return null;
      return hasil.dokumen;
    } catch {
      return null;
    }
  }

  /** Dokumen sambutan bawaan repositori bukan dokumen instansi — jangan dihitung. */
  function tanpaDokumenSambutan(berkas: BerkasKMS[]): BerkasKMS[] {
    return berkas.filter((b) => !String(b.id).startsWith('doc-seed-info-'));
  }

  /**
   * Daftar berkas instansi aktif + ringkasan.
   * Admin boleh `?cakupan=all` untuk melihat seluruh project sekaligus.
   */
  app.get('/api/berkas', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const { tenant, organizationId, otomatis, projectKms } = await konteksBerkas(req, session);
    const cakupanAll = isAdminRole(session.role) && String(req.query.cakupan || '') === 'all';
    const org = cakupanAll ? 'all' : organizationId;

    if (!org) {
      // Jujur: belum dipetakan. Jangan mengaku "0 berkas" seolah repo memang kosong.
      return res.json({
        berkas: [],
        total: 0,
        totalSemua: 0,
        limit: null,
        offset: 0,
        adaLagi: false,
        ringkasan: berkasKosong(),
        terpetakan: false,
        organizationId: null,
        instansi: tenant?.name || null,
        catatan:
          'Instansi ini belum terhubung ke repositori dokumen. Pencocokan otomatis lewat basis dokumen instansi sudah dicoba, tetapi tidak ada repositori dengan basis yang sama. Atur "Repositori Dokumen" pada instansi di panel admin, lalu berkas bisa diunggah & dibaca dari sini.',
      });
    }

    try {
      // Repositori dan basis adalah dua sumber terpisah: jalankan bersamaan
      // supaya halaman tidak menunggu dua kali lipat.
      const [mentah, dokumenBasis] = await Promise.all([
        klienKms().daftarBerkas(org),
        cakupanAll ? Promise.resolve(null) : ambilDokumenBasis(tenant),
      ]);
      const gabung = cakupanAll
        ? {
            berkas: mentah,
            jumlahBasis: 0,
            jumlahSambutan: 0,
            jumlahDitambah: 0,
            catatan: undefined as string | undefined,
          }
        : gabungDokumenBasis(tanpaDokumenSambutan(mentah), dokumenBasis);
      const berkas = gabung.berkas;
      const cari = typeof req.query.cari === 'string' ? req.query.cari : '';
      const tipe = typeof req.query.tipe === 'string' ? req.query.tipe : '';
      const tersaring = cari || tipe ? saringBerkas(berkas, { cari, tipe }) : berkas;

      // Paginasi hanya aktif bila klien meminta `limit`. Klien lama yang tidak
      // mengirimnya tetap menerima seluruh daftar (perilaku lama), tetapi tetap
      // diberi `total` supaya bisa menampilkan "x dari y".
      // ponytail: instansi dengan ratusan dokumen membuat satu respons berisi
      // seluruh baris — halaman jadi berat dan memori server naik tanpa guna.
      const adaLimit = req.query.limit !== undefined && String(req.query.limit).trim() !== '';
      const halaman = adaLimit ? potongUrut(tersaring, req.query.limit, req.query.offset) : null;

      // Sidebar menampilkan jumlah dokumen dari `tenant.documentCount`. Angka itu
      // dulu hanya diisi saat instansi dibuat/dihubungkan, jadi tetap 3 padahal
      // repositori sudah berisi 8 — pengguna melihat dua angka berbeda. Segerakan
      // dengan isi repositori yang sebenarnya setiap kali daftar dibaca.
      if (tenant && !cakupanAll && tenant.documentCount !== berkas.length) {
        await db.updateTenant(tenant.id, { documentCount: berkas.length });
      }

      res.json({
        berkas: halaman ? halaman.baris : tersaring,
        total: tersaring.length,
        totalSemua: berkas.length,
        limit: halaman ? halaman.limit : null,
        offset: halaman ? halaman.offset : 0,
        adaLagi: halaman ? adaLagiHalaman(halaman.total, halaman.offset, halaman.limit) : false,
        ringkasan: hitungRingkasanBerkas(berkas),
        terpetakan: true,
        cakupan: org,
        organizationId: organizationId || null,
        pemetaanOtomatis: otomatis,
        projectKms: projectKms || null,
        instansi: tenant?.name || null,
        dokumenBasis: { jumlah: gabung.jumlahBasis, sambutan: gabung.jumlahSambutan },
        catatan: gabung.catatan,
      });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /** Ringkasan berkas saja (kartu atas tanpa memuat seluruh daftar). */
  app.get('/api/berkas/ringkasan', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const { tenant, organizationId } = await konteksBerkas(req, session);
    if (!organizationId) return res.json({ ...berkasKosong(), terpetakan: false });
    try {
      const [mentah, dokumenBasis] = await Promise.all([
        klienKms().daftarBerkas(organizationId),
        ambilDokumenBasis(tenant),
      ]);
      const gabung = gabungDokumenBasis(tanpaDokumenSambutan(mentah), dokumenBasis);
      res.json({ ...hitungRingkasanBerkas(gabung.berkas), terpetakan: true });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /**
   * Unggah satu berkas ke project KMS instansi aktif.
   *
   * Berkas dikirim sebagai base64 di JSON (bukan multipart) supaya melewati
   * parser yang sudah ada; server yang menyusun multipart ke KMS. Jenis berkas
   * yang diterima dan batas ukuran divalidasi di sini SEBELUM dikirim.
   */
  app.post('/api/berkas/unggah', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    // Batas per akun: unggah memakan memori server + kuota penyimpanan KMS.
    const cekUnggah = pembatasUnggah.cek(`unggah:${session.userId}`);
    if (!cekUnggah.boleh) {
      res.setHeader('Retry-After', String(cekUnggah.tungguDetik));
      return res.status(429).json({
        error: 'Terlalu banyak unggahan dalam satu jam. Coba lagi nanti.',
        kode: 'TERLALU_BANYAK_PERCOBAAN',
      });
    }
    const { tenant, organizationId } = await konteksBerkas(req, session);
    // Cek pemetaan lebih dulu supaya balasannya berisi daftar project KMS, bukan
    // "metadata tidak sah" yang menyesatkan dari validasi metadata.
    if (!organizationId) return balasBelumTerpetakan(res);

    const nama = String(req.body?.nama || '').trim();
    const galatBerkas = validasiBerkas({ nama, ukuran: req.body?.ukuran, tipe: req.body?.tipe });
    if (galatBerkas) return res.status(400).json({ error: galatBerkas });

    // Metadata kini opsional: formulir unggah hanya meminta berkas. Judul jatuh
    // ke nama berkas, kategori jatuh ke "Dokumen Instansi".
    const judulBerkas = String(req.body?.judul || nama).trim();
    const kategoriBerkas = String(req.body?.kategori || 'Dokumen Instansi').trim();

    const galatMeta = validasiMetadata({
      judul: judulBerkas,
      kategori: kategoriBerkas,
      organizationId,
    });
    if (galatMeta) return res.status(400).json({ error: galatMeta });

    // Terima data URL ("data:application/pdf;base64,....") maupun base64 polos.
    const mentah = String(req.body?.isiBase64 || '');
    const base64 = mentah.includes(',') && mentah.trim().startsWith('data:') ? mentah.slice(mentah.indexOf(',') + 1) : mentah;
    if (!base64) return res.status(400).json({ error: 'Isi berkas kosong atau tidak terbaca.' });
    let isi: Buffer;
    try {
      isi = Buffer.from(base64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Isi berkas bukan base64 yang sah.' });
    }
    if (isi.length === 0) return res.status(400).json({ error: 'Isi berkas kosong.' });
    if (isi.length > BATAS_UKURAN_BYTE) {
      return res.status(400).json({ error: `Berkas ${(isi.length / 1024 / 1024).toFixed(1)} MB melebihi batas 50 MB.` });
    }

    try {
      const berkas = await klienKms().unggahBerkas({
        isi,
        namaBerkas: nama,
        judul: judulBerkas,
        kategori: kategoriBerkas,
        organizationId,
        tipeRepositori: req.body?.tipeRepositori === 'photo' ? 'photo' : 'document',
        tahun: req.body?.tahun !== undefined && req.body?.tahun !== '' ? Number(req.body.tahun) : undefined,
        departemen: req.body?.departemen ? String(req.body.departemen).trim() : undefined,
        catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
        mimeType: req.body?.tipe ? String(req.body.tipe) : undefined,
      });
      const kbTujuan = (await daftarProjectKms().catch(() => [])).find((o) => o.id === organizationId)?.knowledgeBase;
      // Dokumen baru masuk ke basis pengetahuan → pratinjau template instansi ini
      // tidak lagi mewakili isi dokumen. Tandai basi dan siapkan ulang di latar
      // belakang, supaya angka template ikut dokumen terbaru tanpa menunggu klik.
      // Berkas yang baru masuk itu sendiri ikut dianalisis di antrean otomatis.
      if (tenant?.id) {
        basiikanTenant(tenant.id);
        basiikanWilayah(tenant.id);
        // Foto tidak punya angka untuk dibaca: analisis hanya untuk dokumen.
        const foto = req.body?.tipeRepositori === 'photo';
        segarkanSetelahDokumen(
          tenant.id,
          foto
            ? undefined
            : {
                berkasId: String((berkas as any)?.id || ''),
                judulBerkas: String(req.body?.judul || nama).trim(),
              }
        );
      }

      res.status(201).json({ success: true, berkas, knowledgeBase: kbTujuan || null });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /** Hapus berkas dari KMS (sekaligus CDN & RAG) — hanya admin. */
  app.delete('/api/berkas/:id', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus berkas dari repositori.')) return;
    const { tenant, organizationId } = await konteksBerkas(req, session);
    if (!organizationId) {
      return balasBelumTerpetakan(res);
    }
    if (String(req.params.id).startsWith('basis:')) {
      // ponytail: dokumen basis belum punya salinan berkas di repositori.
      return res.status(400).json({
        error: 'Berkas ini baru ada di basis dokumen instansi, belum ada di repositori — tidak bisa dihapus dari sini.',
      });
    }
    try {
      await klienKms().hapusBerkas(req.params.id);
      // Dokumen hilang = angka template bisa berubah. Sama seperti unggah: tandai
      // basi dan siapkan ulang di latar belakang.
      if (tenant?.id) {
        basiikanTenant(tenant.id);
        basiikanWilayah(tenant.id);
        segarkanSetelahDokumen(tenant.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /**
   * Teruskan isi berkas dari KMS ke browser (pratinjau inline / unduhan).
   *
   * Diteruskan lewat server supaya API key KMS tidak pernah sampai ke browser.
   * Kedua rute ini WAJIB ada sebelum catch-all SPA di bawah.
   */
  async function teruskanBerkas(req: Request, res: Response, mode: 'view' | 'download') {
    const session = requireAuth(req, res);
    if (!session) return;
    const { organizationId } = await konteksBerkas(req, session);
    if (!organizationId) {
      return balasBelumTerpetakan(res);
    }
    try {
      const { isi, contentType, namaBerkas } = await klienKms().ambilIsiBerkas(req.params.id, mode);
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `${mode === 'download' ? 'attachment' : 'inline'}; filename="${namaBerkas || req.params.id}"`
      );
      res.setHeader('Content-Length', String(isi.length));
      res.send(isi);
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  }

  /**
   * Pratinjau dokumen yang hanya ada di basis dokumen instansi (belum ada
   * berkasnya di repositori). RAG menyimpan potongan teks, bukan berkas asli —
   * jadi yang ditampilkan adalah isi teks yang sudah terindeks, diambil lewat
   * /search lalu diurutkan menurut nomor potongan.
   */
  /** Jumlah potongan per halaman pada pratinjau dokumen basis. */
  const PER_HALAMAN_PRATINJAU = 20;

  /** Normalkan judul berkas untuk pencocokan antar-repositori (tanpa ekstensi). */
  function normalJudul(teks: string): string {
    return String(teks || '')
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Cari berkas asli dokumen basis di repositori instansi.
   *
   * Dokumen lama di basis dokumen sering tidak menyimpan `source_url`, sehingga
   * tombol "lihat dokumen asli" tidak punya tujuan. Selama berkasnya ada di
   * repositori (judul sama), tampilkan berkas aslinya — bukan teks hasil
   * ekstraksi yang bisa terpotong.
   */
  async function cariBerkasAsliDiRepositori(
    organizationId: string | null | undefined,
    nama: string
  ): Promise<string | null> {
    if (!organizationId) return null;
    const target = normalJudul(nama);
    if (!target) return null;
    try {
      const daftar = await klienKms().daftarBerkas(organizationId);
      const cocokPersis = daftar.find((b) => normalJudul(b.title) === target);
      if (cocokPersis) return cocokPersis.id;
      const cocokSebagian = daftar.find((b) => {
        const t = normalJudul(b.title);
        return t.length >= 6 && (t.includes(target) || target.includes(t));
      });
      return cocokSebagian?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Pratinjau dokumen yang hanya ada di basis dokumen instansi (belum ada
   * berkasnya di repositori). RAG menyimpan potongan teks, bukan berkas asli —
   * jadi yang ditampilkan adalah isi teks yang sudah terindeks.
   *
   * Dulu hanya dua kueri dengan `top_k: 50` dan seluruh potongan ditumpuk dalam
   * satu halaman. Dua masalah: (1) retrieval mengembalikan potongan paling
   * mirip, bukan seluruh isi dokumen, sehingga dokumen besar tampil terpotong;
   * (2) halaman menjadi sangat panjang dan berat. Sekarang potongan dikumpulkan
   * dari beberapa kueri penjelajah (lihat `potonganDokumen.ts`), di-dedupe,
   * diurutkan menurut nomor potongan, dan ditampilkan per halaman.
   */
  async function pratinjauBasis(req: Request, res: Response) {
    const session = requireAuth(req, res);
    if (!session) return;
    const { tenant, organizationId } = await konteksBerkas(req, session);
    const kb = String(tenant?.knowledgeBaseId || '').trim();
    const docId = String(req.params.id).replace(/^basis:/, '');
    if (!kb) return res.status(400).send('Instansi ini belum punya basis dokumen.');

    const cfg: any = db.systemConfig || {};
    const base = String(cfg.ragApiUrl || '').replace(/\/+$/, '');
    const kunci = dekripsiNilai(cfg.ragApiKey);
    const daftar = await ragClient.daftarDokumen(kb).catch(() => null);
    const dok = daftar?.dokumen.find((d) => d.id === docId);
    const nama = dok?.nama || docId;

    const kumpulan = await kumpulkanPotongan({
      kb,
      docId,
      nama,
      jumlahKatalog: dok?.potongan,
      panggil: async (kueri, topK) => {
        const r = await fetch(`${base}/search`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge_base_id: kb, query: kueri, top_k: topK }),
          signal: AbortSignal.timeout(60000),
        });
        return r.json().catch(() => null);
      },
    });

    // 1) Layanan basis menyediakan tautan berkas asli → pakai itu.
    if (kumpulan.sumberAsli) return res.redirect(kumpulan.sumberAsli);

    // 2) Berkas aslinya ada di repositori instansi → tampilkan berkas asli.
    const kmsId = await cariBerkasAsliDiRepositori(organizationId, nama);
    if (kmsId) {
      const tenantQ = typeof req.query.tenantId === 'string' ? `?tenantId=${encodeURIComponent(req.query.tenantId)}` : '';
      return res.redirect(`/api/berkas/${encodeURIComponent(kmsId)}/lihat${tenantQ}`);
    }

    const diminta = Number(req.query.hlm) || 1;
    const halaman = ambilHalaman(kumpulan.potongan, diminta, PER_HALAMAN_PRATINJAU);
    const esc = (x: string) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tenantQ = typeof req.query.tenantId === 'string' ? `&tenantId=${encodeURIComponent(req.query.tenantId)}` : '';
    const tautanHalaman = (n: number) => `?hlm=${n}${tenantQ}`;

    const isiHalaman = halaman.isi
      .map((p) => {
        const label = [p.halaman ? `hlm. ${p.halaman}` : '', p.bagian || ''].filter(Boolean).join(' · ');
        return `<section><div class="meta">${esc(label || 'potongan')}</div><pre>${esc(p.isi.trim())}</pre></section>`;
      })
      .join('\n');

    const navigasi =
      halaman.totalHalaman > 1
        ? `<nav>${halaman.halaman > 1 ? `<a href="${tautanHalaman(halaman.halaman - 1)}">← Sebelumnya</a>` : '<span></span>'}
<strong>Halaman ${halaman.halaman} dari ${halaman.totalHalaman}</strong>
${halaman.halaman < halaman.totalHalaman ? `<a href="${tautanHalaman(halaman.halaman + 1)}">Berikutnya →</a>` : '<span></span>'}</nav>`
        : '';

    const catatanSebagian = kumpulan.sebagian
      ? `<div class="note">Pratinjau memuat <b>${kumpulan.potongan.length} dari ${kumpulan.jumlahKatalog}</b> potongan yang terindeks. ` +
        `Layanan basis dokumen hanya mengembalikan potongan yang cocok dengan kueri pencarian, jadi sebagian isi dokumen belum bisa ditampilkan di sini. ` +
        `Berkas aslinya belum ada di repositori instansi.</div>`
      : '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(nama)}</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;max-width:860px;margin:32px auto;padding:0 20px;color:#111;line-height:1.6}
h1{font-size:18px;margin:0 0 4px}small{color:#666}pre{white-space:pre-wrap;font-family:inherit;font-size:13px;background:#f7f7f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin:4px 0 16px}
.meta{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-top:12px}
.note{background:#fff8e1;border:1px solid #f0d68a;border-radius:8px;padding:10px 12px;font-size:12px;margin:12px 0}
nav{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #eee;padding-top:12px;margin-top:20px;font-size:13px}
nav a{color:#0b62c4;text-decoration:none}nav a:hover{text-decoration:underline}</style></head>
<body><h1>${esc(nama)}</h1>
<small>${dok?.halaman ? `${dok.halaman} halaman · ` : ''}${kumpulan.potongan.length}${kumpulan.jumlahKatalog ? `/${kumpulan.jumlahKatalog}` : ''} potongan teks · basis dokumen instansi</small>
${catatanSebagian}
${isiHalaman || '<div class="note">Isi teks dokumen ini belum bisa diambil dari basis dokumen.</div>'}
${navigasi}
</body></html>`);
  }

  app.get('/api/berkas/:id/lihat', (req: Request, res: Response) => {
    if (String(req.params.id).startsWith('basis:')) return void pratinjauBasis(req, res);
    return void teruskanBerkas(req, res, 'view');
  });
  app.get('/api/berkas/:id/unduh', (req: Request, res: Response) => void teruskanBerkas(req, res, 'download'));

  /**
   * Hubungkan instansi ke project KMS (khusus admin). Bila belum ada project
   * yang cocok dengan KB instansi, buat project baru di KMS — KMS otomatis
   * membuat knowledge base RAG-nya, jadi berkas yang diunggah langsung terindeks.
   */
  app.post('/api/admin/tenants/:id/kms-hubungkan', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!isAdminRole(session.role)) {
      return res.status(403).json({ error: 'Hanya administrator yang boleh menghubungkan instansi ke KMS.' });
    }
    const tenant = db.tenants.find((t) => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });
    try {
      const ada = await projectKmsEfektif(tenant);
      let org: OrganisasiKMS | null = null;
      let dibuat = false;
      if (ada.organizationId) {
        org = (await daftarProjectKms()).find((o) => o.id === ada.organizationId) || { id: ada.organizationId, name: ada.projectKms || tenant.name };
      } else {
        // Ragkms mewajibkan `type` (bukan hanya `industry`), dan kode proyek harus
        // unik — kalau bentrok (dua instansi ber-KB sama) pakai akhiran id instansi.
        const kodeDasar = tenant.code || tenant.id;
        const keterangan = `Repositori berkas ${tenant.name}${tenant.city ? ` (${tenant.city})` : ''} — dibuat dari ApexPulse.`;
        const buat = (kode: string) =>
          klienKms().buatOrganisasi({
            name: tenant.name,
            code: kode,
            type: tenant.sector || 'BUMD',
            industry: tenant.sector,
            description: keterangan,
          });
        try {
          org = await buat(kodeDasar);
        } catch (errBuat: any) {
          const pesan = String(errBuat?.detail || errBuat?.message || '');
          if (errBuat?.status === 400 && /sudah digunakan/i.test(pesan)) {
            org = await buat(`${kodeDasar}-${tenant.id.slice(-6)}`);
          } else {
            throw errBuat;
          }
        }
        if (!org) return res.status(502).json({ error: 'KMS tidak mengembalikan project yang dibuat.' });
        dibuat = true;
        cacheOrgKms = null;
      }
      // ponytail: basis dokumen instansi adalah sumber kebenaran — dokumen lama
      // instansi sudah ada di sana dan dibaca asisten. Jadi project yang
      // diarahkan ke basis instansi, BUKAN sebaliknya (kalau dibalik, dokumen
      // lama instansi langsung tak terbaca asisten).
      const basisInstansi = String(tenant.knowledgeBaseId || '').trim();
      let basisDiselaraskan = false;
      if (basisInstansi && org.knowledgeBase && org.knowledgeBase !== basisInstansi) {
        await klienKms().perbaruiOrganisasi(org.id, { knowledgeBase: basisInstansi });
        basisDiselaraskan = true;
        cacheOrgKms = null;
      }
      const basisBaru = basisInstansi || org.knowledgeBase || null;
      await db.updateTenant(tenant.id, {
        kmsOrganizationId: org.id,
        // Basis instansi hanya diisi kalau memang belum punya sama sekali.
        ...(basisBaru && basisBaru !== tenant.knowledgeBaseId ? { knowledgeBaseId: basisBaru } : {}),
      });
      res.json({ ok: true, dibuat, basisDokumen: basisBaru, basisDiselaraskan, organisasi: org });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /** Daftar project KMS — untuk pemetaan instansi di panel admin (khusus admin). */
  app.get('/api/admin/kms-organisasi', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    try {
      const organisasi = await klienKms().daftarOrganisasi();
      res.json({ organisasi, baseUrl: (db.systemConfig as any).kmsApiUrl || '' });
    } catch (err: any) {
      balasGalatKms(res, err);
    }
  });

  /** Uji koneksi KMS dengan konfigurasi yang TERSIMPAN (khusus admin). */
  app.post('/api/admin/kms-uji', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const hasil = await klienKms().uji();
    res.status(hasil.ok ? 200 : 502).json(hasil);
  });

  // ================= IMPORT EXCEL/CSV ROUTES =================
  /**
   * Unggah & pratinjau berkas Excel/CSV.
   *
   * Menerima base64 (JSON) supaya tidak butuh middleware multipart. Berkas
   * diurai di server, dikembalikan sebagai tabel ringkas untuk dipetakan UI.
   * Angka yang tidak bisa dibaca dengan pasti TIDAK ditebak (lihat `keAngka`).
   */
  app.post('/api/impor/pratinjau', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const isiB64 = typeof req.body?.isi === 'string' ? req.body.isi : '';
    if (!isiB64) return res.status(400).json({ error: 'Berkas belum dikirim.' });
    // Buang prefiks data-URL bila ada (mis. "data:...;base64,").
    const bersih = isiB64.includes(',') && /^data:/.test(isiB64) ? isiB64.split(',').pop()! : isiB64;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(bersih, 'base64');
    } catch {
      return res.status(400).json({ error: 'Isi berkas tidak valid (base64 rusak).' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'Berkas kosong.' });
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Berkas terlalu besar (maksimum 25 MB).' });
    }
    try {
      const tabel = bacaTabel(buffer, typeof req.body?.sheet === 'string' ? req.body.sheet : undefined);
      return res.json(ringkasPratinjau(tabel));
    } catch (err) {
      return res.status(400).json({ error: jelaskanError(err) });
    }
  });

  /**
   * Bangun widget dari berkas + konfigurasi pemetaan (TANPA menyimpan).
   *
   * Memakai alur yang sama dengan kanvas: klien mengirim konfigurasi, server
   * mengembalikan `WidgetSpec` yang SUDAH divalidasi skema. Penyimpanan ke
   * dashboard dilakukan lewat PATCH dashboard yang sudah ada, sehingga impor
   * tidak menambah jalur tulis baru.
   */
  app.post('/api/impor/widget', async (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const isiB64 = typeof req.body?.isi === 'string' ? req.body.isi : '';
    if (!isiB64) return res.status(400).json({ error: 'Berkas belum dikirim.' });
    const bersih = isiB64.includes(',') && /^data:/.test(isiB64) ? isiB64.split(',').pop()! : isiB64;

    const konfig = req.body?.konfig as KonfigImpor | undefined;
    if (!konfig || typeof konfig !== 'object') {
      return res.status(400).json({ error: 'Konfigurasi pemetaan wajib diisi.' });
    }
    if (!konfig.tipe) return res.status(400).json({ error: 'Tipe visualisasi wajib dipilih.' });
    if (!Array.isArray(konfig.kolomNilai) || konfig.kolomNilai.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu kolom nilai.' });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(bersih, 'base64');
    } catch {
      return res.status(400).json({ error: 'Isi berkas tidak valid (base64 rusak).' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'Berkas kosong.' });
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Berkas terlalu besar (maksimum 25 MB).' });
    }

    try {
      const tabel = bacaTabel(
        buffer,
        typeof req.body?.sheet === 'string' ? req.body.sheet : undefined
      );
      const idWidget = `w-impor-${randomBytes(6).toString('hex')}`;
      const grid: WidgetGrid = { x: 0, y: 0, w: 6, h: 4 };
      const { widget, peringatan } = bangunWidgetImpor(tabel, konfig, idWidget, grid);
      // Validasi bentuk widget dengan skema yang sama seperti kanvas — supaya
      // impor tak bisa menyimpan data rusak yang nanti gagal dirender.
      const sah = WidgetSpecSchema.safeParse(widget);
      if (!sah.success) {
        return res.status(400).json({
          error: 'Hasil pemetaan tidak lolos validasi widget.',
          detail: sah.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      /**
       * Berkas impor juga disimpan ke REPOSITORI DOKUMEN.
       *
       * Sebelumnya berkas hanya dibaca lalu dibuang, sehingga jejaknya tidak
       * pernah muncul di menu Repositori dan tidak ikut terindeks untuk asisten.
       * Sekarang berkas yang sama diunggah ke project KMS instansi. Kegagalan
       * penyimpanan TIDAK membatalkan widget: widget sudah jadi dan pengguna
       * diberi tahu lewat `peringatanBerkas`.
       */
      let berkasImpor: { id?: string; nama: string; ragStatus?: string } | null = null;
      let knowledgeBase: string | null = null;
      let peringatanBerkas: string | undefined;
      const namaBerkas = String(req.body?.nama || tabel.namaSheet || 'Data Impor').trim();
      try {
        const { tenant: tenantImpor, organizationId } = await konteksBerkas(req, session);
        if (!organizationId) {
          peringatanBerkas =
            'Berkas tidak tersimpan di Repositori Dokumen: instansi ini belum dipetakan ke project KMS (atur di panel admin, Instansi & KB).';
        } else {
          const kategoriBerkas = String(req.body?.kategoriBerkas || 'Data Impor Dashboard').trim().slice(0, 120);
          const galatMeta = validasiMetadata({ judul: namaBerkas, kategori: kategoriBerkas, organizationId });
          if (galatMeta) {
            peringatanBerkas = `Berkas tidak tersimpan di Repositori Dokumen: ${galatMeta}`;
          } else {
            const hasil = await klienKms().unggahBerkas({
              isi: buffer,
              namaBerkas,
              judul: namaBerkas,
              kategori: kategoriBerkas,
              organizationId,
              tipeRepositori: 'document',
              catatan: 'Diunggah otomatis dari Impor Data di kanvas dashboard.',
              mimeType: req.body?.tipe ? String(req.body.tipe) : undefined,
            });
            berkasImpor = { id: hasil?.id, nama: namaBerkas, ragStatus: hasil?.ragStatus };
            knowledgeBase =
              (await daftarProjectKms().catch(() => [])).find((o) => o.id === organizationId)?.knowledgeBase ?? null;
            if (tenantImpor?.id) {
              // Dokumen baru masuk basis pengetahuan → pratinjau template ikut disegarkan.
              basiikanTenant(tenantImpor.id);
              basiikanWilayah(tenantImpor.id);
              segarkanSetelahDokumen(tenantImpor.id, {
                berkasId: String(berkasImpor?.id || ''),
                judulBerkas: namaBerkas,
              });
            }
          }
        }
      } catch (err: any) {
        peringatanBerkas = `Widget dibuat, tetapi berkas gagal disimpan ke Repositori Dokumen: ${err?.message || 'layanan dokumen tidak merespons.'}`;
      }

      return res.json({
        widget: sah.data,
        peringatan,
        baris: tabel.baris.length,
        namaSheet: tabel.namaSheet,
        berkas: berkasImpor,
        knowledgeBase,
        peringatanBerkas,
      });
    } catch (err) {
      return res.status(400).json({ error: jelaskanError(err) });
    }
  });

  // ================= SHARE ROUTES =================
  /** Masa berlaku bawaan tautan bagikan: 30 hari. `expiresInDays: 0` = tanpa kedaluwarsa. */
  const HARI_KEDALUWARSA_TAUTAN = 30;
  const kedaluwarsaTautan = (meta: any): number | null => {
    const iso = typeof meta === 'object' && meta ? meta.expiresAt : null;
    if (!iso) return null;
    const t = Date.parse(String(iso));
    return Number.isFinite(t) ? t : null;
  };
  const tautanKedaluwarsa = (meta: any): boolean => {
    const batas = kedaluwarsaTautan(meta);
    return batas !== null && Date.now() > batas;
  };

  app.post('/api/dashboards/:id/share', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const dash = db.getDashboardById(req.params.id, effectiveTenantId(req, session));
    if (!dash) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    const token = `share_${randomBytes(12).toString('hex')}`;
    const mode = req.body?.mode === 'editable' ? 'editable' : 'readonly';
    // Tautan sekarang punya masa berlaku dan tercatat pembuatnya. Dulu tautan
    // berlaku selamanya dan tidak bisa dicabut — satu tautan bocor = akses permanen.
    const diminta = Number(req.body?.expiresInDays);
    const hari = Number.isFinite(diminta) && diminta >= 0 ? diminta : HARI_KEDALUWARSA_TAUTAN;
    const sekarang = new Date();
    const expiresAt = hari === 0 ? null : new Date(sekarang.getTime() + hari * 86_400_000).toISOString();
    db.shareTokens[token] = {
      dashboardId: req.params.id,
      mode,
      createdAt: sekarang.toISOString(),
      expiresAt,
      createdBy: session.name,
    } as any;
    // ponytail: satu tautan = satu baris (`baris`), bukan snapshot penuh.
    db.simpanTautanBagikan(token, db.shareTokens[token] as any);

    // Tautan mode edit WAJIB ber-PIN: tanpa ini, siapa pun yang memegang URL
    // bisa mengubah widget dashboard instansi. PIN hanya dikirim sekali di sini;
    // yang disimpan hanya hash-nya.
    let pin: string | null = null;
    if (mode === 'editable') {
      pin = String(randomInt(100000, 1000000));
      const hashPin = hashPassword(pin);
      db.sharePins[token] = hashPin;
      db.simpanPinBagikan(token, hashPin);
    }
    db.persist();
    res.json({ token, shareUrl: `/share/${token}`, mode, expiresAt, pin });
  });

  /** Daftar tautan aktif untuk satu dashboard (dipakai panel Bagikan untuk mencabut). */
  app.get('/api/dashboards/:id/shares', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const dash = db.getDashboardById(req.params.id, effectiveTenantId(req, session));
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    const daftar = Object.entries(db.shareTokens)
      .map(([token, meta]: [string, any]) => {
        const dashboardId = typeof meta === 'object' && meta ? meta.dashboardId : meta;
        if (dashboardId !== dash.id) return null;
        return {
          token,
          mode: (typeof meta === 'object' && meta && meta.mode) || 'readonly',
          createdAt: (typeof meta === 'object' && meta && meta.createdAt) || null,
          expiresAt: (typeof meta === 'object' && meta && meta.expiresAt) || null,
          createdBy: (typeof meta === 'object' && meta && meta.createdBy) || null,
          kedaluwarsa: tautanKedaluwarsa(meta),
        };
      })
      .filter(Boolean);
    res.json(daftar);
  });

  /** Cabut tautan bagikan: tautan langsung tidak bisa dipakai lagi (410). */
  app.delete('/api/share/:token', (req: Request, res: Response) => {
    const session = butuhPenulis(req, res);
    if (!session) return;
    const token = req.params.token;
    const meta: any = db.shareTokens[token];
    if (!meta) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
    const dashboardId = typeof meta === 'object' ? meta.dashboardId : meta;
    const dash = db.dashboards.find((d) => d.id === dashboardId);
    if (!dash || dash.tenantId !== effectiveTenantId(req, session)) {
      return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
    }
    delete db.shareTokens[token];
    db.hapusTautanBagikan(token);
    db.persist();
    res.json({ ok: true, token });
  });

  /**
   * Verifikasi PIN tautan edit tanpa mengubah apa pun. Dipakai halaman tautan
   * publik untuk membuka mode edit sebelum pengguna mulai menggeser widget.
   */
  app.post('/api/share/:token/verifikasi-pin', async (req: Request, res: Response) => {
    const token = req.params.token;
    const shareMeta = db.shareTokens[token] as any;
    if (!shareMeta) return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan.' });
    if (tautanKedaluwarsa(shareMeta)) {
      return res.status(410).json({ error: 'Tautan berbagi sudah kedaluwarsa.' });
    }
    const hashPin = db.sharePins[token];
    if (!hashPin) {
      return res.status(400).json({
        error: 'Tautan ini tidak memakai PIN. Minta pembuat dashboard membuat tautan edit baru.',
        kode: 'PIN_BELUM_DIATUR',
      });
    }
    const kunciPin = `pin:${token}:${req.ip || '-'}`;
    const izin = await pembatasPinLintas.cekLintas(kunciPin);
    if (!izin.boleh) {
      res.setHeader('Retry-After', String(izin.tungguDetik));
      return res.status(429).json({
        error: `Terlalu banyak percobaan PIN. Coba lagi dalam ${Math.ceil(izin.tungguDetik / 60)} menit.`,
        kode: 'TERLALU_BANYAK_PERCOBAAN',
      });
    }
    if (!verifyPassword(String(req.body?.pin || ''), hashPin)) {
      await pembatasPinLintas.gagalLintas(kunciPin);
      return res.status(401).json({ error: 'PIN salah.', kode: 'PIN_SALAH' });
    }
    await pembatasPinLintas.bersihkanLintas(kunciPin);
    res.json({ ok: true });
  });

  app.get('/api/share/:token', (req: Request, res: Response) => {
    const shareMeta = db.shareTokens[req.params.token] as any;
    const dashId = typeof shareMeta === 'object' && shareMeta ? shareMeta.dashboardId : shareMeta;
    const mode = typeof shareMeta === 'object' && shareMeta ? shareMeta.mode : 'readonly';

    if (!dashId) {
      return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan atau telah dicabut.' });
    }
    if (tautanKedaluwarsa(shareMeta)) {
      return res.status(410).json({ error: 'Tautan berbagi sudah kedaluwarsa. Minta pembuat dashboard membuat tautan baru.' });
    }
    const dash = db.dashboards.find((d) => d.id === dashId);
    if (!dash) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    // Sertakan data instansi pemilik dashboard LANGSUNG di respons share.
    // Halaman tautan publik tidak boleh membaca /api/tenants (daftar instansi
    // kini wajib login), jadi cukup instansi yang relevan saja — bukan daftarnya.
    const tenant = db.tenants.find((t) => t.id === dash.tenantId) || null;
    res.json({ ...dash, accessMode: mode, tenant });
  });

  /**
   * Edit widget lewat tautan publik (apabila mode 'editable').
   */
  app.patch('/api/share/:token', async (req: Request, res: Response) => {
    const token = req.params.token;
    const shareMeta = db.shareTokens[token] as any;
    const dashId = typeof shareMeta === 'object' && shareMeta ? shareMeta.dashboardId : shareMeta;
    const mode = typeof shareMeta === 'object' && shareMeta ? shareMeta.mode : 'readonly';

    if (!dashId) {
      return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan.' });
    }
    if (tautanKedaluwarsa(shareMeta)) {
      return res.status(410).json({ error: 'Tautan berbagi sudah kedaluwarsa.' });
    }
    // PIN wajib untuk mengubah: tautan bocor saja tidak cukup untuk mengedit.
    const pinDikirim = String(req.headers['x-share-pin'] || req.body?.pin || '');
    const hashPin = db.sharePins[token];
    if (!hashPin) {
      return res.status(401).json({
        error: 'Tautan ini dibuat sebelum PIN diwajibkan. Minta pembuat dashboard membuat tautan edit baru.',
        kode: 'PIN_BELUM_DIATUR',
      });
    }
    const kunciPin = `pin:${token}:${req.ip || '-'}`;
    const izin = await pembatasPinLintas.cekLintas(kunciPin);
    if (!izin.boleh) {
      res.setHeader('Retry-After', String(izin.tungguDetik));
      return res.status(429).json({
        error: `Terlalu banyak percobaan PIN. Coba lagi dalam ${Math.ceil(izin.tungguDetik / 60)} menit.`,
        kode: 'TERLALU_BANYAK_PERCOBAAN',
      });
    }
    if (!pinDikirim || !verifyPassword(pinDikirim, hashPin)) {
      await pembatasPinLintas.gagalLintas(kunciPin);
      return res.status(401).json({ error: 'PIN tautan salah atau belum diisi.', kode: 'PIN_SALAH' });
    }
    await pembatasPinLintas.bersihkanLintas(kunciPin);
    if (mode !== 'editable') {
      return res.status(403).json({ error: 'Tautan ini bersifat Read-Only dan tidak dapat diedit.' });
    }
    // Hanya `widgets` yang boleh diubah lewat tautan publik. Field lain (mis. `title`)
    // dulu diabaikan diam-diam sehingga klien mengira perubahannya tersimpan.
    // `title` ikut didukung: kanvas tautan mode edit punya judul dashboard yang bisa
    // diubah. Dulu field ini ditolak/diabaikan, sehingga perubahan judul tidak tersimpan.
    const fieldDidukung = ['widgets', 'title'];
    const fieldAsing = Object.keys(req.body || {}).filter((k) => !fieldDidukung.includes(k));
    if (fieldAsing.length > 0) {
      return res.status(400).json({
        error: `Field tidak didukung pada tautan publik: ${fieldAsing.join(', ')}. Yang bisa diubah: ${fieldDidukung.join(', ')}.`,
        fieldDidukung,
      });
    }

    const dash = db.dashboards.find((d) => d.id === dashId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });

    const widgets = req.body?.widgets as WidgetSpec[] | undefined;
    const judulBaru = req.body?.title;
    if (widgets === undefined && judulBaru === undefined) {
      return res.status(400).json({ error: 'Kirim minimal satu field: "widgets" atau "title".' });
    }
    if (judulBaru !== undefined && (typeof judulBaru !== 'string' || judulBaru.trim().length === 0)) {
      return res.status(400).json({ error: 'Field "title" wajib berupa teks yang tidak kosong.' });
    }
    let sah: WidgetSpec[] = dash.widgets;
    if (widgets !== undefined) {
      if (!Array.isArray(widgets)) {
        return res.status(400).json({ error: 'Field "widgets" wajib berupa array.' });
      }
      // Paritas penuh dengan kanvas pembuat: urutkan, ubah lebar, edit, gandakan,
      // tambah, dan hapus. Bentuk tiap widget tetap divalidasi (tidak sekadar
      // dipercaya) supaya tautan publik tak bisa menyimpan data rusak.
      const kandidat = widgets.filter(
        (w) => w && typeof w.id === 'string' && WidgetSpecSchema.safeParse(w).success
      );
      if (kandidat.length === 0 && widgets.length > 0) {
        return res.status(400).json({ error: 'Tidak ada widget valid untuk diperbarui.' });
      }
      sah = kandidat;
    }

    const updated = db.updateDashboard(
      dashId,
      { widgets: sah, ...(judulBaru !== undefined ? { title: judulBaru.trim() } : {}) },
      dash.tenantId
    );
    if (!updated) return res.status(500).json({ error: 'Gagal menyimpan perubahan.' });
    db.persist();

    res.json(updated);
  });

  // ================= ADMIN MANAGEMENT ROUTES =================
  app.get('/api/admin/stats', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    // Angka panel mengikuti cakupan peran: Admin Aiones melihat seluruh platform,
    // Admin Instansi hanya instansinya sendiri (dulu ia melihat 6 instansi & 33
    // akun — angka platform yang bukan miliknya).
    const lintas = bolehPindahInstansi(session.role);
    const dashboards = lintas ? db.dashboards : db.dashboards.filter((d) => d.tenantId === session.tenantId);
    const users = lintas ? db.users : db.users.filter((u) => u.tenantId === session.tenantId);
    const totalWidgets = dashboards.reduce((acc, d) => acc + semuaWidget(d).length, 0);
    const totalCitations = dashboards.reduce(
      (acc, d) => acc + semuaWidget(d).reduce((wAcc, w) => wAcc + (w.citations?.length || 0), 0),
      0
    );
    res.json({
      tenantsCount: lintas ? db.tenants.length : 1,
      usersCount: users.length,
      dashboardsCount: dashboards.length,
      totalWidgets,
      totalCitations,
      ragProvider: db.systemConfig.ragProvider,
    });
  });

  /* ================= PANEL ADMIN AIONES (Fase 4) ================= */

  /** Ringkasan lintas instansi — hanya Admin Aiones. */
  app.get('/api/admin/platform', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!isSuperadmin(session.role)) {
      return res.status(403).json({ error: 'Ringkasan platform hanya untuk Admin Aiones.' });
    }
    const ringkasan = ringkasPlatform({
      tenants: db.tenants,
      users: db.users,
      dashboards: db.dashboards,
      permintaan: db.permintaanData,
      analisis: db.analisisDokumen,
      butir: db.butirData,
      kuota: (db.systemConfig as any).kuotaAnalisisHarian ?? undefined,
    });
    res.json(ringkasan);
  });

  /** Pemakaian kuota AI per instansi hari ini. */
  app.get('/api/admin/kuota', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!isSuperadmin(session.role)) {
      return res.status(403).json({ error: 'Kuota AI lintas instansi hanya untuk Admin Aiones.' });
    }
    const kuota = (db.systemConfig as any).kuotaAnalisisHarian ?? undefined;
    res.json({
      kuota: kuota ?? KUOTA_ANALISIS_BAWAAN,
      perInstansi: kuotaPerInstansi({
        tenants: db.tenants,
        users: db.users,
        dashboards: db.dashboards,
        permintaan: db.permintaanData,
        analisis: db.analisisDokumen,
        butir: db.butirData,
        kuota,
      }),
    });
  });

  /** Ubah kuota analisis harian per instansi. */
  app.patch('/api/admin/kuota', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!isSuperadmin(session.role)) {
      return res.status(403).json({ error: 'Kuota AI hanya bisa diatur Admin Aiones.' });
    }
    const nilai = Number(req.body?.kuotaAnalisisHarian);
    if (!Number.isFinite(nilai) || nilai < 0 || nilai > 1000) {
      return res.status(400).json({ error: 'Kuota harus angka 0 sampai 1000 per instansi per hari.' });
    }
    db.updateSystemConfig({ kuotaAnalisisHarian: Math.floor(nilai) });
    const disimpan = db.systemConfig;
    res.json({ kuotaAnalisisHarian: (disimpan as any).kuotaAnalisisHarian });
  });

  app.get('/api/admin/users', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    // Admin Instansi hanya melihat akun instansinya sendiri. Dulu seluruh akun
    // (termasuk Admin Aiones dan 20+ akun BUMD lain) ikut terkirim ke panelnya.
    if (!bolehPindahInstansi(session.role)) {
      return res.json(db.users.filter((u) => u.tenantId === session.tenantId));
    }
    res.json(db.users);
  });

  // ================= PERMINTAAN BERGABUNG (PERSETUJUAN ADMIN) =================
  // Pendaftaran mandiri (email + kata sandi MAUPUN Google) tidak langsung memberi
  // akses. Admin instansi melihat daftar permintaan di sini, lalu menyetujui atau
  // menolak. Sesi hanya terbit untuk akun berstatus `active`.
  app.get('/api/admin/join-requests', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    // Lintas instansi hanya untuk Admin Aiones. Admin Instansi selalu melihat
    // permintaan pending instansinya sendiri, apa pun `?tenantId=` yang dikirim.
    const filterTenant = bolehPindahInstansi(session.role)
      ? String(req.query.tenantId || '').trim()
      : session.tenantId;
    const daftar = db.users
      .filter((u) => (u.status || 'active') === 'pending' && (!filterTenant || u.tenantId === filterTenant))
      .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        tenantId: u.tenantId,
        tenantName: db.tenants.find((t) => t.id === u.tenantId)?.name || null,
        viaGoogle: !!u.viaGoogle,
        emailVerified: !!u.emailVerified,
        requestedAt: u.requestedAt || null,
      }));
    res.json(daftar);
  });

  app.post('/api/admin/join-requests/:id/approve', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh menyetujui pendaftaran.')) return;
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    if ((user.status || 'active') !== 'pending') {
      return res.status(409).json({ error: 'Akun ini bukan permintaan yang menunggu persetujuan.' });
    }
    const ROLE_SAH: UserRole[] = ['admin', 'pengguna'];
    const roleDiminta = req.body?.role;
    if (roleDiminta !== undefined && !ROLE_SAH.includes(roleDiminta)) {
      return res.status(400).json({ error: `Peran "${roleDiminta}" tidak dikenal.`, roleSah: ROLE_SAH });
    }
    // Admin Instansi hanya mengelola instansinya sendiri: `tenantId` dari klien
    // diabaikan untuknya, supaya ia tidak bisa menyetujui akun ke BUMD lain.
    const tenantTujuan = bolehPindahInstansi(session.role)
      ? String(req.body?.tenantId || '').trim() || user.requestedTenantId || user.tenantId
      : session.tenantId;
    if (!db.tenants.some((t) => t.id === tenantTujuan)) {
      return res.status(400).json({ error: 'Instansi tujuan tidak dikenal.' });
    }
    const updated = db.updateUser(user.id, {
      status: 'active',
      tenantId: tenantTujuan,
      requestedTenantId: undefined,
      role: (roleDiminta as UserRole) || user.role,
    } as any);
    if (!updated) return res.status(500).json({ error: 'Gagal menyetujui permintaan.' });
    res.json({ ok: true, user: safeUser(updated) });
  });

  app.post('/api/admin/join-requests/:id/reject', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh menolak pendaftaran.')) return;
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
    if ((user.status || 'active') !== 'pending') {
      return res.status(409).json({ error: 'Akun ini bukan permintaan yang menunggu persetujuan.' });
    }
    const updated = db.updateUser(user.id, { status: 'rejected' } as any);
    if (!updated) return res.status(500).json({ error: 'Gagal menolak permintaan.' });
    res.json({ ok: true, id: updated.id });
  });

  app.post('/api/admin/users', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    const email = (req.body.email || `user${Date.now()}@bumd.id`).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Email sudah terdaftar di sistem.' });
    }
    const ROLE_SAH: UserRole[] = ['admin', 'pengguna'];
    if (req.body.role !== undefined && !ROLE_SAH.includes(req.body.role)) {
      return res.status(400).json({ error: `Peran "${req.body.role}" tidak dikenal.`, roleSah: ROLE_SAH });
    }
    const newUser: SafeUser = {
      id: `user-${Date.now()}`,
      email,
      name: req.body.name || 'Pengguna BUMD',
      role: req.body.role || 'pengguna',
      // Admin Instansi selalu membuat akun di instansinya sendiri.
      tenantId: bolehPindahInstansi(session.role)
        ? req.body.tenantId || 'tenant-pdam'
        : session.tenantId,
      avatar: req.body.role === 'admin' ? '👨‍💼' : '👩‍💼',
    };
    // Sandi awal = kata sandi sementara acak per akun (bukan sandi bersama yang
    // tertulis di dokumentasi). Admin menyalinnya sekali dari respons ini;
    // pengguna tidak lagi dipaksa menggantinya saat login pertama.
    const sandiAwal = kataSandiSementara();
    db.createUser({ ...newUser, mustChangePassword: false }, hashPassword(sandiAwal));
    // Kata sandi sementara hanya muncul SEKALI di sini; tidak disimpan dalam bentuk terbaca.
    res.status(201).json({ ...(safeUser(newUser) as any), sandiSementara: sandiAwal });
  });

  /**
   * Reset kata sandi oleh admin (pengganti alur "lupa kata sandi" tanpa email):
   * server membuat sandi sementara baru, mengembalikannya sekali, dan akun
   * dipaksa menggantinya saat login. Tidak ada sandi bersama yang bisa ditebak.
   */
  app.post('/api/admin/users/:id/reset-password', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mereset kata sandi.')) return;
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const sandiBaru = kataSandiSementara();
    db.setUserPassword(target.id, hashPassword(sandiBaru), true);
    res.json({ ok: true, sandiSementara: sandiBaru, email: target.email });
  });

  app.patch('/api/admin/users/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    // Admin Instansi hanya mengelola akun instansinya sendiri. Tanpa penjagaan
    // ini, ia bisa memindahkan akun ke BUMD lain (atau menyunting akun instansi
    // lain) hanya dengan mengirim `tenantId` di body.
    const targetUser = db.users.find((u) => u.id === req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    if (!bolehPindahInstansi(session.role)) {
      if (targetUser.tenantId !== session.tenantId) {
        return res.status(403).json({ error: 'Akun ini milik instansi lain.' });
      }
      delete (req.body as any).tenantId;
    }
    // Penjagaan akun Admin Aiones terakhir: tanpa ini, satu klik bisa membuat
    // platform tidak punya pengelola sama sekali.
    if (req.body?.role !== undefined && req.body.role !== 'superadmin') {
      const cek = bolehTurunkanSuperadmin(db.users, req.params.id);
      if (!cek.boleh) return res.status(409).json({ error: cek.alasan, kode: 'SUPERADMIN_TERAKHIR' });
    }
    const updated = db.updateUser(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    res.json(safeUser(updated));
  });

  app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    if (req.params.id === session.userId) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
    }
    const cekHapus = bolehTurunkanSuperadmin(db.users, req.params.id);
    if (!cekHapus.boleh) return res.status(409).json({ error: cekHapus.alasan, kode: 'SUPERADMIN_TERAKHIR' });
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    if (!bolehPindahInstansi(session.role) && target.tenantId !== session.tenantId) {
      return res.status(403).json({ error: 'Akun ini milik instansi lain.' });
    }
    const success = db.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    res.json({ success: true });
  });

  app.post('/api/admin/tenants', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const newTenant = {
      id: `tenant-${Date.now()}`,
      name: req.body.name || 'BUMD Baru',
      shortName: req.body.shortName || 'BUMD',
      sector: req.body.sector || 'aneka_usaha',
      code: req.body.code || `BUMD-${Date.now().toString().slice(-3)}`,
      city: req.body.city || 'Kota Daerah',
      logo: req.body.logo || '🏢',
      primaryColor: req.body.primaryColor || '#0284c7',
      // Jumlah dokumen diisi dari KB nyata di bawah (sinkron). Jangan pakai angka
      // karangan: kalau KB belum ada / gagal dibaca, biarkan 0 dan beri tahu jujur.
      documentCount: Number(req.body.documentCount) || 0,
      // KB milik instansi di layanan RAG — tanpa ini permintaan instansi jatuh
      // ke KB campur dan bisa menampilkan dokumen instansi lain.
      knowledgeBaseId: typeof req.body.knowledgeBaseId === 'string' ? req.body.knowledgeBaseId.trim() : undefined,
      // Pemetaan KMS ikut disimpan. Dulu field ini dibuang, sehingga instansi baru
      // kehilangan project repositori dokumen yang sudah dipilih di modal.
      kmsOrganizationId:
        typeof req.body.kmsOrganizationId === 'string' ? req.body.kmsOrganizationId.trim() : undefined,
    };
    const tersimpan = await db.createTenant(newTenant);

    // Langsung sinkronkan KB-nya supaya bagian lain (jumlah dokumen, dashboard,
    // chat) tidak menunggu admin klik "Perbarui RAG". Kalau KB belum bisa dibaca,
    // instansi tetap dibuat dan hasil sinkron dilaporkan jujur (bukan digagalkan).
    let sinkron: { ok: boolean; jumlahDokumen?: number; error?: string } | null = null;
    if (newTenant.knowledgeBaseId) {
      const hasil = await sinkronTenantRag(tersimpan.id, session);
      sinkron = hasil.ok
        ? { ok: true, jumlahDokumen: hasil.jumlahDokumen }
        : { ok: false, error: hasil.error };
    }
    const akhir = db.tenants.find((t) => t.id === tersimpan.id) || tersimpan;
    res.status(201).json({ ...akhir, sinkron });
  });

  app.patch('/api/admin/tenants/:id', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    // Segarkan dulu supaya tenant yang dibuat di instance lain tetap bisa diubah.
    await db.segarkanTenantDariMysql();
    const sebelum = db.tenants.find((t) => t.id === req.params.id);
    const updated = await db.updateTenant(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan.' });
    }
    // Kalau KB diisi/diubah, langsung sinkron supaya bagian lain ikut mutakhir.
    const kbBaru =
      typeof req.body.knowledgeBaseId === 'string' ? req.body.knowledgeBaseId.trim() : undefined;
    let sinkron: { ok: boolean; jumlahDokumen?: number; error?: string } | null = null;
    if (kbBaru && kbBaru !== String(sebelum?.knowledgeBaseId || '')) {
      const hasil = await sinkronTenantRag(req.params.id, session);
      sinkron = hasil.ok
        ? { ok: true, jumlahDokumen: hasil.jumlahDokumen }
        : { ok: false, error: hasil.error };
    }
    const akhir = db.tenants.find((t) => t.id === req.params.id) || updated;
    res.json({ ...akhir, sinkron });
  });

  app.delete('/api/admin/tenants/:id', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const target = db.tenants.find((t) => t.id === req.params.id);
    const success = await db.deleteTenant(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Tenant / Instansi BUMD tidak ditemukan.' });
    }
    res.json({ success: true });
  });

  /**
   * Sinkronkan data RAG satu instansi dengan KB-nya di layanan RAG.
   *
   * Dipakai tombol "Perbarui RAG" di tab BUMD & Tenant: setelah admin mengunggah
   * dokumen baru ke KB, tombol ini membaca ulang isi KB lalu memperbarui jumlah
   * dokumen instansi. Dokumen BARU disebutkan namanya, jadi admin tahu apa yang
   * berubah — bukan hanya angkanya bergeser tanpa penjelasan.
   *
   * Read-only terhadap layanan RAG: tidak ada dokumen yang diubah/dihapus.
   *
   * Dipakai DUA tempat: tombol "Perbarui RAG" DAN otomatis saat instansi dibuat
   * atau KB-nya diubah — supaya bagian lain (jumlah dokumen, dashboard, chat)
   * langsung sinkron tanpa admin harus klik sinkron terpisah. Karena itu
   * pemanggil sebaiknya menampilkan status loading (operasi ini menunggu RAG).
   */
  async function sinkronTenantRag(
    tenantId: string,
    session: SessionPayload
  ): Promise<
    | {
        ok: true;
        tenant: Tenant;
        kbId: string;
        jumlahDokumen: number;
        dokumenBaru: string[];
        dokumenHilang: string[];
        belumPernahSinkron: boolean;
        catatan?: string;
      }
    | { ok: false; status: number; error: string }
  > {
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { ok: false, status: 404, error: 'Instansi tidak ditemukan.' };

    const kb = String(tenant.knowledgeBaseId || '').trim();
    if (!kb) {
      // Jujur: tanpa KB, tidak ada yang bisa disinkronkan. Jangan mengarang angka.
      return {
        ok: false,
        status: 400,
        error:
          'Instansi ini belum punya Knowledge Base ID. Isi KB ID-nya lebih dulu (tombol "+ Daftarkan BUMD Baru" atau perbaiki data instansi).',
      };
    }

    try {
      const hasil = await ragClient.daftarDokumen(kb);
      // Dokumen sambutan repositori ikut terindeks tetapi BUKAN berkas instansi.
      // Menghitungnya membuat panel admin menulis "Berkas RAG: 5" sementara
      // halaman repositori menampilkan 4 baris — terlihat seperti berkas hilang.
      const namaSekarang = hasil.dokumen
        .map((d) => d.nama)
        .filter((n) => !adalahDokumenSambutan(n));
      const namaSebelum = Array.isArray(tenant.dokumenTerakhir) ? tenant.dokumenTerakhir : [];
      const belumPernahSinkron = namaSebelum.length === 0;

      // Dokumen baru = ada di daftar sekarang, tidak ada di daftar sebelumnya.
      const dokumenBaru = belumPernahSinkron
        ? []
        : namaSekarang.filter((n) => !namaSebelum.includes(n));
      // Dokumen hilang = ada sebelumnya, kini tidak ada (jangan disembunyikan).
      const dokumenHilang = belumPernahSinkron
        ? []
        : namaSebelum.filter((n) => !namaSekarang.includes(n));

      const diperbarui = await db.updateTenant(tenant.id, {
        documentCount: namaSekarang.length,
        dokumenTerakhir: namaSekarang,
        kbTersinkronPada: new Date().toISOString(),
      });


      // Dokumen bisa bertambah/berkurang: pratinjau lama tidak lagi mewakili isi
      // dokumen, jadi ditandai basi lalu disiapkan ulang di latar belakang.
      basiikanTenant(tenant.id);
      basiikanWilayah(tenant.id);
      hangatkanTemplateTenant(diperbarui || tenant);

      return {
        ok: true,
        tenant: diperbarui || tenant,
        kbId: kb,
        jumlahDokumen: hasil.jumlah,
        dokumenBaru,
        dokumenHilang,
        belumPernahSinkron,
        catatan: hasil.catatan,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 502,
        error: `Gagal membaca KB "${kb}" dari layanan RAG: ${err?.message || 'kesalahan tidak diketahui'}`,
      };
    }
  }

  app.post('/api/admin/tenants/:id/sinkron-rag', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const hasil = await sinkronTenantRag(req.params.id, session);
    if (!hasil.ok) return res.status(hasil.status).json({ error: hasil.error });
    res.json({
      ok: true,
      tenant: hasil.tenant,
      kbId: hasil.kbId,
      jumlahDokumen: hasil.jumlahDokumen,
      dokumenBaru: hasil.dokumenBaru,
      dokumenHilang: hasil.dokumenHilang,
      belumPernahSinkron: hasil.belumPernahSinkron,
      catatan: hasil.catatan,
    });
  });

  app.get('/api/admin/config', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    // Sengaja tetap `requireAdmin`: halaman Referensi (Repositori Dokumen) yang
    // terbuka untuk Admin Instansi membaca konfigurasi ini untuk status KMS.
    // Yang dikunci hanya PENULISANNYA (`POST /api/admin/config`).
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh melihat konfigurasi sistem.')) return;
    // API key dikirim ter-mask — nilai asli hanya hidup di server.
    res.json({
      ...db.systemConfig,
      ragApiKey: maskKey(db.systemConfig.ragApiKey),
      kmsApiKey: maskKey((db.systemConfig as any).kmsApiKey || ''),
    });
  });

  /**
   * Daftar dokumen sebuah knowledge base (panel admin → Konfigurasi RAG).
   * Saat admin menempelkan KB ID, endpoint ini memberi tahu ADA BERAPA dokumen
   * dan dokumen APA SAJA di dalamnya, supaya KB bisa diperiksa sebelum dipakai.
   * Body/query: `kb` (ID KB yang mau diperiksa; kalau kosong pakai KB dari config).
   */
  app.get('/api/admin/knowledge', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const kb = String((req.query.kb as string) || (db.systemConfig as any).ragKnowledgeBaseId || '').trim();
    try {
      const hasil = await ragClient.daftarDokumen(kb);
      res.json({ ...hasil, provider: db.systemConfig.ragProvider });
    } catch (err: any) {
      res.status(502).json({
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: `Gagal membaca daftar dokumen: ${err?.message || 'kesalahan tidak diketahui'}`,
      });
    }
  });

  /**
   * Profil instansi dari sebuah KB: nama, kota, sektor, jumlah dokumen, ringkasan.
   * Dipakai form "BUMD & Tenant" supaya admin cukup menempel KB ID dan field lainnya
   * terisi otomatis dari dokumen.
   */
  app.get('/api/admin/kb-profil', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    const kb = String(req.query.kb || '').trim();
    try {
      const hasil = await ragClient.profilInstansi(kb);
      res.json({ ...hasil, provider: db.systemConfig.ragProvider });
    } catch (err: any) {
      res.status(502).json({
        kbId: kb,
        jumlahDokumen: 0,
        catatan: `Gagal membaca profil instansi: ${err?.message || 'kesalahan tidak diketahui'}`,
      });
    }
  });

  /**
   * Katalog knowledge base: SELURUH KB di layanan RAG + siapa pemakainya.
   *
   * Dipakai tombol "Perbarui RAG" di tab Instansi & KB. Admin bisa melihat KB
   * yang BARU muncul di sumber RAG (tanpa menebak ID), tahu mana yang sudah
   * dipakai instansi mana, dan mana yang perlu dicek dulu (sisa demo / penulisan
   * ganda). Read-only terhadap layanan RAG — tidak ada yang diubah.
   *
   * Query: `cari` (saring ID), `hanyaBelumDipakai=1`.
   */
  app.get('/api/admin/kb-tersedia', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;

    let hasil: { kbs: any[]; catatan?: string };
    try {
      hasil = await ragClient.daftarKnowledgeBase();
    } catch (err: any) {
      return res.status(502).json({
        error: `Gagal membaca daftar KB dari layanan RAG: ${err?.message || 'kesalahan tidak diketahui'}`,
      });
    }

    // Peta pemakai: knowledgeBaseId → instansi yang memakainya.
    const petaPakai: Record<string, Array<{ id: string; nama: string }>> = {};
    for (const t of db.tenants) {
      const kb = String(t.knowledgeBaseId || '').trim();
      if (!kb) continue;
      (petaPakai[kb] = petaPakai[kb] || []).push({ id: t.id, nama: t.name });
    }

    const semua = tandaiKatalog(hasil.kbs as any, petaPakai);
    const cari = typeof req.query.cari === 'string' ? req.query.cari : '';
    const hanyaBelumDipakai = String(req.query.hanyaBelumDipakai || '') === '1';
    const tersaring = cari || hanyaBelumDipakai ? saringKatalog(semua, { cari, hanyaBelumDipakai }) : semua;

    res.json({
      kbs: tersaring,
      kelompok: kelompokkanKatalog(tersaring),
      ringkasan: hitungRingkasanKatalog(semua),
      catatan: hasil.catatan,
      provider: db.systemConfig.ragProvider,
      baseUrl: db.systemConfig.ragApiUrl,
    });
  });

  /**
   * Simpan konfigurasi SEKALIGUS uji API Key-nya dalam satu panggilan.
   *
   * Urutannya penting: simpan dulu, baru uji. Kalau diuji dulu, key yang diuji adalah
   * key lama yang masih tersimpan — bukan yang baru ditempel admin.
   */
  app.post('/api/admin/config-simpan-uji', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;

    const sebelum = { ...db.systemConfig };
    try {
      // Nilai yang dikirim dari form; field yang tidak dikirim dibiarkan seperti semula.
      //
      // PENJAGAAN API KEY (wajib, sama seperti POST /api/admin/config):
      // GET /api/admin/config mengirim key TER-MASK ke browser, jadi kolom isian
      // berisi topeng seperti "rag_*********w4c4". Kalau topeng itu ikut tersimpan,
      // kredensial asli HANCUR dan uji berikutnya selalu gagal. Dua kasus yang
      // ditangani: (a) nilai sama dengan topeng saat ini -> pertahankan key lama;
      // (b) nilai SUDAH BERBENTUK TOPENG (topeng basi, mis. panel dibuka sebelum key
      // diubah pihak lain) -> JANGAN simpan topeng sebagai key.
      const body = { ...(req.body || {}) };
      body.ragApiKey = lindungiKunci(body.ragApiKey, db.systemConfig.ragApiKey);
      body.kmsApiKey = lindungiKunci(body.kmsApiKey, (db.systemConfig as any).kmsApiKey || '');
      db.updateSystemConfig(body);
    } catch (err: any) {
      return res.status(500).json({
        tersimpan: false,
        error: `Gagal menyimpan konfigurasi: ${err?.message || 'kesalahan tidak diketahui'}`,
      });
    }

    let hasil: any;
    try {
      hasil = await ragClient.ujiApiKey();
    } catch (err: any) {
      hasil = {
        ok: false,
        status: 'galat-layanan',
        latencyMs: 0,
        pesan: `Uji API Key gagal dijalankan: ${err?.message || 'kesalahan tidak diketahui'}`,
      };
    }

    res.json({
      tersimpan: true,
      // Selalu bertopeng ke browser — nilai asli hanya hidup di server.
      konfigurasi: {
        ...db.systemConfig,
        ragApiKey: maskKey(db.systemConfig.ragApiKey),
        kmsApiKey: maskKey((db.systemConfig as any).kmsApiKey || ''),
      },
      // Ringkasan perubahan: key hanya ditampilkan sebagai sidik jari, bukan nilai penuh.
      jejak: {
        baseUrlSebelum: sebelum.ragApiUrl,
        baseUrlSesudah: db.systemConfig.ragApiUrl,
        providerSebelum: sebelum.ragProvider,
        providerSesudah: db.systemConfig.ragProvider,
        keyBerubah: sebelum.ragApiKey !== db.systemConfig.ragApiKey,
      },
      hasil,
    });
  });

  app.post('/api/admin/config', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireSuperadmin(session, res)) return;
    // API key jangan pernah tersimpan ter-mask sebagai nilai aktif. Dua kasus:
    // (a) nilai yang dikirim sama dengan mask key saat ini -> pertahankan key lama
    // (b) nilai yang dikirim SUDAH BERBENTUK MASK (mis. panel dibuka sebelum key
    //     diubah pihak lain, sehingga mask-nya basi) -> JANGAN simpan mask itu
    //     sebagai key, karena akan merusak kredensial yang asli.
    const body = { ...req.body };
    body.ragApiKey = lindungiKunci(body.ragApiKey, db.systemConfig.ragApiKey);
    body.kmsApiKey = lindungiKunci(body.kmsApiKey, (db.systemConfig as any).kmsApiKey || '');
    // Lewat updateSystemConfig() supaya langsung dicerminkan ke MySQL/data/db.json,
    // bukan hanya tersimpan di memori.
    db.updateSystemConfig(body);
    res.json({
      ...db.systemConfig,
      ragApiKey: maskKey(db.systemConfig.ragApiKey),
      kmsApiKey: maskKey((db.systemConfig as any).kmsApiKey || ''),
    });
  });

  // ponytail: tanpa ini alamat /api yang salah dibalas index.html 200 — klien
  // yang mengharapkan JSON malah menerima HTML dan pesan galatnya menyesatkan.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.', kode: 'TIDAK_DITEMUKAN' });
  });

  /**
   * Halaman publik tanpa login: paket & harga, syarat-ketentuan.
   *
   * Didaftarkan SEBELUM penanganan aset/SPA supaya tidak tertelan catch-all
   * `app.get('*')` yang mengirim index.html.
   */
  app.get('/paket', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(halamanPaket());
  });
  app.get('/syarat-ketentuan', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(halamanSyarat());
  });
  // Alias yang sering diketik orang.
  app.get('/harga', (_req: Request, res: Response) => res.redirect(301, '/paket'));
  app.get('/syarat', (_req: Request, res: Response) => res.redirect(301, '/syarat-ketentuan'));
  app.get('/terms', (_req: Request, res: Response) => res.redirect(301, '/syarat-ketentuan'));

  // ================= VITE DEV MIDDLEWARE / STATIC =================
  const distExists = fs.existsSync(path.join(folderDist(), 'index.html'));
  if (distExists && process.env.NODE_ENV !== 'production') peringatkanBundelUsang();
  if (process.env.NODE_ENV === 'production' || distExists) {
    app.use(
      express.static(folderDist(), {
        // index.html TIDAK boleh di-cache: kalau di-cache, pengguna yang membuka
        // ulang halaman masih memakai bundel lama dan mengira fitur baru hilang.
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(path.join(folderDist(), 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  /**
   * Penangan galat terakhir. Tanpa ini, error yang dilempar route menjadi
   * koneksi menggantung tanpa pesan di log, dan pengguna melihat layar kosong.
   * Detail teknis hanya masuk log; klien menerima pesan umum untuk galat 5xx.
   */
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = Number(err?.status || err?.statusCode) || 500;
    const idPermintaan = (req as any).idPermintaan || '-';
    console.error(`[AionesBoard] Galat ${req.method} ${req.originalUrl} req=${idPermintaan}:`, err?.stack || err);
    if (res.headersSent) return;
    res.status(status >= 400 && status <= 599 ? status : 500).json({
      error:
        status < 500
          ? err?.message || 'Permintaan tidak dapat diproses.'
          : 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.',
      // Kode ini bisa disebutkan pengguna saat melapor; operator tinggal
      // mencari baris log dengan id yang sama.
      kode: idPermintaan,
    });
  });

  // Persistence MySQL (Laragon) — muat state sebelum server menerima request.
  await db.initMysql();

  // ponytail: secret sesi harus SAMA di semua host. Database sudah dipakai
  // bersama, jadi di situlah kuncinya disimpan: host pertama membuat, host lain
  // membaca. Tanpa ini, failover membuat semua pengguna terlempar-login dan
  // kunci API yang tersimpan tidak bisa dibuka di host lain.
  {
    const tersimpan = String((db.systemConfig as any)?.sessionSecret || '').trim();
    if (tersimpan.length >= 32) {
      setSecretSesi(tersimpan);
    } else {
      const baru = randomBytes(32).toString('hex');
      setSecretSesi(baru);
      db.updateSystemConfig({ sessionSecret: baru });
      console.log('[sesi] Secret sesi bersama dibuat dan disimpan ke database.');
    }
  }

  /**
   * Muat ulang `systemConfig` & daftar instansi dari MySQL secara berkala.
   *
   * Tanpa ini, instance yang tidak menerima permintaan simpan tetap memakai
   * konfigurasi lama sampai di-restart (base URL/API key RAG baru, KB default,
   * SMTP, instansi baru). Set `CONFIG_REFRESH_SECONDS=0` untuk mematikan.
   */
  function mulaiSinkronKonfigurasi(): () => void {
    const detik = Number(process.env.CONFIG_REFRESH_SECONDS ?? 30);
    if (!Number.isFinite(detik) || detik <= 0) {
      console.log('[sinkron] pemuatan ulang konfigurasi dimatikan (CONFIG_REFRESH_SECONDS=0).');
      return () => {};
    }
    let tik = 0;
    const timer = setInterval(() => {
      void db.muatUlangDariDatabase().then((berubah) => {
        if (berubah.length > 0) {
          console.log(`[sinkron] konfigurasi diperbarui dari database: ${berubah.join(', ')}`);
        }
      });
      // Sekali per ~10 menit: buang baris hitungan percobaan yang jendelanya
      // sudah lewat supaya tabel tidak tumbuh tanpa batas.
      tik += 1;
      if (tik % Math.max(1, Math.round(600 / detik)) === 0) {
        void db.percobaanBersihkanKedaluwarsa();
      }
    }, detik * 1000);
    timer.unref?.();
    console.log(`[sinkron] konfigurasi & instansi dimuat ulang tiap ${detik} dtk dari database.`);
    return () => clearInterval(timer);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aiones Boards Server] Berjalan pada port ${PORT}`);
    // Cadangan harian otomatis (produksi) — lihat docs/operasional.md.
    hentikanBackup = mulaiBackupTerjadwal();
    // Perubahan konfigurasi dari instance lain langsung terpakai di sini.
    hentikanSinkron = mulaiSinkronKonfigurasi();

    /**
     * PRATINJAU TEMPLATE — disiapkan sejak server hidup.
     *
     * Hasil pengisian sebelumnya dimuat dari berkas supaya restart tidak
     * menghapus data. Yang belum siap (atau sudah basi karena dokumen berubah)
     * disiapkan di latar belakang dengan jeda, agar tidak berebut sumber daya
     * dengan permintaan pengguna pertama.
     */
    aturBerkasGudang(path.join(process.cwd(), 'data', 'template-pratinjau.json'));
    // Sengaja TIDAK menyiapkan semua instansi saat server hidup: 6 instansi × 3
    // template = 18 pengisian sekaligus, dan layanan dokumen membalas 429 —
    // pengisian justru gagal semua. Penyiapan dimulai saat galeri template
    // instansi itu dibuka (atau setelah dokumennya disinkronkan).
  });

  // Batas waktu koneksi: header harus selesai 20 dtk, satu permintaan 2 mnt.
  // Tanpa ini koneksi lambat (slow-loris) menahan slot server tanpa batas.
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;
  server.keepAliveTimeout = 65_000;
  let hentikanBackup: () => void = () => {};
  let hentikanSinkron: () => void = () => {};

  // Graceful shutdown: tutup server & pool MySQL saat menerima SIGINT/SIGTERM.
  // Tanpa ini, proses tertinggal (orphan) ketika dijalankan lewat wrapper
  // (mis. `tsx` dari skrip QA/CI) yang menerima sinyal kill lebih dulu.
  let sedangTutup = false;
  const tutup = async (sinyal: string) => {
    if (sedangTutup) return;
    sedangTutup = true;
    console.log(`[Aiones Boards Server] Menerima ${sinyal} — menutup dengan rapi...`);
    hentikanBackup();
    hentikanSinkron();
    // Berhenti menerima koneksi baru; paksa tutup setelah 5 dtk bila ada yang menggantung.
    server.close(() => {
      console.log('[Aiones Boards Server] Koneksi HTTP ditutup.');
    });
    const paksa = setTimeout(() => {
      console.warn('[Aiones Boards Server] Batas waktu 5 dtk — keluar paksa.');
      process.exit(0);
    }, 5000);
    paksa.unref();
    try {
      await db.closeMysql();
    } catch (err) {
      console.error('[Aiones Boards Server] Gagal menutup pool MySQL:', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void tutup('SIGINT'));
  process.on('SIGTERM', () => void tutup('SIGTERM'));

  // Jangan biarkan proses mati tanpa jejak: promise yang ditolak tanpa
  // penangan dulu hilang begitu saja, sehingga penyebab gangguan tidak
  // pernah terlihat di log.
  process.on('unhandledRejection', (alasan) => {
    console.error('[AionesBoard] Promise ditolak tanpa penangan:', alasan);
  });
  process.on('uncaughtException', (err) => {
    console.error('[AionesBoard] Eksepsi tak tertangkap — proses dihentikan:', err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('[Aiones Boards Server] Gagal inisialisasi server:', err);
  process.exit(1);
});
