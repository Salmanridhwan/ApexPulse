import dotenv from 'dotenv';
// Default produksi: .env menang atas variabel shell (perilaku lama, dipakai Kroombox).
// Untuk skrip QA lokal yang butuh port lain: set HONOR_SHELL_ENV=1 agar PORT dari shell menang.
dotenv.config({ override: process.env.HONOR_SHELL_ENV !== '1' });
import express, { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WIDGET_CATALOG } from './src/services/builder/catalog';
import { generateDashboard } from './src/services/builder/generate';
import { ConfigurableRagClient, RagServiceError, jelaskanError, maskKey } from './src/services/rag/http';
import { kbUntukInstansi } from './src/services/rag/kbDefaults';
import { db, SafeUser } from './src/services/store/inMemoryDb';
import {
  clearSessionCookieHeader,
  hashPassword,
  parseSessionCookie,
  sessionCookieHeader,
  signSession,
  verifyPassword,
  verifySession,
  SessionPayload,
} from './src/services/auth/session';
import { BumdSector, ChatMessage, Dashboard, NotificationItem, ProgressStep, Tenant, WidgetSpec } from './src/types';
import { WidgetSpecSchema } from './src/services/spec/widgetSpec';
import { buatNotifikasi, evaluasiAturan } from './src/services/alerts';
import { buatPemeriksaKetersediaan } from './src/services/widgets/ketersediaan';
import { antreEmail, mailerAktif, penerimaAlert } from './src/services/mailer';
import { DASHBOARD_TEMPLATES, widgetDariTemplate } from './src/services/templates/dashboardTemplates';
import { isiTemplateDariRag } from './src/services/templates/isiDariRag';
import { GoogleAuthError, verifikasiIdTokenGoogle } from './src/services/auth/google';

/**
 * Persona chatbot Aiones Boards. Disisipkan ke setiap query percakapan supaya
 * jawaban terasa seperti chatbot LLM yang ramah, TETAP bersandar dokumen resmi,
 * dan TIDAK mengarang angka saat dokumen tidak memuatnya.
 */
const CHATBOT_PERSONA =
  'Kamu adalah "Aiones Boards Orchestrator", asisten AI ramah untuk instansi BUMD (Badan Usaha Milik Daerah). ' +
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
  (req as AuthedRequest).session = session;
  return session;
}

/**
 * Tenant efektif untuk request. Pengguna yang sudah login boleh berpindah
 * konteks instansi lewat ?tenantId= / body.tenantId (fitur "Ganti Instansi"
 * di sidebar, agar bisa menelusuri dokumen RAG & dashboard instansi lain).
 * Tanpa permintaan eksplisit, dipakai tenant milik user.
 */
function effectiveTenantId(req: Request, session: SessionPayload): string {
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
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // RAG client: baca konfigurasi dari panel admin (systemConfig) secara live.
  // Default provider/url/key diambil dari env, lalu bisa dioverride admin via UI.
  const ragClient = new ConfigurableRagClient(() => ({
    provider: db.systemConfig.ragProvider,
    baseUrl: db.systemConfig.ragApiUrl,
    apiKey: db.systemConfig.ragApiKey,
    timeoutMs: db.systemConfig.ragTimeoutSeconds,
    kbId: (db.systemConfig as any).ragKnowledgeBaseId || '',
    useExtract: (db.systemConfig as any).ragUseExtract !== false,
  }));
  // Seed awal dari env (kalau ada) — admin tetap bisa override via panel.
  if (process.env.RAG_PROVIDER === 'http') db.systemConfig.ragProvider = 'http';
  if (process.env.RAG_API_URL) db.systemConfig.ragApiUrl = process.env.RAG_API_URL;
  if (process.env.RAG_API_KEY) db.systemConfig.ragApiKey = process.env.RAG_API_KEY;
  if (process.env.RAG_KB_ID) (db.systemConfig as any).ragKnowledgeBaseId = process.env.RAG_KB_ID;

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

  app.use(express.json());

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
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      db: db.persistenceActive,
      persistence: db.persistenceActive ? 'mysql' : 'file',
      timestamp: Date.now(),
    });
  });

  // ================= TENANT & AUTH ROUTES =================
  app.get('/api/tenants', async (_req: Request, res: Response) => {
    // Segarkan dari tabel khusus dulu supaya instance mana pun melihat daftar
    // instansi yang sama (produksi punya >1 instance backend).
    await db.segarkanTenantDariMysql();
    res.json(db.tenants);
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    // findUserForLogin menyegarkan dari tabel auth khusus dulu, supaya user yang
    // didaftarkan di instance backend lain tetap bisa login di instance ini.
    const user = await db.findUserForLogin(cleanEmail);

    // Verifikasi scrypt terhadap kredensial terpisah; pesan error identik
    // untuk email tak dikenal & password salah (anti user-enumeration).
    const storedHash = user ? db.credentials[user.id] : undefined;
    if (!user || !storedHash || !verifyPassword(password, storedHash)) {
      return res.status(401).json({
        error: 'Email atau kata sandi tidak sesuai dengan kredensial instansi.',
      });
    }

    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
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
      user: safeUser(user),
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

  /** Terbitkan sesi + audit log untuk user yang sudah lolos verifikasi. */
  function terbitkanSesi(res: Response, user: SafeUser, cara: string) {
    const token = signSession({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      name: user.name,
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
   * Akun baru dibuat dengan peran 'analis' dan instansi default. Untuk mencegah
   * penyalahgunaan, pendaftaran bisa ditutup lewat env `ALLOW_REGISTRATION=false`.
   */
  app.post('/api/auth/register', async (req: Request, res: Response) => {
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
    if (password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    }
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

    const newUser: SafeUser = {
      id: `user-${Date.now()}`,
      email,
      name,
      role: 'analis',
      tenantId,
      avatar: '👤',
    };
    db.createUser(newUser, hashPassword(password));
    return terbitkanSesi(res, newUser, 'pendaftaran akun baru');
  });

  /**
   * LOGIN / REGISTRASI dengan GOOGLE.
   *
   * Klien mengirim ID token dari Google Identity Services; server memverifikasi
   * tanda tangannya ke kunci publik Google. Bila email belum terdaftar, akun
   * dibuat otomatis (peran 'analis', instansi default) — jadi "Masuk dengan
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
      const tenantId = String(req.body?.tenantId || '').trim() || 'tenant-pdam';
      const baru: SafeUser = {
        id: `user-g-${profil.sub || Date.now()}`,
        email: profil.email,
        name: profil.name,
        role: 'analis',
        tenantId: db.tenants.some((t) => t.id === tenantId) ? tenantId : 'tenant-pdam',
        avatar: profil.picture || '👤',
        googleSub: profil.sub,
        viaGoogle: true,
      };
      db.createUser(baru);
      db.addAuditLog({
        tenantId: baru.tenantId,
        userId: baru.id,
        userName: baru.name,
        action: 'Registrasi via Google',
        target: baru.name,
        details: `Akun baru dibuat otomatis dari login Google (${baru.email})`,
      });
      user = baru;
    } else if (!user.googleSub) {
      // Akun lokal dengan email sama: tautkan ke Google agar login berikutnya mulus.
      const updated = db.updateUser(user.id, { googleSub: profil.sub } as any);
      if (updated) user = updated;
    }

    return terbitkanSesi(res, user, 'Google Sign-In');
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

    try {
      // Salin widget template (id baru & segar) lalu isi angkanya dari dokumen.
      const seed = Date.now();
      const dasar = widgetDariTemplate(template, seed);
      const hasil = await isiTemplateDariRag(
        { ...template, widgets: dasar },
        { sector: (req.body?.sector || tenant.sector || template.sektor) as BumdSector, instansi: tenant.name, kbId, rag: ragClient }
      );

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
      });
    } catch (err) {
      // Layanan RAG tidak terhubung → jujur, tanpa angka contoh.
      if (err instanceof RagServiceError) {
        return res.status(502).json({
          error: `Layanan RAG tidak dapat dihubungi: ${err.message}`,
          petunjuk: err.detail,
        });
      }
      return res.status(500).json({ error: jelaskanError(err) });
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
        if (!chat) {
          chat = activeDash
            ? db.ensureChatForDashboard(activeDash.id, tenantId, session.userId, activeDash.title)
            : db.ensureGeneralChat(tenantId, session.userId);
        }
        if (!chat) return;
        db.addChatMessage(
          chat.id,
          {
            ...msg,
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
          },
          tenantId
        );
      };
      const catatPesanUser = () => {
        if (pesanUserTercatat) return;
        pesanUserTercatat = true;
        pesanBaru({ sender: 'user', text: prompt });
      };
      /** Balasan asisten — urutannya dijamin setelah prompt user. */
      const catatAsisten = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        catatPesanUser();
        pesanBaru(msg);
      };

      // Check if this is a conversational EDIT instruction

      // Case 0: Chart / widget recommendations & pertanyaan penambahan chart
      const isRekomendasi =
        lower.includes('rekomendasi') ||
        lower.includes('rekomendasikan') ||
        lower.includes('chart apa') ||
        lower.includes('grafik apa') ||
        lower.includes('widget apa') ||
        lower.includes('tambah chart') ||
        lower.includes('tambahkan chart') ||
        lower.includes('tambah grafik') ||
        lower.includes('tambahkan grafik') ||
        lower.includes('tambah widget') ||
        lower.includes('tambahkan widget') ||
        lower.includes('saran chart') ||
        lower.includes('saran grafik') ||
        lower.includes('apa yang bisa') ||
        lower.includes('chart yang bisa') ||
        lower.includes('chart yang dapat') ||
        lower.includes('suggest') ||
        lower.includes('bisa menambahkan') ||
        lower.includes('bisa tambah') ||
        lower.includes('apakah bisa') ||
        lower.includes('chart lagi') ||
        lower.includes('widget lagi') ||
        lower.includes('grafik lagi');

      if (isRekomendasi) {
        sendEvent('step', { id: 's0', title: 'Menganalisis katalog widget & dokumen...', status: 'in_progress' });
        await new Promise((r) => setTimeout(r, 300));

        const tenant = db.tenants.find((t) => t.id === tenantId);
        const sectorFilter = sector || tenant?.sector || 'universal';

        // Pick relevant widgets from catalog (matching sector, max 6)
        const matched = WIDGET_CATALOG.filter(
          (w) => w.sektor.includes(sectorFilter as any) || w.sektor.includes('universal')
        ).slice(0, 6);

        // Exclude already-added widget ids if dashboard exists
        const existingNames = activeDash?.widgets.map((w) => w.title.toLowerCase()) || [];
        const suggestions = matched
          .filter((w) => !existingNames.includes(w.nama.toLowerCase()))
          .slice(0, 6);

        const recommendations = (suggestions.length > 0 ? suggestions : matched.slice(0, 6)).map((w) => ({
          id: w.id,
          name: w.nama,
          category: w.kategori,
          chartTypes: w.tipeChart,
          description: w.deskripsi,
          prompt: `Tambahkan widget "${w.nama}" ke dashboard`,
        }));

        sendEvent('step', { id: 's0', title: `Ditemukan ${recommendations.length} rekomendasi chart`, status: 'completed' });

        const isPertanyaanBisa = lower.includes('bisa') || lower.includes('apakah') || lower.includes('cara');
        const pembuka = isPertanyaanBisa
          ? `Tentu saja bisa! Anda dapat menambahkan widget chart baru ke dashboard ini kapan saja.\n\n`
          : '';

        const replyText = `${pembuka}Berikut beberapa rekomendasi chart dari katalog dokumen resmi ${sector.toUpperCase()} yang relevan. Anda bisa langsung mengklik salah satu tombol di bawah untuk menyematkannya ke kanvas:`;
        catatAsisten({
          sender: 'system',
          text: replyText,
          actionTaken: 'recommend',
          recommendations,
        } as any);

        sendEvent('result', {
          actionTaken: 'recommend',
          message: replyText,
          recommendations,
        });
        sendEvent('done', { ok: true });
        return res.end();
      }

      // Case 1: Hapus widget
      if (lower.startsWith('hapus widget') || lower.includes('delete widget')) {
        sendEvent('step', { id: 's1', title: 'Menganalisis widget yang akan dihapus...', status: 'in_progress' });
        await new Promise((r) => setTimeout(r, 400));

        if (activeDash && activeDash.widgets.length > 0) {
          const query = lower.replace('hapus widget', '').trim();
          const targetIdx = activeDash.widgets.findIndex((w) =>
            w.title.toLowerCase().includes(query) || (w.category && w.category.toLowerCase().includes(query))
          );

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

        let newType: WidgetSpec['type'] = 'bar';
        if (lower.includes('garis') || lower.includes('line')) newType = 'line';
        if (lower.includes('area')) newType = 'area';
        if (lower.includes('donat') || lower.includes('donut')) newType = 'donut';
        if (lower.includes('kpi')) newType = 'kpi';
        if (lower.includes('tabel') || lower.includes('table')) newType = 'table';

        if (activeDash && activeDash.widgets.length > 0) {
          // Find first chart widget or match title
          const target =
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
      // Perintah membuat/memperbarui dashboard (kata kerja eksplisit) masuk jalur
      // orkestrator; SEMUA pesan lain dijawab sebagai chatbot LLM (sapaan, tanya
      // data, obrolan) lewat /query RAG dengan persona + riwayat percakapan.
      const isGenerateDash =
        lower.includes('buat dashboard') ||
        lower.includes('buatkan dashboard') ||
        lower.includes('bikin dashboard') ||
        lower.includes('generate dashboard') ||
        lower.includes('buat laporan') ||
        lower.includes('buatkan laporan') ||
        lower.includes('bikin laporan') ||
        lower.includes('tampilkan dashboard') ||
        lower.includes('perbarui dashboard') ||
        lower.includes('perbaharui dashboard') ||
        lower.includes('update dashboard') ||
        lower.includes('refresh dashboard') ||
        lower.includes('buat kpi') ||
        lower.includes('buatkan kpi') ||
        lower.includes('susun dashboard') ||
        lower.includes('rancang dashboard');

      // Deteksi obrolan ringan (sapaan/terima kasih) → persona boleh membalas
      // natural tanpa strict grounding. Pertanyaan data tetap grounded.
      const isSapaan =
        /^(halo|hai|hi|hello|helo|hey|test|tes|pagi|siang|sore|malam|assalamualaikum|salam)\b/i.test(
          lower.trim()
        ) ||
        lower.includes('apa kabar') ||
        lower.includes('terima kasih') ||
        lower.includes('makasih') ||
        lower.includes('thanks') ||
        lower.includes('thank you') ||
        lower.includes('siapa kamu') ||
        lower.includes('kamu siapa') ||
        lower.includes('apa ini') ||
        lower.includes('bisa apa');

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

          // Bangun teks balasan: jawaban + daftar sumber dokumen (kalau ada).
          let replyText = answer;
          if (citationsCount > 0) {
            const sumberUnik = Array.from(
              new Map(
                ragResult.citations
                  .filter((c) => c.docName)
                  .map((c) => [c.docName, c])
              ).values()
            )
              .slice(0, 4)
              .map((c) => `• ${c.docName}${c.page ? ` (hal. ${c.page})` : ''}`)
              .join('\n');
            if (sumberUnik) replyText += `\n\n📄 **Sumber Dokumen:**\n${sumberUnik}`;
          }

          catatAsisten({
            sender: 'system',
            text: replyText,
            actionTaken: 'qa_answer',
            modeUsed: 'Chatbot RAG',
            citationsCount,
          } as any);

          sendEvent('result', {
            actionTaken: 'qa_answer',
            message: replyText,
            modeUsed: 'Chatbot RAG',
            citationsCount,
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
            `⚠️ Maaf, saya belum bisa menjawab karena **layanan RAG tidak dapat dihubungi**.\n\n` +
            `Penyebab: ${detail}\n\n` +
            `Silakan periksa koneksi layanan RAG (Admin → Konfigurasi RAG), lalu coba lagi. ` +
            `Saya tidak menampilkan data contoh agar jawaban tidak menyesatkan.`;
          console.warn('[chat] chatbot RAG gagal:', detail);

          catatAsisten({
            sender: 'system',
            text: pesanGalat,
            actionTaken: 'rag_error',
            modeUsed: 'Gagal (Layanan RAG)',
          } as any);

          sendEvent('step', { id: 'sc0', title: 'Layanan RAG tidak dapat dihubungi', status: 'failed' });
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
        const pesanGagal = gagalLayanan
          ? `⚠️ Saya belum bisa membuat dashboard untuk instansi "${tenantAktif?.name || tenantId}" karena **layanan RAG tidak dapat dihubungi**.\n\n` +
            `Penyebab: ${genResult.alasanGagal || 'layanan tidak merespons'}\n\n` +
            `Periksa koneksi layanan RAG (Admin → Konfigurasi RAG) lalu coba lagi. ` +
            `Saya tidak membuat dashboard dari data contoh agar tidak menyesatkan.`
          : `Saya belum bisa membuat dashboard untuk instansi "${tenantAktif?.name || tenantId}". ` +
            (genResult.alasanGagal || 'Dokumen instansi ini tidak memadai.') +
            ` Yang bisa dilakukan: tambahkan atau rapikan dokumen instansi ini di knowledge base ` +
            `(${kbUntukInstansi(tenantAktif, db.systemConfig.ragKnowledgeBaseId) || 'KB belum ditautkan'}), lalu coba lagi.`;
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
          ? `Seluruh angka bersitasi dokumen resmi instansi ini (**${genResult.citationsCount} sitasi**).\n`
          : genResult.modeUsed === 'Jalur B (Agregasi Metadata)'
            ? `Angka disusun dari ringkasan metadata dokumen instansi ini (**${genResult.citationsCount} sitasi**), jadi bisa lebih sedikit daripada dashboard penuh.\n`
            : `⚠️ **DATA CONTOH:** dashboard ini berasal dari template demo, bukan dari dokumen instansi ini. Jangan dipakai untuk laporan atau presentasi resmi.\n`;
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
      sendEvent('error', { message: err?.message || 'Terjadi kesalahan sistem saat pemrosesan RAG.' });
      res.end();
    }
  });

  // ================= RAG PROBE & DIAGNOSTICS =================
  app.post('/api/rag-probe', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
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
          `Jalur A (/extract) menyusun angka dari dokumen: ${cfg.ragProvider === 'http' && (db.systemConfig as any).ragUseExtract !== false ? 'aktif' : 'nonaktif'}`,
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
    db.persist();
    res.status(201).json(newRule);
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
    db.persist();
    res.json({ success: true });
  });

  // ================= SHARE ROUTES =================
  app.post('/api/dashboards/:id/share', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const dash = db.getDashboardById(req.params.id, effectiveTenantId(req, session));
    if (!dash) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    const token = `share_${randomBytes(12).toString('hex')}`;
    const mode = req.body?.mode === 'editable' ? 'editable' : 'readonly';
    db.shareTokens[token] = { dashboardId: req.params.id, mode } as any;
    db.persist();
    res.json({ token, shareUrl: `/share/${token}`, mode });
  });

  app.get('/api/share/:token', (req: Request, res: Response) => {
    const shareMeta = db.shareTokens[req.params.token] as any;
    const dashId = typeof shareMeta === 'object' && shareMeta ? shareMeta.dashboardId : shareMeta;
    const mode = typeof shareMeta === 'object' && shareMeta ? shareMeta.mode : 'readonly';

    if (!dashId) {
      return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan atau telah kedaluwarsa.' });
    }
    const dash = db.dashboards.find((d) => d.id === dashId);
    if (!dash) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    res.json({ ...dash, accessMode: mode });
  });

  /**
   * Edit widget lewat tautan publik (apabila mode 'editable').
   */
  app.patch('/api/share/:token', (req: Request, res: Response) => {
    const token = req.params.token;
    const shareMeta = db.shareTokens[token] as any;
    const dashId = typeof shareMeta === 'object' && shareMeta ? shareMeta.dashboardId : shareMeta;
    const mode = typeof shareMeta === 'object' && shareMeta ? shareMeta.mode : 'readonly';

    if (!dashId) {
      return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan.' });
    }
    if (mode !== 'editable') {
      return res.status(403).json({ error: 'Tautan ini bersifat Read-Only dan tidak dapat diedit.' });
    }

    const dash = db.dashboards.find((d) => d.id === dashId);
    if (!dash) return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });

    const widgets = req.body?.widgets as WidgetSpec[] | undefined;
    if (!Array.isArray(widgets)) {
      return res.status(400).json({ error: 'Field "widgets" wajib berupa array.' });
    }
    // Paritas penuh dengan kanvas pembuat: urutkan, ubah lebar, edit, gandakan,
    // tambah, dan hapus. Bentuk tiap widget tetap divalidasi (tidak sekadar
    // dipercaya) supaya tautan publik tak bisa menyimpan data rusak.
    const sah = widgets.filter(
      (w) => w && typeof w.id === 'string' && WidgetSpecSchema.safeParse(w).success
    );
    if (sah.length === 0 && widgets.length > 0) {
      return res.status(400).json({ error: 'Tidak ada widget valid untuk diperbarui.' });
    }
    const idSebelum = new Set(dash.widgets.map((w) => w.id));
    const idSesudah = new Set(sah.map((w) => w.id));
    const ditambah = [...idSesudah].filter((id) => !idSebelum.has(id)).length;
    const dihapus = [...idSebelum].filter((id) => !idSesudah.has(id)).length;

    const updated = db.updateDashboard(dashId, { widgets: sah }, dash.tenantId);
    if (!updated) return res.status(500).json({ error: 'Gagal menyimpan perubahan.' });

    // Catat jejak audit: perubahan lewat tautan publik (termasuk tambah/hapus).
    const rincian = [
      ditambah > 0 ? `+${ditambah} ditambah` : null,
      dihapus > 0 ? `-${dihapus} dihapus` : null,
    ]
      .filter(Boolean)
      .join(', ');
    db.auditLogs.unshift({
      id: `audit_${randomBytes(8).toString('hex')}`,
      tenantId: dash.tenantId,
      userId: 'public-link',
      userName: 'Editor Tautan Publik',
      action: 'UPDATE',
      target: `Dashboard "${dash.title}" via tautan publik — ${sah.length} widget${rincian ? ` (${rincian})` : ''}`,
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
    res.json(logs);
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
    res.json(db.users);
  });

  app.post('/api/admin/users', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
    const email = (req.body.email || `user${Date.now()}@bumd.id`).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Email sudah terdaftar di sistem.' });
    }
    const newUser: SafeUser = {
      id: `user-${Date.now()}`,
      email,
      name: req.body.name || 'Pengguna BUMD',
      role: req.body.role || 'analis',
      tenantId: req.body.tenantId || 'tenant-pdam',
      avatar: req.body.role === 'admin' ? '👨‍💼' : req.body.role === 'direksi' ? '👔' : '👩‍💼',
    };
    // Password awal user baru = DEMO_PASSWORD dari env (default apexpulse2026).
    // JANGAN menyalin hash password admin yang sedang login — itu membuat
    // user baru bisa dibuka dengan kredensial admin.
    db.createUser(newUser, hashPassword(process.env.DEMO_PASSWORD || 'apexpulse2026'));
    db.addAuditLog({
      tenantId: newUser.tenantId,
      userId: session.userId,
      userName: session.name,
      action: 'Tambah Pengguna Baru',
      target: newUser.name,
      details: `Peran: ${newUser.role}, Email: ${newUser.email}`,
    });
    res.status(201).json(safeUser(newUser));
  });

  app.patch('/api/admin/users/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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

  app.post('/api/admin/tenants', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
      const namaSekarang = hasil.dokumen.map((d) => d.nama);
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
        documentCount: hasil.jumlah,
        dokumenTerakhir: namaSekarang,
        kbTersinkronPada: new Date().toISOString(),
      });

      db.addAuditLog({
        tenantId: tenant.id,
        action: 'SINKRON RAG',
        target: `Instansi ${tenant.name} → KB ${kb}`,
        details: `Jumlah dokumen: ${hasil.jumlah}${dokumenBaru.length ? ` · baru: ${dokumenBaru.length}` : ''}${
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh menyinkronkan RAG.' });
    }
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
    // API key dikirim ter-mask — nilai asli hanya hidup di server.
    res.json({ ...db.systemConfig, ragApiKey: maskKey(db.systemConfig.ragApiKey) });
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
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
   * Simpan konfigurasi SEKALIGUS uji API Key-nya dalam satu panggilan.
   *
   * Urutannya penting: simpan dulu, baru uji. Kalau diuji dulu, key yang diuji adalah
   * key lama yang masih tersimpan — bukan yang baru ditempel admin.
   */
  app.post('/api/admin/config-simpan-uji', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengubah konfigurasi.' });
    }

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
      const berbentukMask =
        typeof body.ragApiKey === 'string' && /[*•·]{4,}/.test(body.ragApiKey);
      if (
        berbentukMask ||
        body.ragApiKey === maskKey(db.systemConfig.ragApiKey) ||
        body.ragApiKey === '*********'
      ) {
        body.ragApiKey = db.systemConfig.ragApiKey;
      }
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
      konfigurasi: { ...db.systemConfig, ragApiKey: maskKey(db.systemConfig.ragApiKey) },
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
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
    // API key jangan pernah tersimpan ter-mask sebagai nilai aktif. Dua kasus:
    // (a) nilai yang dikirim sama dengan mask key saat ini -> pertahankan key lama
    // (b) nilai yang dikirim SUDAH BERBENTUK MASK (mis. panel dibuka sebelum key
    //     diubah pihak lain, sehingga mask-nya basi) -> JANGAN simpan mask itu
    //     sebagai key, karena akan merusak kredensial yang asli.
    const body = { ...req.body };
    const berbentukMask =
      typeof body.ragApiKey === 'string' && /[*•·]{4,}/.test(body.ragApiKey);
    if (berbentukMask || body.ragApiKey === maskKey(db.systemConfig.ragApiKey) || body.ragApiKey === '*********') {
      body.ragApiKey = db.systemConfig.ragApiKey;
    }
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
    res.json({ ...db.systemConfig, ragApiKey: maskKey(db.systemConfig.ragApiKey) });
  });

  // ================= VITE DEV MIDDLEWARE / STATIC =================
  const distExists = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  if (process.env.NODE_ENV === 'production' || distExists) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Persistence MySQL (Laragon) — muat state sebelum server menerima request.
  await db.initMysql();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aiones Boards Server] Berjalan pada port ${PORT}`);
  });

  // Graceful shutdown: tutup server & pool MySQL saat menerima SIGINT/SIGTERM.
  // Tanpa ini, proses tertinggal (orphan) ketika dijalankan lewat wrapper
  // (mis. `tsx` dari skrip QA/CI) yang menerima sinyal kill lebih dulu.
  let sedangTutup = false;
  const tutup = async (sinyal: string) => {
    if (sedangTutup) return;
    sedangTutup = true;
    console.log(`[Aiones Boards Server] Menerima ${sinyal} — menutup dengan rapi...`);
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
}

startServer().catch((err) => {
  console.error('[Aiones Boards Server] Gagal inisialisasi server:', err);
  process.exit(1);
});
