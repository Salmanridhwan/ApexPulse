import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Plus,
  Radio,
  Send,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import { AlertRule, NotificationItem } from '../types';
import { ItemCard } from './ui/ItemCard';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  alertRules: AlertRule[];
  notifications: NotificationItem[];
  onTriggerEvaluate: () => void;
  onAddRule: (rule: Partial<AlertRule>) => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  alertRules,
  notifications,
  onTriggerEvaluate,
  onAddRule,
}) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'rules' | 'create'>('notifications');

  // New Rule Form
  const [title, setTitle] = useState('');
  const [metricName, setMetricName] = useState('');
  const [operator, setOperator] = useState<'>=' | '<=' | '>' | '<'>('>=');
  const [threshold, setThreshold] = useState<number>(25);
  const [unit, setUnit] = useState('%');
  const [emailNotification, setEmailNotification] = useState(true);

  if (!isOpen) return null;

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !metricName) return;

    onAddRule({
      tenantId,
      title,
      metricKey: metricName.toLowerCase().replace(/\s+/g, '_'),
      metricName,
      operator,
      threshold,
      unit,
      channels: emailNotification ? ['in_app', 'email'] : ['in_app'],
      severity: 'warning',
      isActive: true,
    });

    setTitle('');
    setMetricName('');
    setActiveTab('rules');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-neg flex items-center justify-center text-white">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Pusat Peringatan & Ambang Batas (Alert System)
              </h2>
              <p className="text-xs text-ink-2">Notifikasi In-App & Email SMTP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-line bg-surface-2/50 px-4 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'notifications'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Notifikasi Aktif ({notifications.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'rules'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Daftar Aturan ({alertRules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'create'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Buat Aturan Baru</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {activeTab === 'notifications' ? (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <span className="text-ink-2">Peringatan yang dipicu evaluasi metrik dokumen:</span>
                <button
                  onClick={onTriggerEvaluate}
                  className="px-2.5 py-1 bg-neg/15 text-neg hover:bg-neg/10 border border-neg/30 rounded-control text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Radio className="w-3 h-3 text-neg animate-pulse" />
                  <span>Jalankan Evaluasi Ambang Sekarang</span>
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-8 text-ink-3">
                  Semua indikator berada dalam batas aman. Belum ada peringatan aktif.
                </div>
              ) : (
                notifications.map((notif) => {
                  const warna =
                    notif.severity === 'critical'
                      ? 'var(--color-neg)'
                      : notif.severity === 'warning'
                      ? 'var(--color-warn)'
                      : 'var(--color-brand)';
                  return (
                    <ItemCard
                      key={notif.id}
                      accent={warna}
                      icon={
                        notif.severity === 'critical' ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )
                      }
                      title={notif.title}
                      trailing={
                        <span className="text-[10px] font-mono text-ink-3">
                          {new Date(notif.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      }
                    >
                      <span className="block mt-1.5 text-xs text-ink-2 leading-relaxed">{notif.message}</span>
                    </ItemCard>
                  );
                })
              )}
            </>
          ) : activeTab === 'rules' ? (
            <>
              {alertRules.map((rule) => (
                <ItemCard
                  key={rule.id}
                  accent={rule.severity === 'critical' ? 'var(--color-neg)' : 'var(--color-warn)'}
                  icon={<Sliders className="w-4 h-4" />}
                  title={rule.title}
                  trailing={
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rule.severity === 'critical'
                          ? 'bg-neg/15 text-neg'
                          : 'bg-warn/15 text-warn'
                        }`}
                    >
                      {rule.severity.toUpperCase()}
                    </span>
                  }
                >
                  <span className="block text-ink-2 mt-1.5">
                    Kondisi: <strong>{rule.metricName}</strong> {rule.operator} {rule.threshold}{' '}
                    {rule.unit}
                  </span>
                  <span className="flex items-center gap-3 pt-1 text-[11px] text-ink-3">
                    <span>Kanal: {rule.channels.join(', ')}</span>
                    <span>•</span>
                    <span className="text-pos font-medium">Status: Aktif</span>
                  </span>
                </ItemCard>
              ))}
            </>
          ) : (
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Judul Peringatan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Peringatan NPL Bank melampaui batas OJK"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Nama Indikator / Metrik
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rasio NPL Gross atau Kehilangan Air NRW"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Operator</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value as any)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value=">=">&gt;= (Lebih atau sama)</option>
                    <option value="<=">&lt;= (Kurang atau sama)</option>
                    <option value=">">&gt; (Lebih dari)</option>
                    <option value="<">&lt; (Kurang dari)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Nilai Batas</label>
                  <input
                    type="number"
                    step="any"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Satuan</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotification}
                    onChange={(e) => setEmailNotification(e.target.checked)}
                    className="rounded text-brand focus:ring-brand"
                  />
                  <span className="text-ink-2 font-medium">
                    Kirimkan juga salinan email notifikasi ke Direksi / BPKP (SMTP)
                  </span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2 bg-pos hover:bg-pos text-white rounded-control font-medium transition-colors"
                >
                  Simpan Aturan Ambang Batas
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex items-center justify-between">
          <span className="text-[11px] text-ink-3">
            Monitoring Kepatuhan Regulasi BUMD
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ink hover:bg-ink/90 text-white text-xs font-medium rounded-control transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
