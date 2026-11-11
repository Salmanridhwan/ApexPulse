import React from 'react';
import { ArrowRight, Database, LayoutTemplate, X } from 'lucide-react';

/**
 * LAYAR PILIH CARA MEMBUAT DASHBOARD.
 *
 * Dua jalur yang ditawarkan ke pengguna, sesuai dua sumber data yang benar-benar
 * ada di aplikasi:
 *
 * 1. Dari data permintaan pengguna — daftar data yang sudah terbaca dari dokumen
 *    instansi, dikelompokkan per kategori, lalu pengguna mencentang yang mau
 *    ditampilkan.
 * 2. Dari template — galeri Template Dashboard (susunan halaman + gaya tampilan
 *    dipilih terpisah).
 *
 * Kanvas kosong tetap bisa dipilih lewat tautan kecil di bawah, karena sebagian
 * pengguna memang ingin menyusun sendiri lewat asisten di kanvas.
 */
interface Props {
  onTutup: () => void;
  onPilihData: () => void;
  /** Kosong untuk non-admin: kartu "Dari template" tidak tampil. */
  onPilihTemplate?: () => void;
  /** Kanvas kosong seperti perilaku lama. */
  onKanvasKosong: () => void;
  /** Jumlah butir data siap pakai, untuk menyebut angka nyata di kartu. */
  jumlahData?: number;
}

export const PilihCaraBuat: React.FC<Props> = ({ onTutup, onPilihData, onPilihTemplate, onKanvasKosong, jumlahData }) => {
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onTutup}
      data-testid="modal-pilih-cara-buat"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl bg-surface border border-line rounded-card shadow-xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Buat dashboard baru</h3>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed">
              Pilih sumbernya dulu. Keduanya bisa diubah lagi lewat asisten di kanvas.
            </p>
          </div>
          <button
            onClick={onTutup}
            className="p-1.5 rounded-control text-ink-3 hover:bg-surface-2 shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <button
            onClick={onPilihData}
            data-testid="pilih-cara-data"
            className="group text-left p-4 rounded-card border border-line bg-surface-1 hover:border-brand/50 hover:bg-surface-2 transition-colors"
          >
            <div className="w-10 h-10 rounded-control bg-brand/10 text-brand-ink flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink">Dari data permintaan</span>
              <ArrowRight className="w-3.5 h-3.5 text-ink-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-ink-2 mt-1 leading-relaxed">
              Data yang sudah terbaca dari dokumen instansi, dikelompokkan per kategori. Centang yang mau
              ditampilkan.
            </p>
            <p className="text-[10px] text-ink-3 mt-2">
              {jumlahData === undefined
                ? 'Memuat jumlah data…'
                : jumlahData > 0
                  ? `${jumlahData} data siap dipilih`
                  : 'Belum ada data siap pakai'}
            </p>
          </button>

          {onPilihTemplate && (
          <button
            onClick={onPilihTemplate}
            data-testid="pilih-cara-template"
            className="group text-left p-4 rounded-card border border-line bg-surface-1 hover:border-brand/50 hover:bg-surface-2 transition-colors"
          >
            <div className="w-10 h-10 rounded-control bg-coral/10 text-coral flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink">Dari template</span>
              <ArrowRight className="w-3.5 h-3.5 text-ink-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-ink-2 mt-1 leading-relaxed">
              Deck rapat siap pakai: susunan halaman, kartu, dan gaya tampilan sudah ditentukan. Angkanya
              diambil dari dokumen instansi.
            </p>
            <p className="text-[10px] text-ink-3 mt-2">Galeri Template Dashboard</p>
          </button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={onKanvasKosong}
            data-testid="pilih-cara-kosong"
            className="text-[11px] text-ink-3 hover:text-ink underline underline-offset-2"
          >
            Mulai kanvas kosong
          </button>
          <button
            onClick={onTutup}
            className="px-4 py-2 text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
