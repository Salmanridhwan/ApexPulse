import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Info,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import IsiDokumenPanel from '../components/IsiDokumenPanel';
import KatalogDataPanel from '../components/KatalogDataPanel';
import type { PermintaanData, StatusPermintaan, UserRole } from '../types';
import { ItemCard } from '../components/ui/ItemCard';
import { BIDANG_BAWAAN, LABEL_STATUS, SEMUA_STATUS, ringkasPermintaan } from '../services/permintaan/aturan';
import { isAdminRole } from '../services/auth/peran';

interface PermintaanDataPageProps {
  tenantId: string;
  peran?: UserRole;
  namaSaya?: string;
  onBackToWorkspace: () => void;
}

type PermintaanDaftar = PermintaanData & { ringkasan?: string };

interface Ringkasan {
  total: number;
  perStatus: Record<string, number>;
  perluTindakan: number;
}

/** Warna lencana per status — sama dengan warna status di halaman Kinerja. */
const KELAS_STATUS: Record<StatusPermintaan, string> = {
  baru: 'bg-brand/15 text-brand-ink border-brand/30',
  diproses: 'bg-warn/15 text-warn border-warn/30',
  perlu_data: 'bg-coral/15 text-coral border-coral/30',
  selesai: 'bg-pos/15 text-pos border-pos/30',
  ditolak: 'bg-neg/15 text-neg border-neg/30',
};

const WARNA_STATUS: Record<StatusPermintaan, string> = {
  baru: 'var(--color-brand)',
  diproses: 'var(--color-warn)',
  perlu_data: 'var(--color-coral)',
  selesai: 'var(--color-pos)',
  ditolak: 'var(--color-neg)',
};

const LABEL_PRIORITAS: Record<string, string> = {
  rendah: 'Rendah',
  normal: 'Normal',
  tinggi: 'Tinggi',
};

async function minta<T>(url: string, opsi?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opsi,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || 'Permintaan gagal diproses.');
  return data as T;
}

const tanggalPendek = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const waktuPendek = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const LencanaStatus: React.FC<{ status: StatusPermintaan }> = ({ status }) => (
  <span
    className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${KELAS_STATUS[status]}`}
  >
    {LABEL_STATUS[status]}
  </span>
);

/** Baca berkas jadi base64 untuk dikirim ke /api/berkas/unggah. */
const bacaBase64 = (berkas: File): Promise<string> =>
  new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result || ''));
    pembaca.onerror = () => gagal(new Error('Berkas tidak bisa dibaca.'));
    pembaca.readAsDataURL(berkas);
  });

const PermintaanDataPage: React.FC<PermintaanDataPageProps> = ({ tenantId, peran, onBackToWorkspace }) => {
  const admin = isAdminRole(peran);
  const [daftar, setDaftar] = useState<PermintaanDaftar[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  /** Warna kotak pesan: hasil negatif (ditolak, perlu data) tidak boleh tampil hijau seperti sukses. */
  const [nadaPesan, setNadaPesan] = useState<'pos' | 'warn' | 'netral'>('pos');
  const kabari = (teks: string, nada: 'pos' | 'warn' | 'netral' = 'pos') => {
    setPesan(teks);
    setNadaPesan(nada);
  };
  const [saring, setSaring] = useState<StatusPermintaan | 'semua'>('semua');
  const [terpilih, setTerpilih] = useState<PermintaanDaftar | null>(null);
  /** Id permintaan yang sedang menunggu konfirmasi hapus (admin). */
  const [konfirmasiHapusId, setKonfirmasiHapusId] = useState<string | null>(null);
  const [bukaForm, setBukaForm] = useState(false);
  const [balasan, setBalasan] = useState('');
  const [alasanTolak, setAlasanTolak] = useState('');
  const [tampilTolak, setTampilTolak] = useState(false);
  const inputBerkas = useRef<HTMLInputElement>(null);

  const [fBidang, setFBidang] = useState<string>('Umum');
  const [fData, setFData] = useState('');
  const [fArah, setFArah] = useState('');
  const [fPrioritas, setFPrioritas] = useState<'rendah' | 'normal' | 'tinggi'>('normal');
  const [fTarget, setFTarget] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const [list, ring] = await Promise.all([
        minta<PermintaanDaftar[]>('/api/permintaan'),
        minta<Ringkasan>('/api/permintaan/ringkasan'),
      ]);
      setDaftar(list);
      setRingkasan(ring);
      setTerpilih((lama) => (lama ? list.find((p) => p.id === lama.id) || null : null));
    } catch (err: any) {
      setGalat(err?.message || 'Gagal memuat permintaan data.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat, tenantId]);

  const tersaring = useMemo(
    () => (saring === 'semua' ? daftar : daftar.filter((p) => p.status === saring)),
    [daftar, saring]
  );

  const kirimBaru = async () => {
    setSibuk(true);
    setGalat(null);
    try {
      const baru = await minta<PermintaanData>('/api/permintaan', {
        method: 'POST',
        body: JSON.stringify({
          bidang: fBidang,
          dataDiminta: fData,
          arahDashboard: fArah,
          prioritas: fPrioritas,
          targetSelesai: fTarget,
        }),
      });
      kabari('Permintaan terkirim. Admin instansi akan menindaklanjuti.');
      setBukaForm(false);
      setFData('');
      setFArah('');
      setFTarget('');
      setFPrioritas('normal');
      await muat();
      setTerpilih(baru as PermintaanDaftar);
    } catch (err: any) {
      setGalat(err?.message || 'Gagal mengirim permintaan.');
    } finally {
      setSibuk(false);
    }
  };

  const ubahStatus = async (status: StatusPermintaan, alasan?: string) => {
    if (!terpilih) return;
    setSibuk(true);
    setGalat(null);
    try {
      const hasil = await minta<PermintaanData>(`/api/permintaan/${terpilih.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(alasan ? { alasanPenolakan: alasan } : {}) }),
      });
      setTerpilih(hasil as PermintaanDaftar);
      kabari(`Status diubah menjadi ${LABEL_STATUS[status]}.`, status === 'ditolak' ? 'netral' : status === 'perlu_data' ? 'warn' : 'pos');
      setTampilTolak(false);
      setAlasanTolak('');
      await muat();
    } catch (err: any) {
      setGalat(err?.message || 'Gagal mengubah status.');
    } finally {
      setSibuk(false);
    }
  };

  const kirimCatatan = async (lampiran?: { berkasId: string; nama: string; ukuranKb?: number; tipe?: string }[]) => {
    if (!terpilih) return;
    if (!balasan.trim() && !lampiran?.length) {
      setGalat('Tulis catatan atau lampirkan berkas lebih dulu.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const hasil = await minta<PermintaanData>(`/api/permintaan/${terpilih.id}/catatan`, {
        method: 'POST',
        body: JSON.stringify({ pesan: balasan.trim() || 'Melampirkan dokumen.', lampiran }),
      });
      setTerpilih(hasil as PermintaanDaftar);
      setBalasan('');
      kabari('Catatan terkirim.');
      await muat();
    } catch (err: any) {
      setGalat(err?.message || 'Gagal mengirim catatan.');
    } finally {
      setSibuk(false);
    }
  };

  const unggahLampiran = async (berkas: File) => {
    if (!terpilih) return;
    setSibuk(true);
    setGalat(null);
    try {
      const isiBase64 = await bacaBase64(berkas);
      const hasil = await minta<{ berkas: { id: string; title?: string; fileSizeKb?: number; fileType?: string } }>(
        '/api/berkas/unggah',
        {
          method: 'POST',
          body: JSON.stringify({
            nama: berkas.name,
            judul: berkas.name,
            kategori: 'Permintaan Data',
            ukuran: berkas.size,
            tipe: berkas.type,
            isiBase64,
          }),
        }
      );
      await kirimCatatan([
        {
          berkasId: hasil.berkas.id,
          nama: hasil.berkas.title || berkas.name,
          ukuranKb: hasil.berkas.fileSizeKb,
          tipe: hasil.berkas.fileType,
        },
      ]);
    } catch (err: any) {
      setGalat(err?.message || 'Gagal mengunggah berkas.');
    } finally {
      setSibuk(false);
      if (inputBerkas.current) inputBerkas.current.value = '';
    }
  };

  const hapus = async (p: PermintaanDaftar) => {
    setSibuk(true);
    setGalat(null);
    try {
      await minta(`/api/permintaan/${p.id}`, { method: 'DELETE' });
      kabari('Permintaan dihapus.', 'netral');
      setTerpilih(null);
      await muat();
    } catch (err: any) {
      setGalat(err?.message || 'Gagal menghapus permintaan.');
    } finally {
      setSibuk(false);
    }
  };

  /* ---------------- Panel detail ---------------- */
  const panelDetail = terpilih ? (
    <div className="bg-surface rounded-card border border-line p-5" data-testid="panel-detail-permintaan">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-ink">{terpilih.bidang}</h3>
            <LencanaStatus status={terpilih.status} />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-ink-2 border border-line font-semibold">
              Prioritas {LABEL_PRIORITAS[terpilih.prioritas] || 'Normal'}
            </span>
          </div>
          <p className="text-[11px] text-ink-3 mt-1">
            {admin ? `Diajukan ${terpilih.pemohonNama}` : 'Permintaan Anda'} · {waktuPendek(terpilih.createdAt)}
            {terpilih.targetSelesai ? ` · dibutuhkan ${tanggalPendek(terpilih.targetSelesai)}` : ''}
            {terpilih.ditanganiOleh ? ` · ditangani ${terpilih.ditanganiOleh}` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setTerpilih(null);
            setTampilTolak(false);
          }}
          className="inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 p-1.5 rounded-control text-ink-3 hover:bg-surface-2 shrink-0"
          aria-label="Tutup detail"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <span className="block text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Data yang diminta</span>
          <p className="text-ink whitespace-pre-wrap leading-relaxed">{terpilih.dataDiminta}</p>
        </div>
        {terpilih.arahDashboard && (
          <div>
            <span className="block text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Arah dashboard</span>
            <p className="text-ink-2 whitespace-pre-wrap leading-relaxed">{terpilih.arahDashboard}</p>
          </div>
        )}
        {terpilih.status === 'ditolak' && terpilih.alasanPenolakan && (
          <div className="p-2.5 rounded-control bg-neg/10 border border-neg/25 text-neg">
            <span className="font-semibold">Alasan penolakan: </span>
            {terpilih.alasanPenolakan}
          </div>
        )}

        {terpilih.lampiran.length > 0 && (
          <div>
            <span className="block text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">
              Dokumen ({terpilih.lampiran.length})
            </span>
            <div className="space-y-1">
              {terpilih.lampiran.map((l) => (
                <a
                  key={l.berkasId}
                  href={`/api/berkas/${l.berkasId}/unduh`}
                  className="flex items-center gap-2 p-2 rounded-control bg-surface-2 border border-line hover:border-brand/40 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                  <span className="flex-1 truncate text-ink">{l.nama}</span>
                  {l.ukuranKb ? <span className="text-[10px] text-ink-3">{Math.round(l.ukuranKb)} KB</span> : null}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Isi dokumen — hasil serapan AI, template, dan butir data */}
        <IsiDokumenPanel permintaan={terpilih} admin={admin} />

        {/* Katalog data — pilih butir mana yang naik ke halaman, lalu bentuknya */}
        <KatalogDataPanel
          permintaan={terpilih}
          admin={admin}
          onSelesai={() => {
            void muat();
          }}
        />

        {/* Percakapan */}
        <div>
          <span className="block text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
            Tanggapan ({terpilih.catatan.length})
          </span>
          {terpilih.catatan.length === 0 ? (
            <p className="text-[11px] text-ink-3 italic">Belum ada tanggapan.</p>
          ) : (
            <div className="space-y-2">
              {terpilih.catatan.map((c) => {
                const dariAdmin = isAdminRole(c.olehRole);
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-control border ${dariAdmin ? 'bg-brand/5 border-brand/20' : 'bg-surface-2 border-line'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3 h-3 text-ink-3" />
                      <span className="font-semibold text-ink text-[11px]">{c.olehNama}</span>
                      <span className="text-[10px] text-ink-3">{waktuPendek(c.pada)}</span>
                      {c.mengubahStatus && (
                        <span className="text-[9px] px-1.5 rounded-chip bg-pos/15 text-pos font-semibold">status berpindah</span>
                      )}
                    </div>
                    <p className="text-ink-2 whitespace-pre-wrap leading-relaxed">{c.pesan}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aksi admin */}
        {admin && !['selesai', 'ditolak'].includes(terpilih.status) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {terpilih.status !== 'diproses' && (
              <button
                disabled={sibuk}
                onClick={() => void ubahStatus('diproses')}
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-on-brand bg-brand hover:opacity-90 rounded-control disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" /> Ambil & proses
              </button>
            )}
            {terpilih.status === 'diproses' && (
              <button
                disabled={sibuk}
                onClick={() => void ubahStatus('perlu_data')}
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-coral bg-coral/10 hover:bg-coral/20 border border-coral/30 rounded-control disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Minta data tambahan
              </button>
            )}
            {terpilih.status === 'diproses' && (
              <button
                disabled={sibuk}
                onClick={() => void ubahStatus('selesai')}
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-pos bg-pos/10 hover:bg-pos/20 border border-pos/30 rounded-control disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Tandai selesai
              </button>
            )}
            <button
              disabled={sibuk}
              onClick={() => setTampilTolak((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-neg bg-neg/10 hover:bg-neg/20 border border-neg/30 rounded-control disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Tolak
            </button>
          </div>
        )}

        {admin && tampilTolak && (
          <div className="p-3 rounded-control bg-neg/5 border border-neg/25 space-y-2">
            <label className="block text-[11px] font-semibold text-ink">
              Alasan penolakan (wajib)
              <textarea
                value={alasanTolak}
                onChange={(e) => setAlasanTolak(e.target.value)}
                rows={2}
                placeholder="Contoh: data yang diminta sudah tersedia di menu Kinerja & Kepatuhan."
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <button
              disabled={sibuk || !alasanTolak.trim()}
              onClick={() => void ubahStatus('ditolak', alasanTolak.trim())}
              className="px-3 py-1.5 text-xs font-semibold text-on-neg bg-neg rounded-control disabled:opacity-50"
            >
              Kirim penolakan
            </button>
          </div>
        )}

        {/* Kotak balasan */}
        {!['selesai', 'ditolak'].includes(terpilih.status) && (
          <div className="pt-1">
            <textarea
              value={balasan}
              onChange={(e) => setBalasan(e.target.value)}
              rows={2}
              placeholder={admin ? 'Tanggapan untuk pemohon…' : 'Tambahkan keterangan atau data susulan…'}
              className="w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                disabled={sibuk}
                onClick={() => void kirimCatatan()}
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-on-brand bg-brand hover:opacity-90 rounded-control disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Kirim
              </button>
              <>
                <input
                    ref={inputBerkas}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void unggahLampiran(f);
                    }}
                  />
                <button
                  disabled={sibuk}
                  onClick={() => inputBerkas.current?.click()}
                  className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> Lampirkan dokumen
                </button>
              </>
            </div>
            <p className="text-[10px] text-ink-3 mt-1.5">
              Dokumen yang dilampirkan ikut terindeks, sehingga bisa dipakai menyusun dashboard.
            </p>
          </div>
        )}

        {/* Pemohon boleh menghapus selama admin belum menyentuh */}
        {!admin && terpilih.status === 'baru' && (
          <button
            disabled={sibuk}
            onClick={() => void hapus(terpilih)}
            className="text-[11px] text-neg hover:underline disabled:opacity-50"
          >
            Hapus permintaan ini
          </button>
        )}

        {/*
          Admin instansi boleh menghapus kapan saja — server mengizinkannya
          (`DELETE /api/permintaan/:id` = 200 untuk admin). Sebelum ini kontrolnya
          tidak ada di layar, jadi satu-satunya jalan adalah menembak API.
          Konfirmasi dibuat dua langkah di dalam panel, bukan `window.confirm`,
          supaya akibatnya terbaca dan alurnya tidak diblokir dialog browser.
        */}
        {admin && (
          <div className="pt-1">
            {konfirmasiHapusId === terpilih.id ? (
              <div className="p-3 rounded-control bg-neg/5 border border-neg/25">
                <p className="text-[11px] text-ink">
                  Hapus permanen permintaan ini? Riwayat tanggapan dan lampirannya ikut hilang.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    disabled={sibuk}
                    onClick={() => {
                      setKonfirmasiHapusId(null);
                      void hapus(terpilih);
                    }}
                    data-testid="konfirmasi-hapus-permintaan"
                    className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-on-neg bg-neg hover:opacity-90 rounded-control disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Ya, hapus permanen
                  </button>
                  <button
                    disabled={sibuk}
                    onClick={() => setKonfirmasiHapusId(null)}
                    data-testid="batal-hapus-permintaan"
                    className="px-3 py-1.5 text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line/60 border border-line rounded-control disabled:opacity-50"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={sibuk}
                onClick={() => setKonfirmasiHapusId(terpilih.id)}
                data-testid="hapus-permintaan-admin"
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-neg bg-neg/10 hover:bg-neg/20 border border-neg/30 rounded-control disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus permintaan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="halaman-permintaan">
      {/* Kepala */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={onBackToWorkspace}
            className="inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 p-2 rounded-control text-ink-2 hover:bg-surface-2 border border-line shrink-0"
            aria-label="Kembali ke workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink flex items-center gap-2 flex-wrap">
              {admin ? 'Kotak Masuk Permintaan' : 'Permintaan Data'}
              {ringkasan && ringkasan.perluTindakan > 0 && admin && (
                <span className="text-xs px-2.5 py-0.5 rounded-full border bg-brand/15 text-brand-ink border-brand/30 font-semibold">
                  {ringkasan.perluTindakan} perlu ditindaklanjuti
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-ink-2 mt-1">
              {admin
                ? 'Permintaan data dari user instansi. Ambil, proses, lalu susun halamannya.'
                : 'Ajukan data yang Anda butuhkan, lampirkan dokumen, dan tentukan arah dashboard-nya.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void muat()}
            aria-label="Segarkan daftar permintaan"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control"
          >
            <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Segarkan</span>
          </button>
          {!admin && (
            <button
              onClick={() => setBukaForm((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-on-brand bg-brand hover:opacity-90 rounded-control"
              data-testid="tombol-permintaan-baru"
            >
              <Plus className="w-3.5 h-3.5" /> Permintaan Baru
            </button>
          )}
        </div>
      </div>

      {galat && (
        <div className="mb-4 p-3 rounded-card border bg-neg/15 border-neg/30 text-neg text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{galat}</span>
          <button onClick={() => setGalat(null)} aria-label="Tutup galat">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {pesan && (
        <div
          className={`mb-4 p-3 rounded-card border text-xs flex items-start gap-2 ${
            nadaPesan === 'pos'
              ? 'bg-pos/15 border-pos/30 text-pos'
              : nadaPesan === 'warn'
                ? 'bg-coral/10 border-coral/30 text-coral'
                : 'bg-surface-2 border-line text-ink-2'
          }`}
        >
          {nadaPesan === 'pos' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : nadaPesan === 'warn' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{pesan}</span>
          <button onClick={() => setPesan(null)} aria-label="Tutup pesan">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Form permintaan baru (user) */}
      {!admin && bukaForm && (
        <div className="bg-surface rounded-card border border-line p-5 mb-5">
          <h2 className="text-sm font-bold text-ink mb-3">Permintaan data baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold text-ink">
              Bidang
              <select
                value={fBidang}
                onChange={(e) => setFBidang(e.target.value)}
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                data-testid="pilih-bidang"
              >
                {BIDANG_BAWAAN.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-ink">
              Prioritas
              <select
                value={fPrioritas}
                onChange={(e) => setFPrioritas(e.target.value as 'rendah' | 'normal' | 'tinggi')}
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="rendah">Rendah</option>
                <option value="normal">Normal</option>
                <option value="tinggi">Tinggi</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-ink sm:col-span-2">
              Data yang diminta
              <textarea
                value={fData}
                onChange={(e) => setFData(e.target.value)}
                rows={3}
                placeholder="Contoh: realisasi pendapatan usaha per bulan 2026 beserta targetnya"
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                data-testid="input-data-diminta"
              />
            </label>
            <label className="text-[11px] font-semibold text-ink sm:col-span-2">
              Arah dashboard (opsional)
              <textarea
                value={fArah}
                onChange={(e) => setFArah(e.target.value)}
                rows={2}
                placeholder="Contoh: fokus ke tren bulanan dan perbandingan dengan target"
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label className="text-[11px] font-semibold text-ink">
              Dibutuhkan sebelum (opsional)
              <input
                type="date"
                value={fTarget}
                onChange={(e) => setFTarget(e.target.value)}
                className="mt-1 w-full text-xs p-2 rounded-control border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              disabled={sibuk || fData.trim().length < 10}
              onClick={() => void kirimBaru()}
              className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 text-xs font-semibold text-on-brand bg-brand hover:opacity-90 rounded-control disabled:opacity-50"
              data-testid="kirim-permintaan"
            >
              <Send className="w-3.5 h-3.5" /> Kirim permintaan
            </button>
            <button
              onClick={() => setBukaForm(false)}
              className="px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2 border border-line rounded-control"
            >
              Batal
            </button>
            <span className="text-[10px] text-ink-3">Dokumen bisa dilampirkan setelah permintaan tersimpan.</span>
          </div>
        </div>
      )}

      {/* Saringan status */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <button
          onClick={() => setSaring('semua')}
          className={`min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px] font-semibold rounded-control border transition-colors ${
            saring === 'semua' ? 'bg-brand/15 text-brand-ink border-brand/30' : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
          }`}
        >
          Semua ({daftar.length})
        </button>
        {SEMUA_STATUS.map((s) => {
          const jumlah = daftar.filter((p) => p.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setSaring(s)}
              className={`min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px] font-semibold rounded-control border transition-colors ${
                saring === s ? 'bg-brand/15 text-brand-ink border-brand/30' : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
              }`}
            >
              {LABEL_STATUS[s]} ({jumlah})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daftar */}
        <div className="space-y-2">
          {memuat ? (
            <div className="p-6 text-center text-xs text-ink-3 bg-surface rounded-card border border-line">Memuat…</div>
          ) : tersaring.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-card border border-line">
              <Inbox className="w-8 h-8 text-ink-3 mx-auto mb-2" />
              <p className="text-xs text-ink-2">
                {admin ? 'Belum ada permintaan pada saringan ini.' : 'Belum ada permintaan. Mulai dengan “Permintaan Baru”.'}
              </p>
            </div>
          ) : (
            tersaring.map((p) => (
              <ItemCard
                key={p.id}
                icon={<FileText className="w-4 h-4" />}
                accent={WARNA_STATUS[p.status]}
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    {p.bidang}
                    <LencanaStatus status={p.status} />
                  </span>
                }
                meta={
                  <span>
                    {admin ? `${p.pemohonNama} · ` : ''}
                    {p.ringkasan || ringkasPermintaan(p)}
                  </span>
                }
                active={terpilih?.id === p.id}
                onClick={() => {
                  setTerpilih(p);
                  setTampilTolak(false);
                  setAlasanTolak('');
                  setBalasan('');
                }}
              />
            ))
          )}
        </div>

        {/* Detail / kosong */}
        <div>
          {panelDetail || (
            <div className="p-8 text-center bg-surface rounded-card border border-line h-full flex flex-col items-center justify-center">
              <Lock className="w-7 h-7 text-ink-3 mb-2" />
              <p className="text-xs text-ink-2">
                {admin
                  ? 'Pilih satu permintaan untuk melihat data, dokumen, dan menanggapinya.'
                  : 'Pilih permintaan untuk melihat tanggapan admin.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermintaanDataPage;
