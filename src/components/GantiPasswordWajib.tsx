import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';

/**
 * Layar wajib ganti kata sandi.
 *
 * Muncul saat akun masih memakai kata sandi sementara (dibuat admin / hasil
 * reset) atau kata sandi bawaan lama yang dipakai bersama. Server juga menolak
 * semua endpoint lain (`kode: MUST_CHANGE_PASSWORD`), jadi layar ini bukan satu-
 * satunya penjaga — hanya tampilannya.
 */
interface Props {
  /** Dipanggil setelah kata sandi berhasil diganti. */
  onSelesai: () => void;
  /** Keluar tanpa mengganti (sesi diakhiri). */
  onKeluar: () => void;
  namaPengguna?: string;
  /**
   * false = dibuka sendiri dari menu akun: teksnya bukan peringatan dan tombol
   * kiri menjadi Batal (memanggil `onKeluar` tanpa mengakhiri sesi).
   */
  wajib?: boolean;
}

export const GantiPasswordWajib: React.FC<Props> = ({ onSelesai, onKeluar, namaPengguna, wajib = true }) => {
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan(null);
    if (baru !== ulangi) {
      setPesan('Kata sandi baru dan ulangannya tidak sama.');
      return;
    }
    setSedangSimpan(true);
    try {
      const res = await fetch('/api/auth/ganti-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lama, baru, ulangi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengganti kata sandi.');
      // Profil di localStorage dipakai boot UI; bersihkan penanda wajib-ganti.
      for (const store of [localStorage, sessionStorage]) {
        const mentah = store.getItem('aionesboard_user');
        if (!mentah) continue;
        try {
          store.setItem(
            'aionesboard_user',
            JSON.stringify({ ...JSON.parse(mentah), mustChangePassword: false })
          );
        } catch {
          // profil rusak — biarkan, server tetap sumber kebenaran
        }
      }
      onSelesai();
    } catch (err: any) {
      setPesan(err?.message || 'Gagal mengganti kata sandi.');
    } finally {
      setSedangSimpan(false);
    }
  };

  // Dibuka dari menu akun: Esc menutup formulir. Layar wajib tidak bisa ditutup.
  useEffect(() => {
    if (wajib) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onKeluar();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [wajib, onKeluar]);

  // Syarat yang sama dengan server, dicentang selagi pengguna mengetik.
  const syarat = [
    { label: 'Minimal 10 karakter', ok: baru.length >= 10 },
    { label: 'Ada huruf dan angka', ok: /[a-z]/i.test(baru) && /\d/.test(baru) },
    { label: 'Kedua kata sandi baru sama', ok: baru.length > 0 && baru === ulangi },
  ];

  // Portal ke body: tanpa ini lapisan gelap ikut terkurung di dalam sidebar.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-[2px] px-4"
      onMouseDown={wajib ? undefined : (e) => e.target === e.currentTarget && onKeluar()}
    >
      <form
        onSubmit={simpan}
        role="dialog"
        aria-label="Ganti kata sandi"
        className="relative w-full max-w-[420px] rounded-card border border-line bg-surface p-6 text-ink shadow-pop"
      >
        {!wajib && (
          <button
            type="button"
            onClick={onKeluar}
            aria-label="Tutup"
            className="absolute right-3 top-3 p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-control bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Keamanan akun</p>
            <h2 className="text-[17px] font-bold leading-tight">Ganti kata sandi</h2>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-2 leading-relaxed">
          {wajib
            ? `${namaPengguna ? `${namaPengguna}, ` : ''}akun ini masih memakai kata sandi sementara. Ganti dulu sebelum memakai aplikasi.`
            : 'Masukkan kata sandi saat ini, lalu buat kata sandi baru.'}
        </p>

        <div className="mt-5 space-y-3.5">
          <IsianSandi label="Kata sandi saat ini" value={lama} onChange={setLama} autoComplete="current-password" autoFocus />
          <IsianSandi label="Kata sandi baru" value={baru} onChange={setBaru} autoComplete="new-password" minLength={10} />
          <IsianSandi label="Ulangi kata sandi baru" value={ulangi} onChange={setUlangi} autoComplete="new-password" minLength={10} />
        </div>

        <ul className="mt-3 space-y-1">
          {syarat.map((s) => (
            <li key={s.label} className={`flex items-center gap-1.5 text-[11.5px] ${s.ok ? 'text-pos' : 'text-ink-3'}`}>
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                  s.ok ? 'bg-pos border-pos text-white' : 'border-line-strong'
                }`}
              >
                {s.ok && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </span>
              {s.label}
            </li>
          ))}
          <li className="text-[11px] text-ink-3 pl-5">Tidak boleh memuat bagian dari email Anda.</li>
        </ul>

        {pesan && (
          <p role="alert" className="mt-3 rounded-control border border-neg/30 bg-neg/10 px-3 py-2 text-[12.5px] font-medium text-neg">
            {pesan}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onKeluar}
            className="text-[13px] font-semibold px-4 py-2 rounded-control border border-line text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {wajib ? 'Keluar' : 'Batal'}
          </button>
          <button
            type="submit"
            disabled={sedangSimpan}
            className="inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-[13px] font-bold text-on-brand hover:brightness-95 disabled:opacity-60"
          >
            {sedangSimpan && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan kata sandi
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

/** Isian kata sandi dengan tombol lihat/sembunyikan. */
const IsianSandi: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  autoFocus?: boolean;
}> = ({ label, value, onChange, autoComplete, minLength, autoFocus }) => {
  const [lihat, setLihat] = useState(false);
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink-2">{label}</span>
      <span className="mt-1 flex items-center rounded-control border border-line bg-surface-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25 transition-colors">
        <input
          type={lihat ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setLihat((v) => !v)}
          aria-label={lihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
          className="px-2.5 text-ink-3 hover:text-ink"
          tabIndex={-1}
        >
          {lihat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
    </label>
  );
};
