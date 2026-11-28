import React, { useState } from 'react';
import {
  X,
  Save,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { TaxChallanRecord, TaxPaymentCategory, ChallanStatus, ChallanVerificationStatus } from '../types';
import {
  TAX_PAYMENT_CATEGORIES,
  PAYMENT_MODES,
  CHALLAN_FORMS,
  computeChallanTotal,
  findDuplicateChallan,
  normalizeNotFound,
  isMissingField,
  getFinancialYearFromAY,
  createAuditEntry,
  diffChallanChanges,
} from '../utils/challanEngine';

interface ChallanFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  initialChallan?: TaxChallanRecord;
  defaultPan?: string;
  defaultName?: string;
  defaultAy?: string;
  defaultFy?: string;
  defaultComputationId?: string;
  existingChallans: TaxChallanRecord[];
  onClose: () => void;
  onSave: (challan: TaxChallanRecord) => void;
}

export const ChallanFormModal: React.FC<ChallanFormModalProps> = ({
  isOpen,
  mode,
  initialChallan,
  defaultPan = '',
  defaultName = '',
  defaultAy = '2026-27',
  defaultFy = '2025-26',
  defaultComputationId,
  existingChallans,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<TaxChallanRecord>(() => {
    if (initialChallan) {
      return { ...initialChallan };
    }
    const now = new Date().toISOString();
    return {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      computationId: defaultComputationId,
      pan: defaultPan ? defaultPan.toUpperCase() : '',
      assesseeName: defaultName ? defaultName.toUpperCase() : '',
      assessmentYear: defaultAy || '2026-27',
      financialYear: defaultFy || getFinancialYearFromAY(defaultAy || '2026-27'),
      challanType: 'Self Assessment Tax – u/s 140A',
      challanForm: 'ITNS 280',
      challanSerialNumber: '',
      bsrCode: '',
      challanTenderDate: '',
      bankName: '',
      cin: '',
      taxAmount: 0,
      surcharge: 0,
      cess: 0,
      interest: 0,
      lateFilingFee: 0,
      otherAmount: 0,
      totalAmountPaid: 0,
      paymentMode: 'Net Banking',
      challanStatus: 'Deposited',
      verificationStatus: 'Unverified',
      evidenceType: '',
      sourceDocumentName: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
      editHistory: [],
    };
  });

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(mode === 'view');

  if (!isOpen) return null;

  const isReadOnly = mode === 'view';

  const updateField = (field: keyof TaxChallanRecord, value: any) => {
    setForm((prev) => {
      const next: TaxChallanRecord = { ...prev, [field]: value };
      if (field === 'assessmentYear' && typeof value === 'string' && value.includes('-')) {
        next.financialYear = getFinancialYearFromAY(value);
      }
      if (
        field === 'taxAmount' ||
        field === 'surcharge' ||
        field === 'cess' ||
        field === 'interest' ||
        field === 'lateFilingFee' ||
        field === 'otherAmount'
      ) {
        next.totalAmountPaid = computeChallanTotal(next);
      }
      return next;
    });
  };

  const handleSave = () => {
    setErrorMsg('');

    const cleaned: TaxChallanRecord = {
      ...form,
      pan: normalizeNotFound(form.pan).toUpperCase(),
      assesseeName: normalizeNotFound(form.assesseeName).toUpperCase(),
      assessmentYear: normalizeNotFound(form.assessmentYear),
      financialYear: normalizeNotFound(form.financialYear),
      challanSerialNumber: normalizeNotFound(form.challanSerialNumber),
      bsrCode: normalizeNotFound(form.bsrCode),
      challanTenderDate: normalizeNotFound(form.challanTenderDate),
      bankName: normalizeNotFound(form.bankName),
      cin: normalizeNotFound(form.cin).toUpperCase(),
      paymentMode: normalizeNotFound(form.paymentMode),
      totalAmountPaid: computeChallanTotal(form) || Math.max(0, Number(form.totalAmountPaid || 0)),
      updatedAt: new Date().toISOString(),
    };

    if (cleaned.totalAmountPaid <= 0) {
      setErrorMsg('Total Amount Paid must be greater than ₹0.');
      return;
    }

    // Rule: Do not mark a payment verified unless supported by reliable evidence
    if (cleaned.verificationStatus === 'Verified') {
      const hasEvidence = !isMissingField(cleaned.evidenceType) || !isMissingField(cleaned.sourceDocumentName) || Boolean(cleaned.isMatchedWith26AS);
      if (!hasEvidence) {
        setErrorMsg('Verification Rule: Cannot mark as Verified without reliable supporting evidence (e.g., ITNS 280 Receipt, Form 26AS match, AIS/TIS, or ITR JSON).');
        return;
      }
      const isTdsOrTcs = cleaned.challanType === 'TDS' || cleaned.challanType === 'TCS';
      if (!isTdsOrTcs && (isMissingField(cleaned.bsrCode) || isMissingField(cleaned.challanSerialNumber) || isMissingField(cleaned.challanTenderDate))) {
        setErrorMsg('Verification Rule: BSR Code, Challan Serial Number, and Tender Date are required before marking a Challan as Verified.');
        return;
      }
    }

    // Duplicate prevention
    const dup = findDuplicateChallan(cleaned, existingChallans, mode === 'edit' ? cleaned.id : undefined);
    if (dup.isDuplicate) {
      setErrorMsg(`Duplicate Challan Blocked: ${dup.reason}`);
      return;
    }

    // Audit History
    if (mode === 'create') {
      cleaned.editHistory = [
        createAuditEntry('Created', `Added ${cleaned.challanType} challan of ₹${cleaned.totalAmountPaid.toLocaleString('en-IN')}`),
      ];
    } else if (mode === 'edit' && initialChallan) {
      const changes = diffChallanChanges(initialChallan, cleaned);
      cleaned.editHistory = [
        ...(initialChallan.editHistory || []),
        createAuditEntry(
          'Updated',
          changes.length > 0 ? `Updated ${changes.length} field(s)` : 'Saved challan record',
          changes
        ),
      ];
    }

    onSave(cleaned);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#10366b] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">
              {mode === 'create'
                ? 'Add Tax Payment / Challan Record'
                : mode === 'edit'
                ? 'Edit Challan Details (With Audit Trail)'
                : 'Complete Challan Record & Audit History'}
            </h3>
            <p className="text-[11px] text-blue-100">
              All 20 statutory challan fields · Missing values are marked "Not Found" (never fabricated)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode !== 'create' && (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({form.editHistory?.length || 0})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 text-blue-100 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Assessee & Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">PAN</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.pan}
                onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                placeholder="e.g. HSIPK5617N"
                className="w-full p-2 rounded-lg border border-slate-300 font-mono uppercase disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assessee Name</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.assesseeName}
                onChange={(e) => updateField('assesseeName', e.target.value.toUpperCase())}
                placeholder="Assessee Full Name"
                className="w-full p-2 rounded-lg border border-slate-300 uppercase disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Category (11 Statutory Types)</label>
              <select
                disabled={isReadOnly}
                value={form.challanType}
                onChange={(e) => updateField('challanType', e.target.value as TaxPaymentCategory)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold disabled:bg-slate-50"
              >
                {TAX_PAYMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assessment Year</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.assessmentYear}
                onChange={(e) => updateField('assessmentYear', e.target.value)}
                placeholder="2026-27"
                className="w-full p-2 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Financial Year</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.financialYear}
                onChange={(e) => updateField('financialYear', e.target.value)}
                placeholder="2025-26"
                className="w-full p-2 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Challan Type / Form</label>
              <select
                disabled={isReadOnly}
                value={form.challanForm || 'ITNS 280'}
                onChange={(e) => updateField('challanForm', e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
              >
                {CHALLAN_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Official Challan Identifiers */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">BSR Code (7-digit)</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.bsrCode}
                onChange={(e) => updateField('bsrCode', e.target.value)}
                placeholder="7-digit BSR or Not Found"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Challan Number / Serial Number</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.challanSerialNumber}
                onChange={(e) => updateField('challanSerialNumber', e.target.value)}
                placeholder="Serial No or Not Found"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Challan Tender Date</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.challanTenderDate}
                onChange={(e) => updateField('challanTenderDate', e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.bankName}
                onChange={(e) => updateField('bankName', e.target.value)}
                placeholder="Bank Name or Not Found"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">CIN (Challan Identification Number)</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.cin}
                onChange={(e) => updateField('cin', e.target.value.toUpperCase())}
                placeholder="CIN or Not Found"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono uppercase disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                disabled={isReadOnly}
                value={PAYMENT_MODES.includes(form.paymentMode) ? form.paymentMode : 'Not Found'}
                onChange={(e) => updateField('paymentMode', e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Amount Breakdown */}
          <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
            <div className="font-bold text-[#10366b] text-xs uppercase tracking-wider">
              Amount Breakdown (Auto-Calculated Total)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tax Amount (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.taxAmount || ''}
                  onChange={(e) => updateField('taxAmount', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Surcharge (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.surcharge || ''}
                  onChange={(e) => updateField('surcharge', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cess (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.cess || ''}
                  onChange={(e) => updateField('cess', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Interest (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.interest || ''}
                  onChange={(e) => updateField('interest', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-amber-800 mb-1">Late Fee 234F (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.lateFilingFee || ''}
                  onChange={(e) => updateField('lateFilingFee', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-amber-300 bg-amber-50/40 font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Other Amt (₹)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={form.otherAmount || ''}
                  onChange={(e) => updateField('otherAmount', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono text-right disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#10366b] mb-1">Total Paid (₹)</label>
                <input
                  type="number"
                  readOnly
                  value={form.totalAmountPaid}
                  className="w-full p-2 rounded-lg border border-blue-400 bg-blue-100/70 font-mono font-bold text-right text-[#10366b]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Status, Verification & Evidence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Challan Status</label>
              <select
                disabled={isReadOnly}
                value={form.challanStatus}
                onChange={(e) => updateField('challanStatus', e.target.value as ChallanStatus)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
              >
                <option value="Deposited">Deposited</option>
                <option value="Paid">Paid</option>
                <option value="Matched with 26AS">Matched with 26AS</option>
                <option value="Pending">Pending</option>
                <option value="Mismatch">Mismatch</option>
                <option value="Reversed">Reversed</option>
                <option value="Unverified">Unverified</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Verification Status</label>
              <select
                disabled={isReadOnly}
                value={form.verificationStatus}
                onChange={(e) => updateField('verificationStatus', e.target.value as ChallanVerificationStatus)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold disabled:bg-slate-50"
              >
                <option value="Unverified">Unverified</option>
                <option value="Verification Required">Verification Required</option>
                <option value="Verified">Verified (Requires Evidence)</option>
                <option value="Mismatch Flagged">Mismatch Flagged</option>
                <option value="Duplicate Flagged">Duplicate Flagged</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supporting Evidence</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.evidenceType || ''}
                onChange={(e) => updateField('evidenceType', e.target.value)}
                placeholder="e.g. ITNS 280 Receipt / Form 26AS / AIS"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Optional audit remarks or reconciliation notes"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Audit / Edit History */}
          {showHistory && form.editHistory && form.editHistory.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#10366b]" />
                <span>Challan Audit &amp; Edit History</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {form.editHistory.map((h) => (
                  <div key={h.id} className="bg-white border border-slate-200 rounded-lg p-2.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-bold text-slate-800">{h.action}</span>
                      <span className="font-mono">{new Date(h.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-slate-700">{h.summary}</div>
                    {h.changes && h.changes.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 text-[10px] font-mono text-slate-600">
                        {h.changes.map((c, idx) => (
                          <div key={idx}>
                            {c.field}: "{c.oldValue}" → "{c.newValue}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
          >
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#10366b] hover:bg-blue-900 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Challan Record</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
