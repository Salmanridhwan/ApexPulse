import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, ShieldAlert, RefreshCw, Search, Mail } from 'lucide-react';
import { NotificationItem } from '../types';
import { ItemCard } from '../components/ui/ItemCard';

interface AlertsPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
}

/**
 * Kotak masuk notifikasi. Fitur aturan ambang batas sudah dihapus, tetapi
 * notifikasi tetap ditulis oleh fitur lain (reset password, permintaan data).
 */
export const AlertsPage: React.FC<AlertsPageProps> = ({ tenantId }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const muatNotifikasi = () => {
    setIsLoading(true);
    fetch(`/api/notifications?tenantId=${tenantId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((notes) => {
        if (Array.isArray(notes)) setNotifications(notes);
      })
      .catch((err) => console.error('Gagal memuat notifikasi:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    muatNotifikasi();
  }, [tenantId]);

  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
                Notifikasi
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-neg/15 text-neg border border-neg/30 font-semibold">
                  {notifications.filter((n) => !n.isRead).length} Belum Dibaca
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Pemberitahuan sistem, misalnya reset password dan permintaan data
              </p>
            </div>
          </div>

          <button
            onClick={muatNotifikasi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="bg-surface p-5 rounded-card border border-line mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-line">
            <h2 className="text-xs font-bold text-ink w-full sm:w-auto">
              Notifikasi Masuk ({notifications.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
              <input
                type="text"
                placeholder="Cari notifikasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-surface-2 border border-line rounded-control pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand text-ink placeholder:text-ink-3"
              />
            </div>
          </div>

          <div className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-ink-3">Memuat notifikasi...</div>
            ) : filteredNotifications.length === 0 ? (
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
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-2 font-semibold uppercase mr-1.5">
                          {item.severity}
                        </span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
