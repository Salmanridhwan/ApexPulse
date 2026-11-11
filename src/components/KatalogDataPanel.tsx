import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Layers, LayoutTemplate, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import type { ButirData, PermintaanData } from '../types';
import { DASHBOARD_TEMPLATES } from '../services/templates/dashboardTemplates';
import { saranTemplate } from '../services/analisis/rekomendasiKategoriTemplate';
import { isiSlotTemplate, slotKosong } from '../services/analisis/butirKeSlotTemplate';
import { cekAturanDashboard } from '../services/analisis/aturanDashboard';

/**
 * KATALOG DATA — memilih butir mana yang naik ke halaman.
 *
 * Tanpa layar ini, butir hasil analisis hanya bisa dipakai lewat API. Di sini
 * admin mencentang butir yang ia percaya, memilih bentuk halaman (template), dan
 * melihat berapa kartu yang benar-benar akan terisi sebelum menekan Buat Halaman.
 *
 * Dua hal yang dijaga di tampilan:
 *
 * 1. Butir yang belum disetujui tidak bisa dicentang — kalau bisa, angka yang
 *    belum diperiksa admin akan ikut naik ke dashboard pimpinan.
 * 2. Pratinjau menyebut slot yang akan KOSONG, bukan hanya yang terisi. Admin
 *    perlu tahu apa yang belum ada sebelum halaman dibuat, bukan sesudah.
 */

interface Props {
  permintaan: PermintaanData;
  admin: boolean;
  onSelesai?: (dashboardId: string, ringkasan: string) => void;
}

const LABEL_KEYAKINAN: Record<string, string> = {
  tinggi: 'bg-pos/10 text-pos border-pos/25',
  sedang: 'bg-coral/10 text-coral border-coral/25',
  rendah: 'bg-neg/10 text-neg border-neg/25',
};

function ringkasAngka(b: ButirData): string {
  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
  if (b.nilai !== undefined && b.nilai !== null) return `${fmt(b.nilai)}${b.satuan ? ` ${b.satuan}` : ''}`;
  if (b.seri && b.seri.length > 0) {
    const titik = b.seri.reduce((n, s) => n + s.data.length, 0);
    return `${b.seri.length} deret · ${titik} titik${b.satuan ? ` · ${b.satuan}` : ''}`;
  }
  if (b.tabel) return `tabel ${b.tabel.baris.length} baris`;
  return 'tanpa angka';
}

export const KatalogDataPanel: React.FC<Props> = ({ permintaan, admin, onSelesai }) => {
  const [butir, setButir] = useState<ButirData[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [judul, setJudul] = useState('');
  const [membuat, setMembuat] = useState(false);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const resA = await fetch(`/api/analisis?permintaanId=${encodeURIComponent(permintaan.id)}`, {
        credentials: 'include',
      });
      if (!resA.ok) throw new Error('Daftar analisis tidak bisa dimuat.');
      const daftar: Array<{ id: string }> = await resA.json();
      const kumpulan: ButirData[] = [];
      for (const a of daftar) {
        const resB = await fetch(`/api/analisis/${encodeURIComponent(a.id)}/butir`, { credentials: 'include' });
        if (!resB.ok) continue;
        const isi = await resB.json();
        if (Array.isArray(isi.butir)) kumpulan.push(...isi.butir);
      }
      setButir(kumpulan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat katalog data.');
    } finally {
      setMemuat(false);
    }
  }, [permintaan.id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const disetujui = useMemo(() => butir.filter((b) => b.status === 'disetujui'), [butir]);
  const perKategori = useMemo(() => {
    const peta = new Map<string, ButirData[]>();
    for (const b of butir) {
      const k = b.kategori || 'Umum';
      peta.set(k, [...(peta.get(k) ?? []), b]);
    }
    return Array.from(peta.entries());
  }, [butir]);

  const butirTerpilih = useMemo(() => disetujui.filter((b) => dipilih.includes(b.id)), [disetujui, dipilih]);

  /** Saran template untuk kategori yang butirnya dipilih. */
  const saran = useMemo(() => {
    if (butirTerpilih.length === 0) return [];
    const kategori = Array.from(new Set(butirTerpilih.map((b) => b.kategori || 'Umum')));
    const hasil = new Map<string, { templateId: string; nama: string; skor: number; alasan: string }>();
    for (const k of kategori) {
      for (const s of saranTemplate(k, butirTerpilih)) {
        if (!hasil.has(s.templateId)) hasil.set(s.templateId, s);
      }
    }
    return Array.from(hasil.values()).sort((a, b) => b.skor - a.skor).slice(0, 3);
  }, [butirTerpilih]);

  /** Pratinjau: berapa kartu terisi, mana yang kosong. Dihitung di layar, tanpa server. */
  const pratinjau = useMemo(() => {
    if (!templateId || butirTerpilih.length === 0) return null;
    const tpl = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return null;
    const hasil = isiSlotTemplate(tpl, butirTerpilih);
    return { hasil, kosong: slotKosong(hasil) };
  }, [templateId, butirTerpilih]);

  const alihkan = (id: string) =>
    setDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const buat = async () => {
    if (butirTerpilih.length === 0) {
      setGalat('Centang dulu butir yang mau dipakai.');
      return;
    }
    // Aturan dashboard baru: minimal 3 chart dan semuanya berhubungan.
    const aturan = cekAturanDashboard(butirTerpilih);
    if (!aturan.boleh) {
      setGalat(aturan.pesan);
      return;
    }
    setMembuat(true);
    setGalat('');
    setPesan('');
    try {
      const res = await fetch('/api/dashboards/dari-butir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          butirIds: butirTerpilih.map((b) => b.id),
          permintaanId: permintaan.id,
          judul: judul.trim() || `Data ${permintaan.bidang}`,
          ...(templateId ? { templateId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Halaman gagal dibuat.');
      const ringkasan = String(data?.ringkasan || 'Halaman dibuat.');
      setPesan(ringkasan);
      onSelesai?.(String(data?.dashboard?.id || ''), ringkasan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Halaman gagal dibuat.');
    } finally {
      setMembuat(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="rounded-card border border-line bg-surface-1 p-3" data-testid="katalog-data">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-3.5 h-3.5 text-brand" />
        <span className="text-[11px] font-semibold text-ink uppercase tracking-wide">Katalog Data</span>
        <span className="text-[10px] text-ink-3">
          {disetujui.length} butir disetujui dari {butir.length} butir terbaca
        </span>
        <button
          onClick={() => void muat()}
          className="ml-auto inline-flex items-center gap-1 min-h-11 sm:min-h-0 px-2 py-1 text-[11px] font-semibold text-brand-ink bg-surface border border-line hover:bg-brand/10 rounded-control"
          data-testid="katalog-muat-ulang"
        >
          {memuat ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Muat ulang
        </button>
      </div>

      {galat && (
        <div className="mb-2 flex items-start gap-1.5 p-2 rounded-control bg-neg/10 border border-neg/25 text-[11px] text-neg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{galat}</span>
        </div>
      )}

      {butir.length === 0 && !memuat && (
        <p className="text-[11px] text-ink-3 italic">
          Belum ada butir data. Jalankan analisis isi dokumen lebih dulu.
        </p>
      )}

      {perKategori.map(([kategori, daftar]) => (
        <div key={kategori} className="mb-2.5">
          <div className="text-[10px] font-semibold text-ink-2 uppercase tracking-wide mb-1">{kategori}</div>
          <div className="space-y-1">
            {daftar.map((b) => {
              const bisa = b.status === 'disetujui';
              const aktif = dipilih.includes(b.id);
              return (
                <label
                  key={b.id}
                  className={`flex items-start gap-2 p-2 rounded-control border text-[11px] ${
                    bisa
                      ? aktif
                        ? 'bg-brand/5 border-brand/40 cursor-pointer'
                        : 'bg-surface-2 border-line hover:border-brand/30 cursor-pointer'
                      : 'bg-surface-2 border-line opacity-60'
                  }`}
                  data-testid={`katalog-butir-${b.id}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={aktif}
                    disabled={!bisa}
                    onChange={() => alihkan(b.id)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-ink font-medium truncate">{b.nama}</span>
                    <span className="block text-ink-3">
                      {ringkasAngka(b)}
                      {b.periode ? ` · ${b.periode}` : ''}
                      {b.sitasi?.dokumen ? ` · ${b.sitasi.dokumen}${b.sitasi.halaman ? ` hlm ${b.sitasi.halaman}` : ''}` : ''}
                    </span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] shrink-0 ${LABEL_KEYAKINAN[b.keyakinan] ?? ''}`}>
                    {b.keyakinan}
                  </span>
                  {!bisa && <span className="text-[9px] text-ink-3 shrink-0">belum disetujui</span>}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {butirTerpilih.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-2 uppercase tracking-wide">
            <LayoutTemplate className="w-3 h-3" /> Bentuk halaman
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTemplateId('')}
              className={`px-2 py-1 rounded-control border text-[10px] ${
                templateId === '' ? 'bg-brand text-on-brand border-brand' : 'bg-surface-2 border-line text-ink-2'
              }`}
              data-testid="katalog-template-otomatis"
            >
              Kelompok otomatis
            </button>
            {saran.map((s) => (
              <button
                key={s.templateId}
                onClick={() => setTemplateId(s.templateId)}
                className={`px-2 py-1 rounded-control border text-[10px] ${
                  templateId === s.templateId ? 'bg-brand text-on-brand border-brand' : 'bg-surface-2 border-line text-ink-2'
                }`}
                title={s.alasan}
                data-testid={`katalog-template-${s.templateId}`}
              >
                {s.nama}
              </button>
            ))}
          </div>

          {pratinjau && (
            <div className="p-2 rounded-control bg-surface-2 border border-line text-[10px] text-ink-2 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <Sparkles className="w-3 h-3 text-brand" /> Pratinjau: {pratinjau.hasil.catatan}
              </div>
              {pratinjau.kosong.length > 0 && (
                <ul className="space-y-0.5">
                  {pratinjau.kosong.map((k, i) => (
                    <li key={i} className="text-ink-3">
                      • {k.judulSlot}: {k.alasan}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder={`Judul halaman (bawaan: Data ${permintaan.bidang})`}
            className="w-full px-2 py-1.5 rounded-control bg-surface-2 border border-line text-[11px] text-ink"
            data-testid="katalog-judul"
          />

          <button
            onClick={() => void buat()}
            disabled={membuat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-brand text-on-brand text-[11px] font-semibold disabled:opacity-60"
            data-testid="katalog-buat-halaman"
          >
            {membuat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Buat halaman dari {butirTerpilih.length} butir
          </button>
        </div>
      )}

      {pesan && (
        <div className="mt-2 p-2 rounded-control bg-pos/10 border border-pos/25 text-[11px] text-pos" data-testid="katalog-pesan">
          {pesan}
        </div>
      )}
    </div>
  );
};

export default KatalogDataPanel;
