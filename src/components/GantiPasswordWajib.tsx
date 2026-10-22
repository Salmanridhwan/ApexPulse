import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';

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
}

export const GantiPasswordWajib: React.FC<Props> = ({ onSelesai, onKeluar, namaPengguna }) => {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1b33]/80 px-4">
      <form
        onSubmit={simpan}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2 text-[#0057ff]">
          <KeyRound size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Keamanan Akun</span>
        </div>
        <h2 className="text-xl font-black text-[#0a1b33]">Ganti kata sandi Anda</h2>
        <p className="mt-1 text-sm text-slate-600">
          {namaPengguna ? `${namaPengguna}, ` : ''}
          akun ini masih memakai kata sandi sementara. Ganti dulu sebelum memakai aplikasi.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Kata sandi saat ini</span>
            <input
              type="password"
              value={lama}
              onChange={(e) => setLama(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0057ff] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Kata sandi baru</span>
            <input
              type="password"
              value={baru}
              onChange={(e) => setBaru(e.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0057ff] focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Minimal 10 karakter, ada huruf dan angka, tidak memuat bagian email Anda.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Ulangi kata sandi baru</span>
            <input
              type="password"
              value={ulangi}
              onChange={(e) => setUlangi(e.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0057ff] focus:outline-none"
            />
          </label>
        </div>

        {pesan && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{pesan}</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onKeluar}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Keluar
          </button>
          <button
            type="submit"
            disabled={sedangSimpan}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0057ff] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {sedangSimpan && <Loader2 size={15} className="animate-spin" />}
            Simpan kata sandi
          </button>
        </div>
      </form>
    </div>
  );
};
