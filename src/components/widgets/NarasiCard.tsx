import React from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Citation } from '../../types';

interface NarasiCardProps {
  text: string;
  bulletPoints?: string[];
  citations: Citation[];
  onOpenCitation?: (citation: Citation) => void;
}

export const NarasiCard: React.FC<NarasiCardProps> = ({
  text,
  bulletPoints,
  citations,
  onOpenCitation,
}) => {
  return (
    <div className="flex flex-col h-full justify-between space-y-3">
      <div className="prose prose-sm max-w-none text-xs text-slate-700 leading-relaxed">
        <p className="whitespace-pre-line">{text}</p>
      </div>

      {bulletPoints && bulletPoints.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Poin Temuan Utama
          </p>
          <ul className="space-y-1">
            {bulletPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {citations.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Sitasi Dokumen:
          </span>
          {citations.map((c, i) => (
            <button
              key={c.id || i}
              onClick={() => onOpenCitation?.(c)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200 transition-colors"
              title={`${c.docName} (Hal. ${c.page})`}
            >
              <span>[{i + 1}]</span>
              <span className="max-w-[130px] truncate">{c.docName}</span>
              <span className="text-slate-400">p.{c.page}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
