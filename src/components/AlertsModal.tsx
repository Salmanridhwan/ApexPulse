import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Mail,
  Plus,
  Radio,
  Send,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import { AlertRule, NotificationItem } from '../types';

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
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Pusat Peringatan & Ambang Batas (Alert System)
              </h2>
              <p className="text-xs text-slate-500">Notifikasi In-App & Simulasi Dispatch Email SMTP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Notifikasi Aktif ({notifications.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Daftar Aturan ({alertRules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Peringatan yang dipicu evaluasi metrik dokumen:</span>
                <button
                  onClick={onTriggerEvaluate}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Radio className="w-3 h-3 text-rose-600 animate-pulse" />
                  <span>Jalankan Evaluasi Ambang Sekarang</span>
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Semua indikator berada dalam batas aman. Belum ada peringatan aktif.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      notif.severity === 'critical'
                        ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                        : notif.severity === 'warning'
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert
                          className={`w-4 h-4 ${
                            notif.severity === 'critical'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        />
                        <h4 className="font-semibold">{notif.title}</h4>
                      </div>
                      <span className="text-[10px] opacity-60">
                        {new Date(notif.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="mt-1 text-xs opacity-90 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.sentEmail && (
                      <div className="mt-2 pt-2 border-t border-rose-200/50 flex items-center gap-1.5 text-[10px] text-rose-700">
                        <Mail className="w-3 h-3" />
                        <span>Notifikasi telah disimulasikan terkirim ke email Direksi & BPKP</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          ) : activeTab === 'rules' ? (
            <>
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{rule.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        rule.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rule.severity.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-slate-500">
                    Kondisi: <strong>{rule.metricName}</strong> {rule.operator} {rule.threshold}{' '}
                    {rule.unit}
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <span>Kanal: {rule.channels.join(', ')}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">Status: Aktif</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Judul Peringatan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Peringatan NPL Bank melampaui batas OJK"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Indikator / Metrik
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rasio NPL Gross atau Kehilangan Air NRW"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Operator</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value=">=">&gt;= (Lebih atau sama)</option>
                    <option value="<=">&lt;= (Kurang atau sama)</option>
                    <option value=">">&gt; (Lebih dari)</option>
                    <option value="<">&lt; (Kurang dari)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nilai Batas</label>
                  <input
                    type="number"
                    step="any"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Satuan</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotification}
                    onChange={(e) => setEmailNotification(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-slate-700 font-medium">
                    Kirimkan juga salinan email notifikasi ke Direksi / BPKP (SMTP)
                  </span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Simpan Aturan Ambang Batas
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Monitoring Kepatuhan Regulasi BUMD
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
