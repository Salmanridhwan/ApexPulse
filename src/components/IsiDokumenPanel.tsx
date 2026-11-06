import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

import type { AnalisisDokumen, ButirData, PermintaanData } from '../types';

/**
 * Panel "Isi Dokumen" — tempat admin instansi melihat apa yang AI serap dari
 * dokumen pemohon, memilih template, dan menyetujui butir data.
 *
 * Prinsip tampilan: angka yang belum disetujui admin TIDAK boleh tampak seperti
 * angka final. Karena itu setiap butir membawa label keyakinan dan sitasinya,
 * dan yang belum disetujui diberi latar berbeda.
 */

const LABEL_STATUS_ANALISIS: Record<string, { teks: string; kelas: string }> = {
  antri: { teks: 'Menunggu', kelas: 'bg-surface-2 text-ink-2 border-line' },
  proses: { teks: 'Menganalisis…', kelas: 'bg-brand/10 text-brand border-brand/25' },
  selesai: { teks: 'Selesai', kelas: 'bg-pos/10 text-pos border-pos/25' },
  gagal: { teks: 'Gagal', kelas: 'bg-neg/10 text-neg border-neg/25' },
  'tertunda-kuota': { teks: 'Tertunda — kuota', kelas: 'bg-coral/10 text-coral border-coral/25' },
};

const LABEL_KEYAKINAN: Record<string, string> = {
  tinggi: 'bg-pos/10 text-pos border-pos/25',
  sedang: 'bg-coral/10 text-coral border-coral/25',
  rendah: 'bg-neg/10 text-neg border-neg/25',
};

function angkaTampil(n?: number | null): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

const ButirBaris: React.FC<{
  butir: ButirData;
  admin: boolean;
  onUbah: (id: string, status: 'disetujui' | 'ditolak' | 'draf') => void;
  sibuk: boolean;
}> = ({ butir, admin, onUbah, sibuk }) => {
  const disetujui = butir.status === 'disetujui';
  const ditolak = butir.status === 'ditolak';
  return (
    <div
      className={`p-2.5 rounded-control border text-xs ${
        disetujui ? 'bg-pos/5 border-pos/25' : ditolak ? 'bg-surface-2 border-line opacity-60' : 'bg-surface-1 border-line'
      }`}
      data-testid={`butir-${butir.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-semibold text-ink ${ditolak ? 'line-through' : ''}`}>{butir.nama}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-chip bg-surface-2 text-ink-2 border border-line">
              {butir.kategori}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-chip border ${LABEL_KEYAKINAN[butir.keyakinan]}`}>
              keyakinan {butir.keyakinan}
            </span>
            {disetujui && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-chip bg-pos/15 text-pos font-semibold">disetujui</span>
            )}
          </div>

          <div className="mt-1 text-ink-2">
            {butir.nilai !== undefined && butir.nilai !== null && (
              <span className="font-mono text-ink">
                {angkaTampil(butir.nilai)}
                {butir.satuan ? ` ${butir.satuan}` : ''}
              </span>
            )}
            {butir.seri && butir.seri.length > 0 && (
              <span className="font-mono">
                {butir.seri[0].nama}: {butir.seri[0].data.map((d) => angkaTampil(d)).join(' · ')}
              </span>
            )}
            {butir.tabel && (
              <span>
                Tabel {butir.tabel.baris.length} baris × {butir.tabel.kolom.length} kolom
              </span>
            )}
            {butir.periode ? <span className="text-ink-3"> · {butir.periode}</span> : null}
          </div>

          <div className="mt-1 text-[10px] text-ink-3 truncate" title={butir.sitasi.kutipan || butir.sitasi.dokumen}>
            {butir.sitasi.dokumen}
            {butir.sitasi.halaman ? ` hlm. ${butir.sitasi.halaman}` : ''}
            {butir.sitasi.kutipan ? ` — "${butir.sitasi.kutipan.slice(0, 90)}"` : ''}
          </div>
        </div>

        {admin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              disabled={sibuk}
              onClick={() => onUbah(butir.id, disetujui ? 'draf' : 'disetujui')}
              title={disetujui ? 'Batalkan persetujuan' : 'Setujui butir ini'}
              className={`p-1.5 rounded-control border transition-colors disabled:opacity-40 ${
                disetujui
                  ? 'bg-pos/15 border-pos/30 text-pos hover:bg-pos/25'
                  : 'bg-surface-2 border-line text-ink-3 hover:text-pos hover:border-pos/40'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={sibuk}
              onClick={() => onUbah(butir.id, ditolak ? 'draf' : 'ditolak')}
              title={ditolak ? 'Batalkan penolakan' : 'Tolak butir ini'}
              className={`p-1.5 rounded-control border transition-colors disabled:opacity-40 ${
                ditolak
                  ? 'bg-neg/15 border-neg/30 text-neg hover:bg-neg/25'
                  : 'bg-surface-2 border-line text-ink-3 hover:text-neg hover:border-neg/40'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const KartuAnalisis: React.FC<{
  analisis: AnalisisDokumen;
  admin: boolean;
  onUlang: (id: string) => void;
  onHapus: (id: string) => void;
  onSegarkan: (berkasId: string, nama: string) => void;
  onUbahButir: (id: string, status: 'disetujui' | 'ditolak' | 'draf') => void;
  sibuk: boolean;
  /** Dinaikkan setiap ada perubahan, supaya butir yang sedang terbuka ikut segar. */
  versi: number;
}> = ({ analisis, admin, onUlang, onHapus, onSegarkan, onUbahButir, sibuk, versi }) => {
  const [terbuka, setTerbuka] = useState(false);
  const [butir, setButir] = useState<ButirData[] | null>(null);
  const [memuat, setMemuat] = useState(false);

  const status = LABEL_STATUS_ANALISIS[analisis.status] || LABEL_STATUS_ANALISIS.antri;

  const muatButir = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/analisis/${analisis.id}/butir`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setButir(Array.isArray(data.butir) ? data.butir : []);
      }
    } finally {
      setMemuat(false);
    }
  }, [analisis.id]);

  useEffect(() => {
    if (terbuka) void muatButir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versi]);

  const buka = () => {
    const berikut = !terbuka;
    setTerbuka(berikut);
    if (berikut && butir === null) void muatButir();
  };

  const ringkasKeyakinan = useMemo(() => {
    const h = { tinggi: 0, sedang: 0, rendah: 0 };
    for (const b of butir || []) h[b.keyakinan] += 1;
    return h;
  }, [butir]);

  return (
    <div className="rounded-control border border-line bg-surface-1" data-testid={`analisis-${analisis.id}`}>
      <button onClick={buka} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-surface-2/60">
        {terbuka ? <ChevronDown className="w-3.5 h-3.5 text-ink-3" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-3" />}
        <FileSearch className="w-3.5 h-3.5 text-brand shrink-0" />
        <span className="flex-1 min-w-0 truncate text-xs font-semibold text-ink">{analisis.judulBerkas}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-chip border font-semibold ${status.kelas}`}>{status.teks}</span>
        {analisis.status === 'selesai' && (
          <span className="text-[10px] text-ink-3">{analisis.jumlahButir} butir</span>
        )}
        {/* Alasan gagal tampil di kepala kartu: kalau harus dibuka dulu, admin
            hanya melihat kata "Gagal" dan tidak tahu harus berbuat apa. */}
        {analisis.status === 'gagal' && analisis.galat && (
          <span className="text-[10px] text-neg max-w-[45%] truncate" title={analisis.galat}>
            {analisis.galat}
          </span>
        )}
      </button>

      {terbuka && (
        <div className="px-2.5 pb-2.5 space-y-2 text-xs border-t border-line pt-2">
          {analisis.ringkasan && <p className="text-ink-2 leading-relaxed">{analisis.ringkasan}</p>}

          {analisis.galat && analisis.status !== 'selesai' && (
            <div className="p-2 rounded-control bg-neg/5 border border-neg/25 text-neg text-[11px] flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{analisis.galat}</span>
            </div>
          )}

          {analisis.kategoriTerdeteksi.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analisis.kategoriTerdeteksi.map((k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-chip bg-brand/10 text-brand border border-brand/20">
                  {k}
                </span>
              ))}
            </div>
          )}

          {analisis.rekomendasiTemplate && analisis.rekomendasiTemplate.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold text-ink-3 uppercase tracking-wide">
                <Sparkles className="w-3 h-3" /> Template disarankan
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {analisis.rekomendasiTemplate.map((t) => (
                  <div key={t.templateId} className="p-2 rounded-control bg-surface-2 border border-line">
                    <div className="font-semibold text-ink text-[11px]">{t.nama}</div>
                    <div className="text-[10px] text-ink-3">{t.alasan}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {memuat && (
            <div className="flex items-center gap-1.5 text-ink-3 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" /> Memuat butir…
            </div>
          )}

          {butir && butir.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-ink-3">
                {butir.length} butir · {ringkasKeyakinan.tinggi} tinggi · {ringkasKeyakinan.sedang} sedang ·{' '}
                {ringkasKeyakinan.rendah} rendah
              </div>
              {butir.map((b) => (
                <ButirBaris key={b.id} butir={b} admin={admin} onUbah={onUbahButir} sibuk={sibuk} />
              ))}
            </div>
          )}

          {butir && butir.length === 0 && analisis.status === 'selesai' && (
            <p className="text-[11px] text-ink-3 italic">Dokumen ini tidak memuat angka yang bisa dipakai.</p>
          )}

          {admin && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {analisis.status === 'selesai' && (
                <button
                  disabled={sibuk}
                  onClick={() => onSegarkan(analisis.berkasId, analisis.judulBerkas)}
                  title="Baca ulang dari RAG — pakai bila dokumennya berubah atau ada dokumen baru"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-2 bg-surface-2 hover:bg-surface-3 border border-line rounded-control disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" /> Baca ulang dari RAG
                </button>
              )}
              {analisis.status !== 'selesai' && (
                <button
                  disabled={sibuk}
                  onClick={() => onUlang(analisis.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand bg-brand/10 hover:bg-brand/20 border border-brand/25 rounded-control disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" /> Ulangi analisis
                </button>
              )}
              <button
                disabled={sibuk}
                onClick={() => onHapus(analisis.id)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neg bg-neg/10 hover:bg-neg/20 border border-neg/25 rounded-control disabled:opacity-50"
              >
                <X className="w-3 h-3" /> Hapus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const IsiDokumenPanel: React.FC<{ permintaan: PermintaanData; admin: boolean }> = ({ permintaan, admin }) => {
  const [daftar, setDaftar] = useState<AnalisisDokumen[]>([]);
  const [kuota, setKuota] = useState<{ kuota: number; terpakai: number; sisa: number } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [kesegaran, setKesegaran] = useState<{ perluDibacaUlang: Array<{ id: string; judulBerkas: string }>; catatan: string } | null>(
    null
  );
  const [versi, setVersi] = useState(0);

  const muat = useCallback(async () => {
    try {
      const [resA, resK, resS] = await Promise.all([
        fetch(`/api/analisis?permintaanId=${encodeURIComponent(permintaan.id)}`, { credentials: 'include' }),
        fetch('/api/analisis/kuota', { credentials: 'include' }),
        admin ? fetch('/api/analisis/kesegaran', { credentials: 'include' }) : Promise.resolve(null),
      ]);
      if (resA.ok) setDaftar(await resA.json());
      if (resK.ok) setKuota(await resK.json());
      if (resS && resS.ok) setKesegaran(await resS.json());
    } catch {
      /* biarkan kosong — panel tetap bisa dipakai */
    }
  }, [permintaan.id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const analisisUntuk = (berkasId: string) => daftar.filter((a) => a.berkasId === berkasId);

  const jalankan = async (lampiran: { berkasId: string; nama: string }, segarkan = false) => {
    setSibuk(true);
    setGalat('');
    setInfo('');
    try {
      const res = await fetch('/api/analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          berkasId: lampiran.berkasId,
          judulBerkas: lampiran.nama,
          permintaanId: permintaan.id,
          ...(segarkan ? { segarkan: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 422) {
        setGalat(data?.error || 'Analisis gagal dijalankan.');
      } else if (data?.dariCache) {
        setInfo(data.catatanCache || 'Memakai hasil analisis yang tersimpan.');
      } else if (data?.catatanCache) {
        setInfo(data.catatanCache);
      }
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const ulang = async (id: string) => {
    setSibuk(true);
    try {
      const res = await fetch(`/api/analisis/${id}/ulang`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 422) setGalat(data?.error || 'Gagal mengulang analisis.');
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async (id: string) => {
    setSibuk(true);
    try {
      await fetch(`/api/analisis/${id}`, { method: 'DELETE', credentials: 'include' });
      await muat();
      setVersi((v) => v + 1);
    } finally {
      setSibuk(false);
    }
  };

  const ubahButir = async (id: string, status: 'disetujui' | 'ditolak' | 'draf') => {
    setSibuk(true);
    try {
      await fetch(`/api/analisis/butir/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      await muat();
      setVersi((v) => v + 1);
    } finally {
      setSibuk(false);
    }
  };

  if (permintaan.lampiran.length === 0) {
    return (
      <div className="p-2.5 rounded-control bg-surface-2 border border-line text-[11px] text-ink-3">
        Pemohon belum melampirkan dokumen. Minta data tambahan bila angka dibutuhkan.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="panel-isi-dokumen">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Isi dokumen</span>
        {kuota && (
          <span className={`text-[10px] ${kuota.sisa === 0 ? 'text-coral font-semibold' : 'text-ink-3'}`}>
            Sisa kuota hari ini: {kuota.sisa}/{kuota.kuota}
          </span>
        )}
      </div>

      {galat && (
        <div className="p-2 rounded-control bg-neg/5 border border-neg/25 text-neg text-[11px]">{galat}</div>
      )}

      {info && (
        <div className="p-2 rounded-control bg-brand/5 border border-brand/20 text-ink-2 text-[11px]">{info}</div>
      )}

      {kesegaran && kesegaran.perluDibacaUlang.length > 0 && (
        <div className="p-2 rounded-control bg-coral/10 border border-coral/30 text-[11px] flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-coral" />
          <div>
            <div className="font-semibold text-ink">Ada dokumen baru di basis instansi</div>
            <div className="text-ink-2">{kesegaran.catatan}</div>
            <div className="text-ink-3 mt-0.5">
              {kesegaran.perluDibacaUlang.map((k) => k.judulBerkas).join(', ')}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {permintaan.lampiran.map((l) => {
          const hasil = analisisUntuk(l.berkasId);
          const sudahJalan = hasil.length > 0;
          return (
            <div key={l.berkasId} className="space-y-1.5">
              {admin && !sudahJalan && (
                <button
                  disabled={sibuk}
                  onClick={() => void jalankan({ berkasId: l.berkasId, nama: l.nama })}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-brand hover:opacity-90 rounded-control disabled:opacity-50"
                  data-testid={`analisis-berkas-${l.berkasId}`}
                >
                  {sibuk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Analisis isi dokumen — {l.nama}
                </button>
              )}
              {hasil.map((a) => (
                <KartuAnalisis
                  key={a.id}
                  analisis={a}
                  admin={admin}
                  onUlang={(id) => void ulang(id)}
                  onHapus={(id) => void hapus(id)}
                  onSegarkan={(berkasId, nama) => void jalankan({ berkasId, nama }, true)}
                  onUbahButir={(id, s) => void ubahButir(id, s)}
                  sibuk={sibuk}
                  versi={versi}
                />
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-ink-3 leading-relaxed">
        Angka diambil hanya dari dokumen ini. Butir yang belum Anda setujui tidak dipakai menyusun dashboard.
      </p>
    </div>
  );
};

export default IsiDokumenPanel;
