import dotenv from 'dotenv';
// Default produksi: .env menang atas variabel shell (perilaku lama, dipakai Kroombox).
// Untuk skrip QA lokal yang butuh port lain: set HONOR_SHELL_ENV=1 agar PORT dari shell menang.
dotenv.config({ override: process.env.HONOR_SHELL_ENV !== '1' });
import express, { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WIDGET_CATALOG } from './src/services/builder/catalog';
import { generateDashboard } from './src/services/builder/generate';
import { ConfigurableRagClient, jelaskanError, maskKey } from './src/services/rag/http';
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
import { BumdSector, ChatMessage, Dashboard, NotificationItem, ProgressStep, WidgetSpec } from './src/types';
import { buatNotifikasi, evaluasiAturan } from './src/services/alerts';
import { antreEmail, mailerAktif, penerimaAlert } from './src/services/mailer';

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

/** Tenant efektif untuk request: admin boleh lintas tenant via ?tenantId=, lainnya terkunci tenant miliknya. */
function effectiveTenantId(req: Request, session: SessionPayload): string {
  const requested = (req.query.tenantId as string) || (req.body?.tenantId as string | undefined);
  if (session.role === 'admin' && requested) return requested;
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

  app.use(express.json());

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
  app.get('/api/tenants', (_req: Request, res: Response) => {
    res.json(db.tenants);
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

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
      target: 'Portal ApexPulse BUMD',
      details: `Masuk sebagai ${user.role.toUpperCase()} (${user.email})`,
    });

    // Token dikirim via cookie HttpOnly — tidak bisa dicuri JS browser.
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    res.json({
      user: safeUser(user),
    });
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
          target: 'Portal ApexPulse BUMD',
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
    const mulai = Date.now();
    try {
      const hasil = await ragClient.ambilDataWidget(String(query).trim(), sector, String(tipe || 'kpi'));
      if (!hasil) {
        return res.status(502).json({
          error:
            'Dokumen resmi tidak memuat indikator ini, atau layanan RAG tidak menjawab. Tidak ada angka contoh yang ditambahkan.',
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
    const sector = (req.body.sector || 'pdam') as BumdSector;
    const tenantId = effectiveTenantId(req, session);

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
      let chat = activeDash
        ? db.ensureChatForDashboard(activeDash.id, tenantId, session.userId, activeDash.title)
        : undefined;
      let pesanUserTercatat = false;
      const pesanBaru = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        if (!chat && activeDash) {
          chat = db.ensureChatForDashboard(activeDash.id, tenantId, session.userId, activeDash.title);
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

      // Case 2.5: Pertanyaan bebas (chatbot) — jawab via /query RAG tanpa generate dashboard
      // Deteksi: pertanyaan informatif, bukan perintah membuat/mengubah dashboard
      const isGenerateDash =
        lower.includes('buat dashboard') ||
        lower.includes('buatkan dashboard') ||
        lower.includes('generate dashboard') ||
        lower.includes('buat laporan') ||
        lower.includes('buatkan laporan') ||
        lower.includes('tampilkan dashboard') ||
        lower.includes('perbarui dashboard') ||
        lower.includes('update dashboard') ||
        lower.includes('buat kpi') ||
        lower.includes('buatkan kpi');

      const isPertanyaanBebas =
        !isGenerateDash && (
          lower.includes('?') ||
          lower.startsWith('berapa') ||
          lower.startsWith('apa') ||
          lower.startsWith('siapa') ||
          lower.startsWith('bagaimana') ||
          lower.startsWith('mengapa') ||
          lower.startsWith('kenapa') ||
          lower.startsWith('kapan') ||
          lower.startsWith('di mana') ||
          lower.startsWith('dimana') ||
          lower.startsWith('jelaskan') ||
          lower.startsWith('ceritakan') ||
          lower.startsWith('sebutkan') ||
          lower.startsWith('tolong jelaskan') ||
          lower.startsWith('tolong ceritakan') ||
          lower.startsWith('tolong sebutkan') ||
          lower.startsWith('cari') ||
          lower.startsWith('cari tahu') ||
          lower.startsWith('info') ||
          lower.startsWith('informasi') ||
          lower.includes('total') ||
          lower.includes('berapa besar') ||
          lower.includes('berapa total') ||
          lower.includes('berapa jumlah') ||
          lower.includes('berapa nilai') ||
          lower.includes('tunjukkan') ||
          lower.includes('persentase') ||
          lower.includes('rasio') ||
          lower.includes('pertumbuhan') ||
          lower.includes('perkembangan') ||
          lower.includes('kinerja') ||
          lower.includes('capaian') ||
          lower.includes('ringkasan')
        );

      if (isPertanyaanBebas) {
        sendEvent('step', { id: 'sc0', title: 'Mencari jawaban di dokumen resmi...', status: 'in_progress' });

        try {
          const ragResult = await ragClient.query({
            prompt,
            sector,
            mode: 'prose',
          });

          sendEvent('step', { id: 'sc0', title: 'Dokumen ditemukan, menyusun jawaban...', status: 'completed' });

          const answer = ragResult.answer || 'Maaf, jawaban tidak ditemukan di dokumen yang tersedia.';
          const citationsCount = ragResult.citations?.length || 0;

          // Bangun teks balasan: jawaban + sumber
          let replyText = answer;
          if (citationsCount > 0) {
            const sumberUnik = ragResult.citations
              .slice(0, 3)
              .map((c) => `• ${c.docName}${c.page ? ` (hal. ${c.page})` : ''}`)
              .join('\n');
            replyText += `\n\n📄 **Sumber Dokumen:**\n${sumberUnik}`;
          }

          catatAsisten({
            sender: 'system',
            text: replyText,
            actionTaken: 'qa_answer' as any,
            modeUsed: ragResult.mode,
            citationsCount,
          } as any);

          sendEvent('result', {
            actionTaken: 'qa_answer',
            message: replyText,
            modeUsed: ragResult.mode,
            citationsCount,
            latencyMs: ragResult.latencyMs,
          });
          sendEvent('done', { ok: true });
          return res.end();
        } catch (err: any) {
          // Jika RAG gagal untuk pertanyaan, lanjut ke default generate dashboard
          console.warn('[chat] chatbot RAG gagal, lanjut ke generate dashboard:', err?.message);
        }
      }

      // Case 3: DEFAULT -> Generate / Perbarui Dashboard via RAG Orchestrator
      const onProgress = (step: ProgressStep) => {
        sendEvent('step', step);
      };

      const genResult = await generateDashboard({
        userPrompt: prompt,
        sector,
        tenantId,
        onProgress,
        ragClient,
      });

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

      let replyText = `Tentu! Dashboard **"${dashboardTersimpan.title}"** berhasil ${activeDash ? 'diperbarui' : 'disintesis'} menggunakan dokumen resmi ${sector.toUpperCase()}.\n\n`;

      if (narasiWidget?.narasi?.text) {
        replyText += `📋 **Ringkasan Temuan Dokumen:**\n${narasiWidget.narasi.text}\n\n`;
      }

      if (charts.length > 0) {
        replyText += `📈 **Visualisasi Grafik:**\n${chartNames}\n\n`;
      }

      if (kpiItems) {
        replyText += `🎯 **Indikator Kunci Utama:**\n${kpiItems}\n\n`;
      }

      replyText += `Seluruh data diverifikasi langsung via **${genResult.modeUsed}** dengan **${genResult.citationsCount} sitasi resmi**.\n`;
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
          subject: `[ApexPulse ${rule.severity.toUpperCase()}] ${notif.title}`,
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
    db.shareTokens[token] = req.params.id;
    db.persist();
    res.json({ token, shareUrl: `/share/${token}` });
  });

  app.get('/api/share/:token', (req: Request, res: Response) => {
    const dashId = db.shareTokens[req.params.token];
    if (!dashId) {
      return res.status(404).json({ error: 'Tautan berbagi tidak ditemukan atau telah kedaluwarsa.' });
    }
    const dash = db.dashboards.find((d) => d.id === dashId);
    if (!dash) {
      return res.status(404).json({ error: 'Dashboard tidak ditemukan.' });
    }
    res.json(dash);
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

  app.post('/api/admin/tenants', (req: Request, res: Response) => {
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
      documentCount: Number(req.body.documentCount) || 12,
    };
    db.createTenant(newTenant);
    res.status(201).json(newTenant);
  });

  app.patch('/api/admin/tenants/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengakses panel ini.' });
    }
    const updated = db.updateTenant(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan.' });
    }
    res.json(updated);
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
    console.log(`[ApexPulse Server] Berjalan pada port ${PORT}`);
  });

  // Graceful shutdown: tutup server & pool MySQL saat menerima SIGINT/SIGTERM.
  // Tanpa ini, proses tertinggal (orphan) ketika dijalankan lewat wrapper
  // (mis. `tsx` dari skrip QA/CI) yang menerima sinyal kill lebih dulu.
  let sedangTutup = false;
  const tutup = async (sinyal: string) => {
    if (sedangTutup) return;
    sedangTutup = true;
    console.log(`[ApexPulse Server] Menerima ${sinyal} — menutup dengan rapi...`);
    // Berhenti menerima koneksi baru; paksa tutup setelah 5 dtk bila ada yang menggantung.
    server.close(() => {
      console.log('[ApexPulse Server] Koneksi HTTP ditutup.');
    });
    const paksa = setTimeout(() => {
      console.warn('[ApexPulse Server] Batas waktu 5 dtk — keluar paksa.');
      process.exit(0);
    }, 5000);
    paksa.unref();
    try {
      await db.closeMysql();
    } catch (err) {
      console.error('[ApexPulse Server] Gagal menutup pool MySQL:', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void tutup('SIGINT'));
  process.on('SIGTERM', () => void tutup('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[ApexPulse Server] Gagal inisialisasi server:', err);
  process.exit(1);
});
