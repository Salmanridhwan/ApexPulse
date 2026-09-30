import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filteredRows = rows.filter((r) =>
    columns.some((c) => {
      const val = String(r[c.key] || '').toLowerCase();
      return val.includes(searchTerm.toLowerCase());
    })
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    const result = aVal > bVal ? 1 : -1;
    return sortAsc ? result : -result;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari tabel..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50/50"
        />
      </div>

      <div className="overflow-x-auto overflow-y-auto flex-1 border border-slate-100 rounded-md max-h-[300px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 select-none transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {sortKey === col.key && (
                      sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                  Tidak ada data yang sesuai
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                      {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
