import React from 'react';
import { BookOpen } from 'lucide-react';
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
      {/* Poin temuan dulu (insight-first ala data storytelling), baru kutipan mentah. */}
      {bulletPoints && bulletPoints.length > 0 && (
        <div className="space-y-1.5">
          <ul className="space-y-1.5">
            {bulletPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-800 font-medium">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {idx + 1}
                </span>
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {text && (
        <div className="prose prose-sm max-w-none text-xs text-slate-600 leading-relaxed">
          <p className="whitespace-pre-line">{text}</p>
        </div>
      )}

      {citations.length > 0 && (
        <div className="pt-3 border-t border-blue-100 flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-semibold text-blue-500 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Sitasi Dokumen:
          </span>
          {citations.map((c, i) => (
            <button
              key={c.id || i}
              onClick={() => onOpenCitation?.(c)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-100 transition-colors"
              title={`${c.docName} (Hal. ${c.page})`}
            >
              <span>[{i + 1}]</span>
              <span className="max-w-[130px] truncate">{c.docName}</span>
              <span className="text-blue-400">p.{c.page}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
