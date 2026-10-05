import React from 'react';

// Palet dot ala referensi — biru dominan sesuai tone aplikasi.
const DOT_COLORS = ['#4f46e5', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

interface Column {
  key: string;
  label: string;
  format?: 'number' | 'currency' | 'percent' | 'text';
}

interface DataTableProps {
  columns: Column[];
  rows: Array<Record<string, any>>;
}

export const DataTable: React.FC<DataTableProps> = ({ columns, rows }) => {
  // Tanpa sort/search toolbar — daftar sederhana ala referensi.
  const labelCol = columns[0];
  const valueCols = columns.slice(1);

  // Mode list hanya masuk akal untuk 1 kolom nilai; lebih dari itu fallback tabel ringkas.
  if (valueCols.length === 1) {
    const valueKey = valueCols[0].key;
    const angka = (v: any) => {
      const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const items = rows.map((r, i) => ({
      label: String(r[labelCol?.key] ?? '-'),
      value: r[valueKey],
      n: angka(r[valueKey]),
      color: DOT_COLORS[i % DOT_COLORS.length],
    }));
    const max = Math.max(...items.map((it) => it.n ?? 0), 1);

    return (
      <div className="flex flex-col h-full space-y-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">Belum ada data.</div>
        )}
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 py-2 border-b border-slate-100 last:border-0 group"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: it.color }}
            />
            <span className="text-xs font-medium text-slate-700 truncate flex-1">{it.label}</span>
            {/* Bar mini proporsional (halus, ala referensi) */}
            <span className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.round(((it.n ?? 0) / max) * 100)}%`, backgroundColor: it.color }}
              />
            </span>
            <span className="text-sm font-bold text-slate-900 tabular-nums w-16 text-right shrink-0">
              {String(it.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: tabel ringkas tanpa toolbar (kolom nilai > 1).
  return (
    <div className="overflow-x-auto overflow-y-auto flex-1 border border-slate-100 rounded-lg max-h-[300px]">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-100">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                Belum ada data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap ${
                      col !== labelCol ? 'font-semibold text-slate-900 tabular-nums' : 'font-medium'
                    }`}
                  >
                    {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
