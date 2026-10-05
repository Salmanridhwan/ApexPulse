import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart2,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  CornerDownLeft,
  FileCheck,
  Layers,
  Loader2,
  PieChart,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';
import { BumdSector, ChatMessage, ChatRecommendation, Dashboard, ProgressStep } from '../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sector: BumdSector;
  tenantId: string;
  /** Dashboard pemilik percakapan ini — sumber riwayatnya. */
  dashboardId?: string;
  onDashboardUpdated: (dashboard: Dashboard) => void;
}

// Chart type icon helper
const ChartIcon: React.FC<{ type: string; className?: string }> = ({ type, className = 'w-3 h-3' }) => {
  if (type === 'bar') return <BarChart2 className={className} />;
  if (type === 'line' || type === 'area') return <TrendingUp className={className} />;
  if (type === 'donut' || type === 'pie') return <PieChart className={className} />;
  return <Layers className={className} />;
};

// Category color map
const categoryColor: Record<string, string> = {
  Keuangan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Operasional: 'bg-surface-2 text-brand-ink border-line',
  'Kepatuhan & Risiko': 'bg-amber-50 text-amber-700 border-amber-200',
  SDM: 'bg-violet-50 text-violet-700 border-violet-200',
  Pelanggan: 'bg-rose-50 text-rose-700 border-rose-200',
};
const getCategoryClass = (cat: string) =>
  categoryColor[cat] || 'bg-surface-2 text-ink-2 border-line';

// Recommendation cards component
const RecommendationCards: React.FC<{
  items: ChatRecommendation[];
  onSelect: (prompt: string) => void;
  isStreaming: boolean;
}> = ({ items, onSelect, isStreaming }) => (
  <div className="mt-3 grid gap-2">
    {items.map((rec, i) => (
      <button
        key={rec.id}
        disabled={isStreaming}
        onClick={() => onSelect(rec.prompt)}
        className="group text-left w-full bg-surface border border-line hover:border-line-strong hover:shadow-md rounded-card p-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ animationDelay: `${i * 60}ms` }}
      >
        <div className="flex items-start gap-2.5">
          {/* index badge */}
          <span className="shrink-0 w-5 h-5 rounded-full bg-surface-2 text-brand-ink text-[10px] font-bold flex items-center justify-center mt-0.5 group-hover:bg-brand group-hover:text-white transition-colors">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-xs font-semibold text-ink leading-tight">{rec.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getCategoryClass(rec.category)}`}>
                {rec.category}
              </span>
            </div>
            <p className="text-[11px] text-ink-2 leading-snug line-clamp-2 mb-2">{rec.description}</p>
            {/* chart type pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {rec.chartTypes.slice(0, 3).map((ct) => (
                <span
                  key={ct}
                  className="inline-flex items-center gap-0.5 text-[10px] bg-surface-2 text-ink-2 px-1.5 py-0.5 rounded font-mono"
                >
                  <ChartIcon type={ct} className="w-2.5 h-2.5" />
                  {ct}
                </span>
              ))}
            </div>
          </div>
          {/* CTA arrow */}
          <div className="shrink-0 mt-1 text-ink-3 group-hover:text-brand transition-colors">
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </button>
    ))}
  </div>
);

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  sector,
  tenantId,
  dashboardId,
  onDashboardUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<ProgressStep[]>([]);
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

  // Riwayat dimuat dari server tiap dashboard aktif berubah (server yang membuatnya).
  useEffect(() => {
    if (!isOpen) return;
    if (isStreaming) return; // Jangan bersihkan atau muat ulang riwayat saat sedang streaming respon!

    if (!dashboardId) {
      setChatId(undefined);
      // PERBAIKAN: Jangan panggil setMessages([]) agar pesan lokal yang baru dikirim tidak hilang!
      return;
    }
    let batal = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/chat`);
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
  }, [isOpen, dashboardId, isStreaming]);

  const quickPrompts = [
    `Berapa total aset ${sector.toUpperCase()} tahun 2025?`,
    `Apa saja indikator kinerja utama ${sector.toUpperCase()}?`,
    `Buat dashboard kinerja keuangan ${sector.toUpperCase()} 2026`,
    `Rekomendasi chart untuk dashboard ini`,
    `Bagaimana pertumbuhan laba bersih tahun ini?`,
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
      { id: 'step-0', title: 'Menghubungkan ke ApexPulse Orchestrator...', status: 'in_progress' },
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
        }),
      });

      if (!response.body) {
        throw new Error('Streaming response body not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'step') {
                setCurrentSteps((prev) => {
                  const existingIdx = prev.findIndex((s) => s.id === data.id);
                  if (existingIdx !== -1) {
                    const copy = [...prev];
                    copy[existingIdx] = data;
                    return copy;
                  }
                  return [...prev, data];
                });
              } else if (currentEvent === 'result') {
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
                  recommendations: data.recommendations,
                };
              } else if (currentEvent === 'error') {
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
          <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <span>Chat Orchestrator RAG</span>
            </h2>
            <p className="text-xs text-ink-2">
              {chatId && dashboardId ? `Riwayat tersimpan · ${messages.length} pesan` : 'Tanya dokumen resmi atau buat dashboard BUMD'}
            </p>
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
                  const ulang = await fetch(`/api/dashboards/${dashboardId}/chat`);
                  const data = await ulang.json();
                  setChatId(data.chat?.id);
                  setMessages(data.chat?.messages || []);
                } catch (err) {
                  console.error('Gagal menghapus riwayat chat:', err);
                }
              }}
              title="Hapus riwayat chat (dashboard tetap ada)"
              className="p-1 rounded-chip text-ink-3 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                  ? 'bg-brand text-white rounded-tr-none'
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
                    <span>ApexPulse Orchestrator</span>
                  </>
                )}
                <span>•</span>
                <span>{jam(msg.timestamp)}</span>
              </div>

              {/* Message text – render markdown: bold, code, headings, bullet, newline */}
              <div className="leading-relaxed space-y-1">
                {msg.text.split('\n').map((rawLine, li) => {
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

              {/* ✦ Interactive Recommendation Cards */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <RecommendationCards
                  items={msg.recommendations}
                  onSelect={handleSendMessage}
                  isStreaming={isStreaming}
                />
              )}

              {/* Mode & Citations Metadata Pill */}
              {(msg.modeUsed || msg.citationsCount) && (
                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center gap-2 text-[10px]">
                  {msg.modeUsed && (
                    <span className="inline-flex items-center gap-1 text-ink-2 font-medium bg-surface px-2 py-0.5 rounded border border-line">
                      <Layers className="w-3 h-3 text-brand" />
                      {msg.modeUsed}
                    </span>
                  )}
                  {msg.citationsCount !== undefined && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <FileCheck className="w-3 h-3 text-emerald-600" />
                      {msg.citationsCount} Sitasi
                    </span>
                  )}
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
                    <div className="w-6 h-6 rounded-control bg-brand text-white flex items-center justify-center relative z-10 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-ink text-[11px] block">ApexPulse Orchestrator</span>
                    <span className="text-[10px] text-brand font-medium flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Sedang memproses & menganalisis...
                    </span>
                  </div>
                </div>

                {/* Animated Bouncing Dots */}
                <div className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-full border border-line">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>

              {/* Realtime Stepper Progress List */}
              <div className="space-y-2 pt-0.5">
                {currentSteps.map((step) => {
                  const isDone = step.status === 'completed';
                  const isCurrent = step.status === 'in_progress';
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-control text-xs transition-all duration-300 ${
                        isCurrent
                          ? 'bg-surface-2 border border-line/80 text-ink font-semibold shadow-2xs'
                          : isDone
                            ? 'text-ink-2 bg-surface-2/70 border border-transparent'
                            : 'text-ink-3 opacity-60'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-ink-3 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{step.title}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand text-white font-mono uppercase tracking-wider animate-pulse">
                          Aktif
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Line Bar */}
              <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-gradient-to-r from-brand to-brand h-full transition-all duration-500 rounded-full animate-pulse"
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
            className="absolute right-1.5 p-1.5 rounded-control bg-brand hover:bg-brand-ink text-white disabled:opacity-40 disabled:hover:bg-brand transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-ink-3 text-center mt-1.5">
          Didukung Orkestrator Node.js + Validasi Zod + Dual Jalur RAG BUMD
        </p>
      </div>
    </div>
  );
};
