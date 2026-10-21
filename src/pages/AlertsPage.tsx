import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, Plus, RefreshCw, Search, Mail, Pencil, Trash2, X, Power } from 'lucide-react';
import { AlertRule, NotificationItem } from '../types';
import { ItemCard } from '../components/ui/ItemCard';

interface AlertsPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ tenantId, onBackToWorkspace }) => {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notifications' | 'rules'>('notifications');
  const [searchQuery, setSearchQuery] = useState('');
  /** Aturan yang sedang diedit (null = modal tertutup). */
  const [ruleEdit, setRuleEdit] = useState<AlertRule | null>(null);
  const [form, setForm] = useState({
    title: '',
    metricName: '',
    operator: '>' as AlertRule['operator'],
    threshold: 0,
    unit: '',
    severity: 'warning' as AlertRule['severity'],
    isActive: true,
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesanAksi, setPesanAksi] = useState('');

  const bukaEdit = (rule: AlertRule) => {
    setRuleEdit(rule);
    setPesanAksi('');
    setForm({
      title: rule.title || rule.metricName,
      metricName: rule.metricName,
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit || '',
      severity: rule.severity,
      isActive: rule.isActive,
    });
  };

  const simpanEdit = async () => {
    if (!ruleEdit) return;
    setMenyimpan(true);
    setPesanAksi('');
    try {
      const res = await fetch(`/api/alerts/${ruleEdit.id}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menyimpan (HTTP ${res.status}).`);
      setRuleEdit(null);
      fetchAlertsData();
    } catch (err) {
      setPesanAksi(err instanceof Error ? err.message : 'Gagal menyimpan aturan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const hapusRule = async (rule: AlertRule) => {
    if (!window.confirm(`Hapus aturan "${rule.metricName} ${rule.operator} ${rule.threshold} ${rule.unit}"?`)) return;
    setPesanAksi('');
    try {
      const res = await fetch(`/api/alerts/${rule.id}?tenantId=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menghapus (HTTP ${res.status}).`);
      if (ruleEdit?.id === rule.id) setRuleEdit(null);
      fetchAlertsData();
    } catch (err) {
      setPesanAksi(err instanceof Error ? err.message : 'Gagal menghapus aturan.');
    }
  };

  const alihkanAktif = async (rule: AlertRule) => {
    setPesanAksi('');
    try {
      const res = await fetch(`/api/alerts/${rule.id}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Gagal mengubah status (HTTP ${res.status}).`);
      }
      fetchAlertsData();
    } catch (err) {
      setPesanAksi(err instanceof Error ? err.message : 'Gagal mengubah status aturan.');
    }
  };

  const fetchAlertsData = () => {
    setIsLoading(true);
    Promise.all([
      fetch(`/api/alerts?tenantId=${tenantId}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/notifications?tenantId=${tenantId}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([rules, notes]) => {
        if (Array.isArray(rules)) setAlertRules(rules);
        if (Array.isArray(notes)) setNotifications(notes);
      })
      .catch((err) => console.error('Failed to fetch alerts data:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAlertsData();
  }, [tenantId]);

  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRules = alertRules.filter(
    (r) =>
      r.metricName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${r.threshold}`.includes(searchQuery)
  );

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Page Header Header & Description */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-neg flex items-center justify-center text-on-neg shrink-0 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
                Ambang Batas & Peringatan Otomatis (Alerts)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-neg/15 text-neg border border-neg/30 font-semibold">
                  {notifications.filter((n) => !n.isRead).length} Belum Dibaca
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Pemantauan ambang batas indikator kualitatif/kuantitatif secara real-time dan notifikasi potensi risiko
              </p>
            </div>
          </div>

          <button
            onClick={fetchAlertsData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Tab Navigation & Search */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-line">
            {/* Tabs */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Notifikasi Masuk ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'rules'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Aturan Ambang Batas ({alertRules.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
              <input
                type="text"
                placeholder="Cari notifikasi / aturan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-surface-2 border border-line rounded-control pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand text-ink placeholder:text-ink-3"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-ink-3">Memuat data ambang batas...</div>
            ) : activeTab === 'notifications' ? (
              filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-xs text-ink-3">Tidak ada notifikasi ditemukan.</div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((item) => {
                    const warna =
                      item.severity === 'critical'
                        ? 'var(--color-neg)'
                        : item.severity === 'warning'
                        ? 'var(--color-warn)'
                        : 'var(--color-brand)';
                    return (
                      <ItemCard
                        key={item.id}
                        accent={warna}
                        icon={
                          item.severity === 'critical' ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : item.severity === 'warning' ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )
                        }
                        title={item.title}
                        meta={
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-2 font-semibold uppercase mr-1.5">
                              {item.severity}
                            </span>
                            {item.metricValue !== undefined && item.threshold !== undefined
                              ? `Nilai ${item.metricValue} vs ambang ${item.threshold}`
                              : 'Sistem'}
                          </>
                        }
                        trailing={
                          <>
                            {item.sentEmail && (
                              <span className="inline-flex items-center gap-1 text-pos text-[10px] font-semibold">
                                <Mail className="w-3 h-3" />
                                Terkirim
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-ink-3">
                              {new Date(item.timestamp).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </>
                        }
                      >
                        <span className="block text-xs text-ink-2 leading-relaxed mt-1.5">{item.message}</span>
                      </ItemCard>
                    );
                  })}
                </div>
              )
            ) : (
              /* Rules Tab */
              filteredRules.length === 0 ? (
                <div className="text-center py-12 text-xs text-ink-3">Tidak ada aturan ambang batas.</div>
              ) : (
                <div className="space-y-2">
                  {pesanAksi && !ruleEdit && (
                    <div className="text-[11px] rounded-control p-2 border bg-neg/15 border-neg/30 text-neg flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{pesanAksi}</span>
                    </div>
                  )}
                <div className="overflow-x-auto border border-line rounded-card">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                      <tr>
                        <th className="p-3">Metrik Indikator</th>
                        <th className="p-3">Kondisi Ambang Batas</th>
                        <th className="p-3">Kanal Notifikasi</th>
                        <th className="p-3">Tingkat Keparahan</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink-2">
                      {filteredRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="p-3 font-semibold text-ink">{rule.metricName}</td>
                          <td className="p-3 font-mono text-[11px] text-ink-2">
                            {rule.metricName} {rule.operator} {rule.threshold} {rule.unit}
                          </td>
                          <td className="p-3 text-ink-2">{rule.channels.join(' & ')}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                                rule.severity === 'critical'
                                  ? 'bg-neg/15 text-neg'
                                  : rule.severity === 'warning'
                                  ? 'bg-warn/15 text-warn'
                                  : 'bg-surface-2 text-ink'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="p-3">
                            {rule.isActive ? (
                              <span className="inline-flex items-center gap-1 text-pos font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-ink-3 font-semibold text-[11px]">
                                <Power className="w-3.5 h-3.5" />
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => alihkanAktif(rule)}
                                title={rule.isActive ? 'Nonaktifkan aturan' : 'Aktifkan aturan'}
                                className="p-1.5 rounded-chip text-ink-3 hover:text-ink hover:bg-line/60 transition-colors"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => bukaEdit(rule)}
                                title="Ubah aturan"
                                className="p-1.5 rounded-chip text-brand hover:bg-brand/10 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void hapusRule(rule)}
                                title="Hapus aturan"
                                className="p-1.5 rounded-chip text-neg hover:bg-neg/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {ruleEdit && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="scrim" onClick={() => setRuleEdit(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-edit-aturan"
            className="relative w-full max-w-md bg-surface rounded-card border border-line shadow-2xl z-10 overflow-hidden"
          >
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
              <h2 id="judul-edit-aturan" className="text-sm font-semibold text-ink flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand" />
                Ubah Aturan Ambang Batas
              </h2>
              <button
                type="button"
                onClick={() => setRuleEdit(null)}
                className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="edit-metrik" className="block text-ink font-semibold">Metrik Indikator</label>
                <input
                  id="edit-metrik"
                  value={form.metricName}
                  onChange={(e) => setForm({ ...form, metricName: e.target.value })}
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="edit-operator" className="block text-ink font-semibold">Operator</label>
                  <select
                    id="edit-operator"
                    value={form.operator}
                    onChange={(e) => setForm({ ...form, operator: e.target.value as AlertRule['operator'] })}
                    className="w-full px-2 py-2 border border-line rounded-control bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value=">">&gt;</option>
                    <option value=">=">&ge;</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&le;</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-ambang" className="block text-ink font-semibold">Ambang</label>
                  <input
                    id="edit-ambang"
                    type="number"
                    step="any"
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                    className="w-full px-2 py-2 border border-line rounded-control bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-satuan" className="block text-ink font-semibold">Satuan</label>
                  <input
                    id="edit-satuan"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-2 py-2 border border-line rounded-control bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="edit-keparahan" className="block text-ink font-semibold">Tingkat Keparahan</label>
                <select
                  id="edit-keparahan"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as AlertRule['severity'] })}
                  className="w-full px-2 py-2 border border-line rounded-control bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-line text-brand focus:ring-brand"
                />
                <span>Aturan aktif (dievaluasi saat ambang batas diperiksa)</span>
              </label>
              {pesanAksi && (
                <div className="text-[11px] rounded-control p-2 border bg-neg/15 border-neg/30 text-neg flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pesanAksi}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRuleEdit(null)}
                  className="px-3 py-2 rounded-control border border-line text-ink-2 hover:bg-line/60 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void simpanEdit()}
                  disabled={menyimpan}
                  className="px-3 py-2 rounded-control bg-brand text-on-brand font-medium hover:brightness-95 transition-colors disabled:opacity-50"
                >
                  {menyimpan ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
