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
import { WIDGET_CATALOG } from './src/services/builder/catalog';
import { generateDashboard } from './src/services/builder/generate';
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
import {
  niatBuatDashboard,
  niatTambahWidget,
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
import { AlertRule, BumdSector, ChatMessage, Dashboard, NotificationItem, OrganisasiKMS, ProgressStep, StatusLaporan, Tenant, TIPE_SERI, UserRole, WidgetGrid, WidgetSpec } from './src/types';
import { WidgetSpecSchema } from './src/services/spec/widgetSpec';
import { buatNotifikasi, evaluasiAturan } from './src/services/alerts';
import { buatPembatas } from './src/services/auth/rateLimit';
import { buatPembatasLintas } from './src/services/auth/pembatasLintas';
import { adalahSandiBawaan, kataSandiSementara, masalahKataSandi } from './src/services/auth/password';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dekripsiNilai } from './src/services/config/rahasia';
import {
  mulaiBackupTerjadwal,
  statusCadangan,
  statusUnggahanOffsite,
} from './src/services/ops/backupTerjadwal';
import { adaLagiHalaman, potongHalaman, potongUrut } from './src/services/http/halaman';
import { adalahDokumenSambutan, gabungDokumenBasis } from './src/services/berkas/gabungBasis';
import type { DokumenBasis } from './src/services/berkas/gabungBasis';
import { keCsv } from './src/services/http/csv';
import { buatPemeriksaKetersediaan } from './src/services/widgets/ketersediaan';
import { antreEmail, mailerAktif, penerimaAlert } from './src/services/mailer';
import { DASHBOARD_TEMPLATES, widgetDariTemplate } from './src/services/templates/dashboardTemplates';
import { isiTemplateDariRag } from './src/services/templates/isiDariRag';
import { adalahPermintaanSaran, dataDariWidget, indikatorDariPrompt, susunSaranChart } from './src/services/chat/saranChart';
import { adalahPertanyaanDokumen, susunJawabanDokumen } from './src/services/chat/dokumen';
import { generateInsightPresentasi } from './src/services/presentasi/generateInsight';
import { susunSlide, VERSI_PRESENTASI } from './src/services/presentasi/slide';
import { GoogleAuthError, verifikasiIdTokenGoogle } from './src/services/auth/google';
import {
  hitungDeadline,
  hitungKepatuhan,
  periodeTersedia,
} from './src/services/laporan/periode';
import {
  buatAksi,
  hitungPosisi,
  bolehMenyetujui,
  validasiAlur,
  normalisasiPeran,
  LABEL_PERAN,
} from './src/services/laporan/alur';
import {
  bacaTabel,
  bangunWidgetImpor,
  ringkasPratinjau,
  KonfigImpor,
} from './src/services/impor/tabel';
import {
  buatAksiTindakLanjut,
  hitungRingkasan as hitungRingkasanAudit,
  normalisasiStatus as normalisasiStatusAudit,
  normalisasiSumber as normalisasiSumberAudit,
  validasiAksi as validasiAksiAudit,
  validasiTemuan,
} from './src/services/audit/tindakLanjut';
import {
  hitungRasio,
  hitungSkorKesehatan,
  labelPeriodeKeuangan,
  lengkapiSnapshot,
  normalisasiKomponen,
  normalisasiSitasi,
  ringkasKeuangan,
  urutPeriodeTerbaru,
  validasiSnapshot,
} from './src/services/keuangan/rasio';
import {
  buatAksiMitigasi,
  hitungRingkasanRisiko,
  hitungSkor as hitungSkorRisiko,
  levelDariSkor,
  normalisasiKategori as normalisasiKategoriRisiko,
  normalisasiLevel,
  normalisasiStatusRisiko,
  validasiAksiMitigasi,
  validasiRisiko,
} from './src/services/risiko/register';
import {
  akumulasiPenyusutan,
  hitungRingkasanAset,
  nilaiBuku,
  normalisasiKategoriAset,
  normalisasiKondisi,
  normalisasiPemanfaatan,
  validasiAset,
} from './src/services/aset/daftarAset';
import {
  buatIndikator,
  hitungRingkasanPK,
  normalisasiStatusPK,
  validasiIndikator,
  validasiPerjanjianKinerja,
} from './src/services/kinerja/perjanjianKinerja';
import {
  buatBagian,
  hitungRingkasanLKjIP,
  normalisasiStatusLKjIP,
  ringkasIndikatorTertaut,
  validasiBagian,
  validasiLKjIP,
} from './src/services/kinerja/lkjip';
import { KmsClient, KmsServiceError } from './src/services/berkas/kmsClient';
import type { BerkasKMS } from './src/types';
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
 * Gerbang admin. Mengembalikan `true` bila boleh lanjut; bila tidak, respons 403
 * sudah dikirim sehingga pemanggil cukup `if (!requireAdmin(...)) return;`.
 *
 * Semua route admin memakai ini supaya bentuk penolakan seragam dan cakupannya
 * bisa diaudit dengan satu grep, bukan 41 salinan blok if yang gampang terlewat.
 */
function requireAdmin(session: SessionPayload, res: Response, pesan = 'Hanya administrator yang boleh melakukan tindakan ini.'): boolean {
  if (session.role === 'admin') return true;
  res.status(403).json({ error: pesan });
  return false;
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
  if (session.role !== 'admin') {
    // Non-admin: kunci ke instansinya sendiri, titik. Abaikan permintaan pindah.
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
const BATAS_ISI_TEMPLATE_MS = 900_000;

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
const VERSI_BUNDEL = versiBundelSaatIni();

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
        // sistem. Dua origin ini saja; sisanya tetap terkunci.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/berkas/unggah') return jsonBesar(req, res, next);
    return jsonKecil(req, res, next);
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
    res.json({ versi: VERSI_BUNDEL });
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
    // Non-admin hanya boleh melihat instansinya sendiri (kunci ketat 1 akun = 1 BUMD).
    if (session.role !== 'admin') {
      return res.json(db.tenants.filter((t) => t.id === session.tenantId));
    }
    res.json(db.tenants);
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

    // Kata sandi bawaan lama (dipakai bersama oleh banyak akun) dianggap tidak
    // sah sebagai sandi akhir → pengguna wajib menggantinya sebelum memakai
    // aplikasi. Akun hasil reset admin juga ditandai lewat mustChangePassword.
    const wajibGanti = user.mustChangePassword === true || adalahSandiBawaan(password);

    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      mustChange: wajibGanti,
    });

    db.addAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'Login Pengguna',
      target: 'Portal Aiones Boards BUMD',
      details: `Masuk sebagai ${user.role.toUpperCase()} (${user.email})`,
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

  /** Terbitkan sesi + audit log untuk user yang sudah lolos verifikasi. */
  function terbitkanSesi(res: Response, user: SafeUser, cara: string) {
    // Kata sandi bawaan lama (dipakai bersama oleh banyak akun) dianggap tidak
    // sah sebagai sandi akhir → pengguna wajib menggantinya sebelum memakai
    // aplikasi. Akun hasil reset admin juga ditandai lewat mustChangePassword.
    // Login Google tidak memakai sandi lokal → hanya flag akun yang berlaku.
    const wajibGanti = user.mustChangePassword === true;

    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
      mustChange: wajibGanti,
    });
    db.addAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'Login Pengguna',
      target: 'Portal Aiones Boards BUMD',
      details: `Masuk sebagai ${user.role.toUpperCase()} (${user.email}) — ${cara}`,
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
    db.addAuditLog({
      tenantId,
      userId: newUser.id,
      userName: newUser.name,
      action: 'Pendaftaran Akun (menunggu persetujuan)',
      target: instansiTujuan?.name || tenantId,
      details: `Pendaftaran mandiri ${newUser.email} menunggu persetujuan admin instansi.`,
    });
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
      db.addAuditLog({
        tenantId: baru.tenantId,
        userId: baru.id,
        userName: baru.name,
        action: 'Pendaftaran via Google (menunggu persetujuan)',
        target: instansiTujuan.name,
        details: `Akun Google ${baru.email} menunggu persetujuan admin instansi.`,
      });
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
          db.addAuditLog({
            tenantId: instansiBaru.id,
            userId: user.id,
            userName: user.name,
            action: 'Ubah Instansi Pendaftaran (menunggu persetujuan)',
            target: instansiBaru.name,
            details: `Pendaftar ${user.email} memilih instansi lain selagi menunggu persetujuan.`,
          });
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
    db.addAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'Ganti Kata Sandi',
      target: user.name,
      details: 'Kata sandi akun diganti oleh pemiliknya.',
    });

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
        db.addAuditLog({
          tenantId: user.tenantId,
          userId: user.id,
          userName: user.name,
          action: 'Logout Pengguna',
          target: 'Portal Aiones Boards BUMD',
          details: 'Sesi pengguna berhasil diakhiri dengan aman',
        });
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

  app.post('/api/dashboards', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const newDash: Dashboard = {
      id: `dash-${Date.now()}`,
      tenantId,
      title: req.body.title || 'Dashboard Baru',
      description: req.body.description || 'Dashboard kustom BUMD',
      sector: req.body.sector || 'pdam',
      widgets: req.body.widgets || [],
      globalFilters: req.body.globalFilters || {
        periode: '2026-Q1',
        unitKerja: 'Semua',
        kategori: 'Semua',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createDashboard(newDash);
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Buat Dashboard',
      target: newDash.title,
      details: `Membuat dashboard baru sektor ${newDash.sector}`,
    });
    res.status(201).json(newDash);
  });

  app.patch('/api/dashboards/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const updated = db.updateDashboard(req.params.id, req.body, tenantId);
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
    const session = requireAuth(req, res);
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

      db.addAuditLog({
        tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Siapkan Presentasi',
        target: dash.title,
        details: `Menyusun ${hasil.slides.length} slide (insight RAG: ${hasil.dariRag}, dari data: ${hasil.dariData}).`,
      });

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
  app.post('/api/dashboards/dari-template', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: 'Instansi tidak ditemukan.' });

    const templateId = String(req.body?.templateId || '').trim();
    const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return res.status(400).json({ error: 'Template tidak dikenal.' });

    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || '';
    // jobId dipakai UI untuk membaca progres pengisian (polling) selama menunggu.
    const jobId = String(req.body?.jobId || '').trim();

    try {
      // Salin widget template (id baru & segar) lalu isi angkanya dari dokumen.
      const seed = Date.now();
      const dasar = widgetDariTemplate(template, seed);
      if (jobId) {
        progresTemplate.set(jobId, {
          selesai: 0,
          total: dasar.length,
          terisi: 0,
          judul: 'Menyiapkan permintaan ke dokumen…',
          mulai: Date.now(),
        });
      }
      const hasil = await isiTemplateDariRag(
        { ...template, widgets: dasar },
        {
          sector: (req.body?.sector || tenant.sector || template.sektor) as BumdSector,
          instansi: tenant.name,
          kbId,
          rag: ragClient,
          // 2 serentak, bukan 8: RAG membalas 429 bila dihantam banyak permintaan
          // sekaligus. Uji nyata: 8 serentak = hampir semua kartu kosong.
          konkurensi: 2,
          // Tunggu sampai semua kartu terisi: kartu yang gagal karena layanan
          // sibuk diulang di putaran berikutnya, bukan langsung dikosongkan.
          batasMs: BATAS_ISI_TEMPLATE_MS,
          putaranMaks: 6,
          onProgres: (info) => {
            if (!jobId) return;
            progresTemplate.set(jobId, {
              selesai: info.selesai,
              total: info.total,
              terisi: info.terisiTotal ?? 0,
              judul: info.judul,
              mulai: progresTemplate.get(jobId)?.mulai ?? Date.now(),
            });
          },
        }
      );
      if (jobId) progresTemplate.delete(jobId);

      // Judul dashboard: buang penanda "(Contoh)" karena kini angkanya dari dokumen.
      const judulBersih = template.judulDashboard.replace(/\s*\(Contoh\)\s*/i, '').trim();

      const newDash: Dashboard = {
        id: `dash-${Date.now()}`,
        tenantId,
        title: judulBersih,
        description: template.deskripsiDashboard.replace(
          /Angka bersifat contoh[^.]*\./i,
          'Angka diambil dari dokumen resmi instansi; kartu yang indikatornya belum ada di dokumen ditandai kosong.'
        ),
        sector: template.sektor,
        widgets: hasil.widgets,
        globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createDashboard(newDash);
      db.addAuditLog({
        tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Buat Dashboard dari Template',
        target: newDash.title,
        details: `Template ${template.sektor}: ${hasil.terisi} kartu terisi dari dokumen, ${hasil.kosong} kartu belum ada di dokumen.`,
      });

      return res.status(201).json({
        dashboard: newDash,
        terisi: hasil.terisi,
        kosong: hasil.kosong,
        total: template.widgets.length,
        catatan: hasil.catatan,
        kedaluwarsa: hasil.kedaluwarsa,
      });
    } catch (err) {
      // Rincian teknis hanya untuk log; pengguna menerima kalimat yang jelas.
      console.error('[template] gagal membuat dashboard dari template:', jelaskanError(err));
      if (jobId) progresTemplate.delete(jobId);
      return res.status(500).json({
        error: 'Dashboard belum bisa dibuat. Coba lagi beberapa saat lagi.',
      });
    }
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
    const session = requireAuth(req, res);
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
      db.addAuditLog({
        tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Tambah Widget dari Saran Asisten',
        target: widgetBaru.title,
        details: `Indikator: "${indikator}" · tipe ${widgetBaru.type}`,
      });

      return res.status(201).json({ dashboard: { ...dash, widgets }, widget: widgetBaru });
    } catch (err) {
      console.error('[saran] gagal menambah kartu dari dokumen:', jelaskanError(err));
      return res.status(503).json({
        error: 'Layanan dokumen sedang tidak tersedia. Coba lagi beberapa saat lagi.',
      });
    }
  });

  app.delete('/api/dashboards/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const success = db.deleteDashboard(req.params.id, tenantId);
    if (!success) {
      return res.status(404).json({ error: 'Gagal menghapus dashboard.' });
    }
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Dashboard',
      target: req.params.id,
      details: 'Menghapus dashboard dari sistem',
    });
    res.json({ success: true });
  });

  app.post('/api/dashboards/:id/duplicate', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
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
    db.addAuditLog({
      tenantId: effectiveTenantId(req, session),
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Riwayat Chat',
      target: req.params.id,
      details: 'Riwayat percakapan dihapus; dashboard tetap ada',
    });
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
      const mintaTambahWidget = niatTambahWidget(prompt);
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
        if (!activeDash) {
          const pesan = 'Buka dulu salah satu dashboard, baru saya bisa menambahkan widget ke kanvasnya.';
          catatAsisten({ sender: 'system', text: pesan, actionTaken: 'none' } as any);
          sendEvent('result', { actionTaken: 'none', message: pesan });
          sendEvent('done', { ok: false });
          return res.end();
        }
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
        if (indikator.length < 2) {
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
          const widgetBaru: WidgetSpec = {
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
          // Tolak KEMBARAN: kalau kanvas sudah punya widget dengan isi yang sama
          // (judul + subjudul + periode + tipe), jangan tambah duplikat. Menambah
          // kartu kedua yang menanyakan hal sama membuat jumlah widget menipu.
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
            db.addAuditLog({
              tenantId,
              userId: session.userId,
              userName: session.name,
              action: 'Tolak Widget Kembar via Chat',
              target: kembar.title,
              details: `Indikator: "${indikator}" · sudah ada di kanvas`,
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
          db.updateDashboard(activeDash.id, { widgets: updatedWidgets }, tenantId);
          db.addAuditLog({
            tenantId,
            userId: session.userId,
            userName: session.name,
            action: 'Tambah Widget via Chat (RAG)',
            target: widgetBaru.title,
            details: `Indikator: "${indikator}" · tipe ${widgetBaru.type}`,
          });
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

            db.addAuditLog({
              tenantId,
              userId: session.userId,
              userName: session.name,
              action: 'Hapus Widget via Chat',
              target: removed.title,
              details: `Perintah chat: "${prompt}"`,
            });

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

            db.addAuditLog({
              tenantId,
              userId: session.userId,
              userName: session.name,
              action: 'Ubah Tipe Chart via Chat',
              target: target.title,
              details: `Diubah ke tipe ${newType}`,
            });

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
      const isGenerateDash = niatBuatDashboard(prompt);

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
        db.addAuditLog({
          tenantId,
          userId: session.userId,
          userName: session.name,
          action: gagalLayanan ? 'Generate Dashboard Gagal (Layanan RAG)' : 'Generate Dashboard Gagal',
          target: prompt.slice(0, 60),
          details: genResult.alasanGagal || 'Dokumen tidak memadai',
        });
        sendEvent('result', {
          actionTaken: gagalLayanan ? 'rag_error' : 'none',
          message: pesanGagal,
          modeUsed: genResult.modeUsed,
        });
        sendEvent('done', { ok: false });
        return res.end();
      }

      let dashboardTersimpan: Dashboard;
      if (activeDash) {
        dashboardTersimpan =
          db.updateDashboard(
            activeDash.id,
            {
              title: genResult.dashboard.title,
              description: genResult.dashboard.description,
              widgets: genResult.dashboard.widgets,
              sector,
            },
            tenantId
          ) || activeDash;
      } else {
        dashboardTersimpan = db.createDashboard(genResult.dashboard);
        chat = db.ensureChatForDashboard(
          dashboardTersimpan.id,
          tenantId,
          session.userId,
          dashboardTersimpan.title
        );
        pesanUserTercatat = false;
      }

      db.addAuditLog({
        tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Generate Dashboard Otomatis',
        target: dashboardTersimpan.title,
        details: `Via ${genResult.modeUsed}, Sitasi: ${genResult.citationsCount}, Latensi: ${genResult.latencyMs}ms`,
      });

      // Susun jawaban percakapan yang kontekstual, manusiawi, dan informatif (bukan template kaku)
      const kpis = dashboardTersimpan.widgets.filter((w) => w.type === 'kpi');
      const charts = dashboardTersimpan.widgets.filter((w) => ['bar', 'line', 'area', 'donut', 'heatmap'].includes(w.type));
      const narasiWidget = dashboardTersimpan.widgets.find((w) => w.type === 'narasi');

      const kpiItems = kpis.slice(0, 3).map((k) => `• **${k.title}**: ${k.kpi?.value} ${k.kpi?.unit || ''}`).join('\n');
      const chartNames = charts.map((c) => `• ${c.title} (${c.type.toUpperCase()})`).join('\n');

      let replyText = `Tentu! Dashboard **"${dashboardTersimpan.title}"** berhasil ${activeDash ? 'diperbarui' : 'disintesis'} ${
        genResult.modeUsed === 'Fallback (Template Snapshot)'
          ? 'dari TEMPLATE CONTOH (bukan dokumen instansi)'
          : `menggunakan dokumen resmi ${sector.toUpperCase()}`
      }.\n\n`;

      if (narasiWidget?.narasi?.text) {
        replyText += `📋 **Ringkasan Temuan Dokumen:**\n${narasiWidget.narasi.text}\n\n`;
      }

      if (charts.length > 0) {
        replyText += `📈 **Visualisasi Grafik:**\n${chartNames}\n\n`;
      }

      if (kpiItems) {
        replyText += `🎯 **Indikator Kunci Utama:**\n${kpiItems}\n\n`;
      }

      replyText +=
        genResult.modeUsed === 'Jalur A (LLM JSON)'
          ? `Seluruh angka diambil dari dokumen resmi instansi ini.\n`
          : `⚠️ **DATA CONTOH:** dashboard ini berasal dari template demo, bukan dari dokumen instansi ini. Jangan dipakai untuk laporan atau presentasi resmi.\n`;

      // JUJUR soal jumlah widget: kalau pengguna meminta jumlah tertentu
      // ("dashboard dengan 15-20 widget"), katakan berapa yang benar-benar
      // tersusun — jangan menjanjikan angka yang tidak ada di kanvas.
      if (genResult.permintaanJumlah) {
        const diminta = labelJumlahWidget(genResult.permintaanJumlah);
        if (genResult.jumlahKurang) {
          replyText +=
            `⚠️ Anda meminta **${diminta} widget**, tetapi dokumen instansi ini baru memuat data untuk **${genResult.jumlahWidget} widget**. ` +
            `Sisanya tidak ditambahkan supaya tidak ada angka contoh. Tambahkan/rapikan dokumen di knowledge base lalu minta lagi.\n`;
        } else {
          replyText += `Dashboard berisi **${genResult.jumlahWidget} widget** sesuai permintaan Anda.\n`;
        }
      } else {
        replyText += `Dashboard berisi **${genResult.jumlahWidget} widget** dari dokumen instansi ini.\n`;
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

  // ================= ALERTS & NOTIFICATIONS =================
  app.get('/api/alerts', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const rules = db.alertRules.filter((r) => r.tenantId === effectiveTenantId(req, session));
    res.json(rules);
  });

  app.post('/api/alerts', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const newRule = {
      id: `alert-${Date.now()}`,
      tenantId,
      title: req.body.title || 'Aturan Ambang Batas Baru',
      metricKey: req.body.metricKey || 'kpi',
      metricName: req.body.metricName || 'Indikator Utama',
      operator: req.body.operator || '>=',
      threshold: Number(req.body.threshold) || 0,
      unit: req.body.unit || '%',
      channels: req.body.channels || ['in_app'],
      severity: req.body.severity || 'warning',
      isActive: true,
    };
    db.alertRules.push(newRule);
    db.simpanAturanAlert(newRule);
    db.persist();
    res.status(201).json(newRule);
  });

  /**
   * Ubah aturan ambang batas. Dulu aturan hanya bisa DIBUAT: salah ketik ambang atau
   * salah indikator membuat aturan permanen (tidak ada jalur ubah/hapus di UI maupun API).
   * Validasi nilai ketat supaya PATCH tidak diam-diam menormalkan input ngawur.
   */
  app.patch('/api/alerts/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const rule = db.alertRules.find((r) => r.id === req.params.id && r.tenantId === tenantId);
    if (!rule) return res.status(404).json({ error: 'Aturan ambang batas tidak ditemukan.' });

    const OPERATOR_SAH: AlertRule['operator'][] = ['>', '>=', '<', '<='];
    const SEVERITY_SAH: AlertRule['severity'][] = ['info', 'warning', 'critical'];
    const body = req.body || {};

    if (body.operator !== undefined && !OPERATOR_SAH.includes(body.operator)) {
      return res.status(400).json({ error: `Operator "${body.operator}" tidak dikenal.`, operatorSah: OPERATOR_SAH });
    }
    if (body.severity !== undefined && !SEVERITY_SAH.includes(body.severity)) {
      return res.status(400).json({ error: `Tingkat keparahan "${body.severity}" tidak dikenal.`, severitySah: SEVERITY_SAH });
    }
    if (body.threshold !== undefined) {
      const angka = Number(body.threshold);
      if (!Number.isFinite(angka)) return res.status(400).json({ error: 'Ambang batas harus berupa angka.' });
    }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      return res.status(400).json({ error: 'Status aktif harus berupa boolean.' });
    }

    if (body.title !== undefined) rule.title = String(body.title).trim() || rule.title;
    if (body.metricKey !== undefined) rule.metricKey = String(body.metricKey).trim() || rule.metricKey;
    if (body.metricName !== undefined) rule.metricName = String(body.metricName).trim() || rule.metricName;
    if (body.operator !== undefined) rule.operator = body.operator;
    if (body.threshold !== undefined) rule.threshold = Number(body.threshold);
    if (body.unit !== undefined) rule.unit = String(body.unit).trim() || rule.unit;
    if (body.severity !== undefined) rule.severity = body.severity;
    if (body.isActive !== undefined) rule.isActive = body.isActive;
    if (Array.isArray(body.channels) && body.channels.length > 0) {
      rule.channels = body.channels.map((c: unknown) => String(c)).filter(Boolean) as AlertRule['channels'];
    }

    db.persist();
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah Ambang Batas',
      target: rule.metricName,
      details: `Aturan ${rule.metricName} ${rule.operator} ${rule.threshold} ${rule.unit} (${rule.isActive ? 'aktif' : 'nonaktif'})`,
    });
    res.json(rule);
  });

  app.delete('/api/alerts/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const idx = db.alertRules.findIndex((r) => r.id === req.params.id && r.tenantId === tenantId);
    if (idx < 0) return res.status(404).json({ error: 'Aturan ambang batas tidak ditemukan.' });
    const [dihapus] = db.alertRules.splice(idx, 1);
    db.hapusAturanAlert(dihapus.id);
    db.persist();
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Ambang Batas',
      target: dihapus.metricName,
      details: `Aturan ${dihapus.metricName} ${dihapus.operator} ${dihapus.threshold} ${dihapus.unit} dihapus.`,
    });
    res.json({ ok: true, id: dihapus.id });
  });

  // Evaluasi ambang batas: aturan hanya menyala kalau nilai indikator dari dokumen
  // benar-benar melanggar ambang. Aturan yang aman / tanpa data dilaporkan apa adanya
  // di `tidakTerlampaui` — tidak ada notifikasi karangan.
  app.post('/api/alerts/evaluate', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const sector = (tenant?.sector || 'pdam') as BumdSector;
    const rules = db.alertRules.filter((r) => r.tenantId === tenantId && r.isActive);

    const triggered: NotificationItem[] = [];
    const terlewat: { ruleId: string; metricName: string; alasan: string }[] = [];
    let emailDiantre = 0;

    rules.forEach((rule) => {
      const hasil = evaluasiAturan(rule, sector);
      if (hasil.status !== 'terlampaui') {
        terlewat.push({
          ruleId: rule.id,
          metricName: rule.metricName,
          alasan:
            hasil.status === 'tanpa-data'
              ? hasil.alasan
              : `Nilai ${hasil.indikator.nilai} ${hasil.indikator.satuan} masih di dalam ambang ${rule.operator} ${rule.threshold} ${rule.unit}.`,
        });
        return;
      }

      const { indikator } = hasil;
      // `sentEmail` selalu false di sini — hanya callback mailer di bawah yang
      // boleh menaikkannya, setelah SMTP benar-benar menerima email.
      const notif = buatNotifikasi(rule, tenantId, indikator);

      db.notifications.unshift(notif);
      db.simpanNotifikasi(notif); // ponytail: per-baris, bukan snapshot
      triggered.push(notif);
      rule.lastTriggered = notif.timestamp;

      if (rule.channels.includes('email')) {
        emailDiantre++;
        antreEmail({
          subject: `[Aiones Boards ${rule.severity.toUpperCase()}] ${notif.title}`,
          text: `${notif.message}\n\nInstansi: ${tenant?.name || tenantId}\nWaktu: ${notif.timestamp}`,
          html:
            `<p><strong>${notif.title}</strong></p>` +
            `<p>${notif.message}</p>` +
            `<p>Instansi: ${tenant?.name || tenantId}<br/>Tingkat: ${rule.severity}<br/>Waktu: ${notif.timestamp}</p>`,
          onSent: () => {
            notif.sentEmail = true;
            db.persist();
          },
        });
      }
    });

    if (triggered.length > 0) db.persist();

    res.json({
      evaluated: rules.length,
      triggeredCount: triggered.length,
      notifications: triggered,
      tidakTerlampaui: terlewat,
      email: {
        aktif: mailerAktif(),
        penerima: penerimaAlert(),
        diantre: emailDiantre,
      },
    });
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const notifs = db.notifications.filter((n) => n.tenantId === effectiveTenantId(req, session));
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

  // ================= PELAPORAN PERIODIK & KEPATUHAN =================

  /**
   * Daftar kewajiban lapor instansi + periode yang tersedia.
   * Semua data berasal dari instansi efektif (non-admin terkunci ke instansinya).
   */
  app.get('/api/pelaporan/kewajiban', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kewajiban = db.getKewajiban(tenantId);
    res.json({
      kewajiban,
      periode: periodeTersedia(kewajiban),
    });
  });

  app.post('/api/pelaporan/kewajiban', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const nama = String(req.body?.nama || '').trim();
    if (!nama) return res.status(400).json({ error: 'Nama kewajiban lapor wajib diisi.' });
    const jenis = ['bulanan', 'triwulanan', 'semesteran', 'tahunan'].includes(req.body?.jenis)
      ? req.body.jenis
      : 'triwulanan';
    const tenggatHari = Number.isFinite(Number(req.body?.tenggatHari))
      ? Math.max(0, Math.min(180, Number(req.body.tenggatHari)))
      : 10;
    const baru = db.createKewajiban({
      tenantId,
      nama,
      jenis,
      dasar: req.body?.dasar ? String(req.body.dasar).trim() : undefined,
      penerima: req.body?.penerima ? String(req.body.penerima).trim() : undefined,
      tenggatHari,
      isActive: req.body?.isActive !== false,
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Kewajiban Lapor',
      target: baru.nama,
      details: `Jenis: ${baru.jenis}, tenggat ${baru.tenggatHari} hari setelah periode berakhir`,
    });
    res.status(201).json(baru);
  });

  app.patch('/api/pelaporan/kewajiban/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const partial: Record<string, unknown> = {};
    if (typeof req.body?.nama === 'string') partial.nama = req.body.nama.trim();
    if (['bulanan', 'triwulanan', 'semesteran', 'tahunan'].includes(req.body?.jenis)) {
      partial.jenis = req.body.jenis;
    }
    if (typeof req.body?.dasar === 'string') partial.dasar = req.body.dasar.trim();
    if (typeof req.body?.penerima === 'string') partial.penerima = req.body.penerima.trim();
    if (Number.isFinite(Number(req.body?.tenggatHari))) {
      partial.tenggatHari = Math.max(0, Math.min(180, Number(req.body.tenggatHari)));
    }
    if (typeof req.body?.isActive === 'boolean') partial.isActive = req.body.isActive;
    const updated = db.updateKewajiban(req.params.id, tenantId, partial);
    if (!updated) return res.status(404).json({ error: 'Kewajiban lapor tidak ditemukan.' });
    res.json(updated);
  });

  app.delete('/api/pelaporan/kewajiban/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteKewajiban(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Kewajiban lapor tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Kewajiban Lapor',
      target: req.params.id,
      details: 'Kewajiban beserta seluruh laporan terkait dihapus',
    });
    res.json({ success: true });
  });

  /**
   * Daftar laporan + ringkasan kepatuhan untuk satu periode.
   * Ringkasan DIHITUNG dari kewajiban aktif vs laporan nyata.
   *
   * Tiap laporan dilengkapi `posisiVerifikasi` (tahap mana yang sedang menunggu)
   * supaya UI tidak perlu menghitung ulang rantai persetujuan.
   */
  app.get('/api/pelaporan/laporan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kewajiban = db.getKewajiban(tenantId);
    const periode = String(req.query.periode || '') || periodeTersedia(kewajiban)[0] || '';
    const daftarAlur = db.getAlurVerifikasi(tenantId);
    const laporan = db.getLaporan(tenantId, periode || undefined).map((l) => ({
      ...l,
      posisiVerifikasi: hitungPosisi(l, daftarAlur),
    }));
    const ringkasan = periode
      ? hitungKepatuhan(kewajiban, laporan, periode)
      : null;
    res.json({
      periode,
      laporan,
      ringkasan,
      alur: daftarAlur,
      periodeTersedia: periodeTersedia(kewajiban),
    });
  });

  /**
   * Catat/perbarui laporan untuk (kewajiban, periode).
   * Tenggat dihitung server dari kewajiban — tidak dipercaya dari klien.
   */
  app.post('/api/pelaporan/laporan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kewajibanId = String(req.body?.kewajibanId || '').trim();
    const periode = String(req.body?.periode || '').trim();
    if (!kewajibanId || !periode) {
      return res.status(400).json({ error: 'Kewajiban dan periode wajib diisi.' });
    }
    const kew = db.getKewajiban(tenantId).find((k) => k.id === kewajibanId);
    if (!kew) {
      return res.status(404).json({ error: 'Kewajiban lapor tidak ditemukan untuk instansi ini.' });
    }
    const status = ['belum', 'draf', 'terkirim', 'terverifikasi', 'revisi'].includes(req.body?.status)
      ? req.body.status
      : 'draf';
    const lampiran = Array.isArray(req.body?.lampiran)
      ? req.body.lampiran
          .filter((l: any) => l && typeof l.nama === 'string' && l.nama.trim())
          .map((l: any) => ({
            nama: String(l.nama).trim(),
            ukuran: Number.isFinite(Number(l.ukuran)) ? Number(l.ukuran) : undefined,
            catatan: l.catatan ? String(l.catatan).trim() : undefined,
          }))
      : [];
    // Alur verifikasi: pakai yang diminta bila memang milik instansi ini,
    // kalau tidak jatuh ke alur default instansi (boleh kosong = alur bawaan).
    const alurDiminta = req.body?.alurId ? String(req.body.alurId).trim() : '';
    const daftarAlur = db.getAlurVerifikasi(tenantId);
    const alurId = alurDiminta && daftarAlur.some((a) => a.id === alurDiminta)
      ? alurDiminta
      : db.getAlurDefault(tenantId)?.id;
    const tersimpan = db.catatLaporan({
      tenantId,
      kewajibanId,
      nama: kew.nama,
      jenis: kew.jenis,
      periode,
      status,
      // Tenggat DIHITUNG server dari kewajiban; klien tidak boleh menentukan.
      deadline: hitungDeadline(periode, kew.tenggatHari) || undefined,
      tanggalKirim:
        status === 'terkirim' || status === 'terverifikasi'
          ? req.body?.tanggalKirim || new Date().toISOString()
          : undefined,
      disusunOleh: req.body?.disusunOleh ? String(req.body.disusunOleh).trim() : session.name,
      catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
      lampiran,
      alurId,
    });
    // Catat pengiriman ke riwayat verifikasi (titik awal rantai persetujuan).
    // Hanya sekali per percobaan: kalau status tetap 'terkirim' dan riwayat
    // sudah punya kiriman terakhir, jangan menambah entri kembar.
    let hasil = tersimpan;
    if (status === 'terkirim') {
      const riwayat = Array.isArray(tersimpan.riwayatVerifikasi) ? tersimpan.riwayatVerifikasi : [];
      const kirimTerakhir = [...riwayat].reverse().find((a) => a.aksi === 'kirim');
      const adaSetelah = kirimTerakhir
        ? riwayat.some((a) => new Date(a.pada).getTime() > new Date(kirimTerakhir.pada).getTime())
        : false;
      const perluCatat = !kirimTerakhir || adaSetelah;
      if (perluCatat) {
        hasil =
          db.tambahAksiVerifikasi(
            tersimpan.id,
            tenantId,
            buatAksi('kirim', 0, {
              userId: session.userId,
              name: session.name,
              role: normalisasiPeran(session.role),
            })
          ) || tersimpan;
      }
    }
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Catat Laporan Periodik',
      target: `${kew.nama} — ${periode}`,
      details: `Status: ${status}`,
    });
    res.status(201).json(hasil);
  });

  /**
   * Setujui / minta revisi laporan pada tahap verifikasi yang sedang aktif.
   *
   * Aturan yang ditegakkan server:
   * - Hanya tahap AKTIF yang bisa diselesaikan (tidak boleh melompat).
   * - Peran pengguna harus cocok dengan tahap (admin selalu boleh).
   * - Tahap terakhir yang disetujui menaikkan status menjadi `terverifikasi`.
   * - Revisi mengembalikan status ke `revisi` dan menghapus tahap yang belum
   *   disetujui dari percobaan ini (riwayat tetap tersimpan sebagai jejak).
   */
  app.post('/api/pelaporan/laporan/:id/verifikasi', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const laporan = db.getLaporan(tenantId).find((l) => l.id === req.params.id);
    if (!laporan) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });

    const aksi = req.body?.aksi === 'revisi' ? 'revisi' : 'setujui';
    const catatan = req.body?.catatan ? String(req.body.catatan).trim() : undefined;
    // Minta revisi WAJIB disertai alasan — tanpa itu penyusun tak tahu apa yang
    // harus diperbaiki. Divalidasi sebelum cek status agar pesannya jelas.
    if (aksi === 'revisi' && !catatan) {
      return res.status(400).json({ error: 'Alasan revisi wajib diisi.' });
    }
    const daftarAlur = db.getAlurVerifikasi(tenantId);
    const posisi = hitungPosisi(laporan, daftarAlur);

    if (posisi.tuntas) {
      return res.status(409).json({ error: 'Laporan ini sudah tuntas diverifikasi.' });
    }
    const tahap = posisi.tahapAktif;
    if (!tahap) {
      return res
        .status(409)
        .json({ error: 'Laporan belum dikirim, atau sedang menunggu pengiriman ulang setelah revisi.' });
    }
    if (!bolehMenyetujui(normalisasiPeran(session.role), tahap)) {
      return res.status(403).json({
        error: `Tahap "${tahap.nama}" hanya bisa diselesaikan oleh peran ${LABEL_PERAN[tahap.peran]} (atau admin).`,
      });
    }

    let diperbarui = db.tambahAksiVerifikasi(
      laporan.id,
      tenantId,
      buatAksi(
        aksi,
        tahap.urutan,
        { userId: session.userId, name: session.name, role: normalisasiPeran(session.role) },
        catatan
      )
    );
    if (!diperbarui) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });

    // Perbarui status laporan mengikuti hasil aksi.
    const posisiBaru = hitungPosisi(diperbarui, daftarAlur);
    const statusBaru: StatusLaporan =
      aksi === 'revisi' ? 'revisi' : posisiBaru.tuntas ? 'terverifikasi' : 'terkirim';
    diperbarui = db.updateLaporanStatus(diperbarui.id, tenantId, statusBaru) || diperbarui;

    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: aksi === 'revisi' ? 'Minta Revisi Laporan' : 'Setujui Tahap Verifikasi',
      target: `${laporan.nama} — ${laporan.periode}`,
      details: `Tahap ${tahap.urutan} "${tahap.nama}" (${LABEL_PERAN[tahap.peran]})${
        catatan ? ` — ${catatan}` : ''
      }. Status: ${statusBaru}`,
    });

    res.json({ ...diperbarui, posisiVerifikasi: hitungPosisi(diperbarui, daftarAlur) });
  });

  /** Daftar alur verifikasi instansi (semua peran boleh membaca). */
  app.get('/api/pelaporan/alur', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    res.json({ alur: db.getAlurVerifikasi(tenantId) });
  });

  /** Simpan alur verifikasi (admin-only — ini konfigurasi tata kelola instansi). */
  app.post('/api/pelaporan/alur', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengatur alur verifikasi.')) return;
    const tenantId = effectiveTenantId(req, session);
    const nama = String(req.body?.nama || '').trim();
    if (!nama) return res.status(400).json({ error: 'Nama alur verifikasi wajib diisi.' });
    const galatTahap = validasiAlur(req.body?.tahap);
    if (galatTahap) return res.status(400).json({ error: galatTahap });
    const tahap = (req.body.tahap as any[]).map((t, i) => ({
      urutan: Number(t.urutan) || i + 1,
      nama: String(t.nama).trim(),
      peran: t.peran,
    }));
    const id = req.body?.id ? String(req.body.id) : undefined;
    if (id && !db.getAlurVerifikasi(tenantId).some((a) => a.id === id)) {
      return res.status(404).json({ error: 'Alur verifikasi tidak ditemukan.' });
    }
    const tersimpan = db.simpanAlurVerifikasi({
      id,
      tenantId,
      nama,
      tahap,
      isDefault: req.body?.isDefault === true,
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: id ? 'Ubah Alur Verifikasi' : 'Tambah Alur Verifikasi',
      target: tersimpan.nama,
      details: `${tahap.length} tahap${tersimpan.isDefault ? ' (default)' : ''}`,
    });
    res.status(id ? 200 : 201).json(tersimpan);
  });

  app.delete('/api/pelaporan/alur/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus alur verifikasi.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteAlurVerifikasi(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Alur verifikasi tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Alur Verifikasi',
      target: req.params.id,
      details: 'Laporan yang memakainya kembali ke alur bawaan',
    });
    res.json({ success: true });
  });

  app.delete('/api/pelaporan/laporan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteLaporan(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    res.json({ success: true });
  });

  // ================= TINDAK LANJUT AUDIT (BPK / Inspektorat / BPKP) ROUTES =================

  /**
   * Daftar temuan audit + ringkasan tindak lanjut untuk instansi aktif.
   * Ringkasan DIHITUNG server dari temuan nyata (persentase tindak lanjut = IKU).
   * Filter opsional: `?sumber=` dan `?status=`.
   */
  app.get('/api/audit/temuan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const sumber = typeof req.query.sumber === 'string' ? req.query.sumber : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const temuan = db.getTemuanAudit(tenantId, { sumber, status });
    res.json({ temuan, ringkasan: hitungRingkasanAudit(db.getTemuanAudit(tenantId)) });
  });

  /** Ringkasan saja (dipakai kartu atas tanpa memuat seluruh daftar). */
  app.get('/api/audit/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    res.json(hitungRingkasanAudit(db.getTemuanAudit(tenantId)));
  });

  /** Tambah temuan audit — hanya admin. */
  app.post('/api/audit/temuan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menambah temuan audit.')) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiTemuan(req.body);
    if (galat) return res.status(400).json({ error: galat });
    const statusAwal = normalisasiStatusAudit(req.body?.status);
    const baru = db.createTemuanAudit({
      tenantId,
      sumber: normalisasiSumberAudit(req.body?.sumber),
      nomorLHP: String(req.body.nomorLHP).trim(),
      tanggalLHP: req.body?.tanggalLHP ? new Date(req.body.tanggalLHP).toISOString() : new Date().toISOString(),
      periodePemeriksaan: req.body?.periodePemeriksaan ? String(req.body.periodePemeriksaan).trim() : undefined,
      judul: String(req.body.judul).trim(),
      uraian: req.body?.uraian ? String(req.body.uraian).trim() : undefined,
      nilaiTemuan:
        req.body?.nilaiTemuan !== undefined && req.body?.nilaiTemuan !== null && req.body?.nilaiTemuan !== ''
          ? Number(req.body.nilaiTemuan)
          : undefined,
      rekomendasi: String(req.body.rekomendasi).trim(),
      status: statusAwal,
      batasWaktu: req.body?.batasWaktu ? new Date(req.body.batasWaktu).toISOString() : undefined,
      penanggungJawab: req.body?.penanggungJawab ? String(req.body.penanggungJawab).trim() : undefined,
      alasanTidakLanjut:
        statusAwal === 'tidak_ditindaklanjuti' && req.body?.alasan
          ? String(req.body.alasan).trim()
          : undefined,
      aksiTindakLanjut: [],
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Temuan Audit',
      target: `${baru.nomorLHP} — ${baru.judul}`,
      details: `Sumber: ${baru.sumber}`,
    });
    res.status(201).json(baru);
  });

  /** Ubah temuan audit — hanya admin. Riwayat tindak lanjut tidak ikut berubah. */
  app.patch('/api/audit/temuan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengubah temuan audit.')) return;
    const tenantId = effectiveTenantId(req, session);
    if (!db.getTemuanAuditById(req.params.id, tenantId)) {
      return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });
    }
    const partial: Record<string, unknown> = {};
    if (typeof req.body?.sumber === 'string') partial.sumber = normalisasiSumberAudit(req.body.sumber);
    if (typeof req.body?.nomorLHP === 'string') partial.nomorLHP = req.body.nomorLHP.trim();
    if (typeof req.body?.tanggalLHP === 'string') partial.tanggalLHP = new Date(req.body.tanggalLHP).toISOString();
    if (typeof req.body?.periodePemeriksaan === 'string') partial.periodePemeriksaan = req.body.periodePemeriksaan.trim();
    if (typeof req.body?.judul === 'string') partial.judul = req.body.judul.trim();
    if (typeof req.body?.uraian === 'string') partial.uraian = req.body.uraian.trim();
    if (typeof req.body?.rekomendasi === 'string') partial.rekomendasi = req.body.rekomendasi.trim();
    if (typeof req.body?.penanggungJawab === 'string') partial.penanggungJawab = req.body.penanggungJawab.trim();
    if (typeof req.body?.batasWaktu === 'string') {
      partial.batasWaktu = req.body.batasWaktu ? new Date(req.body.batasWaktu).toISOString() : undefined;
    }
    if (req.body?.nilaiTemuan !== undefined) {
      partial.nilaiTemuan =
        req.body.nilaiTemuan === null || req.body.nilaiTemuan === '' ? undefined : Number(req.body.nilaiTemuan);
    }
    const updated = db.updateTemuanAudit(req.params.id, tenantId, partial);
    if (!updated) return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah Temuan Audit',
      target: `${updated.nomorLHP} — ${updated.judul}`,
      details: `Field: ${Object.keys(partial).join(', ') || '(tidak ada)'}`,
    });
    res.json(updated);
  });

  /** Hapus temuan audit (beserta riwayat tindak lanjutnya) — hanya admin. */
  app.delete('/api/audit/temuan/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus temuan audit.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ada = db.getTemuanAuditById(req.params.id, tenantId);
    if (!ada) return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });
    const ok = db.deleteTemuanAudit(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Temuan Audit',
      target: `${ada.nomorLHP} — ${ada.judul}`,
      details: `Riwayat tindak lanjut (${ada.aksiTindakLanjut.length} aksi) ikut dihapus`,
    });
    res.json({ success: true });
  });

  /**
   * Catat satu aksi tindak lanjut pada temuan.
   *
   * Boleh `analis` (bukan hanya admin) — ini pekerjaan operasional. Aturan yang
   * ditegakkan: uraian wajib; status `selesai`/`tidak_ditindaklanjuti` hanya sah
   * bila ada aksi; `tidak_ditindaklanjuti` wajib alasan.
   */
  app.post('/api/audit/temuan/:id/tindak-lanjut', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const temuan = db.getTemuanAuditById(req.params.id, tenantId);
    if (!temuan) return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });

    const galat = validasiAksiAudit(req.body);
    if (galat) return res.status(400).json({ error: galat });
    const statusSesudah = normalisasiStatusAudit(req.body?.statusSesudah);
    const alasan = req.body?.alasan ? String(req.body.alasan).trim() : undefined;
    if (statusSesudah === 'tidak_ditindaklanjuti' && !alasan) {
      return res.status(400).json({ error: 'Alasan wajib diisi bila temuan dinyatakan tidak dapat ditindaklanjuti.' });
    }

    const aksi = buatAksiTindakLanjut(
      { uraian: String(req.body.uraian), tanggal: req.body?.tanggal, bukti: req.body?.bukti },
      { userId: session.userId, name: session.name },
      statusSesudah
    );
    const diperbarui = db.tambahAksiTindakLanjut(req.params.id, tenantId, aksi, {
      alasanTidakLanjut: statusSesudah === 'tidak_ditindaklanjuti' ? alasan : undefined,
    });
    if (!diperbarui) return res.status(404).json({ error: 'Temuan audit tidak ditemukan.' });

    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Catat Tindak Lanjut Audit',
      target: `${temuan.nomorLHP} — ${temuan.judul}`,
      details: `Status → ${statusSesudah}`,
    });
    res.status(201).json(diperbarui);
  });

  // ================= MANAJEMEN RISIKO ROUTES =================
  /**
   * Daftar risiko instansi aktif + ringkasan (termasuk heat map 5×5).
   * Skor & level DIHITUNG server dari kemungkinan × dampak — nilai dari klien
   * tidak pernah dipercaya (prinsip sama dengan rasio kesehatan keuangan).
   */
  app.get('/api/risiko', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kategori = typeof req.query.kategori === 'string' ? req.query.kategori : undefined;
    const level = typeof req.query.level === 'string' ? req.query.level : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const daftar = db.getRisiko(tenantId, { kategori, level, status });
    res.json({ risiko: daftar, ringkasan: hitungRingkasanRisiko(db.getRisiko(tenantId)) });
  });

  /** Ringkasan risiko saja (kartu atas tanpa memuat seluruh register). */
  app.get('/api/risiko/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    res.json(hitungRingkasanRisiko(db.getRisiko(tenantId)));
  });

  /** Tambah risiko — hanya admin (penetapan kebijakan risiko). */
  app.post('/api/risiko', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menambah risiko.')) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiRisiko(req.body);
    if (galat) return res.status(400).json({ error: galat });

    // Skor & level DIHITUNG server; nilai kiriman klien (skor/level) diabaikan.
    const kemungkinan = Math.max(1, Math.min(5, Math.round(Number(req.body.kemungkinan))));
    const dampak = Math.max(1, Math.min(5, Math.round(Number(req.body.dampak))));
    const skor = hitungSkorRisiko(kemungkinan, dampak);
    const statusAwal = normalisasiStatusRisiko(req.body?.status);

    const baru = db.createRisiko({
      tenantId,
      kode: String(req.body.kode).trim(),
      kategori: normalisasiKategoriRisiko(req.body?.kategori),
      pernyataan: String(req.body.pernyataan).trim(),
      penyebab: req.body?.penyebab ? String(req.body.penyebab).trim() : undefined,
      dampakUraian: req.body?.dampakUraian ? String(req.body.dampakUraian).trim() : undefined,
      sasaran: req.body?.sasaran ? String(req.body.sasaran).trim() : undefined,
      kemungkinan,
      dampak,
      skor,
      level: levelDariSkor(skor),
      status: statusAwal,
      pemilikRisiko: req.body?.pemilikRisiko ? String(req.body.pemilikRisiko).trim() : undefined,
      rencanaMitigasi: req.body?.rencanaMitigasi ? String(req.body.rencanaMitigasi).trim() : undefined,
      batasWaktu: req.body?.batasWaktu ? new Date(req.body.batasWaktu).toISOString() : undefined,
      levelResidual: normalisasiLevel(req.body?.levelResidual),
      aksiMitigasi: [],
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Risiko',
      target: `${baru.kode} — ${baru.pernyataan.slice(0, 80)}`,
      details: `Kategori: ${baru.kategori}, skor ${baru.skor} (${baru.level})`,
    });
    res.status(201).json(baru);
  });

  /** Ubah risiko — hanya admin. Riwayat mitigasi tidak ikut berubah. */
  app.patch('/api/risiko/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengubah risiko.')) return;
    const tenantId = effectiveTenantId(req, session);
    const lama = db.getRisikoById(req.params.id, tenantId);
    if (!lama) return res.status(404).json({ error: 'Risiko tidak ditemukan.' });

    const patch: Record<string, unknown> = {};
    if (req.body?.kode !== undefined) patch.kode = String(req.body.kode).trim();
    if (req.body?.pernyataan !== undefined) patch.pernyataan = String(req.body.pernyataan).trim();
    if (req.body?.kategori !== undefined) patch.kategori = normalisasiKategoriRisiko(req.body.kategori);
    if (req.body?.penyebab !== undefined) patch.penyebab = req.body.penyebab ? String(req.body.penyebab).trim() : undefined;
    if (req.body?.dampakUraian !== undefined) patch.dampakUraian = req.body.dampakUraian ? String(req.body.dampakUraian).trim() : undefined;
    if (req.body?.sasaran !== undefined) patch.sasaran = req.body.sasaran ? String(req.body.sasaran).trim() : undefined;
    if (req.body?.pemilikRisiko !== undefined) patch.pemilikRisiko = req.body.pemilikRisiko ? String(req.body.pemilikRisiko).trim() : undefined;
    if (req.body?.rencanaMitigasi !== undefined) patch.rencanaMitigasi = req.body.rencanaMitigasi ? String(req.body.rencanaMitigasi).trim() : undefined;
    if (req.body?.batasWaktu !== undefined) patch.batasWaktu = req.body.batasWaktu ? new Date(req.body.batasWaktu).toISOString() : undefined;
    if (req.body?.status !== undefined) patch.status = normalisasiStatusRisiko(req.body.status);
    if (req.body?.levelResidual !== undefined) patch.levelResidual = normalisasiLevel(req.body.levelResidual);

    // Skor & level dihitung ulang bila skala berubah (walau hanya salah satu).
    if (req.body?.kemungkinan !== undefined || req.body?.dampak !== undefined) {
      const kemungkinan = Math.max(1, Math.min(5, Math.round(Number(req.body?.kemungkinan ?? lama.kemungkinan))));
      const dampak = Math.max(1, Math.min(5, Math.round(Number(req.body?.dampak ?? lama.dampak))));
      const skor = hitungSkorRisiko(kemungkinan, dampak);
      patch.kemungkinan = kemungkinan;
      patch.dampak = dampak;
      patch.skor = skor;
      patch.level = levelDariSkor(skor);
    }

    const diperbarui = db.updateRisiko(req.params.id, tenantId, patch);
    if (!diperbarui) return res.status(404).json({ error: 'Risiko tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah Risiko',
      target: `${diperbarui.kode}`,
      details: `Perubahan: ${Object.keys(patch).join(', ')}`,
    });
    res.json(diperbarui);
  });

  /** Hapus risiko — hanya admin. */
  app.delete('/api/risiko/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus risiko.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteRisiko(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Risiko tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Risiko',
      target: req.params.id,
      details: 'Risiko dihapus dari register',
    });
    res.json({ success: true });
  });

  /**
   * Catat satu aksi mitigasi pada risiko.
   * Boleh `analis` (pekerjaan operasional), sama seperti tindak lanjut audit.
   * Aturan: uraian wajib; `ditutup` wajib alasan.
   */
  app.post('/api/risiko/:id/mitigasi', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const risiko = db.getRisikoById(req.params.id, tenantId);
    if (!risiko) return res.status(404).json({ error: 'Risiko tidak ditemukan.' });

    const galat = validasiAksiMitigasi(req.body);
    if (galat) return res.status(400).json({ error: galat });
    const statusSesudah = normalisasiStatusRisiko(req.body?.statusSesudah);
    const alasan = req.body?.alasan ? String(req.body.alasan).trim() : undefined;
    if (statusSesudah === 'ditutup' && !alasan) {
      return res.status(400).json({ error: 'Alasan wajib diisi bila risiko ditutup.' });
    }

    const aksi = buatAksiMitigasi(
      { uraian: String(req.body.uraian), tanggal: req.body?.tanggal, bukti: req.body?.bukti },
      { userId: session.userId, name: session.name },
      statusSesudah,
      normalisasiLevel(req.body?.levelResidual)
    );
    const diperbarui = db.tambahAksiMitigasi(req.params.id, tenantId, aksi, {
      rencanaMitigasi: req.body?.rencanaMitigasi !== undefined
        ? (req.body.rencanaMitigasi ? String(req.body.rencanaMitigasi).trim() : undefined)
        : undefined,
    });
    if (!diperbarui) return res.status(404).json({ error: 'Risiko tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Catat Mitigasi Risiko',
      target: `${risiko.kode} — ${risiko.pernyataan.slice(0, 60)}`,
      details: `Status → ${statusSesudah}`,
    });
    res.status(201).json(diperbarui);
  });

  // ================= MANAJEMEN ASET ROUTES =================
  /**
   * Daftar aset instansi aktif + ringkasan (nilai buku, penyusutan, kondisi).
   * Nilai buku & akumulasi penyusutan DIHITUNG server (metode garis lurus);
   * angka dari klien tidak pernah dipercaya.
   */
  app.get('/api/aset', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const kategori = typeof req.query.kategori === 'string' ? req.query.kategori : undefined;
    const kondisi = typeof req.query.kondisi === 'string' ? req.query.kondisi : undefined;
    const pemanfaatan = typeof req.query.pemanfaatan === 'string' ? req.query.pemanfaatan : undefined;
    const tahun = Number(req.query.tahun) || new Date().getFullYear();
    const daftar = db.getAset(tenantId, { kategori, kondisi, pemanfaatan });
    // Lampirkan nilai buku & akumulasi penyusutan yang dihitung server.
    const diperkaya = daftar.map((a) => ({
      ...a,
      nilaiBuku: nilaiBuku(a, tahun),
      akumulasiPenyusutan: akumulasiPenyusutan(a, tahun),
    }));
    res.json({
      aset: diperkaya,
      ringkasan: hitungRingkasanAset(db.getAset(tenantId), tahun),
    });
  });

  /** Ringkasan aset saja (kartu atas tanpa memuat seluruh daftar). */
  app.get('/api/aset/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const tahun = Number(req.query.tahun) || new Date().getFullYear();
    res.json(hitungRingkasanAset(db.getAset(tenantId), tahun));
  });

  /** Tambah aset — hanya admin (kebijakan pencatatan aset). */
  app.post('/api/aset', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menambah aset.')) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiAset(req.body);
    if (galat) return res.status(400).json({ error: galat });

    const baru = db.createAset({
      tenantId,
      kode: String(req.body.kode).trim(),
      nama: String(req.body.nama).trim(),
      kategori: normalisasiKategoriAset(req.body?.kategori),
      lokasi: req.body?.lokasi ? String(req.body.lokasi).trim() : undefined,
      tahunPerolehan: Math.round(Number(req.body.tahunPerolehan)),
      nilaiPerolehan: Number(req.body.nilaiPerolehan),
      umurEkonomis: Math.round(Number(req.body.umurEkonomis)),
      nilaiResidu: Number(req.body.nilaiResidu ?? 0),
      kondisi: normalisasiKondisi(req.body?.kondisi),
      pemanfaatan: normalisasiPemanfaatan(req.body?.pemanfaatan),
      catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Aset',
      target: `${baru.kode} — ${baru.nama}`,
      details: `Kategori: ${baru.kategori}, perolehan Rp${baru.nilaiPerolehan.toLocaleString('id-ID')}`,
    });
    res.status(201).json({ ...baru, nilaiBuku: nilaiBuku(baru), akumulasiPenyusutan: akumulasiPenyusutan(baru) });
  });

  /** Ubah aset — hanya admin. Nilai buku dihitung ulang dari field mentah. */
  app.patch('/api/aset/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengubah aset.')) return;
    const tenantId = effectiveTenantId(req, session);
    const lama = db.getAsetById(req.params.id, tenantId);
    if (!lama) return res.status(404).json({ error: 'Aset tidak ditemukan.' });

    const patch: Record<string, unknown> = {};
    if (req.body?.kode !== undefined) patch.kode = String(req.body.kode).trim();
    if (req.body?.nama !== undefined) patch.nama = String(req.body.nama).trim();
    if (req.body?.kategori !== undefined) patch.kategori = normalisasiKategoriAset(req.body.kategori);
    if (req.body?.lokasi !== undefined) patch.lokasi = req.body.lokasi ? String(req.body.lokasi).trim() : undefined;
    if (req.body?.tahunPerolehan !== undefined) patch.tahunPerolehan = Math.round(Number(req.body.tahunPerolehan));
    if (req.body?.nilaiPerolehan !== undefined) patch.nilaiPerolehan = Number(req.body.nilaiPerolehan);
    if (req.body?.umurEkonomis !== undefined) patch.umurEkonomis = Math.round(Number(req.body.umurEkonomis));
    if (req.body?.nilaiResidu !== undefined) patch.nilaiResidu = Number(req.body.nilaiResidu);
    if (req.body?.kondisi !== undefined) patch.kondisi = normalisasiKondisi(req.body.kondisi);
    if (req.body?.pemanfaatan !== undefined) patch.pemanfaatan = normalisasiPemanfaatan(req.body.pemanfaatan);
    if (req.body?.catatan !== undefined) patch.catatan = req.body.catatan ? String(req.body.catatan).trim() : undefined;

    // Validasi gabungan supaya residu tidak melebihi perolehan setelah patch.
    const gabungan = { ...lama, ...patch };
    const galat = validasiAset(gabungan);
    if (galat) return res.status(400).json({ error: galat });

    const diperbarui = db.updateAset(req.params.id, tenantId, patch);
    if (!diperbarui) return res.status(404).json({ error: 'Aset tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah Aset',
      target: `${diperbarui.kode}`,
      details: `Perubahan: ${Object.keys(patch).join(', ') || '(tidak ada)'}`,
    });
    res.json({ ...diperbarui, nilaiBuku: nilaiBuku(diperbarui), akumulasiPenyusutan: akumulasiPenyusutan(diperbarui) });
  });

  /** Hapus aset — hanya admin. */
  app.delete('/api/aset/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus aset.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteAset(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Aset tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Aset',
      target: req.params.id,
      details: 'Aset dihapus dari daftar',
    });
    res.json({ success: true });
  });

  // ================= PERJANJIAN KINERJA ROUTES =================
  /**
   * Daftar Perjanjian Kinerja instansi aktif + ringkasan.
   * Persentase capaian DIHITUNG server dari target & realisasi — nilai capaian
   * dari klien tidak pernah dipercaya.
   */
  app.get('/api/perjanjian-kinerja', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const periode = typeof req.query.periode === 'string' ? req.query.periode : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const daftar = db.getPerjanjianKinerja(tenantId, { periode, status });
    res.json({ perjanjianKinerja: daftar, ringkasan: hitungRingkasanPK(db.getPerjanjianKinerja(tenantId)) });
  });

  /** Ringkasan PK saja (kartu atas tanpa memuat seluruh dokumen). */
  app.get('/api/perjanjian-kinerja/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    res.json(hitungRingkasanPK(db.getPerjanjianKinerja(tenantId)));
  });

  /** Tambah Perjanjian Kinerja — hanya admin (dokumen komitmen pejabat). */
  app.post('/api/perjanjian-kinerja', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh membuat Perjanjian Kinerja.')) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiPerjanjianKinerja(req.body);
    if (galat) return res.status(400).json({ error: galat });

    // Validasi + bangun indikator (kalau ada).
    const indikatorInput = Array.isArray(req.body.indikator) ? req.body.indikator : [];
    for (const ind of indikatorInput) {
      const g = validasiIndikator(ind);
      if (g) return res.status(400).json({ error: g });
    }

    const baru = db.createPerjanjianKinerja({
      tenantId,
      nomor: String(req.body.nomor).trim(),
      periode: String(req.body.periode).trim(),
      pihakPertama: req.body?.pihakPertama ? String(req.body.pihakPertama).trim() : '',
      jabatanPertama: req.body?.jabatanPertama ? String(req.body.jabatanPertama).trim() : '',
      pihakKedua: String(req.body.pihakKedua).trim(),
      jabatanKedua: req.body?.jabatanKedua ? String(req.body.jabatanKedua).trim() : '',
      tanggal: req.body?.tanggal ? new Date(req.body.tanggal).toISOString() : new Date().toISOString(),
      status: normalisasiStatusPK(req.body?.status),
      indikator: indikatorInput.map((i: any) => buatIndikator(i)),
      catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Perjanjian Kinerja',
      target: `${baru.nomor} — ${baru.pihakKedua}`,
      details: `Periode ${baru.periode}, ${baru.indikator.length} indikator`,
    });
    res.status(201).json(baru);
  });

  /** Ubah Perjanjian Kinerja — hanya admin. */
  app.patch('/api/perjanjian-kinerja/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengubah Perjanjian Kinerja.')) return;
    const tenantId = effectiveTenantId(req, session);
    const lama = db.getPerjanjianKinerjaById(req.params.id, tenantId);
    if (!lama) return res.status(404).json({ error: 'Perjanjian Kinerja tidak ditemukan.' });

    const patch: Record<string, unknown> = {};
    if (req.body?.nomor !== undefined) patch.nomor = String(req.body.nomor).trim();
    if (req.body?.periode !== undefined) patch.periode = String(req.body.periode).trim();
    if (req.body?.pihakPertama !== undefined) patch.pihakPertama = req.body.pihakPertama ? String(req.body.pihakPertama).trim() : '';
    if (req.body?.jabatanPertama !== undefined) patch.jabatanPertama = req.body.jabatanPertama ? String(req.body.jabatanPertama).trim() : '';
    if (req.body?.pihakKedua !== undefined) patch.pihakKedua = String(req.body.pihakKedua).trim();
    if (req.body?.jabatanKedua !== undefined) patch.jabatanKedua = req.body.jabatanKedua ? String(req.body.jabatanKedua).trim() : '';
    if (req.body?.tanggal !== undefined) patch.tanggal = req.body.tanggal ? new Date(req.body.tanggal).toISOString() : lama.tanggal;
    if (req.body?.status !== undefined) {
      if (normalisasiStatusPK(req.body.status) !== req.body.status) {
        return res.status(400).json({ error: `Status "${req.body.status}" tidak dikenal.` });
      }
      patch.status = req.body.status;
    }
    if (req.body?.catatan !== undefined) patch.catatan = req.body.catatan ? String(req.body.catatan).trim() : undefined;
    if (Array.isArray(req.body?.indikator)) {
      for (const ind of req.body.indikator) {
        const g = validasiIndikator(ind);
        if (g) return res.status(400).json({ error: g });
      }
      patch.indikator = req.body.indikator.map((i: any) => buatIndikator(i));
    }

    const diperbarui = db.updatePerjanjianKinerja(req.params.id, tenantId, patch);
    if (!diperbarui) return res.status(404).json({ error: 'Perjanjian Kinerja tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah Perjanjian Kinerja',
      target: `${diperbarui.nomor}`,
      details: `Perubahan: ${Object.keys(patch).join(', ') || '(tidak ada)'}`,
    });
    res.json(diperbarui);
  });

  /** Hapus Perjanjian Kinerja — hanya admin. */
  app.delete('/api/perjanjian-kinerja/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus Perjanjian Kinerja.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deletePerjanjianKinerja(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Perjanjian Kinerja tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Perjanjian Kinerja',
      target: req.params.id,
      details: 'Dokumen dihapus',
    });
    res.json({ success: true });
  });

  /**
   * Catat realisasi/capaian satu indikator dalam Perjanjian Kinerja.
   * Boleh `analis` (pekerjaan operasional — pengumpulan data capaian),
   * sama seperti pencatatan laporan & tindak lanjut.
   */
  app.post('/api/perjanjian-kinerja/:id/realisasi', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const pk = db.getPerjanjianKinerjaById(req.params.id, tenantId);
    if (!pk) return res.status(404).json({ error: 'Perjanjian Kinerja tidak ditemukan.' });

    const indikatorId = String(req.body?.indikatorId || '').trim();
    const idx = pk.indikator.findIndex((i) => i.id === indikatorId);
    if (idx === -1) return res.status(404).json({ error: 'Indikator tidak ditemukan dalam dokumen ini.' });

    const realisasi = Number(req.body?.realisasi);
    if (!Number.isFinite(realisasi) || realisasi < 0) {
      return res.status(400).json({ error: 'Realisasi harus angka tidak negatif.' });
    }

    const indikatorBaru = pk.indikator.map((i, k) =>
      k === idx
        ? {
            ...i,
            realisasi,
            catatanRealisasi: req.body?.catatanRealisasi
              ? String(req.body.catatanRealisasi).trim()
              : i.catatanRealisasi,
          }
        : i
    );
    const diperbarui = db.updatePerjanjianKinerja(req.params.id, tenantId, { indikator: indikatorBaru });
    if (!diperbarui) return res.status(404).json({ error: 'Perjanjian Kinerja tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Catat Realisasi Kinerja',
      target: `${pk.nomor} — ${pk.indikator[idx].indikator}`,
      details: `Realisasi: ${realisasi} ${pk.indikator[idx].satuan}`,
    });
    res.status(201).json(diperbarui);
  });

  // ================= LKjIP ROUTES =================
  /**
   * Daftar LKjIP instansi aktif + ringkasan. Capaian DIHITUNG dari indikator
   * Perjanjian Kinerja yang ditautkan — bukan diketik ulang di laporan.
   */
  app.get('/api/lkjip', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const periode = typeof req.query.periode === 'string' ? req.query.periode : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const daftar = db.getLKjIP(tenantId, { periode, status });
    const semuaPK = db.getPerjanjianKinerja(tenantId);
    // Lampirkan ringkasan capaian tertaut + info PK tertaut agar UI bisa tampil.
    const diperkaya = daftar.map((l) => ({
      ...l,
      capaianTertaut: ringkasIndikatorTertaut(l, semuaPK),
      pkTertaut: semuaPK
        .filter((p) => l.perjanjianKinerjaIds.includes(p.id))
        .map((p) => ({ id: p.id, nomor: p.nomor, periode: p.periode, status: p.status, jumlahIndikator: p.indikator.length })),
    }));
    res.json({ lkjip: diperkaya, ringkasan: hitungRingkasanLKjIP(daftar, semuaPK) });
  });

  /** Ringkasan LKjIP saja (kartu atas). */
  app.get('/api/lkjip/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    res.json(hitungRingkasanLKjIP(db.getLKjIP(tenantId), db.getPerjanjianKinerja(tenantId)));
  });

  /** Tambah LKjIP — hanya admin (dokumen pelaporan pejabat). */
  app.post('/api/lkjip', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh membuat LKjIP.')) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiLKjIP(req.body);
    if (galat) return res.status(400).json({ error: galat });

    const bagianInput = Array.isArray(req.body.bagian) ? req.body.bagian : [];
    for (const b of bagianInput) {
      const g = validasiBagian(b);
      if (g) return res.status(400).json({ error: g });
    }

    // Hanya tautkan PK yang memang milik instansi ini.
    const pkIds = Array.isArray(req.body.perjanjianKinerjaIds) ? req.body.perjanjianKinerjaIds.map((x: any) => String(x)) : [];
    const pkValid = pkIds.filter((id: string) => !!db.getPerjanjianKinerjaById(id, tenantId));

    const baru = db.createLKjIP({
      tenantId,
      periode: String(req.body.periode).trim(),
      nomor: String(req.body.nomor).trim(),
      judul: String(req.body.judul).trim(),
      status: normalisasiStatusLKjIP(req.body?.status),
      tanggal: req.body?.tanggal ? new Date(req.body.tanggal).toISOString() : new Date().toISOString(),
      ringkasanEksekutif: req.body?.ringkasanEksekutif ? String(req.body.ringkasanEksekutif).trim() : '',
      bagian: bagianInput.map((b: any) => buatBagian(b)),
      perjanjianKinerjaIds: pkValid,
    });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah LKjIP',
      target: `${baru.nomor} — ${baru.judul}`,
      details: `Periode ${baru.periode}, ${baru.bagian.length} bagian, ${pkValid.length} PK tertaut`,
    });
    res.status(201).json(baru);
  });

  /** Ubah LKjIP — hanya admin. */
  app.patch('/api/lkjip/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh mengubah LKjIP.')) return;
    const tenantId = effectiveTenantId(req, session);
    const lama = db.getLKjIPById(req.params.id, tenantId);
    if (!lama) return res.status(404).json({ error: 'LKjIP tidak ditemukan.' });

    const patch: Record<string, unknown> = {};
    if (req.body?.periode !== undefined) patch.periode = String(req.body.periode).trim();
    if (req.body?.nomor !== undefined) patch.nomor = String(req.body.nomor).trim();
    if (req.body?.judul !== undefined) patch.judul = String(req.body.judul).trim();
    if (req.body?.status !== undefined) {
      if (normalisasiStatusLKjIP(req.body.status) !== req.body.status) {
        return res.status(400).json({ error: `Status "${req.body.status}" tidak dikenal.` });
      }
      patch.status = req.body.status;
    }
    if (req.body?.tanggal !== undefined) patch.tanggal = req.body.tanggal ? new Date(req.body.tanggal).toISOString() : lama.tanggal;
    if (req.body?.ringkasanEksekutif !== undefined) patch.ringkasanEksekutif = String(req.body.ringkasanEksekutif || '').trim();
    if (Array.isArray(req.body?.bagian)) {
      for (const b of req.body.bagian) {
        const g = validasiBagian(b);
        if (g) return res.status(400).json({ error: g });
      }
      patch.bagian = req.body.bagian.map((b: any) => buatBagian(b));
    }
    if (Array.isArray(req.body?.perjanjianKinerjaIds)) {
      const pkIds = req.body.perjanjianKinerjaIds.map((x: any) => String(x));
      patch.perjanjianKinerjaIds = pkIds.filter((id: string) => !!db.getPerjanjianKinerjaById(id, tenantId));
    }

    const diperbarui = db.updateLKjIP(req.params.id, tenantId, patch);
    if (!diperbarui) return res.status(404).json({ error: 'LKjIP tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Ubah LKjIP',
      target: `${diperbarui.nomor}`,
      details: `Perubahan: ${Object.keys(patch).join(', ') || '(tidak ada)'}`,
    });
    res.json(diperbarui);
  });

  /** Hapus LKjIP — hanya admin. */
  app.delete('/api/lkjip/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus LKjIP.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteLKjIP(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'LKjIP tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus LKjIP',
      target: req.params.id,
      details: 'Dokumen LKjIP dihapus',
    });
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
    const cakupanAll = session.role === 'admin' && String(req.query.cakupan || '') === 'all';
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

    const galatMeta = validasiMetadata({
      judul: req.body?.judul || nama,
      kategori: req.body?.kategori,
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
        judul: String(req.body?.judul || nama).trim(),
        kategori: String(req.body?.kategori).trim(),
        organizationId,
        tipeRepositori: req.body?.tipeRepositori === 'photo' ? 'photo' : 'document',
        tahun: req.body?.tahun !== undefined && req.body?.tahun !== '' ? Number(req.body.tahun) : undefined,
        departemen: req.body?.departemen ? String(req.body.departemen).trim() : undefined,
        catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
        mimeType: req.body?.tipe ? String(req.body.tipe) : undefined,
      });
      const kbTujuan = (await daftarProjectKms().catch(() => [])).find((o) => o.id === organizationId)?.knowledgeBase;
      db.addAuditLog({
        tenantId: tenant?.id || session.tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Unggah Berkas',
        target: String(req.body?.judul || nama),
        details: `Berkas ${nama} (${(isi.length / 1024).toFixed(0)} KB) diunggah ke project KMS ${organizationId}${kbTujuan ? ` · KB ${kbTujuan}` : ''}${berkas?.cdnFileId ? ` · CDN ${berkas.cdnFileId}` : ''}${berkas?.ragStatus ? ` · status RAG: ${berkas.ragStatus}` : ''}`,
      });
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
      db.addAuditLog({
        tenantId: tenant?.id || session.tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Hapus Berkas',
        target: req.params.id,
        details: `Berkas ${req.params.id} dihapus dari repositori KMS ${organizationId} (beserta CDN & RAG)`,
      });
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
    if (session.role !== 'admin') {
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
      db.addAuditLog({
        tenantId: tenant.id,
        userId: session.userId,
        userName: session.name,
        action: dibuat ? 'Buat Repositori Dokumen' : 'Hubungkan Repositori Dokumen',
        target: tenant.name,
        details: `Instansi ${tenant.name} → project KMS ${org.id}${basisBaru ? ` (basis ${basisBaru})` : ''}${
          basisDiselaraskan ? ' · project diselaraskan ke basis dokumen instansi' : ''
        }`,
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh melihat daftar project KMS.')) return;
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh menguji koneksi KMS.')) return;
    const hasil = await klienKms().uji();
    res.status(hasil.ok ? 200 : 502).json(hasil);
  });

  // ================= KESEHATAN KEUANGAN & RASIO ROUTES =================
  /**
   * Ambil data kesehatan keuangan instansi aktif: snapshot terbaru + sebelumnya,
   * delta tiap rasio, dan daftar periode. Rasio DIHITUNG server dari komponen
   * yang tersimpan — nilai rasio dari klien tidak pernah dipercaya.
   */
  app.get('/api/keuangan/ringkasan', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const semua = db.getSnapshotKeuangan(tenantId);
    res.json(ringkasKeuangan(semua));
  });

  /** Daftar snapshot (opsional satu periode) + rasio terhitung per snapshot. */
  app.get('/api/keuangan/snapshot', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const periode = typeof req.query.periode === 'string' ? req.query.periode : undefined;
    const daftar = db.getSnapshotKeuangan(tenantId, periode);
    res.json({ snapshot: daftar, periodeTersedia: urutPeriodeTerbaru(daftar.map((s) => s.periode)) });
  });

  /**
   * Tarik komponen keuangan (neraca + laba rugi) dari dokumen lewat RAG.
   *
   * TIDAK menyimpan apa pun — mengembalikan usulan angka + sitasi supaya admin
   * bisa memeriksa/mengoreksi sebelum menyimpan. Angka yang tidak ada di dokumen
   * dibiarkan kosong (bukan 0). Hanya admin (pemegang konfigurasi RAG).
   */
  app.post('/api/keuangan/ekstrak', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menarik data keuangan dari dokumen.')) return;
    const tenantId = effectiveTenantId(req, session);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const periode = req.body?.periode ? String(req.body.periode).trim() : '';
    if (!periode) return res.status(400).json({ error: 'Periode wajib diisi (contoh: 2026-Q1).' });
    const kbId = kbUntukInstansi(tenant, db.systemConfig.ragKnowledgeBaseId) || undefined;
    try {
      const hasil = await ragClient.ekstrakKomponenKeuangan(
        periode,
        tenant?.name,
        (tenant?.sector || 'aneka_usaha') as BumdSector,
        kbId
      );
      if (!hasil) {
        return res.status(503).json({
          error: 'Layanan RAG tidak aktif atau tidak bisa dihubungi. Aktifkan provider HTTP di panel admin.',
        });
      }
      // Hitung rasio sebagai PRATINJAU (belum disimpan) supaya admin melihat dampaknya.
      const komponen = normalisasiKomponen(hasil.komponen);
      const rasio = hitungRasio(komponen, tenant?.sector);
      res.json({
        periode,
        periodeLabel: hasil.periodeLabel || labelPeriodeKeuangan(periode),
        komponen,
        sitasi: hasil.sitasi,
        rasio,
        skorKesehatan: hitungSkorKesehatan(rasio),
        catatan: hasil.catatan,
      });
    } catch (err) {
      res.status(502).json({
        error: `Gagal menarik data keuangan: ${err instanceof Error ? err.message : 'kesalahan tidak dikenal'}`,
      });
    }
  });

  /**
   * Simpan snapshot kesehatan keuangan satu periode (idempoten per periode).
   * Rasio DIHITUNG ULANG server dari komponen — angka rasio dari klien diabaikan.
   * Boleh analis & admin (input data), sesuai pola modul pelaporan.
   */
  app.post('/api/keuangan/snapshot', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const galat = validasiSnapshot(req.body);
    if (galat) return res.status(400).json({ error: galat });
    const tenant = db.tenants.find((t) => t.id === tenantId);
    const periode = String(req.body.periode).trim();
    const komponen = normalisasiKomponen(req.body.komponen);
    const sitasi = normalisasiSitasi(req.body.sitasi);
    const snapshot = lengkapiSnapshot(
      {
        tenantId,
        periode,
        periodeLabel: req.body?.periodeLabel
          ? String(req.body.periodeLabel).trim()
          : labelPeriodeKeuangan(periode),
        komponen,
        sitasi,
        catatan: req.body?.catatan ? String(req.body.catatan).trim() : undefined,
        disusunOleh: session.name,
      },
      tenant?.sector
    );
    const disimpan = db.catatSnapshotKeuangan(snapshot);
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Simpan Kesehatan Keuangan',
      target: `Periode ${disimpan.periode}`,
      details: `Skor ${disimpan.skorKesehatan ?? '—'} · ${disimpan.rasio.filter((r) => r.nilai !== null).length} rasio terhitung`,
    });
    res.status(201).json(disimpan);
  });

  /** Hapus snapshot satu periode — hanya admin. */
  app.delete('/api/keuangan/snapshot/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya admin yang boleh menghapus snapshot keuangan.')) return;
    const tenantId = effectiveTenantId(req, session);
    const ok = db.deleteSnapshotKeuangan(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Snapshot keuangan tidak ditemukan.' });
    db.addAuditLog({
      tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Kesehatan Keuangan',
      target: req.params.id,
      details: 'Snapshot kesehatan keuangan dihapus',
    });
    res.json({ ok: true });
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
    const session = requireAuth(req, res);
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
  app.post('/api/impor/widget', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
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
      db.addAuditLog({
        tenantId: effectiveTenantId(req, session),
        userId: session.userId,
        userName: session.name,
        action: 'Impor Data Excel/CSV',
        target: widget.title,
        details: `Berkas "${tabel.namaSheet}" → ${widget.type}, ${tabel.baris.length} baris.`,
      });
      return res.json({ widget: sah.data, peringatan, baris: tabel.baris.length, namaSheet: tabel.namaSheet });
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
    const session = requireAuth(req, res);
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
    db.addAuditLog({
      tenantId: dash.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Buat Tautan Bagikan',
      target: dash.title,
      details: `Mode ${mode}, berlaku ${hari === 0 ? 'tanpa batas' : `${hari} hari`} (${expiresAt || '-'}).`,
    });
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
    const session = requireAuth(req, res);
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
    db.addAuditLog({
      tenantId: dash.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Cabut Tautan Bagikan',
      target: dash.title,
      details: `Tautan ${token} dicabut (mode ${(typeof meta === 'object' && meta.mode) || 'readonly'}).`,
    });
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
    let rincian = '';
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
      const idSebelum = new Set(dash.widgets.map((w) => w.id));
      const idSesudah = new Set(kandidat.map((w) => w.id));
      const ditambah = [...idSesudah].filter((id) => !idSebelum.has(id)).length;
      const dihapus = [...idSebelum].filter((id) => !idSesudah.has(id)).length;
      rincian = [
        ditambah > 0 ? `+${ditambah} ditambah` : null,
        dihapus > 0 ? `-${dihapus} dihapus` : null,
      ]
        .filter(Boolean)
        .join(', ');
      sah = kandidat;
    }

    const updated = db.updateDashboard(
      dashId,
      { widgets: sah, ...(judulBaru !== undefined ? { title: judulBaru.trim() } : {}) },
      dash.tenantId
    );
    if (!updated) return res.status(500).json({ error: 'Gagal menyimpan perubahan.' });
    db.auditLogs.unshift({
      id: `audit_${randomBytes(8).toString('hex')}`,
      tenantId: dash.tenantId,
      userId: 'public-link',
      userName: 'Editor Tautan Publik',
      action: 'UPDATE',
      target: `Dashboard "${dash.title}" via tautan publik — ${sah.length} widget${rincian ? ` (${rincian})` : ''}${
        judulBaru !== undefined && judulBaru.trim() !== dash.title ? `, judul diubah menjadi "${judulBaru.trim()}"` : ''
      }`,
      timestamp: new Date().toISOString(),
    } as (typeof db.auditLogs)[number]);
    db.persist();

    res.json(updated);
  });

  // ================= AUDIT LOGS =================
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const logs = db.auditLogs.filter((l) => l.tenantId === effectiveTenantId(req, session));

    // Ekspor CSV untuk kebutuhan audit eksternal (dibuka di Excel).
    if (String(req.query.format || '').toLowerCase() === 'csv') {
      const terbaruDulu = [...logs].reverse();
      const csv = keCsv(terbaruDulu, [
        { kunci: 'timestamp', judul: 'Waktu' },
        { kunci: 'action', judul: 'Aksi' },
        { kunci: 'target', judul: 'Target' },
        { kunci: 'userName', judul: 'Pengguna' },
        { kunci: 'details', judul: 'Detail' },
      ]);
      const tanggal = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="log-audit-${tanggal}.csv"`);
      res.send(csv);
      return;
    }

    // Tanpa `limit` tetap balas array seperti sebelumnya (klien lama aman).
    if (req.query.limit === undefined) {
      res.json(logs);
      return;
    }
    const { baris, total, limit, offset } = potongHalaman(logs, req.query.limit, req.query.offset);
    res.json({ logs: baris, total, limit, offset });
  });

  app.post('/api/audit-logs', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const { action, target, details } = req.body;
    const log = db.addAuditLog({
      tenantId: effectiveTenantId(req, session),
      userId: session.userId,
      userName: session.name,
      action: action || 'Aktivitas',
      target: target || 'Dashboard',
      details: details || '',
    });
    res.status(201).json({ id: log.id });
  });

  // ================= ADMIN MANAGEMENT ROUTES =================
  app.get('/api/admin/stats', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    const totalWidgets = db.dashboards.reduce((acc, d) => acc + d.widgets.length, 0);
    const totalCitations = db.dashboards.reduce(
      (acc, d) => acc + d.widgets.reduce((wAcc, w) => wAcc + (w.citations?.length || 0), 0),
      0
    );
    res.json({
      tenantsCount: db.tenants.length,
      usersCount: db.users.length,
      dashboardsCount: db.dashboards.length,
      totalWidgets,
      totalCitations,
      alertRulesCount: db.alertRules.length,
      auditLogsCount: db.auditLogs.length,
      ragProvider: db.systemConfig.ragProvider,
    });
  });

  app.get('/api/admin/users', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
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
    // Panel admin bersifat lintas instansi: tanpa `?tenantId=` tampilkan SEMUA
    // permintaan pending supaya admin tidak perlu berpindah konteks satu per satu.
    const filterTenant = String(req.query.tenantId || '').trim();
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
    const tenantTujuan =
      String(req.body?.tenantId || '').trim() ||
      user.requestedTenantId ||
      user.tenantId;
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
    db.addAuditLog({
      tenantId: tenantTujuan,
      userId: session.userId,
      userName: session.name,
      action: 'Setujui Pendaftaran',
      target: updated.name,
      details: `Akun ${updated.email} disetujui sebagai ${updated.role} di ${db.tenants.find((t) => t.id === tenantTujuan)?.name || tenantTujuan} (${updated.viaGoogle ? 'Google' : 'kata sandi'}).`,
    });
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
    db.addAuditLog({
      tenantId: updated.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tolak Pendaftaran',
      target: updated.name,
      details: `Pendaftaran ${updated.email} ditolak${req.body?.alasan ? `: ${String(req.body.alasan).slice(0, 200)}` : '.'}`,
    });
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
      tenantId: req.body.tenantId || 'tenant-pdam',
      avatar: req.body.role === 'admin' ? '👨‍💼' : '👩‍💼',
    };
    // Sandi awal = kata sandi sementara acak per akun (bukan sandi bersama yang
    // tertulis di dokumentasi). Admin menyalinnya sekali dari respons ini, dan
    // pengguna WAJIB menggantinya saat login pertama.
    const sandiAwal = kataSandiSementara();
    db.createUser({ ...newUser, mustChangePassword: true }, hashPassword(sandiAwal));
    db.addAuditLog({
      tenantId: newUser.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Pengguna Baru',
      target: newUser.name,
      details: `Peran: ${newUser.role}, Email: ${newUser.email} (sandi sementara, wajib diganti)`,
    });
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
    db.addAuditLog({
      tenantId: target.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Reset Kata Sandi',
      target: target.name,
      details: 'Kata sandi direset admin; pengguna wajib menggantinya saat login.',
    });
    res.json({ ok: true, sandiSementara: sandiBaru, email: target.email });
  });

  app.patch('/api/admin/users/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    const updated = db.updateUser(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    db.addAuditLog({
      tenantId: updated.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Perbarui Data Pengguna',
      target: updated.name,
      details: `Perubahan: ${Object.keys(req.body).join(', ')}`,
    });
    res.json(safeUser(updated));
  });

  app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    if (req.params.id === session.userId) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
    }
    const target = db.users.find((u) => u.id === req.params.id);
    const success = db.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    db.addAuditLog({
      tenantId: target?.tenantId || session.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Pengguna',
      target: req.params.id,
      details: 'Pengguna dinonaktifkan dari sistem',
    });
    res.json({ success: true });
  });

  // Menu grup "Kinerja & Kepatuhan" yang boleh diatur per instansi (sama dengan
  // `MENU_KINERJA` di frontend; 'berkas' hanya bisa dimatikan, tidak dipakai default).
  const MENU_KINERJA_SAH = ['pelaporan', 'auditTl', 'keuangan', 'risiko', 'aset', 'pk', 'lkjip'];

  app.post('/api/admin/tenants', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    const newTenant = {
      // ponytail: instansi baru masuk dengan SELURUH menu Kinerja & Kepatuhan mati.
      // Admin menyalakan satu per satu di tab "Tampilan Menu Instansi", jadi tidak
      // ada instansi baru yang langsung membuka semua halaman ke penggunanya.
      menuSembunyi: [...MENU_KINERJA_SAH],
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    // Hanya key menu yang dikenal yang disimpan; sisanya dibuang supaya salah
    // ketik/tambahan dari versi frontend lain tidak ikut masuk ke data tenant.
    if ('menuSembunyi' in (req.body || {})) {
      const sah = [...MENU_KINERJA_SAH, 'berkas'];
      const masuk = Array.isArray(req.body.menuSembunyi) ? req.body.menuSembunyi : [];
      req.body.menuSembunyi = [...new Set(masuk.filter((k: unknown) => typeof k === 'string' && sah.includes(k)))];
    }
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
    const target = db.tenants.find((t) => t.id === req.params.id);
    const success = await db.deleteTenant(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Tenant / Instansi BUMD tidak ditemukan.' });
    }
    db.addAuditLog({
      // Dicatat pada instansi ADMIN pelaku, bukan instansi yang dihapus —
      // audit milik instansi target sudah ikut dibersihkan oleh cascade.
      tenantId: session.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Hapus Instansi BUMD',
      target: target?.name || req.params.id,
      details: `Instansi BUMD ${target?.name || req.params.id} beserta seluruh data terkait (pengguna, dashboard, tautan bagikan, notifikasi, aturan alert, cache katalog) dihapus dari sistem`,
    });
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

      db.addAuditLog({
        tenantId: tenant.id,
        action: 'SINKRON RAG',
        target: `Instansi ${tenant.name} → KB ${kb}`,
        details: `Jumlah dokumen: ${namaSekarang.length}${dokumenBaru.length ? ` · baru: ${dokumenBaru.length}` : ''}${
          dokumenHilang.length ? ` · hilang: ${dokumenHilang.length}` : ''
        }`,
        userId: session.userId,
        userName: session.name,
      });

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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh menyinkronkan RAG.')) return;
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh melihat katalog knowledge base.')) return;

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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengubah konfigurasi.')) return;

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
      // Jejak audit: key hanya ditampilkan sebagai sidik jari, bukan nilai penuh.
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
    if (!requireAdmin(session, res, 'Hanya administrator yang boleh mengakses panel ini.')) return;
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
    db.addAuditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Konfigurasi Sistem',
      target: 'System Settings',
      details: `Memperbarui parameter sistem & RAG provider (provider: ${db.systemConfig.ragProvider}, url: ${db.systemConfig.ragApiUrl})`,
    });
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
