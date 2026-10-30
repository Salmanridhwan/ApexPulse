import { Copy, LayoutGrid, Trash2 } from 'lucide-react';
import type { Dashboard } from '../types';

interface Props {
  aksi?: 'hapus' | 'duplikat' | 'buat';
  dashboard?: Dashboard;
  onKonfirmasi: () => void;
  onBatal: () => void;
}

/** Modal konfirmasi hapus/duplikat dashboard, dipakai daftar dashboard dan menu topbar. */
export function ModalKonfirmasiDashboard({ aksi = 'hapus', dashboard, onKonfirmasi, onBatal }: Props) {
  const hapus = aksi === 'hapus';
  const buat = aksi === 'buat';
  const jumlah = dashboard?.widgets?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onBatal}
      data-testid={`modal-${aksi}-dashboard`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-surface border border-line rounded-card shadow-xl px-6 pt-8 pb-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ikon dengan lingkaran halo */}
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${hapus ? 'bg-neg/10' : 'bg-brand/10'}`}>
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${hapus ? 'bg-neg/20 text-neg' : 'bg-brand/20 text-brand-ink'}`}>
            {hapus ? <Trash2 className="w-5 h-5" /> : buat ? <LayoutGrid className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </div>
        </div>

        <h3 className="text-base font-bold text-ink mt-5">
          {hapus ? 'Hapus dashboard?' : buat ? 'Buat dashboard baru?' : 'Duplikat dashboard?'}
        </h3>

        {dashboard && (
        <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-control bg-surface-2 border border-line px-3 py-1.5">
          <span className="text-xs font-semibold text-ink truncate">{dashboard.title}</span>
          <span className="text-[11px] text-ink-2 shrink-0">{jumlah} widget</span>
        </div>
        )}

        <p className="text-xs text-ink-2 leading-relaxed mt-3">
          {hapus
            ? 'Dashboard dan semua widgetnya dihapus permanen. Tindakan ini tidak bisa dibatalkan.'
            : buat
              ? 'Dashboard kosong dibuat dan langsung terbuka. Widget bisa ditambahkan setelahnya.'
              : 'Salinan dibuat sebagai dashboard baru. Dashboard asli tidak berubah.'}
        </p>

        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <button
            onClick={onBatal}
            className="py-2.5 text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onKonfirmasi}
            autoFocus
            className={`py-2.5 text-xs font-bold rounded-control transition-colors ${hapus ? 'text-on-neg bg-neg hover:bg-neg' : 'text-on-solid bg-solid hover:bg-solid'}`}
          >
            {hapus ? 'Ya, Hapus' : buat ? 'Ya, Buat' : 'Ya, Duplikat'}
          </button>
        </div>
      </div>
    </div>
  );
}
