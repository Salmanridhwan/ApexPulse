import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, Plus, RefreshCw, Search, Mail } from 'lucide-react';
import { AlertRule, NotificationItem } from '../types';

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
    <div className="flex-1 bg-blue-50 min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Page Header Header & Description */}
        <div className="bg-white p-5 rounded-xl border border-blue-100 mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-blue-900 flex items-center gap-2.5 flex-wrap">
                Ambang Batas & Peringatan Otomatis (Alerts)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-semibold">
                  {notifications.filter((n) => !n.isRead).length} Belum Dibaca
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
                Pemantauan ambang batas indikator kualitatif/kuantitatif secara real-time dan notifikasi potensi risiko
              </p>
            </div>
          </div>

          <button
            onClick={fetchAlertsData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Tab Navigation & Search */}
        <div className="bg-white p-5 rounded-xl border border-blue-100 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Tabs */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-800'
                }`}
              >
                Notifikasi Masuk ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'rules'
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-800'
                }`}
              >
                Aturan Ambang Batas ({alertRules.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari notifikasi / aturan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Memuat data ambang batas...</div>
            ) : activeTab === 'notifications' ? (
              filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">Tidak ada notifikasi ditemukan.</div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-colors flex items-start gap-3.5 ${
                        item.severity === 'critical'
                          ? 'bg-rose-50/50 border-rose-200'
                          : item.severity === 'warning'
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-blue-50/50 border-blue-100'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white mt-0.5 ${
                          item.severity === 'critical'
                            ? 'bg-rose-600'
                            : item.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                      >
                        {item.severity === 'critical' ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : item.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-xs font-bold text-slate-900 truncate">{item.title}</h3>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(item.timestamp).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{item.message}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                            {item.severity}
                          </span>
                          <span className="text-slate-400">
                            {item.metricValue !== undefined && item.threshold !== undefined
                              ? `Nilai ${item.metricValue} vs ambang ${item.threshold}`
                              : 'Sistem'}
                          </span>
                          {item.sentEmail && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <Mail className="w-3 h-3" />
                              Email terkirim
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Rules Tab */
              filteredRules.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">Tidak ada aturan ambang batas.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Metrik Indikator</th>
                        <th className="p-3">Kondisi Ambang Batas</th>
                        <th className="p-3">Kanal Notifikasi</th>
                        <th className="p-3">Tingkat Keparahan</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-semibold text-slate-900">{rule.metricName}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-600">
                            {rule.metricName} {rule.operator} {rule.threshold} {rule.unit}
                          </td>
                          <td className="p-3 text-slate-600">{rule.channels.join(' & ')}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                                rule.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800'
                                  : rule.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aktif
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
