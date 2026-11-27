import React, { useState } from 'react';
import { 
  Search, 
  FileText, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  UserPlus,
  Edit3
} from 'lucide-react';
import { TaxComputation, Language } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { formatINR } from '../utils/pdfGenerator';
import { exportClientListToExcel } from '../utils/excelExporter';

interface ClientDirectoryProps {
  computations: TaxComputation[];
  lang: Language;
  onSelectComputation: (comp: TaxComputation) => void;
  onDeleteComputation: (id: string) => void;
  onEditComputation?: (comp: TaxComputation) => void;
  onAddNew: () => void;
  onOpenManualClientModal?: () => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({
  computations,
  lang,
  onSelectComputation,
  onDeleteComputation,
  onEditComputation,
  onAddNew,
  onOpenManualClientModal,
}) => {
  const t = TRANSLATIONS[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'refund' | 'payable' | 'nil'>('all');
  const [filterAY, setFilterAY] = useState<string>('all');

  // Filter list
  const filtered = computations.filter((comp) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      comp.client.name.toLowerCase().includes(q) ||
      comp.client.pan.toLowerCase().includes(q) ||
      (comp.client.mobile && comp.client.mobile.includes(q)) ||
      (comp.acknowledgementNumber && comp.acknowledgementNumber.includes(q));

    if (!matchesQuery) return false;

    if (filterAY !== 'all' && comp.assessmentYear !== filterAY) return false;

    if (filterType === 'refund') return comp.refundDue > 0;
    if (filterType === 'payable') return comp.netTaxPayable > 0;
    if (filterType === 'nil') return comp.refundDue === 0 && comp.netTaxPayable === 0;

    return true;
  });

  const totalRefund = filtered.reduce((s, c) => s + (c.refundDue || 0), 0);
  const totalPayable = filtered.reduce((s, c) => s + (c.netTaxPayable || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t.clientDirectory} ({computations.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage, search, export and generate 1-page compact computation sheets for all clients
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onOpenManualClientModal && (
            <button
              onClick={onOpenManualClientModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ {lang === 'pa' ? 'ਮੈਨੂਅਲ ਕਲਾਇੰਟ ਐਂਟਰੀ' : lang === 'hi' ? 'मैन्युअल नया क्लाइंट' : 'Add Client Manually'}</span>
            </button>
          )}

          <button
            onClick={() => exportClientListToExcel(computations)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Export</span>
          </button>

          <button
            onClick={onAddNew}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Upload PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-500 font-semibold block">Total Clients</span>
          <span className="text-xl font-bold text-slate-900">{computations.length}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-emerald-600 font-semibold block">Refunds Claimed</span>
          <span className="text-xl font-bold text-emerald-600">{formatINR(totalRefund)}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-red-600 font-semibold block">Balance Taxes</span>
          <span className="text-xl font-bold text-red-600">{formatINR(totalPayable)}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] text-blue-600 font-semibold block">Current AY 2025-26</span>
          <span className="text-xl font-bold text-blue-600">
            {computations.filter(c => c.assessmentYear === '2025-26').length}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PAN, Name, Mobile..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:border-blue-500 font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({computations.length})
            </button>
            <button
              onClick={() => setFilterType('refund')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                filterType === 'refund' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Refund Due
            </button>
            <button
              onClick={() => setFilterType('payable')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                filterType === 'payable' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tax Payable
            </button>
          </div>

          <select
            value={filterAY}
            onChange={(e) => setFilterAY(e.target.value)}
            className="p-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="all">All AYs</option>
            <option value="2025-26">AY 2025-26</option>
            <option value="2024-25">AY 2024-25</option>
          </select>
        </div>
      </div>

      {/* Client Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No client records found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Client Name & PAN</th>
                  <th className="py-3 px-3">AY / Form</th>
                  <th className="py-3 px-3">Gross Total Income</th>
                  <th className="py-3 px-3">Taxable Income</th>
                  <th className="py-3 px-3">Taxes Paid</th>
                  <th className="py-3 px-3">Refund / Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((comp) => (
                  <tr 
                    key={comp.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => onSelectComputation(comp)}
                  >
                    {/* Client Name & PAN */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">{comp.client.name}</div>
                      <div className="font-mono text-[11px] text-blue-600 font-semibold">{comp.client.pan}</div>
                    </td>

                    {/* AY / Form */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">AY {comp.assessmentYear}</div>
                      <div className="text-[10px] text-slate-500">{comp.itrForm} ({comp.regimeOpted === 'new' ? 'New' : 'Old'})</div>
                    </td>

                    {/* Gross Income */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{formatINR(comp.grossTotalIncome)}</div>
                      {((comp.agriculturalIncome || comp.otherSources?.agriculturalIncome || 0) > 0) && (
                        <div className="text-[9px] text-emerald-700 font-medium">
                          + Agri: {formatINR(comp.agriculturalIncome || comp.otherSources?.agriculturalIncome)} (Exempt)
                        </div>
                      )}
                    </td>

                    {/* Taxable Income */}
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {formatINR(comp.totalTaxableIncome)}
                    </td>

                    {/* Taxes Paid */}
                    <td className="py-3 px-3 text-slate-700">
                      {formatINR(comp.taxesPaid.totalTaxesPaid)}
                    </td>

                    {/* Refund / Payable Badge */}
                    <td className="py-3 px-3">
                      {comp.refundDue > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Refund {formatINR(comp.refundDue)}
                        </span>
                      ) : comp.netTaxPayable > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" />
                          Payable {formatINR(comp.netTaxPayable)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          NIL Return
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditComputation && (
                          <button
                            type="button"
                            onClick={() => onEditComputation(comp)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 transition cursor-pointer text-[11px] font-bold"
                            title="Edit Client & Tax Data (ਕਲਾਇੰਟ ਜਾਣਕਾਰੀ ਐਡਿਟ ਕਰੋ)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Edit (ਸੋਧੋ)</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectComputation(comp)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          title="Open 1-Page Computation Sheet (ਸ਼ੀਟ ਦੇਖੋ)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteComputation(comp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Delete Client Record (ਰਿਕਾਰਡ ਹਟਾਓ)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
