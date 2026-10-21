import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { BumdSector, ChatMessage, Dashboard, ProgressStep } from '../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sector: BumdSector;
  tenantId: string;
  /**
   * Nama instansi yang sedang dibuka. Dipakai HANYA untuk ditampilkan di header,
   * supaya jelas copilot ini menjawab dokumen instansi yang mana — tanpa ini,
   * jawaban dari KB instansi lain terlihat seolah "ngacak".
   */
  tenantName?: string;
  /** Knowledge Base instansi aktif (kalau diatur admin) — ikut ditampilkan di header. */
  tenantKbId?: string;
  /** Dashboard pemilik percakapan ini — sumber riwayatnya. */
  dashboardId?: string;
  onDashboardUpdated: (dashboard: Dashboard) => void;
}

/**
 * Riwayat percakapan lama menyimpan istilah mesin ("Orchestrator", "RAG", baris
 * "Penyebab: ..."). Ini dibersihkan saat ditampilkan supaya pengguna hanya melihat
 * bahasa yang berguna; pesan aslinya di database tidak diubah.
 */
const bersihkanTeks = (teks: string): string =>
  teks
    .replace(/Aiones Boards Orchestrator/g, 'Asisten Aiones Boards')
    .replace(/Konfigurasi RAG/gi, 'Pengaturan layanan')
    .replace(/Provider RAG/gi, 'Penyedia dokumen')
    .replace(/layanan RAG/gi, 'layanan dokumen')
    .replace(/knowledge base/gi, 'kumpulan dokumen')
    .replace(/^\s*Penyebab:.*$/gim, '')
    // Blok sitasi di riwayat lama ("📄 **Sumber Dokumen:**" + daftar berkas) dibuang.
    // Catatan: emoji adalah pasangan surrogate, jadi kelas karakter tanpa flag /u
    // hanya memotong SATU bagian dan menyisakan "\uFFFD" di layar. Pakai alternasi + /u.
    .replace(/\n*\s*(?:📄|📚)?\s*\*\*Sumber Dokumen:\*\*[\s\S]*$/iu, '')
    // Sisa potongan surrogate (kalau ada dari riwayat lama) dibuang.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  sector,
  tenantId,
  tenantName,
  tenantKbId,
  dashboardId,
  onDashboardUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<ProgressStep[]>([]);
  /**
   * Detak waktu berjalan + urutan langkah. Langkah hanya berubah saat backend mengirim
   * progres baru, jadi tanpa penanda yang bergerak tiap detik panel terlihat "diam"
   * meski sedang menunggu RAG puluhan detik.
   */
  const [detik, setDetik] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setDetik(0);
      return;
    }
    const id = setInterval(() => setDetik((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  /**
   * Hanya langkah TERAKHIR yang berstatus `in_progress` yang dianggap sedang berjalan.
   * Backend mengirim langkah baru tanpa menutup langkah sebelumnya, jadi tanpa penanda
   * ini dua baris (atau lebih) tampil "AKTIF" sekaligus.
   */
  const idxLangkahAktif = currentSteps.reduce((acc, s, i) => (s.status === 'in_progress' ? i : acc), -1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Timestamp pesan dari server berbentuk ISO; tampilkan sebagai jam lokal. */
  const jam = (ts: string) => {
    const d = new Date(ts);
    return isNaN(d.getTime())
      ? ts
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentSteps]);

  // Riwayat dimuat dari server tiap dashboard aktif ATAU instansi aktif berubah.
  //
  // `tenantId` wajib ada di daftar dependensi DAN di setiap permintaan: tanpa itu,
  // saat admin berpindah instansi panel tetap menampilkan riwayat instansi
  // sebelumnya, dan permintaan tanpa `tenantId` dijawab server dengan instansi milik
  // akun admin sendiri — riwayat dan jawaban jadi berasal dari dua instansi berbeda.
  useEffect(() => {
    if (!isOpen) return;
    if (isStreaming) return; // Jangan bersihkan atau muat ulang riwayat saat sedang streaming respon!

    // Kosongkan dulu supaya riwayat instansi lama tidak menyangkut di instansi baru.
    setMessages([]);
    setChatId(undefined);

    if (!dashboardId) {
      // Belum ada dashboard terbuka: muat riwayat "percakapan umum" instansi aktif,
      // supaya pertanyaan bebas yang tadi diajukan tidak hilang saat panel dibuka lagi.
      let batalUmum = false;
      (async () => {
        try {
          const res = await fetch(`/api/chat/umum?tenantId=${encodeURIComponent(tenantId)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (batalUmum) return;
          setChatId(data.chat?.id);
          if (Array.isArray(data.chat?.messages) && data.chat.messages.length > 0) {
            setMessages(data.chat.messages);
          }
        } catch (err) {
          if (!batalUmum) console.error('Gagal memuat riwayat chat umum:', err);
        }
      })();
      return () => {
        batalUmum = true;
      };
    }
    let batal = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/chat?tenantId=${encodeURIComponent(tenantId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (batal) return;
        setChatId(data.chat?.id);
        if (Array.isArray(data.chat?.messages) && data.chat.messages.length > 0) {
          setMessages(data.chat.messages);
        }
      } catch (err) {
        if (!batal) console.error('Gagal memuat riwayat chat:', err);
      }
    })();
    return () => {
      batal = true;
    };
  }, [isOpen, dashboardId, isStreaming, tenantId]);

  const quickPrompts = [
    `Berapa total aset ${sector.toUpperCase()} tahun 2025?`,
    `Apa saja indikator kinerja utama ${sector.toUpperCase()}?`,
    `Buat dashboard kinerja keuangan ${sector.toUpperCase()} 2026`,
    `Bagaimana pertumbuhan laba bersih tahun ini?`,
    `Apa program kerja utama ${sector.toUpperCase()} tahun ini?`,
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isStreaming) return;

    setInputPrompt('');
    const userMsgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setCurrentSteps([
      { id: 'step-0', title: 'Menghubungkan ke asisten...', status: 'in_progress' },
    ]);

    const streamStart = Date.now();
    let pendingBotMsg: ChatMessage | null = null;
    let pendingDashboard: Dashboard | null = null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          sector,
          tenantId,
          dashboardId,
          // Riwayat percakapan untuk chatbot multi-turn (dipakai saat belum ada
          // dashboard tempat server menyimpan riwayat).
          history: messages.slice(-12).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!response.body) {
        throw new Error('Streaming response body not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // PENTING: `currentEvent` harus bertahan ANTAR potongan (chunk). Balasan
      // RAG bisa panjang sehingga satu peristiwa (`event:` + `data:`) terbelah
      // jadi beberapa chunk; kalau nama event di-reset tiap chunk, baris `data:`
      // tiba tanpa nama event → hasil jawaban ikut terbuang (loading hilang,
      // tidak ada output).
      let currentEvent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.slice('data:'.length).trim();
            if (!dataStr) continue;
            // Konsumsi nama event SETELAH data diproses (bukan per-chunk).
            const eventName = currentEvent;
            currentEvent = '';

            try {
              const data = JSON.parse(dataStr);
              if (eventName === 'step') {
                setCurrentSteps((prev) => {
                  const existingIdx = prev.findIndex((s) => s.id === data.id);
                  if (existingIdx !== -1) {
                    const copy = [...prev];
                    copy[existingIdx] = data;
                    return copy;
                  }
                  return [...prev, data];
                });
              } else if (eventName === 'result') {
                if (data.dashboard) {
                  pendingDashboard = data.dashboard;
                }
                pendingBotMsg = {
                  id: `bot-${Date.now()}`,
                  sender: 'system',
                  text: data.message || 'Operasi selesai.',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  actionTaken: data.actionTaken,
                  modeUsed: data.modeUsed,
                  citationsCount: data.citationsCount,
                };
              } else if (eventName === 'error') {
                pendingBotMsg = {
                  id: `bot-err-${Date.now()}`,
                  sender: 'system',
                  text: `⚠️ Terjadi kendala: ${data.message}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
              }
            } catch (parseErr) {
              console.error('SSE JSON parse error:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      pendingBotMsg = {
        id: `bot-err-${Date.now()}`,
        sender: 'system',
        text: `Gagal memproses instruksi: ${err.message || 'Koneksi terputus.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    } finally {
      // Jamin durasi loading minimal (1000ms) agar indikator stepper terlihat jelas
      const elapsed = Date.now() - streamStart;
      const MIN_DISPLAY_TIME = 1000;
      if (elapsed < MIN_DISPLAY_TIME) {
        await new Promise((r) => setTimeout(r, MIN_DISPLAY_TIME - elapsed));
      }

      // Kalau stream berakhir TANPA hasil (mis. koneksi diputus proxy), jangan
      // diamkan layar — beri tahu jujur daripada loading hilang tanpa jejak.
      if (!pendingBotMsg && !pendingDashboard) {
        pendingBotMsg = {
          id: `bot-empty-${Date.now()}`,
          sender: 'system',
          text: 'Tidak ada balasan yang diterima dari server (koneksi terputus atau layanan tidak merespons). Silakan coba lagi.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }

      if (pendingDashboard) {
        onDashboardUpdated(pendingDashboard);
      }
      if (pendingBotMsg) {
        const msgToAdd = pendingBotMsg;
        setMessages((prev) => [...prev, msgToAdd]);
      }

      setIsStreaming(false);
      setCurrentSteps([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] bg-surface border-l border-line shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-on-brand shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <span>Asisten Dashboard</span>
            </h2>
            <p className="text-xs text-ink-2">
              {chatId && dashboardId ? `Riwayat tersimpan · ${messages.length} pesan` : 'Tanya dokumen resmi atau buat dashboard BUMD'}
            </p>
            {/* Instansi sumber jawaban. Penting saat login sebagai admin: instansi aktif
                bisa berbeda dari instansi akun, jadi harus terlihat agar tidak terkesan
                copilot mengambil KB secara acak. */}
            {tenantName && (
              <p className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1 flex-wrap">
                <Building2 className="w-3 h-3 shrink-0" />
                <span>
                  Menjawab untuk <strong className="text-ink-2">{tenantName}</strong>
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {chatId && dashboardId && (
            <button
              onClick={async () => {
                if (!window.confirm('Hapus riwayat percakapan ini? Dashboard-nya tetap ada.')) return;
                try {
                  const del = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
                  if (!del.ok) throw new Error(`HTTP ${del.status}`);
                  // Server membuat ulang chat kosong untuk dashboard ini.
                  const ulang = await fetch(`/api/dashboards/${dashboardId}/chat?tenantId=${encodeURIComponent(tenantId)}`);
                  const data = await ulang.json();
                  setChatId(data.chat?.id);
                  setMessages(data.chat?.messages || []);
                } catch (err) {
                  console.error('Gagal menghapus riwayat chat:', err);
                }
              }}
              title="Hapus riwayat chat (dashboard tetap ada)"
              className="p-1 rounded-chip text-ink-3 hover:text-neg hover:bg-neg/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-card p-3.5 text-xs leading-relaxed shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-brand text-on-brand rounded-tr-none'
                  : 'bg-surface-2 border border-line/80 text-ink rounded-tl-none'
              }`}
            >
              {/* Sender & time */}
              <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10px]">
                {msg.sender === 'user' ? (
                  <span>Anda</span>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-brand" />
                    <span>Asisten Aiones Boards</span>
                  </>
                )}
                <span>•</span>
                <span>{jam(msg.timestamp)}</span>
              </div>

              {/* Message text – render markdown: bold, code, headings, bullet, newline */}
              <div className="leading-relaxed space-y-1">
                {/* Riwayat lama menyimpan istilah teknis (nama mesin, "RAG", baris
                    "Penyebab: ..."). Dibersihkan saat ditampilkan — tanpa migrasi data. */}
                {bersihkanTeks(msg.text)
                  .split('\n').map((rawLine, li) => {
                  const line = rawLine.trim();
                  if (!line) return <div key={li} className="h-1.5" />;

                  // Inline parser: bold & code
                  const renderInline = (s: string) => {
                    // split by code `...`
                    const codeParts = s.split(/`([^`]+)`/g);
                    return codeParts.map((cp, ci) => {
                      if (ci % 2 === 1) {
                        return (
                          <code key={ci} className="px-1 py-0.5 rounded bg-line text-ink text-[11px] font-mono">
                            {cp}
                          </code>
                        );
                      }
                      // split by **bold**
                      const boldParts = cp.split(/\*\*(.*?)\*\*/g);
                      return boldParts.map((bp, bi) =>
                        bi % 2 === 1 ? <strong key={`${ci}-${bi}`} className="font-semibold text-ink">{bp}</strong> : <span key={`${ci}-${bi}`}>{bp}</span>
                      );
                    });
                  };

                  // Heading: ## or ###
                  if (line.startsWith('### ')) {
                    return <h4 key={li} className="font-bold text-ink text-xs mt-2">{renderInline(line.replace(/^###\s+/, ''))}</h4>;
                  }
                  if (line.startsWith('## ')) {
                    return <h3 key={li} className="font-bold text-ink text-xs mt-2.5 border-b border-line/80 pb-0.5">{renderInline(line.replace(/^##\s+/, ''))}</h3>;
                  }

                  // Bullet list
                  const isBullet = line.startsWith('•') || line.startsWith('- ');
                  if (isBullet) {
                    return (
                      <div key={li} className="flex items-start gap-1.5 pl-1.5 text-ink-2">
                        <span className="text-brand font-bold leading-tight">•</span>
                        <span className="flex-1">{renderInline(line.replace(/^[•\-]\s*/, ''))}</span>
                      </div>
                    );
                  }

                  // Table row separator: |---|---|
                  if (/^\|[\s\-:|]+\|$/.test(line)) {
                    return null;
                  }

                  // Table row
                  if (line.startsWith('|') && line.endsWith('|')) {
                    const cells = line.slice(1, -1).split('|').map((c) => c.trim());
                    return (
                      <div key={li} className="grid grid-flow-col auto-cols-fr gap-2 py-0.5 px-1 bg-surface/70 rounded text-[11px] font-mono border-b border-line/50">
                        {cells.map((cell, ci) => (
                          <span key={ci} className="truncate">{renderInline(cell)}</span>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <p key={li} className="text-ink">
                      {renderInline(line)}
                    </p>
                  );
                })}
              </div>

              {/* Kartu rekomendasi DIHAPUS: rekomendasi chart kini datang dari
                  jawaban RAG (chatbot), bukan dari katalog aplikasi. */}

              {/* Peringatan status dashboard. Label teknis internal ("Jalur A
                  (LLM JSON)", jumlah sitasi) sengaja TIDAK ditampilkan — itu
                  detail mesin, bukan informasi yang berguna bagi pengguna. Yang
                  tetap tampil hanya peringatan yang memang penting: dashboard
                  berisi data contoh, layanan RAG tidak terhubung, atau dashboard
                  tidak dibuat. */}
              {msg.modeUsed === 'Fallback (Template Snapshot)' && (
                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-warn font-semibold bg-warn/15 px-2 py-0.5 rounded border border-warn/40">
                    <AlertTriangle className="w-3 h-3 text-warn" />
                    DATA CONTOH — bukan dokumen instansi
                  </span>
                </div>
              )}
              {msg.modeUsed === 'Gagal (Layanan RAG)' && (
                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-neg font-semibold bg-neg/15 px-2 py-0.5 rounded border border-neg/40">
                    <AlertCircle className="w-3 h-3 text-neg" />
                    Layanan dokumen tidak tersedia
                  </span>
                </div>
              )}
              {msg.modeUsed === 'Gagal (Dokumen Tidak Memadai)' && (
                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-neg font-semibold bg-neg/15 px-2 py-0.5 rounded border border-neg/40">
                    <AlertTriangle className="w-3 h-3 text-neg" />
                    Dashboard tidak dibuat
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live SSE Streaming Loading Card */}
        {isStreaming && (
          <div className="flex flex-col items-start space-y-2 animate-fadeIn">
            {/* Assistant Bubble Skeleton & Typing Indicator */}
            <div className="max-w-[95%] w-full bg-surface border border-line/90 rounded-card rounded-tl-none p-4 text-xs shadow-md space-y-3">
              {/* Header Indicator */}
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                    <div className="w-6 h-6 rounded-control bg-brand text-on-brand flex items-center justify-center relative z-10 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-ink text-[11px] block">Asisten Aiones Boards</span>
                    <span role="status" aria-live="polite" className="text-[10px] text-brand font-medium flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Sedang memproses & menganalisis...
                      <span className="tabular-nums text-ink-3">· {detik} dtk</span>
                    </span>
                  </div>
                </div>

                {/* Animated Typing Dots — exponential ease-out, bukan bounce */}
                <div className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-full border border-line">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand dot-typing" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand dot-typing" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand dot-typing" style={{ animationDelay: '300ms' }} />
                </div>
              </div>

              {/* Realtime Stepper Progress List */}
              <div className="space-y-2 pt-0.5">
                {currentSteps.map((step, i) => {
                  const isCurrent = i === idxLangkahAktif;
                  const isDone = step.status === 'completed' || i < idxLangkahAktif;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs transition-all duration-300 ${
                        isCurrent
                          ? 'step-live bg-surface-2 border border-line/80 text-ink font-semibold shadow-2xs'
                          : isDone
                            ? 'text-ink-2 bg-surface-2/70 border border-transparent'
                            : 'text-ink-3 opacity-60'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-pos shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-ink-3 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{step.title}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand text-on-brand font-mono uppercase tracking-wider animate-pulse tabular-nums">
                          Aktif · {detik} dtk
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Line Bar — bergaris & alurnya bergerak supaya tetap terlihat hidup
                  walau persentasenya belum berubah (menunggu RAG bisa puluhan detik). */}
              <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-brand bar-live h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${
                      currentSteps.length > 0
                        ? Math.max(
                            20,
                            Math.round(
                              (currentSteps.filter((s) => s.status === 'completed').length /
                                currentSteps.length) *
                                100
                            )
                          )
                        : 15
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-surface-2/50 border-t border-line flex gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            disabled={isStreaming}
            onClick={() => handleSendMessage(qp)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 bg-surface hover:bg-surface-2 border border-line rounded-full text-ink-2 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-line bg-surface">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder={
              isStreaming
                ? 'Sedang memproses instruksi... Mohon tunggu sebentar'
                : `Ketik instruksi dashboard ${sector.toUpperCase()}...`
            }
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isStreaming}
            className="w-full text-xs pl-3.5 pr-12 py-2.5 bg-surface-2 border border-line rounded-card focus:outline-none focus:ring-2 focus:ring-brand focus:bg-surface transition-all disabled:bg-surface-2 disabled:text-ink-3 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-control bg-brand hover:brightness-95 text-on-brand disabled:opacity-40 disabled:hover:bg-brand transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-ink-3 text-center mt-1.5">
          Jawaban & angka bersumber dari dokumen instansi
        </p>
      </div>
    </div>
  );
};
