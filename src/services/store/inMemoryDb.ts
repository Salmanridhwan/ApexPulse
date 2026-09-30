import {
  AlertRule,
  AuditLog,
  BumdSector,
  Dashboard,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
} from '../../types';
import { getFallbackDemoDashboard } from '../builder/fallback';

export class InMemoryDb {
  public tenants: Tenant[] = [
    {
      id: 'tenant-pdam',
      name: 'Perumda Air Minum Tirta Kencana',
      shortName: 'PDAM Tirta',
      sector: 'pdam',
      code: 'PAM-TK',
      city: 'Kota Mandiri',
      logo: '💧',
      primaryColor: '#0284c7',
      documentCount: 48,
    },
    {
      id: 'tenant-bank',
      name: 'Bank Pembangunan Daerah Artha Daerah',
      shortName: 'BPD Artha',
      sector: 'bank',
      code: 'BPD-AD',
      city: 'Provinsi Nusantara',
      logo: '🏦',
      primaryColor: '#1d4ed8',
      documentCount: 76,
    },
    {
      id: 'tenant-pasar',
      name: 'Perumda Pasar Rakyat Sejahtera',
      shortName: 'Perumda Pasar',
      sector: 'pasar',
      code: 'PRS-01',
      city: 'Kota Mandiri',
      logo: '🏪',
      primaryColor: '#059669',
      documentCount: 34,
    },
    {
      id: 'tenant-rsud',
      name: 'RSUD Sehat Madani (BLUD)',
      shortName: 'RSUD Sehat',
      sector: 'rsud',
      code: 'RSUD-SM',
      city: 'Kabupaten Madani',
      logo: '🏥',
      primaryColor: '#e11d48',
      documentCount: 62,
    },
    {
      id: 'tenant-trans',
      name: 'Perumda Transportasi Trans Metro',
      shortName: 'Trans Metro',
      sector: 'transportasi',
      code: 'TMD-09',
      city: 'Kota Metropolitan',
      logo: '🚌',
      primaryColor: '#ea580c',
      documentCount: 29,
    },
    {
      id: 'tenant-aneka',
      name: 'Perumda Aneka Usaha Karya Mandiri',
      shortName: 'Karya Mandiri',
      sector: 'aneka_usaha',
      code: 'AUKM-03',
      city: 'Kota Mandiri',
      logo: '🏢',
      primaryColor: '#7c3aed',
      documentCount: 22,
    },
  ];

  public users: User[] = [
    {
      id: 'user-admin',
      email: 'admin@apexpulse.id',
      name: 'Budi Santoso, S.Kom, M.T.',
      role: 'admin',
      tenantId: 'tenant-pdam',
      avatar: '👨‍💼',
    },
    {
      id: 'user-demo',
      email: 'demo@apexpulse.id',
      name: 'Siti Rahmawati, S.E. (Analis BUMD)',
      role: 'analis',
      tenantId: 'tenant-pdam',
      avatar: '👩‍💼',
    },
    {
      id: 'user-direksi',
      email: 'direksi@apexpulse.id',
      name: 'Dr. Ir. Hendra Kusuma (Direktur Utama)',
      role: 'direksi',
      tenantId: 'tenant-pdam',
      avatar: '👔',
    },
  ];

  public dashboards: Dashboard[] = [];

  public alertRules: AlertRule[] = [
    {
      id: 'alert-1',
      tenantId: 'tenant-pdam',
      title: 'Peringatan Ambang Batas NRW Air',
      metricKey: 'nrw',
      metricName: 'Tingkat Kehilangan Air (NRW)',
      operator: '>=',
      threshold: 25.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'warning',
      isActive: true,
      lastTriggered: '2026-03-31T08:00:00.000Z',
    },
    {
      id: 'alert-2',
      tenantId: 'tenant-bank',
      title: 'Peringatan Rasio NPL Kritis OJK',
      metricKey: 'npl',
      metricName: 'Rasio NPL Gross',
      operator: '>=',
      threshold: 5.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'critical',
      isActive: true,
    },
    {
      id: 'alert-3',
      tenantId: 'tenant-rsud',
      title: 'Kapasitas Tempat Tidur BOR Melampaui Batas',
      metricKey: 'bor',
      metricName: 'Bed Occupancy Rate (BOR)',
      operator: '>=',
      threshold: 85.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'warning',
      isActive: true,
    },
  ];

  public notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      tenantId: 'tenant-pdam',
      alertRuleId: 'alert-1',
      title: 'Evaluasi NRW Zona Timur Terdeteksi 22,4%',
      message: 'Tingkat kehilangan air di DMA-04 berada dalam batas kendali aman (< 25%).',
      severity: 'info',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isRead: false,
      metricValue: 22.4,
      threshold: 25.0,
      sentEmail: true,
    },
    {
      id: 'notif-2',
      tenantId: 'tenant-pdam',
      title: 'Laporan Triwulan I 2026 Siap Dicetak',
      message: 'Semua 6 widget telah memiliki sitasi sah dari dokumen LRA BPKP.',
      severity: 'info',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      isRead: false,
    },
  ];

  public auditLogs: AuditLog[] = [
    {
      id: 'audit-init',
      tenantId: 'tenant-pdam',
      userId: 'user-admin',
      userName: 'Budi Santoso',
      action: 'Inisialisasi Sistem',
      target: 'ApexPulse Engine',
      details: 'Sistem boot up dengan 6 tenant BUMD dan 40 preset katalog widget.',
      timestamp: new Date().toISOString(),
    },
  ];

  public systemConfig = {
    ragProvider: 'mock' as 'mock' | 'http',
    ragApiUrl: 'https://api-rag-bumd.pemda.go.id/v1',
    ragApiKey: 'rag_live_sec_*********',
    ragTimeoutSeconds: 60,
    defaultRagMode: 'structured' as 'structured' | 'prose',
    smtpHost: 'smtp.mailgun.org',
    smtpPort: 587,
    smtpUser: 'alert@bumd-pemda.go.id',
    smtpFrom: 'ApexPulse Alert System <alert@apexpulse.id>',
    auditRetentionDays: 90,
  };

  public shareTokens: Record<string, string> = {}; // token -> dashboardId

  constructor() {
    this.seedInitialDashboards();
  }

  private seedInitialDashboards() {
    const sectors: Array<{ sector: BumdSector; tenantId: string }> = [
      { sector: 'pdam', tenantId: 'tenant-pdam' },
      { sector: 'bank', tenantId: 'tenant-bank' },
      { sector: 'pasar', tenantId: 'tenant-pasar' },
      { sector: 'rsud', tenantId: 'tenant-rsud' },
      { sector: 'transportasi', tenantId: 'tenant-trans' },
      { sector: 'aneka_usaha', tenantId: 'tenant-aneka' },
    ];

    sectors.forEach(({ sector, tenantId }) => {
      const demo = getFallbackDemoDashboard(sector, tenantId);
      this.dashboards.push(demo);
    });
  }

  // Tenant-isolated getters and mutations
  getDashboards(tenantId: string): Dashboard[] {
    return this.dashboards.filter((d) => d.tenantId === tenantId);
  }

  getDashboardById(id: string, tenantId?: string): Dashboard | undefined {
    const d = this.dashboards.find((item) => item.id === id);
    if (!d) return undefined;
    if (tenantId && d.tenantId !== tenantId) return undefined; // Isolation guarantee!
    return d;
  }

  createDashboard(dashboard: Dashboard): Dashboard {
    this.dashboards.unshift(dashboard);
    return dashboard;
  }

  updateDashboard(id: string, partial: Partial<Dashboard>, tenantId: string): Dashboard | undefined {
    const idx = this.dashboards.findIndex((d) => d.id === id && d.tenantId === tenantId);
    if (idx === -1) return undefined;
    this.dashboards[idx] = {
      ...this.dashboards[idx],
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    return this.dashboards[idx];
  }

  deleteDashboard(id: string, tenantId: string): boolean {
    const initialLen = this.dashboards.length;
    this.dashboards = this.dashboards.filter((d) => !(d.id === id && d.tenantId === tenantId));
    return this.dashboards.length < initialLen;
  }

  duplicateDashboard(id: string, tenantId: string): Dashboard | undefined {
    const orig = this.getDashboardById(id, tenantId);
    if (!orig) return undefined;
    const copy: Dashboard = {
      ...orig,
      id: `dash-dup-${Date.now()}`,
      title: `${orig.title} (Salinan)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.dashboards.unshift(copy);
    return copy;
  }

  addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  // User Management
  createUser(user: User): User {
    this.users.push(user);
    return user;
  }

  updateUser(id: string, partial: Partial<User>): User | undefined {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.users[idx] = { ...this.users[idx], ...partial };
    return this.users[idx];
  }

  deleteUser(id: string): boolean {
    const len = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    return this.users.length < len;
  }

  // Tenant Management
  createTenant(tenant: Tenant): Tenant {
    this.tenants.push(tenant);
    return tenant;
  }

  updateTenant(id: string, partial: Partial<Tenant>): Tenant | undefined {
    const idx = this.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.tenants[idx] = { ...this.tenants[idx], ...partial };
    return this.tenants[idx];
  }
}

export const db = new InMemoryDb();
