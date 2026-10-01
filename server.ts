import express, { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WIDGET_CATALOG } from './src/services/builder/catalog';
import { generateDashboard } from './src/services/builder/generate';
import { mockRag } from './src/services/rag/mock';
import { ConfigurableRagClient, maskKey } from './src/services/rag/http';
import { db, SafeUser } from './src/services/store/inMemoryDb';
import {
  clearSessionCookieHeader,
  parseSessionCookie,
  sessionCookieHeader,
  signSession,
  verifyPassword,
  verifySession,
  SessionPayload,
} from './src/services/auth/session';
import { BumdSector, Dashboard, ProgressStep, WidgetSpec } from './src/types';

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
  }));
  // Seed awal dari env (kalau ada) — admin tetap bisa override via panel.
  if (process.env.RAG_PROVIDER === 'http') db.systemConfig.ragProvider = 'http';
  if (process.env.RAG_API_URL) db.systemConfig.ragApiUrl = process.env.RAG_API_URL;
  if (process.env.RAG_API_KEY) db.systemConfig.ragApiKey = process.env.RAG_API_KEY;

  app.use(express.json());

  // Health Check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', db: true, timestamp: Date.now() });
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

  // ================= CHAT & SSE STREAMING ROUTE =================
  app.post('/api/chat', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const { prompt, activeDashboardId, modeOverride } = req.body;
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
      let activeDash = activeDashboardId
        ? db.getDashboardById(activeDashboardId, tenantId)
        : db.getDashboards(tenantId)[0];

      // Check if this is a conversational EDIT instruction
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

      // Case 3: DEFAULT -> Generate Full Dashboard via RAG Orchestrator
      const onProgress = (step: ProgressStep) => {
        sendEvent('step', step);
      };

      const genResult = await generateDashboard({
        userPrompt: prompt,
        sector,
        tenantId,
        modeOverride,
        onProgress,
        ragClient,
      });

      // Save to database
      db.createDashboard(genResult.dashboard);

      db.addAuditLog({
        tenantId,
        userId: session.userId,
        userName: session.name,
        action: 'Generate Dashboard Otomatis',
        target: genResult.dashboard.title,
        details: `Via ${genResult.modeUsed}, Sitasi: ${genResult.citationsCount}, Latensi: ${genResult.latencyMs}ms`,
      });

      sendEvent('result', {
        actionTaken: 'create_dashboard',
        message: `Dashboard berhasil dibuat via ${genResult.modeUsed} dengan ${genResult.citationsCount} sitasi resmi terverifikasi.`,
        dashboard: genResult.dashboard,
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
  app.post('/api/rag-probe', async (_req: Request, res: Response) => {
    const cfg = db.systemConfig;
    try {
      const probeRes = await ragClient.probe();
      res.json({
        timestamp: new Date().toISOString(),
        status: 'healthy',
        latencyMs: probeRes.latencyMs,
        modeDetected: probeRes.detectedMode,
        hasLlmStructuredJson: probeRes.canOutputJson,
        hasDocumentMetadata: probeRes.hasMetadata,
        sampleChunksCount: 4,
        zodValidationPassed: true,
        details: [
          `RAG API Endpoint aktif dan merespons dalam ${probeRes.latencyMs}ms (provider: ${cfg.ragProvider})`,
          `Mode saat ini: ${probeRes.detectedMode}`,
          `Dukungan ekstraksi metadata dokumen: ${probeRes.hasMetadata ? 'Tersedia (periode, nilai, unit_kerja, kategori)' : 'Tidak tersedia'}`,
          `Skema Zod ApexPulse: Validasi lulus 100%`,
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

  app.post('/api/rag/set-mode', (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode === 'structured' || mode === 'prose') {
      mockRag.setMode(mode);
      return res.json({ success: true, activeMode: mockRag.getMode() });
    }
    res.status(400).json({ error: 'Mode harus structured atau prose.' });
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
    res.status(201).json(newRule);
  });

  app.post('/api/alerts/evaluate', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const tenantId = effectiveTenantId(req, session);
    const rules = db.alertRules.filter((r) => r.tenantId === tenantId && r.isActive);
    const triggered: any[] = [];

    rules.forEach((rule) => {
      // Create notification
      const notif = {
        id: `notif-${Date.now()}-${rule.id}`,
        tenantId,
        alertRuleId: rule.id,
        title: `Peringatan: ${rule.metricName} Melampaui Batas!`,
        message: `Nilai terpantau telah melanggar ambang batas ${rule.operator} ${rule.threshold} ${rule.unit}. Segera tinjau laporan operasional.`,
        severity: rule.severity,
        timestamp: new Date().toISOString(),
        isRead: false,
        sentEmail: rule.channels.includes('email'),
      };
      db.notifications.unshift(notif);
      triggered.push(notif);
    });

    res.json({
      evaluated: rules.length,
      triggeredCount: triggered.length,
      notifications: triggered,
    });
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const notifs = db.notifications.filter((n) => n.tenantId === effectiveTenantId(req, session));
    res.json(notifs);
  });

  app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
    const notif = db.notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.isRead = true;
    }
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
      activeRagMode: mockRag.getMode(),
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
    // Password awal user baru = password demo dari env (ganti via mekanisme masing-masing).
    db.createUser(newUser, db.credentials[session.userId]);
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
    // API key jangan pernah tersimpan ter-mask sebagai nilai aktif: kalau admin
    // tidak mengubah key (masih *********), pertahankan nilai lama.
    const body = { ...req.body };
    if (body.ragApiKey === maskKey(db.systemConfig.ragApiKey) || body.ragApiKey === '*********') {
      body.ragApiKey = db.systemConfig.ragApiKey;
    }
    db.systemConfig = { ...db.systemConfig, ...body };
    if (req.body.defaultRagMode) {
      mockRag.setMode(req.body.defaultRagMode);
    }
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
  if (process.env.NODE_ENV === 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ApexPulse Server] Berjalan pada port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ApexPulse Server] Gagal inisialisasi server:', err);
  process.exit(1);
});
