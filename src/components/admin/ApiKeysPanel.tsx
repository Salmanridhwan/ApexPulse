import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { Tenant } from '../../types';

/**
 * PANEL KUNCI API PLATFORM MITRA (khusus superadmin).
 *
 * Kunci dibuat di sini, diserahkan ke platform lain, dan dipakai lewat header
 * `X-API-Key` pada endpoint biasa: unggah dokumen, analisis dokumen, lalu susun
 * dashboard. Chat TIDAK termasuk — platform memakai kunci modelnya sendiri.
 *
 * Kunci asli hanya tampil SEKALI (setelah dibuat); server hanya menyimpan
 * SHA-256-nya, jadi tombol "lihat lagi" memang tidak ada.
 */

export interface KunciApiKlien {
  id: string;
  nama: string;
  awalan: string;
  tenantId: string;
  instansi: string;
  izin: string[];
  dibuatPada: string;
  kedaluwarsaPada?: string;
  dicabutPada?: string;
  terakhirDipakai?: string;
  jumlahPermintaan: number;
  dibuatOleh?: { userId: string; name: string };
}

const LABEL_IZIN: Record<string, string> = {
  dokumen: 'Dokumen & analisis',
  dashboard: 'Dashboard',
};

/** Chip di tabel harus pendek supaya kolom Izin tidak melipat dua baris. */
const LABEL_IZIN_PENDEK: Record<string, string> = {
  dokumen: 'Dokumen',
  dashboard: 'Dashboard',
};

function waktu(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusKunci(k: KunciApiKlien): { label: string; kelas: string } {
  if (k.dicabutPada) return { label: 'Dicabut', kelas: 'bg-neg/10 text-neg border-neg/30' };
  if (k.kedaluwarsaPada && Date.parse(k.kedaluwarsaPada) <= Date.now()) {
    return { label: 'Kedaluwarsa', kelas: 'bg-warn/10 text-warn border-warn/30' };
  }
  return { label: 'Aktif', kelas: 'bg-pos/10 text-pos border-pos/30' };
}

export function ApiKeysPanel() {
  const [daftar, setDaftar] = useState<KunciApiKlien[]>([]);
  const [tenant, setTenant] = useState<Tenant[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kunciBaru, setKunciBaru] = useState('');
  const [tersalin, setTersalin] = useState(false);
  const [hapusId, setHapusId] = useState('');

  const [nama, setNama] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [izin, setIzin] = useState<string[]>(['dokumen', 'dashboard']);
  const [berlakuHari, setBerlakuHari] = useState(365);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const [rKunci, rTenant] = await Promise.all([
        fetch('/api/admin/api-keys', { credentials: 'same-origin' }),
        fetch('/api/tenants', { credentials: 'same-origin' }),
      ]);
      const jKunci = await rKunci.json().catch(() => ({}));
      const jTenant = await rTenant.json().catch(() => []);
      if (!rKunci.ok) throw new Error(jKunci?.error || 'Gagal memuat kunci API.');
      setDaftar(Array.isArray(jKunci.kunci) ? jKunci.kunci : []);
      setTenant(Array.isArray(jTenant) ? jTenant : []);
    } catch (err: any) {
      setGalat(String(err?.message || err));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const aktif = useMemo(() => daftar.filter((k) => !statusKunci(k).label.includes('Dicabut')), [daftar]);

  const buat = async () => {
    setMenyimpan(true);
    setGalat('');
    try {
      const r = await fetch('/api/admin/api-keys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, tenantId, izin, berlakuHari: Number(berlakuHari) || 0 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Gagal membuat kunci.');
      setKunciBaru(j.kunci);
      setTersalin(false);
      setFormTerbuka(false);
      setNama('');
      setTenantId('');
      setIzin(['dokumen', 'dashboard']);
      setBerlakuHari(365);
      await muat();
    } catch (err: any) {
      setGalat(String(err?.message || err));
    } finally {
      setMenyimpan(false);
    }
  };

  const ubahStatus = async (k: KunciApiKlien, cabut: boolean) => {
    setGalat('');
    const r = await fetch(`/api/admin/api-keys/${k.id}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cabut }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setGalat(j?.error || 'Gagal mengubah kunci.');
      return;
    }
    await muat();
  };

  const hapus = async (id: string) => {
    setGalat('');
    const r = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setGalat(j?.error || 'Gagal menghapus kunci.');
      return;
    }
    setHapusId('');
    await muat();
  };

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(kunciBaru);
      setTersalin(true);
    } catch {
      // Clipboard bisa diblokir; pengguna tetap bisa menyalin manual dari kotak.
      setTersalin(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="panel-api-keys">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-ink" />
              Kunci API platform mitra
            </h3>
            <p className="text-xs text-ink-2 mt-1 max-w-2xl leading-relaxed">
              Kunci ini dipakai platform lain (tanpa login) untuk <strong>mengunggah dokumen</strong>,
              menjalankan <strong>analisis dokumen</strong>, dan <strong>menyusun dashboard</strong> milik satu
              instansi. Chat dan asisten RAG aplikasi ini sengaja TIDAK ikut terbuka — platform memakai
              kunci modelnya sendiri.
            </p>
            <p className="text-[11px] text-ink-3 mt-2">
              Kunci hanya ditampilkan sekali saat dibuat. Server menyimpan hash SHA-256-nya, jadi kunci
              yang hilang harus dibuat ulang.
            </p>
          </div>
          <button
            onClick={() => {
              setKunciBaru('');
              setFormTerbuka(true);
            }}
            className="btn-primary text-xs px-3 py-2 inline-flex items-center gap-1.5"
            data-testid="tombol-buat-kunci"
          >
            <Plus className="w-3.5 h-3.5" /> Buat kunci
          </button>
        </div>
      </div>

      {galat && (
        <div className="card p-3 border-neg/40 bg-neg/5 text-neg text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{galat}</span>
        </div>
      )}

      {/* Kunci baru: ditampilkan sekali, dengan peringatan jelas. */}
      {kunciBaru && (
        <div className="card p-4 border-brand/40 bg-brand/5" data-testid="kunci-baru">
          <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Check className="w-4 h-4 text-pos" /> Kunci berhasil dibuat — salin sekarang, tidak bisa dilihat lagi.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code
              className="flex-1 min-w-[260px] font-mono text-xs break-all bg-surface border border-line rounded-control px-3 py-2 text-ink"
              data-testid="nilai-kunci-baru"
            >
              {kunciBaru}
            </code>
            <button onClick={salin} className="btn-primary text-xs px-3 py-2 inline-flex items-center gap-1.5">
              {tersalin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {tersalin ? 'Tersalin' : 'Salin'}
            </button>
            <button
              onClick={() => setKunciBaru('')}
              className="text-xs px-3 py-2 text-ink-2 border border-line rounded-control hover:bg-surface-2 inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Tutup
            </button>
          </div>
          <p className="text-[11px] text-ink-3 mt-2">
            Pakai di platform: header <code className="font-mono">X-API-Key: {kunciBaru.slice(0, 8)}…</code>
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">
            Kunci terdaftar <span className="text-ink-3 font-normal">({daftar.length}, {aktif.length} aktif)</span>
          </h3>
          <button
            onClick={() => void muat()}
            className="text-xs text-brand-ink hover:underline inline-flex items-center gap-1.5 min-h-[44px] px-2"
            data-testid="muat-ulang-kunci"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${memuat ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>

        {memuat && daftar.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-ink-2">Memuat…</p>
        ) : daftar.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-ink-2">
            Belum ada kunci API. Buat satu lalu serahkan ke platform mitra.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-ink-2">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold">Nama / awalan</th>
                  <th className="text-left px-3 py-2 font-semibold">Instansi</th>
                  <th className="text-left px-3 py-2 font-semibold">Izin</th>
                  <th className="text-left px-3 py-2 font-semibold">Pemakaian</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-5 py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((k) => {
                  const st = statusKunci(k);
                  return (
                    <tr key={k.id} className="border-t border-line align-top" data-testid={`baris-kunci-${k.id}`}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{k.nama}</p>
                        <p className="font-mono text-[11px] text-ink-3">{k.awalan}…</p>
                      </td>
                      <td className="px-3 py-3 text-ink-2 max-w-[160px] truncate" title={k.instansi}>
                        {k.instansi}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[130px]">
                          {(k.izin || []).map((i) => (
                            <span
                              key={i}
                              title={LABEL_IZIN[i] || i}
                              className="px-1.5 py-0.5 rounded-chip border border-line bg-surface-2 text-[10px] text-ink-2 whitespace-nowrap"
                            >
                              {LABEL_IZIN_PENDEK[i] || i}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-3">
                        <p className="whitespace-nowrap">Dibuat {waktu(k.dibuatPada)}</p>
                        <p className="whitespace-nowrap text-[10px]">
                          Dipakai {k.terakhirDipakai ? waktu(k.terakhirDipakai) : '—'} · {k.jumlahPermintaan || 0}×
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-chip border text-[10px] font-semibold ${st.kelas}`}>{st.label}</span>
                        {k.kedaluwarsaPada && !k.dicabutPada && (
                          <p className="text-[10px] text-ink-3 mt-1 whitespace-nowrap">s/d {waktu(k.kedaluwarsaPada)}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => void ubahStatus(k, !k.dicabutPada)}
                          className="text-[11px] font-semibold text-brand-ink hover:underline mr-3"
                          data-testid={`cabut-${k.id}`}
                        >
                          {k.dicabutPada ? 'Aktifkan' : 'Cabut'}
                        </button>
                        {hapusId === k.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button onClick={() => void hapus(k.id)} className="text-[11px] font-semibold text-neg hover:underline">
                              Yakin hapus
                            </button>
                            <button onClick={() => setHapusId('')} className="text-[11px] text-ink-2 hover:underline">
                              Batal
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setHapusId(k.id)}
                            className="text-ink-3 hover:text-neg inline-flex items-center"
                            title="Hapus permanen"
                            data-testid={`hapus-${k.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form buat kunci */}
      {formTerbuka && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setFormTerbuka(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-surface border border-line rounded-card shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="form-kunci"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Buat kunci API</h3>
                <p className="text-[11px] text-ink-3 mt-1">Kunci melekat ke satu instansi dan satu set izin.</p>
              </div>
              <button onClick={() => setFormTerbuka(false)} className="text-ink-3 hover:text-ink" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">Nama platform</label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="mis. Platform CSR TPCC"
                className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                data-testid="input-nama-kunci"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">Instansi</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                data-testid="pilih-instansi-kunci"
              >
                <option value="">— pilih instansi —</option>
                {tenant.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-ink-2 mb-1">Izin</p>
              <div className="space-y-1.5">
                {(['dokumen', 'dashboard'] as const).map((i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={izin.includes(i)}
                      onChange={(e) =>
                        setIzin((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))
                      }
                      className="accent-brand"
                      data-testid={`izin-${i}`}
                    />
                    {LABEL_IZIN[i]} <span className="text-ink-3">({i === 'dokumen' ? 'unggah, hapus, analisis' : 'buat, baca, tautan bagikan'})</span>
                  </label>
                ))}
                <p className="text-[10px] text-ink-3">Chat &amp; panel admin tidak pernah termasuk.</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">Berlaku (hari, 0 = tanpa batas)</label>
              <input
                type="number"
                min={0}
                max={3650}
                value={berlakuHari}
                onChange={(e) => setBerlakuHari(Number(e.target.value))}
                className="w-32 bg-surface-2 border border-line rounded-control px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                data-testid="input-berlaku-hari"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setFormTerbuka(false)}
                className="text-xs px-3 py-2 text-ink-2 border border-line rounded-control hover:bg-surface-2"
              >
                Batal
              </button>
              <button
                onClick={() => void buat()}
                disabled={menyimpan || nama.trim().length < 3 || !tenantId || izin.length === 0}
                className="btn-primary text-xs px-3 py-2 disabled:opacity-50"
                data-testid="simpan-kunci"
              >
                {menyimpan ? 'Membuat…' : 'Buat kunci'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
