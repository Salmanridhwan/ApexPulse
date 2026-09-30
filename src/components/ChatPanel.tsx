import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  CornerDownLeft,
  FileCheck,
  Layers,
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
  activeDashboardId?: string;
  onDashboardUpdated: (dashboard: Dashboard) => void;
  activeMode: 'structured' | 'prose';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  sector,
  tenantId,
  activeDashboardId,
  onDashboardUpdated,
  activeMode,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'system',
      text: `Halo! Saya asisten orkestrator ApexPulse. Tuliskan kebutuhan dashboard BUMD Anda, dan saya akan mengekstraksi data dokumen RAG instansi secara langsung tanpa ketergantungan model LLM eksternal.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<ProgressStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentSteps]);

  const quickPrompts = [
    `Buat dashboard kinerja keuangan & operasional ${sector.toUpperCase()} 2026`,
    `Tampilkan tren capaian 12 bulan dan kepatuhan RKAP`,
    `Ubah grafik visualisasi jadi diagram batang`,
    `Hapus widget arus kas`,
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
      { id: 'step-0', title: 'Menghubungkan ke API RAG...', status: 'in_progress' },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          sector,
          tenantId,
          activeDashboardId,
          modeOverride: activeMode,
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
                  onDashboardUpdated(data.dashboard);
                }
                const botMsg: ChatMessage = {
                  id: `bot-${Date.now()}`,
                  sender: 'system',
                  text: data.message || 'Operasi selesai.',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  actionTaken: data.actionTaken,
                  modeUsed: data.modeUsed,
                  citationsCount: data.citationsCount,
                };
                setMessages((prev) => [...prev, botMsg]);
              } else if (currentEvent === 'error') {
                const errMsg: ChatMessage = {
                  id: `bot-err-${Date.now()}`,
                  sender: 'system',
                  text: `⚠️ Terjadi kendala: ${data.message}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                setMessages((prev) => [...prev, errMsg]);
              }
            } catch (parseErr) {
              console.error('SSE JSON parse error:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'system',
          text: `Gagal memproses instruksi: ${err.message || 'Koneksi terputus.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setCurrentSteps([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Chat Orchestrator RAG</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                {activeMode === 'structured' ? 'Jalur A (JSON)' : 'Jalur B (Metadata)'}
              </span>
            </h2>
            <p className="text-xs text-slate-500">Ekstraksi otomatis dokumen instansi BUMD</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-none'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10px]">
                {msg.sender === 'user' ? (
                  <span>Anda</span>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-sky-600" />
                    <span>ApexPulse Orchestrator</span>
                  </>
                )}
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <p className="whitespace-pre-line">{msg.text}</p>

              {/* Mode & Citations Metadata Pill */}
              {(msg.modeUsed || msg.citationsCount) && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-[10px]">
                  {msg.modeUsed && (
                    <span className="inline-flex items-center gap-1 text-slate-600 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                      <Layers className="w-3 h-3 text-sky-600" />
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

        {/* Live SSE Streaming Steps Card */}
        {isStreaming && (
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2.5 animate-pulse-subtle">
            <div className="flex items-center justify-between text-xs font-semibold text-sky-900">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                Memproses Permintaan RAG...
              </span>
              <span className="text-[10px] text-sky-700">Streaming SSE</span>
            </div>

            <div className="space-y-1.5 text-xs">
              {currentSteps.map((step) => (
                <div key={step.id} className="flex items-start gap-2">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : step.status === 'in_progress' ? (
                    <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                  )}
                  <span
                    className={
                      step.status === 'completed'
                        ? 'text-slate-700 font-medium'
                        : step.status === 'in_progress'
                        ? 'text-sky-800 font-medium'
                        : 'text-slate-400'
                    }
                  >
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            disabled={isStreaming}
            onClick={() => handleSendMessage(qp)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-600 transition-colors shrink-0 disabled:opacity-50"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder={`Ketik instruksi dashboard ${sector.toUpperCase()}...`}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isStreaming}
            className="w-full text-xs pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40 disabled:hover:bg-sky-600 transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Didukung Orkestrator Node.js + Validasi Zod + Dual Jalur RAG BUMD
        </p>
      </div>
    </div>
  );
};
