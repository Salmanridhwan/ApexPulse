import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ tenantId, onBackToWorkspace }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/audit-logs?tenantId=${tenantId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch((err) => console.error('Failed to fetch audit logs:', err))
      .finally(() => setIsLoading(false));
  }, [tenantId]);

  return (
    <div className="flex-1 bg-surface-2 min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Judul & keterangan */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-ink flex items-center justify-center text-white shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
              Log Audit Sistem & Rekam Jejak Kepatuhan (F-14 & F-21)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-2 text-brand-ink border border-line font-semibold">
                {logs.length} Entri
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
              Seluruh pembuatan, perubahan widget, dan koreksi manual tercatat secara permanen
            </p>
          </div>
        </div>

        {/* Tabel jejak audit */}
        <div className="bg-surface p-5 rounded-card border border-line">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-ink-3">Memuat riwayat audit...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-xs text-ink-3">Belum ada aktivitas tercatat.</div>
          ) : (
            <div className="overflow-x-auto border border-line rounded-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Target / Entitas</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Detail Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-2">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="p-3 whitespace-nowrap text-ink-3 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="p-3 font-semibold text-ink">{log.action}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-surface-2 text-ink-2 font-medium">
                          {log.target}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-ink">{log.userName}</td>
                      <td className="p-3 text-ink-2 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
