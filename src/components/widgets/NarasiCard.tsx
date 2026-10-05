import React from 'react';

interface NarasiCardProps {
  text: string;
  bulletPoints?: string[];
}

export const NarasiCard: React.FC<NarasiCardProps> = ({ text, bulletPoints }) => {
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

    </div>
  );
};
