import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Eye,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Receipt,
  Lock,
  RotateCcw,
} from 'lucide-react';
import {
  TaxComputation,
  TaxChallanRecord,
  FirmDetails,
  TaxPaymentCategory,
  ChallanVerificationStatus,
} from '../types';
import {
  TAX_PAYMENT_CATEGORIES,
  auditChallanRecord,
  isMissingField,
  normalizeNotFound,
} from '../utils/challanEngine';
import { recalculateFullComputation } from '../utils/taxCalculator';
import { formatINR, exportChallanRegisterToPdf } from '../utils/pdfGenerator';
import { exportChallanRegisterToExcel } from '../utils/excelExporter';
import { ChallanFormModal } from './ChallanFormModal';
import { ChallanExtractionModal } from './ChallanExtractionModal';

interface ChallanRegisterProps {
  computations: TaxComputation[];
  standaloneChallans: TaxChallanRecord[];
  firm: FirmDetails;
  onUpdateComputation: (updated: TaxComputation) => void;
  onUpdateStandaloneChallans: (challans: TaxChallanRecord[]) => void;
  onSelectComputation: (comp: TaxComputation) => void;
}

interface UnifiedChallanEntry {
  challan: TaxChallanRecord;
  sourceComp?: TaxComputation;
  isFiledReturn: boolean;
}

export const ChallanRegister: React.FC<ChallanRegisterProps> = ({
  computations,
  standaloneChallans,
  firm,
  onUpdateComputation,
  onUpdateStandaloneChallans,
  onSelectComputation,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [panFilter, setPanFilter] = useState('');
  const [ayFilter, setAyFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [amountFilter, setAmountFilter] = useState('');

  // Modal & Confirmation State
  const [isExtractorOpen, setIsExtractorOpen] = useState(false);
  const [formState, setFormState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'view';
    challan?: TaxChallanRecord;
    sourceComp?: TaxComputation;
  }>({ isOpen: false, mode: 'create' });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [filedWarningAction, setFiledWarningAction] = useState<{
    type: 'edit' | 'delete';
    entry: UnifiedChallanEntry;
  } | null>(null);

  // Merge all challans from computations + standalone store
  const unifiedEntries = useMemo<UnifiedChallanEntry[]>(() => {
    const items: UnifiedChallanEntry[] = [];
    computations.forEach((comp) => {
      const isFiled =
        comp.status === 'Filed' ||
        comp.status === 'Verified' ||
        comp.status === 'Refund Received';
      const list = comp.taxesPaid?.challans || [];
      list.forEach((ch) => {
        items.push({
          challan: {
            ...ch,
            computationId: comp.id,
            pan: !isMissingField(ch.pan) ? ch.pan.toUpperCase() : (comp.client.pan || 'Not Found').toUpperCase(),
            assesseeName: !isMissingField(ch.assesseeName)
              ? ch.assesseeName.toUpperCase()
              : (comp.client.name || 'Not Found').toUpperCase(),
            assessmentYear: !isMissingField(ch.assessmentYear) ? ch.assessmentYear : comp.assessmentYear,
            financialYear: !isMissingField(ch.financialYear) ? ch.financialYear : comp.financialYear,
          },
          sourceComp: comp,
          isFiledReturn: isFiled,
        });
      });
    });

    standaloneChallans.forEach((ch) => {
      items.push({
        challan: ch,
        sourceComp: undefined,
        isFiledReturn: false,
      });
    });

    return items;
  }, [computations, standaloneChallans]);

  const allFlatChallans = useMemo(() => unifiedEntries.map((u) => u.challan), [unifiedEntries]);

  const availableAYs = useMemo(() => {
    const set = new Set<string>();
    unifiedEntries.forEach((u) => {
      if (u.challan.assessmentYear && u.challan.assessmentYear !== 'Not Found') {
        set.add(u.challan.assessmentYear);
      }
    });
    return Array.from(set).sort().reverse();
  }, [unifiedEntries]);

  // Apply Search & Filters
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const panQ = panFilter.trim().toLowerCase();
    const dateQ = dateFilter.trim().toLowerCase();
    const amtNum = amountFilter.trim() !== '' ? Number(amountFilter.trim()) : null;

    return unifiedEntries.filter(({ challan }) => {
      if (ayFilter !== 'ALL' && challan.assessmentYear !== ayFilter) return false;
      if (categoryFilter !== 'ALL' && challan.challanType !== categoryFilter) return false;
      if (verificationFilter !== 'ALL' && challan.verificationStatus !== verificationFilter) return false;
      if (panQ && !(challan.pan || '').toLowerCase().includes(panQ)) return false;
      if (dateQ && !(challan.challanTenderDate || '').toLowerCase().includes(dateQ)) return false;
      if (amtNum !== null && !isNaN(amtNum) && Math.abs((challan.totalAmountPaid || 0) - amtNum) > 0.99) {
        return false;
      }

      if (q) {
        const haystack = [
          challan.pan,
          challan.assesseeName,
          challan.assessmentYear,
          challan.financialYear,
          challan.challanType,
          challan.challanSerialNumber,
          challan.bsrCode,
          challan.challanTenderDate,
          challan.bankName,
          challan.cin,
          String(challan.totalAmountPaid || 0),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [unifiedEntries, searchQuery, panFilter, ayFilter, categoryFilter, verificationFilter, dateFilter, amountFilter]);

  // Register KPIs (Calculated on filtered entries)
  const kpis = useMemo(() => {
    let totalDeposited = 0;
    let eligibleCredits = 0;
    let fee234F = 0;
    let verifiedCount = 0;
    let pendingCount = 0;

    filteredEntries.forEach(({ challan }) => {
      const amt = Number(challan.totalAmountPaid || 0);
      totalDeposited += amt;
      if (challan.challanType === 'Late Filing Fee – u/s 234F') {
        fee234F += amt;
      } else if (
        challan.challanType !== 'Interest u/s 234A' &&
        challan.challanType !== 'Interest u/s 234B' &&
        challan.challanType !== 'Interest u/s 234C'
      ) {
        eligibleCredits += Math.max(0, amt - Number(challan.lateFilingFee || 0));
      }

      if (challan.verificationStatus === 'Verified') verifiedCount++;
      else pendingCount++;
    });

    return {
      count: filteredEntries.length,
      totalDeposited,
      eligibleCredits,
      fee234F,
      verifiedCount,
      pendingCount,
    };
  }, [filteredEntries]);

  // Persistence helpers: route saves to matching computation (if PAN + AY match and not locked, or explicitly linked) or standalone
  const findMatchingComputation = (pan?: string, ay?: string, compId?: string): TaxComputation | undefined => {
    if (compId) {
      const byId = computations.find((c) => c.id === compId);
      if (byId) return byId;
    }
    if (!pan || isMissingField(pan)) return undefined;
    const normPan = pan.trim().toUpperCase();
    const normAy = (ay || '').trim();
    return computations.find(
      (c) =>
        (c.client.pan || '').trim().toUpperCase() === normPan &&
        (!normAy || normAy === 'Not Found' || c.assessmentYear === normAy)
    );
  };

  const handleSaveChallan = (saved: TaxChallanRecord) => {
    const targetComp =
      formState.sourceComp || findMatchingComputation(saved.pan, saved.assessmentYear, saved.computationId);

    if (targetComp) {
      const existingList = targetComp.taxesPaid?.challans || [];
      const exists = existingList.some((c) => c.id === saved.id);
      const nextList = exists
        ? existingList.map((c) => (c.id === saved.id ? { ...saved, computationId: targetComp.id } : c))
        : [{ ...saved, computationId: targetComp.id }, ...existingList];

      const updatedComp = recalculateFullComputation({
        ...targetComp,
        taxesPaid: {
          ...targetComp.taxesPaid,
          challans: nextList,
        },
      });
      onUpdateComputation(updatedComp);

      // Remove from standalone if it migrated into a computation
      if (standaloneChallans.some((c) => c.id === saved.id)) {
        onUpdateStandaloneChallans(standaloneChallans.filter((c) => c.id !== saved.id));
      }
    } else {
      const exists = standaloneChallans.some((c) => c.id === saved.id);
      const nextStandalone = exists
        ? standaloneChallans.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...standaloneChallans];
      onUpdateStandaloneChallans(nextStandalone);
    }
  };

  const handleSaveExtracted = (extracted: TaxChallanRecord[]) => {
    const compAdditions = new Map<string, TaxChallanRecord[]>();
    const newStandalone: TaxChallanRecord[] = [];

    extracted.forEach((ch) => {
      const match = findMatchingComputation(ch.pan, ch.assessmentYear);
      const matchIsFiled =
        match &&
        (match.status === 'Filed' || match.status === 'Verified' || match.status === 'Refund Received');

      // Protect Filed ITRs from silent automatic mutation — save to standalone unless user explicitly edits the ITR
      if (match && !matchIsFiled) {
        const list = compAdditions.get(match.id) || [];
        list.push({ ...ch, computationId: match.id });
        compAdditions.set(match.id, list);
      } else {
        newStandalone.push(ch);
      }
    });

    compAdditions.forEach((addedList, compId) => {
      const comp = computations.find((c) => c.id === compId);
      if (!comp) return;
      const updated = recalculateFullComputation({
        ...comp,
        taxesPaid: {
          ...comp.taxesPaid,
          challans: [...addedList, ...(comp.taxesPaid?.challans || [])],
        },
      });
      onUpdateComputation(updated);
    });

    if (newStandalone.length > 0) {
      onUpdateStandaloneChallans([...newStandalone, ...standaloneChallans]);
    }
  };

  const performDelete = (entry: UnifiedChallanEntry) => {
    if (entry.sourceComp) {
      const existingList = entry.sourceComp.taxesPaid?.challans || [];
      const nextList = existingList.filter((c) => c.id !== entry.challan.id);
      const updated = recalculateFullComputation({
        ...entry.sourceComp,
        taxesPaid: {
          ...entry.sourceComp.taxesPaid,
          challans: nextList,
        },
      });
      onUpdateComputation(updated);
    } else {
      onUpdateStandaloneChallans(standaloneChallans.filter((c) => c.id !== entry.challan.id));
    }
    setDeleteConfirmKey(null);
    setFiledWarningAction(null);
  };

  const handleRequestEdit = (entry: UnifiedChallanEntry) => {
    if (entry.isFiledReturn) {
      setFiledWarningAction({ type: 'edit', entry });
      return;
    }
    setFormState({
      isOpen: true,
      mode: 'edit',
      challan: entry.challan,
      sourceComp: entry.sourceComp,
    });
  };

  const handleRequestDelete = (entry: UnifiedChallanEntry) => {
    if (entry.isFiledReturn) {
      setFiledWarningAction({ type: 'delete', entry });
      return;
    }
    setDeleteConfirmKey(entry.challan.id);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPanFilter('');
    setAyFilter('ALL');
    setCategoryFilter('ALL');
    setVerificationFilter('ALL');
    setDateFilter('');
    setAmountFilter('');
  };

  const handleExportPdf = () => {
    const filters: string[] = [];
    if (ayFilter !== 'ALL') filters.push(`AY: ${ayFilter}`);
    if (categoryFilter !== 'ALL') filters.push(`Category: ${categoryFilter}`);
    if (verificationFilter !== 'ALL') filters.push(`Status: ${verificationFilter}`);
    if (panFilter.trim()) filters.push(`PAN: ${panFilter.trim().toUpperCase()}`);
    exportChallanRegisterToPdf(
      filteredEntries.map((e) => e.challan),
      firm,
      filters.length > 0 ? filters.join(' | ') : 'All Records'
    );
  };

  const handleExportExcel = () => {
    exportChallanRegisterToExcel(filteredEntries.map((e) => e.challan));
  };

  const verificationBadge = (status: ChallanVerificationStatus) => {
    if (status === 'Verified') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status === 'Mismatch Flagged' || status === 'Duplicate Flagged') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (status === 'Verification Required') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#10366b] text-white flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Challan Register &amp; Tax Payment Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Centralized AY-wise register for ITNS 280/281/282/283, Form 26AS, Advance Tax, Self Assessment Tax, TDS/TCS &amp; Sec 234F Fees
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsExtractorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-700" />
            <span>Upload / Extract Challan</span>
          </button>

          <button
            type="button"
            onClick={() => setFormState({ isOpen: true, mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#10366b] hover:bg-blue-900 text-white text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manual Challan</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition whitespace-nowrap disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition whitespace-nowrap disabled:opacity-40 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF Register</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Challans Shown</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{kpis.count}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {unifiedEntries.length} total across all AYs
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Total Deposited</div>
          <div className="text-xl font-bold text-[#10366b] tabular-nums mt-0.5">
            {formatINR(kpis.totalDeposited)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Gross challan &amp; credit value</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Eligible Tax Credits</div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">
            {formatINR(kpis.eligibleCredits)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Excludes 234F fee &amp; interest</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] font-medium text-slate-500">234F Late Fee Paid</div>
          <div className="text-xl font-bold text-amber-700 tabular-nums mt-0.5">
            {formatINR(kpis.fee234F)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tracked separately (non-creditable)</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-slate-500">Verification Status</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {kpis.verifiedCount} Verified
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 tabular-nums">
              <AlertTriangle className="w-3.5 h-3.5" />
              {kpis.pendingCount} Pending
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Evidence required for verification</div>
        </div>
      </div>

      {/* Search & Multi-Faceted Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PAN, Assessee Name, Challan Serial No, BSR Code, CIN, Date, or Amount..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              PAN
            </label>
            <input
              type="text"
              value={panFilter}
              onChange={(e) => setPanFilter(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Assessment Year
            </label>
            <select
              value={ayFilter}
              onChange={(e) => setAyFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All AYs</option>
              {availableAYs.map((ay) => (
                <option key={ay} value={ay}>
                  AY {ay}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Challan Type / Payment Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All 11 Categories</option>
              {TAX_PAYMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Tender Date
            </label>
            <input
              type="text"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Exact Amount (₹)
            </label>
            <input
              type="number"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
            <Filter className="w-3 h-3" /> Verification:
          </span>
          {(['ALL', 'Verified', 'Unverified', 'Verification Required', 'Mismatch Flagged', 'Duplicate Flagged'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setVerificationFilter(st)}
                className={`px-2.5 py-1 rounded-md border font-medium transition cursor-pointer ${
                  verificationFilter === st
                    ? 'bg-[#10366b] text-white border-[#10366b]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL' ? 'All Statuses' : st}
              </button>
            )
          )}
        </div>
      </div>

      {/* Filed Return Warning Banner when user tries to modify a locked ITR challan */}
      {filedWarningAction && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Filed Return Protection: {filedWarningAction.entry.sourceComp?.client.name} (AY{' '}
                {filedWarningAction.entry.sourceComp?.assessmentYear}) is marked as &ldquo;
                {filedWarningAction.entry.sourceComp?.status}&rdquo;.
              </p>
              <p className="text-amber-800 mt-0.5">
                Modifying or deleting a challan on a filed ITR will recalculate its settlement summary. Confirm only if you intend to update the filed record or prepare a revised computation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFiledWarningAction(null)}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (filedWarningAction.type === 'edit') {
                  setFormState({
                    isOpen: true,
                    mode: 'edit',
                    challan: filedWarningAction.entry.challan,
                    sourceComp: filedWarningAction.entry.sourceComp,
                  });
                  setFiledWarningAction(null);
                } else {
                  performDelete(filedWarningAction.entry);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
            >
              {filedWarningAction.type === 'edit' ? 'Proceed to Edit' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Challan Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Matching Challan Records Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {unifiedEntries.length === 0
                  ? 'Add a tax payment manually or upload an ITNS 280/281 receipt, Form 26AS, AIS/TIS, or ITR JSON to start tracking challans.'
                  : 'Try clearing or adjusting your PAN, Assessment Year, Challan Type, or Amount filters.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsExtractorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Challan Document
              </button>
              <button
                type="button"
                onClick={() => setFormState({ isOpen: true, mode: 'create' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10366b] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Manual Challan
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#10366b] text-white text-left">
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">PAN &amp; Assessee</th>
                  <th className="px-3 py-2.5 font-semibold">AY / FY</th>
                  <th className="px-3 py-2.5 font-semibold">Payment Category &amp; Form</th>
                  <th className="px-3 py-2.5 font-semibold">BSR / Serial / Date / CIN</th>
                  <th className="px-3 py-2.5 font-semibold">Bank &amp; Mode</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Amount Paid (₹)</th>
                  <th className="px-3 py-2.5 font-semibold">Verification</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.map((entry, idx) => {
                  const { challan, sourceComp, isFiledReturn } = entry;
                  const warnings = auditChallanRecord(challan, allFlatChallans);
                  const isDeleting = deleteConfirmKey === challan.id;

                  return (
                    <tr key={challan.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-2.5 text-slate-500 tabular-nums align-top">{idx + 1}</td>

                      <td className="px-3 py-2.5 align-top">
                        <div className="font-mono font-bold text-slate-900">
                          {normalizeNotFound(challan.pan)}
                        </div>
                        <div className="text-[11px] text-slate-700 font-medium">
                          {normalizeNotFound(challan.assesseeName)}
                        </div>
                        {sourceComp ? (
                          <button
                            type="button"
                            onClick={() => onSelectComputation(sourceComp)}
                            className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
                          >
                            <span>ITR ({sourceComp.status})</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Standalone Record
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="font-semibold text-slate-800">AY {challan.assessmentYear}</div>
                        <div className="text-[10.5px] text-slate-500">FY {challan.financialYear}</div>
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <div className="font-semibold text-[#10366b]">{challan.challanType}</div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5">
                          {challan.challanForm || 'ITNS 280'} &bull; {challan.challanStatus}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-top font-mono text-[11px] space-y-0.5">
                        <div>
                          <span className="text-slate-500 font-sans">BSR:</span>{' '}
                          <span className={isMissingField(challan.bsrCode) ? 'text-rose-600 font-semibold' : 'text-slate-900 font-semibold'}>
                            {normalizeNotFound(challan.bsrCode)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-sans">Serial:</span>{' '}
                          <span className={isMissingField(challan.challanSerialNumber) ? 'text-rose-600 font-semibold' : 'text-slate-900 font-semibold'}>
                            {normalizeNotFound(challan.challanSerialNumber)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-sans">Date:</span>{' '}
                          <span className={isMissingField(challan.challanTenderDate) ? 'text-rose-600' : 'text-slate-800'}>
                            {normalizeNotFound(challan.challanTenderDate)}
                          </span>
                        </div>
                        {!isMissingField(challan.cin) && (
                          <div className="text-[10px] text-slate-600">
                            <span className="font-sans">CIN:</span> {challan.cin}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <div className="text-slate-800 font-medium">{normalizeNotFound(challan.bankName)}</div>
                        <div className="text-[10.5px] text-slate-500">{normalizeNotFound(challan.paymentMode)}</div>
                      </td>

                      <td className="px-3 py-2.5 align-top text-right tabular-nums">
                        <div className="font-bold text-slate-900 text-xs">
                          {formatINR(challan.totalAmountPaid)}
                        </div>
                        <div className="text-[10px] text-slate-500 space-y-0.2 mt-0.5">
                          {challan.taxAmount > 0 && <div>Tax: {formatINR(challan.taxAmount)}</div>}
                          {challan.interest > 0 && <div>Int: {formatINR(challan.interest)}</div>}
                          {challan.lateFilingFee > 0 && (
                            <div className="text-amber-700 font-medium">234F: {formatINR(challan.lateFilingFee)}</div>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${verificationBadge(
                            challan.verificationStatus
                          )}`}
                        >
                          {challan.verificationStatus}
                        </span>
                        {isFiledReturn && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Filed ITR</span>
                          </div>
                        )}
                        {warnings.mismatchReasons.length > 0 && (
                          <div className="text-[10px] text-amber-700 mt-1 max-w-[170px] leading-tight">
                            {warnings.mismatchReasons[0]}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-top text-right">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => performDelete(entry)}
                              className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmKey(null)}
                              className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-medium cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setFormState({
                                  isOpen: true,
                                  mode: 'view',
                                  challan,
                                  sourceComp,
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200 cursor-pointer"
                              title="View Challan & Edit History"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestEdit(entry)}
                              className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 cursor-pointer"
                              title="Edit Challan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDelete(entry)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                              title="Delete Challan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {formState.isOpen && (
        <ChallanFormModal
          isOpen={formState.isOpen}
          mode={formState.mode}
          initialChallan={formState.challan}
          existingChallans={allFlatChallans}
          onClose={() => setFormState({ isOpen: false, mode: 'create' })}
          onSave={handleSaveChallan}
        />
      )}

      {isExtractorOpen && (
        <ChallanExtractionModal
          isOpen={isExtractorOpen}
          onClose={() => setIsExtractorOpen(false)}
          existingChallans={allFlatChallans}
          onSaveChallans={handleSaveExtracted}
        />
      )}
    </div>
  );
};
