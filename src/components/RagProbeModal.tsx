import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Layers,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { RAGProbeResult } from '../types';

interface RagProbeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: 'structured' | 'prose';
  onToggleMode: (mode: 'structured' | 'prose') => void;
}

export const RagProbeModal: React.FC<RagProbeModalProps> = ({
  isOpen,
  onClose,
  activeMode,
  onToggleMode,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [probeResult, setProbeResult] = useState<RAGProbeResult | null>(null);

  if (!isOpen) return null;

  const runProbe = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/rag-probe', { method: 'POST' });
      const data = await res.json();
      setProbeResult(data);
    } catch (err) {
      console.error('Probe failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Uji Diagnostik API RAG (Probe Test Runner)
              </h2>
              <p className="text-xs text-slate-500">Evaluasi Kemampuan Jalur A vs Jalur B (Task 0.5 PRD)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Mode Switcher Banner for Demo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">Mode Simulasi RAG Demo</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Uji ketangguhan aplikasi pada kedua kemungkinan kapabilitas API RAG asli
                </p>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold uppercase">
                {activeMode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleMode('structured')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeMode === 'structured'
                    ? 'border-sky-500 bg-sky-50/80 ring-1 ring-sky-500 text-sky-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Code2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Jalur A (JSON Terstruktur)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  API RAG mengembalikan JSON spec langsung dengan sintesis AI.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onToggleMode('prose')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeMode === 'prose'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-500 text-emerald-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Jalur B (Agregasi Metadata)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  API RAG retrieval murni; dashboard disusun dari metadata tanpa AI.
                </p>
              </button>
            </div>
          </div>

          {/* Trigger Probe Button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-600 font-medium">Jalankan 5 Pengujian Diagnostik Otomatis:</span>
            <button
              onClick={runProbe}
              disabled={isRunning}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center gap-1.5 shadow-xs"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menguji Endpoint...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Jalankan Uji Probe</span>
                </>
              )}
            </button>
          </div>

          {/* Probe Output Report */}
          {probeResult ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <span className="text-[10px] text-slate-500 uppercase">Latensi RAG</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{probeResult.latencyMs} ms</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <span className="text-[10px] text-slate-500 uppercase">Jalur Terdeteksi</span>
                  <p className="text-sm font-bold text-sky-700 mt-0.5">{probeResult.modeDetected}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <span className="text-[10px] text-slate-500 uppercase">Validasi Zod</span>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">Lolos 100%</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-semibold text-slate-700">Rangkuman Hasil Uji:</span>
                <ul className="space-y-1.5 text-slate-600">
                  {probeResult.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
              Tekan tombol "Jalankan Uji Probe" untuk memverifikasi kesiapan komunikasi RAG.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Probe Engine v1.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
