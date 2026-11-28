import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Receipt,
  Scale,
  RefreshCw,
  FileCheck2,
  Lock,
  Info,
} from 'lucide-react';
import { TaxComputation, TaxChallanRecord, TaxPaymentCategory } from '../types';
import {
  TAX_PAYMENT_CATEGORIES,
  computeTaxPaymentSettlement,
  auditChallanRecord,
  getOriginalDueDateForAY,
  createAuditEntry,
} from '../utils/challanEngine';
import { recalculateFullComputation } from '../utils/taxCalculator';
import { formatINR } from '../utils/pdfGenerator';
import { ChallanExtractionModal } from './ChallanExtractionModal';
import { ChallanFormModal } from './ChallanFormModal';

interface TaxPaymentsChallanSectionProps {
  computation: TaxComputation;
  onUpdateComputation: (updated: TaxComputation) => void;
}

export const TaxPaymentsChallanSection: React.FC<TaxPaymentsChallanSectionProps> = ({
  computation,
  onUpdateComputation,
}) => {
  const [isExtractorOpen, setIsExtractorOpen] = useState(false);
  const [formModalState, setFormModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'view';
    challan?: TaxChallanRecord;
  }>({ isOpen: false, mode: 'create' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showReconcilePanel, setShowReconcilePanel] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [filedUnlockConfirmed, setFiledUnlockConfirmed] = useState(false);

  const challans = computation.taxesPaid?.challans || [];
  const isFiledReturn =
    computation.status === 'Filed' ||
    computation.status === 'Verified' ||
    computation.status === 'Refund Received';

  const canModify = !isFiledReturn || filedUnlockConfirmed;

  const settlement =
    computation.finalSettlement || computeTaxPaymentSettlement(computation, challans).finalSettlement;
  const fee234F =
    computation.lateFilingFeeDetails ||
    computeTaxPaymentSettlement(computation, challans).lateFilingFeeDetails;

  const commitChallans = (nextChallans: TaxChallanRecord[]) => {
    const updated = recalculateFullComputation({
      ...computation,
      taxesPaid: {
        ...computation.taxesPaid,
        challans: nextChallans,
      },
    });
    onUpdateComputation(updated);
  };

  const handleSaveChallan = (saved: TaxChallanRecord) => {
    const exists = challans.some((c) => c.id === saved.id);
    const next = exists
      ? challans.map((c) => (c.id === saved.id ? saved : c))
      : [{ ...saved, computationId: computation.id }, ...challans];
    commitChallans(next);
  };

  const handleSaveExtracted = (extracted: TaxChallanRecord[]) => {
    const enriched = extracted.map((c) => ({
      ...c,
      computationId: computation.id,
      pan: c.pan === 'Not Found' && computation.client.pan ? computation.client.pan.toUpperCase() : c.pan,
      assesseeName:
        c.assesseeName === 'Not Found' && computation.client.name
          ? computation.client.name.toUpperCase()
          : c.assesseeName,
    }));
    commitChallans([...enriched, ...challans]);
  };

  const handleDeleteChallan = (id: string) => {
    const next = challans.filter((c) => c.id !== id);
    commitChallans(next);
    setDeleteConfirmId(null);
  };

  const handleVerifyWithEvidence = (challan: TaxChallanRecord) => {
    if (!challan.evidenceType && !challan.sourceDocumentName && !challan.isMatchedWith26AS) {
      setFormModalState({ isOpen: true, mode: 'edit', challan });
      return;
    }
    const next = challans.map((c) =>
      c.id === challan.id
        ? {
            ...c,
            verificationStatus: 'Verified' as const,
            challanStatus: c.isMatchedWith26AS ? ('Matched with 26AS' as const) : ('Deposited' as const),
            updatedAt: new Date().toISOString(),
            editHistory: [
              ...(c.editHistory || []),
              createAuditEntry('Verified', `Verified against ${c.evidenceType || c.sourceDocumentName || '26AS'}`),
            ],
          }
        : c
    );
    commitChallans(next);
  };

  const handleUpdateInterestOrFee = (field: 'interest234A' | 'interest234B' | 'interest234C' | 'otherLiabilities', val: number) => {
    const updated = recalculateFullComputation({
      ...computation,
      [field]: Math.max(0, val),
    });
    onUpdateComputation(updated);
  };

  const handleToggleAuditCase234F = (isAudit: boolean) => {
    const ay = computation.assessmentYear || '2026-27';
    const updated = recalculateFullComputation({
      ...computation,
      lateFilingFeeDetails: {
        ...fee234F,
        isAuditCase: isAudit,
        originalDueDate: getOriginalDueDateForAY(ay, isAudit),
      },
    });
    onUpdateComputation(updated);
  };

  const handleUpdate234FOverride = (rawVal: string) => {
    const override = rawVal.trim() === '' ? undefined : Math.max(0, Number(rawVal) || 0);
    const updated = recalculateFullComputation({
      ...computation,
      lateFilingFeeDetails: {
        ...fee234F,
        manualFeeOverride: override,
      },
    });
    onUpdateComputation(updated);
  };

  const handleUpdate26AS = (field: 'tdsAsPer26AS' | 'tcsAsPer26AS' | 'advanceTaxAsPer26AS' | 'satAsPer26AS', val: string) => {
    const num = val.trim() === '' ? undefined : Math.max(0, Number(val) || 0);
    const updated = recalculateFullComputation({
      ...computation,
      reconciliation26AS: {
        ...computation.reconciliation26AS,
        [field]: num,
        lastReconciledAt: new Date().toISOString(),
      },
    });
    onUpdateComputation(updated);
  };

  // Compute category-wise totals across all 11 categories strictly separated
  const categoryTotals: Record<TaxPaymentCategory, { count: number; amount: number }> = {
    'Self Assessment Tax – u/s 140A': { count: 0, amount: 0 },
    'Advance Tax': { count: 0, amount: 0 },
    'Regular Assessment Tax – u/s 156': { count: 0, amount: 0 },
    'Tax on Regular Assessment': { count: 0, amount: 0 },
    'Late Filing Fee – u/s 234F': { count: 0, amount: 0 },
    'Interest u/s 234A': { count: 0, amount: 0 },
    'Interest u/s 234B': { count: 0, amount: 0 },
    'Interest u/s 234C': { count: 0, amount: 0 },
    TDS: { count: 0, amount: 0 },
    TCS: { count: 0, amount: 0 },
    'Other applicable tax payments': { count: 0, amount: 0 },
  };

  challans.forEach((c) => {
    if (categoryTotals[c.challanType]) {
      categoryTotals[c.challanType].count += 1;
      categoryTotals[c.challanType].amount += Number(c.totalAmountPaid || 0);
    }
  });

  const statusBadgeClass =
    settlement.settlementStatus === 'REFUND DUE'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : settlement.settlementStatus === 'ADDITIONAL TAX PAYABLE'
      ? 'bg-rose-50 text-rose-800 border-rose-300'
      : settlement.settlementStatus === 'PAYMENT VERIFICATION REQUIRED'
      ? 'bg-amber-50 text-amber-800 border-amber-300'
      : 'bg-slate-100 text-slate-800 border-slate-300';

  return (
    <div className="space-y-4">
      {/* Filed ITR Protection Notice */}
      {isFiledReturn && !filedUnlockConfirmed && (
        <div className="no-print bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <Lock className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              <strong>Filed ITR Protection Active:</strong> This ITR is marked as <strong>{computation.status}</strong>. Payment records cannot be altered automatically.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiledUnlockConfirmed(true)}
            className="px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs whitespace-nowrap cursor-pointer"
          >
            Unlock for Manual Correction
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. TAX PAYMENTS & CHALLAN DETAILS                                   */}
      {/* =================================================================== */}
      <div className="space-y-1.5">
        <div className="bg-[#f0f4ff] px-3 py-1.5 rounded-t border border-[#cbd5e1] border-b-0 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART F: TAX PAYMENTS &amp; CHALLAN DETAILS ({challans.length} Challan{challans.length === 1 ? '' : 's'} Recorded)
            </h2>
          </div>
          <div className="no-print flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!canModify}
              onClick={() => setIsExtractorOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-[10.5px] whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Upload &amp; Extract Challan (OCR / 26AS / JSON)</span>
            </button>
            <button
              type="button"
              disabled={!canModify}
              onClick={() => setFormModalState({ isOpen: true, mode: 'create' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#10366b] hover:bg-blue-900 disabled:opacity-50 text-white font-bold text-[10.5px] whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Challan</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReconcilePanel((s) => !s)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-[#10366b] border border-blue-300 font-bold text-[10.5px] whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>26AS Reconcile</span>
            </button>
          </div>
        </div>

        {/* Optional 26AS Reconciliation Panel */}
        {showReconcilePanel && (
          <div className="no-print border border-[#cbd5e1] bg-slate-50 p-3 space-y-2 text-[11px]">
            <div className="font-bold text-[#10366b] flex items-center justify-between">
              <span>Form 26AS / Official ITR Reconciliation Check</span>
              <span className="text-[10px] font-normal text-slate-500">Enter Form 26AS totals to detect mismatches</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">TDS as per 26AS (₹)</label>
                <input
                  type="number"
                  value={computation.reconciliation26AS?.tdsAsPer26AS ?? ''}
                  onChange={(e) => handleUpdate26AS('tdsAsPer26AS', e.target.value)}
                  placeholder="Optional"
                  className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">TCS as per 26AS (₹)</label>
                <input
                  type="number"
                  value={computation.reconciliation26AS?.tcsAsPer26AS ?? ''}
                  onChange={(e) => handleUpdate26AS('tcsAsPer26AS', e.target.value)}
                  placeholder="Optional"
                  className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Advance Tax in 26AS (₹)</label>
                <input
                  type="number"
                  value={computation.reconciliation26AS?.advanceTaxAsPer26AS ?? ''}
                  onChange={(e) => handleUpdate26AS('advanceTaxAsPer26AS', e.target.value)}
                  placeholder="Optional"
                  className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Self Assessment Tax in 26AS (₹)</label>
                <input
                  type="number"
                  value={computation.reconciliation26AS?.satAsPer26AS ?? ''}
                  onChange={(e) => handleUpdate26AS('satAsPer26AS', e.target.value)}
                  placeholder="Optional"
                  className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
                />
              </div>
            </div>
            {settlement.reconciliationWarnings.length > 0 && (
              <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 space-y-0.5">
                {settlement.reconciliationWarnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 11 Separate Categories Overview */}
        <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
          <div className="bg-slate-50 px-2.5 py-1.5 border-b border-[#cbd5e1] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[10px]">
            {TAX_PAYMENT_CATEGORIES.map((cat) => {
              const info = categoryTotals[cat];
              const fallbackAmt =
                cat === 'TDS' && info.count === 0
                  ? settlement.totalTDS
                  : cat === 'TCS' && info.count === 0
                  ? settlement.totalTCS
                  : cat === 'Advance Tax' && info.count === 0
                  ? settlement.totalAdvanceTax
                  : cat === 'Self Assessment Tax – u/s 140A' && info.count === 0
                  ? settlement.totalSelfAssessmentTax
                  : info.amount;

              return (
                <div key={cat} className="bg-white border border-slate-200 rounded px-2 py-1">
                  <div className="text-[9.5px] font-semibold text-slate-600 truncate" title={cat}>
                    {cat}
                  </div>
                  <div className="font-mono font-bold text-[#10366b] tabular-nums">
                    {formatINR(fallbackAmt)}
                    {info.count > 0 && (
                      <span className="text-[9px] text-slate-500 font-normal ml-1">({info.count})</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Complete Challan Table */}
          {challans.length === 0 ? (
            <div className="p-4 text-center bg-white text-slate-500 text-[10.5px]">
              No challan receipts recorded yet for PAN <strong>{computation.client.pan || 'N/A'}</strong> (AY{' '}
              <strong>{computation.assessmentYear}</strong>). Use <strong>Upload &amp; Extract Challan</strong> or{' '}
              <strong>Add Challan</strong> to attach ITNS 280/281/282/283 or 26AS payment records.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[#10366b] text-white">
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">#</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">Payment Category</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">BSR Code</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">Challan Serial No</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">Tender Date</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">Bank / CIN</th>
                    <th className="px-2 py-1.5 text-right font-bold border-r border-blue-900/40">Tax+SC+Cess</th>
                    <th className="px-2 py-1.5 text-right font-bold border-r border-blue-900/40">Int / 234F Fee</th>
                    <th className="px-2 py-1.5 text-right font-bold border-r border-blue-900/40">Total Paid (₹)</th>
                    <th className="px-2 py-1.5 text-left font-bold border-r border-blue-900/40">Verification</th>
                    <th className="no-print px-2 py-1.5 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.map((ch, idx) => {
                    const audit = auditChallanRecord(ch, challans, computation);
                    const taxPart = (ch.taxAmount || 0) + (ch.surcharge || 0) + (ch.cess || 0) + (ch.otherAmount || 0);
                    return (
                      <tr
                        key={ch.id}
                        className={`border-b border-[#cbd5e1] ${idx % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}`}
                      >
                        <td className="px-2 py-1.5 font-mono text-slate-600 border-r border-[#cbd5e1]">{idx + 1}</td>
                        <td className="px-2 py-1.5 border-r border-[#cbd5e1]">
                          <div className="font-bold text-slate-900">{ch.challanType}</div>
                          <div className="text-[9px] text-slate-500">
                            {ch.challanForm || 'ITNS 280'} · {ch.paymentMode || 'Not Found'}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 font-mono font-semibold text-slate-900 border-r border-[#cbd5e1]">
                          {ch.bsrCode || 'Not Found'}
                        </td>
                        <td className="px-2 py-1.5 font-mono font-semibold text-slate-900 border-r border-[#cbd5e1]">
                          {ch.challanSerialNumber || 'Not Found'}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-800 border-r border-[#cbd5e1]">
                          {ch.challanTenderDate || 'Not Found'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-[#cbd5e1]">
                          <div className="text-slate-900 font-medium">{ch.bankName || 'Not Found'}</div>
                          <div className="text-[9px] font-mono text-slate-500">CIN: {ch.cin || 'Not Found'}</div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums border-r border-[#cbd5e1]">
                          {Number(taxPart).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums border-r border-[#cbd5e1]">
                          <div>Int: {Number(ch.interest || 0).toLocaleString('en-IN')}</div>
                          {Number(ch.lateFilingFee || 0) > 0 && (
                            <div className="text-amber-800 font-semibold">234F: {Number(ch.lateFilingFee).toLocaleString('en-IN')}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-[#10366b] border-r border-[#cbd5e1]">
                          {Number(ch.totalAmountPaid).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2 py-1.5 border-r border-[#cbd5e1]">
                          <div
                            className={`font-bold text-[9.5px] ${
                              ch.verificationStatus === 'Verified'
                                ? 'text-emerald-700'
                                : ch.verificationStatus === 'Duplicate Flagged' || ch.verificationStatus === 'Mismatch Flagged'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {ch.verificationStatus}
                          </div>
                          {audit.mismatchReasons.length > 0 && (
                            <div className="text-[8.5px] text-rose-700 leading-tight mt-0.5">
                              {audit.mismatchReasons[0]}
                            </div>
                          )}
                        </td>
                        <td className="no-print px-2 py-1.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setFormModalState({ isOpen: true, mode: 'view', challan: ch })}
                              className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="View Complete Challan & History"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canModify && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormModalState({ isOpen: true, mode: 'edit', challan: ch })}
                                  className="p-1 rounded hover:bg-blue-50 text-blue-700 cursor-pointer"
                                  title="Edit Challan"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {ch.verificationStatus !== 'Verified' && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyWithEvidence(ch)}
                                    className="p-1 rounded hover:bg-emerald-50 text-emerald-700 cursor-pointer"
                                    title="Mark Verified (Requires Evidence)"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {deleteConfirmId === ch.id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChallan(ch.id)}
                                    className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(ch.id)}
                                    className="p-1 rounded hover:bg-rose-50 text-rose-600 cursor-pointer"
                                    title="Delete Challan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. DEDICATED LATE FILING FEE – SECTION 234F                         */}
      {/* =================================================================== */}
      <div className="space-y-1">
        <div className="bg-[#f0f4ff] px-3 py-1.5 rounded-t border border-[#cbd5e1] border-b-0 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
            PART G: LATE FILING FEE – SECTION 234F &amp; INTEREST (234A / 234B / 234C)
          </h2>
          <div className="no-print flex items-center gap-3 text-[10px]">
            <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700 font-semibold">
              <input
                type="checkbox"
                checked={Boolean(fee234F.isAuditCase)}
                onChange={(e) => handleToggleAuditCase234F(e.target.checked)}
                className="accent-[#10366b]"
              />
              <span>Tax Audit Case (Due Date 31 Oct)</span>
            </label>
          </div>
        </div>

        <div className="border border-[#cbd5e1] rounded-b overflow-hidden bg-white">
          <table className="w-full border-collapse text-[10.5px]">
            <tbody>
              <tr className="border-b border-[#cbd5e1]">
                <td className="w-1/4 px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Assessment Year:</td>
                <td className="w-1/4 px-2.5 py-1 font-mono font-semibold border-r border-[#cbd5e1]">{fee234F.assessmentYear}</td>
                <td className="w-1/4 px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Original Due Date:</td>
                <td className="w-1/4 px-2.5 py-1 font-mono">{fee234F.originalDueDate}</td>
              </tr>
              <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Actual Filing Date:</td>
                <td className="px-2.5 py-1 font-mono border-r border-[#cbd5e1]">{fee234F.actualFilingDate || 'Not Found'}</td>
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Filing Section:</td>
                <td className="px-2.5 py-1">{fee234F.filingSection}</td>
              </tr>
              <tr className="border-b border-[#cbd5e1]">
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Taxable Income:</td>
                <td className="px-2.5 py-1 font-mono font-bold tabular-nums border-r border-[#cbd5e1]">{formatINR(fee234F.taxableIncome)}</td>
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Applicable Fee u/s 234F:</td>
                <td className="px-2.5 py-1 font-mono font-bold text-rose-700 tabular-nums">
                  {formatINR(fee234F.applicableFee)}
                  <span className="no-print ml-2">
                    <input
                      type="number"
                      placeholder="Override"
                      value={fee234F.manualFeeOverride ?? ''}
                      onChange={(e) => handleUpdate234FOverride(e.target.value)}
                      className="w-20 px-1.5 py-0.5 text-[10px] border border-slate-300 rounded font-mono text-slate-800"
                      title="Optional manual override for 234F Fee"
                    />
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Amount Actually Paid (234F):</td>
                <td className="px-2.5 py-1 font-mono font-bold text-emerald-800 tabular-nums border-r border-[#cbd5e1]">
                  {formatINR(fee234F.amountActuallyPaid)}
                </td>
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">234F Payment Verification:</td>
                <td className="px-2.5 py-1 font-bold">
                  <span
                    className={
                      fee234F.paymentVerificationStatus === 'Verified'
                        ? 'text-emerald-700'
                        : fee234F.paymentVerificationStatus === 'Unpaid'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }
                  >
                    {fee234F.paymentVerificationStatus}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#cbd5e1]">
                <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">234F Challan BSR / Serial / Date:</td>
                <td colSpan={3} className="px-2.5 py-1 font-mono text-slate-800">
                  BSR: <strong>{fee234F.linkedChallanBsrCode}</strong> · Serial: <strong>{fee234F.linkedChallanSerialNumber}</strong> · Date:{' '}
                  <strong>{fee234F.linkedChallanDate}</strong>
                </td>
              </tr>
              <tr className="bg-amber-50/50">
                <td colSpan={4} className="px-2.5 py-1.5 text-[10px] text-slate-700">
                  <strong>Provision:</strong> {fee234F.ruleExplanation}{' '}
                  <span className="text-amber-900 font-semibold">
                    (Late Filing Fee u/s 234F is tracked separately from TDS/TCS/Advance/SAT and is NEVER treated as refundable tax credit.)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Interest u/s 234A/234B/234C & Other Liabilities inputs */}
          <div className="no-print p-2.5 bg-slate-50 border-t border-[#cbd5e1] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[10.5px]">
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Interest u/s 234A (₹)</label>
              <input
                type="number"
                value={computation.interest234A || ''}
                onChange={(e) => handleUpdateInterestOrFee('interest234A', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Interest u/s 234B (₹)</label>
              <input
                type="number"
                value={computation.interest234B || ''}
                onChange={(e) => handleUpdateInterestOrFee('interest234B', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Interest u/s 234C (₹)</label>
              <input
                type="number"
                value={computation.interest234C || ''}
                onChange={(e) => handleUpdateInterestOrFee('interest234C', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Other Liabilities (₹)</label>
              <input
                type="number"
                value={computation.otherLiabilities || ''}
                onChange={(e) => handleUpdateInterestOrFee('otherLiabilities', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. AUTOMATIC TAX COMPUTATION & PROFESSIONAL FINAL SUMMARY (A/B/C/D) */}
      {/* =================================================================== */}
      <div className="space-y-1">
        <div className="bg-[#f0f4ff] px-3 py-1.5 rounded-t border border-[#cbd5e1] border-b-0 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
            PART H: FINAL TAX SETTLEMENT &amp; PROFESSIONAL SUMMARY (A · B · C · D)
          </h2>
          <span className={`px-2.5 py-0.5 rounded border font-black text-[10px] uppercase ${statusBadgeClass}`}>
            {settlement.settlementStatus}
          </span>
        </div>

        <div className="border border-[#cbd5e1] rounded-b overflow-hidden bg-white">
          {/* Verification / Reconciliation Alert Box */}
          {(settlement.verificationIssues.length > 0 || settlement.reconciliationWarnings.length > 0) && (
            <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-[10px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Payment Verification / Reconciliation Flags ({settlement.verificationIssues.length + settlement.reconciliationWarnings.length}):</span>
              </div>
              {settlement.verificationIssues.map((msg, i) => (
                <div key={`v_${i}`} className="pl-5">• {msg}</div>
              ))}
              {settlement.reconciliationWarnings.map((msg, i) => (
                <div key={`r_${i}`} className="pl-5 text-rose-800 font-semibold">• {msg}</div>
              ))}
            </div>
          )}

          {/* 4-Part A/B/C/D Structured Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-[#cbd5e1]">
            {/* A & B: Liability */}
            <div className="border-b md:border-b-0 md:border-r border-[#cbd5e1]">
              <div className="bg-[#10366b] text-white px-2.5 py-1 font-bold text-[10px] uppercase">
                A. Income Tax Calculation &amp; B. Interest / Fees
              </div>
              <table className="w-full text-[10.5px] border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Total Income (GTI)</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalIncome)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-slate-700">Taxable Income (u/s 288A)</td>
                    <td className="px-2.5 py-1 text-right font-mono font-bold tabular-nums">{formatINR(settlement.taxableIncome)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Income Tax Before Rebate</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.incomeTaxBeforeRebate)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-emerald-800">Less: Rebate u/s 87A</td>
                    <td className="px-2.5 py-1 text-right font-mono text-emerald-800 tabular-nums">-{formatINR(settlement.rebate87A)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Tax After Rebate</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.taxAfterRebate)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-slate-700">Surcharge + 4% Health &amp; Education Cess</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.surcharge + settlement.healthAndEducationCess)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 font-bold bg-[#f0f4ff]">
                    <td className="px-2.5 py-1 text-[#10366b]">Total Tax Liability (A)</td>
                    <td className="px-2.5 py-1 text-right font-mono text-[#10366b] tabular-nums">{formatINR(settlement.totalTaxLiability)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Interest u/s 234A + 234B + 234C</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">
                      {formatINR(settlement.interest234A + settlement.interest234B + settlement.interest234C)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-rose-800 font-semibold">Late Filing Fee u/s 234F + Other Liabilities</td>
                    <td className="px-2.5 py-1 text-right font-mono text-rose-800 font-semibold tabular-nums">
                      {formatINR(settlement.fee234F + settlement.otherLiabilities)}
                    </td>
                  </tr>
                  <tr className="font-bold bg-[#e6f0fa]">
                    <td className="px-2.5 py-1 text-[#10366b]">Total Gross Obligation (A + B)</td>
                    <td className="px-2.5 py-1 text-right font-mono text-[#10366b] tabular-nums">{formatINR(settlement.totalGrossDemand)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* C & D: Credits & Final Settlement */}
            <div>
              <div className="bg-[#10366b] text-white px-2.5 py-1 font-bold text-[10px] uppercase">
                C. Taxes Already Paid &amp; D. Final Settlement
              </div>
              <table className="w-full text-[10.5px] border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Total TDS (Salary + Non-Salary)</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalTDS)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-slate-700">Total TCS</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalTCS)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Total Advance Tax</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalAdvanceTax)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-slate-700">Total Self Assessment Tax (u/s 140A)</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalSelfAssessmentTax)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-slate-700">Regular Assessment Tax (u/s 156) &amp; Other Credits</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">
                      {formatINR(settlement.totalRegularAssessmentTax + settlement.totalOtherEligibleCredits)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 font-bold bg-[#f0f4ff]">
                    <td className="px-2.5 py-1 text-[#10366b]">Total Eligible Tax Credits (C)</td>
                    <td className="px-2.5 py-1 text-right font-mono text-[#10366b] tabular-nums">{formatINR(settlement.totalEligibleTaxCredits)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-2.5 py-1 text-amber-900">Late Filing Fee Paid (234F) [Non-Creditable]</td>
                    <td className="px-2.5 py-1 text-right font-mono text-amber-900 tabular-nums">{formatINR(settlement.totalLateFilingFeePaid)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <td className="px-2.5 py-1 text-slate-700">Total Interest Paid via Challans</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalInterestPaid)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 font-semibold">
                    <td className="px-2.5 py-1 text-slate-800">Total All Payments Deposited</td>
                    <td className="px-2.5 py-1 text-right font-mono tabular-nums">{formatINR(settlement.totalAllPaymentsDeposited)}</td>
                  </tr>
                  <tr className="font-black bg-[#e6f0fa]">
                    <td className="px-2.5 py-1.5 text-[#10366b]">
                      {settlement.totalRefundDue > 0
                        ? 'TOTAL REFUND DUE (D)'
                        : settlement.additionalAmountPayable > 0
                        ? 'ADDITIONAL AMOUNT PAYABLE (D)'
                        : 'NET SETTLEMENT BALANCE (D)'}
                    </td>
                    <td
                      className={`px-2.5 py-1.5 text-right font-mono text-[11.5px] tabular-nums ${
                        settlement.totalRefundDue > 0
                          ? 'text-emerald-700'
                          : settlement.additionalAmountPayable > 0
                          ? 'text-rose-700'
                          : 'text-[#10366b]'
                      }`}
                    >
                      {formatINR(
                        settlement.totalRefundDue > 0
                          ? settlement.totalRefundDue
                          : settlement.additionalAmountPayable
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transparent Calculation Breakdown */}
          <div className="bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[10px] text-[#10366b] uppercase tracking-wider">
                Transparent Calculation Audit Trail
              </span>
              <button
                type="button"
                onClick={() => setShowBreakdown((b) => !b)}
                className="no-print text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                {showBreakdown ? 'Hide Steps' : 'Show Steps'}
              </button>
            </div>
            {showBreakdown && (
              <div className="space-y-1 text-[10px]">
                {settlement.breakdownSteps.map((step, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white px-2.5 py-1 rounded border border-slate-200"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{step.label}</span>
                      <span className="text-slate-500 ml-2">({step.formula})</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {step.amount < 0 ? `-${formatINR(Math.abs(step.amount))}` : formatINR(step.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isExtractorOpen && (
        <ChallanExtractionModal
          isOpen={isExtractorOpen}
          onClose={() => setIsExtractorOpen(false)}
          defaultPan={computation.client.pan}
          defaultName={computation.client.name}
          defaultAy={computation.assessmentYear}
          defaultFy={computation.financialYear}
          existingChallans={challans}
          onSaveChallans={handleSaveExtracted}
        />
      )}

      {formModalState.isOpen && (
        <ChallanFormModal
          isOpen={formModalState.isOpen}
          mode={formModalState.mode}
          initialChallan={formModalState.challan}
          defaultPan={computation.client.pan}
          defaultName={computation.client.name}
          defaultAy={computation.assessmentYear}
          defaultFy={computation.financialYear}
          defaultComputationId={computation.id}
          existingChallans={challans}
          onClose={() => setFormModalState({ isOpen: false, mode: 'create' })}
          onSave={handleSaveChallan}
        />
      )}
    </div>
  );
};
