import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  ArrowRight, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  Unlock, 
  HelpCircle, 
  AlertCircle,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { TaxComputation, ITRFormType, ITREligibilityResult } from '../types';
import { checkITREligibility } from '../utils/itrEligibilityEngine';
import { recalculateFullComputation } from '../utils/taxCalculator';

interface ITREligibilityBannerProps {
  computation: TaxComputation;
  onUpdateComputation: (updated: TaxComputation) => void;
  onOpenEditModal?: () => void;
}

export const ITREligibilityBanner: React.FC<ITREligibilityBannerProps> = ({
  computation,
  onUpdateComputation,
  onOpenEditModal,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState(computation.userOverrideReason || '');

  // Calculate live eligibility result if not pre-computed
  const result: ITREligibilityResult = computation.eligibilityResult || checkITREligibility(computation);

  const isGreen = result.status === 'GREEN';
  const isYellow = result.status === 'YELLOW';
  const isRed = result.status === 'RED';

  const hasOverride = Boolean(computation.userOverrideITR || result.userOverride?.overridden);

  // One-click switch to recommended form
  const handleSwitchToRecommended = () => {
    const updated = recalculateFullComputation({
      ...computation,
      itrForm: result.recommendedITR,
      userOverrideITR: false,
      userOverrideReason: undefined,
    });
    onUpdateComputation(updated);
  };

  // Submit override
  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;

    const updated = recalculateFullComputation({
      ...computation,
      userOverrideITR: true,
      userOverrideReason: overrideReason.trim(),
    });
    onUpdateComputation(updated);
    setShowOverrideModal(false);
  };

  const handleClearOverride = () => {
    const updated = recalculateFullComputation({
      ...computation,
      userOverrideITR: false,
      userOverrideReason: undefined,
    });
    onUpdateComputation(updated);
  };

  return (
    <div className="space-y-2.5">
      {/* MAIN BANNER CONTAINER */}
      <div 
        className={`rounded-xl border p-3 sm:p-4 transition shadow-xs ${
          isRed
            ? 'bg-red-50/80 border-red-200 text-red-950'
            : isYellow
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* LEFT: STATUS ICON & SUMMARY */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {isRed ? (
                <div className="w-8 h-8 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600">
                  <XCircle className="w-5 h-5" />
                </div>
              ) : isYellow ? (
                <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isRed
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : isYellow
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  {isRed ? 'ITR Form Not Eligible' : isYellow ? 'Manual Verification Required' : 'ITR Form Fully Eligible'}
                </span>

                {hasOverride && (
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full">
                    ⚠️ User Override Active
                  </span>
                )}
                
                <span className="text-[11px] text-slate-500 font-medium">
                  AY {computation.assessmentYear || '2026-27'} CBDT Rules
                </span>
              </div>

              <div className="text-xs sm:text-sm font-semibold flex items-center gap-2 flex-wrap">
                <span>Selected: <strong className="font-bold underline">{computation.itrForm || 'ITR-4 (Sugam)'}</strong></span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 inline" />
                <span>Recommended: <strong className="font-bold text-blue-700">{result.recommendedITR}</strong></span>
              </div>

              {result.reasons.length > 0 && (
                <p className="text-xs text-red-800 font-medium pt-0.5">
                  <strong>Disqualification Reason:</strong> {result.reasons[0]}
                </p>
              )}

              {result.reasons.length === 0 && result.warnings.length > 0 && (
                <p className="text-xs text-amber-900 font-medium pt-0.5">
                  <strong>Notice:</strong> {result.warnings[0]}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: ACTION BUTTONS */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {computation.itrForm !== result.recommendedITR && (
              <button
                type="button"
                onClick={handleSwitchToRecommended}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                title={`Switch form to ${result.recommendedITR}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Switch to {result.recommendedITR}</span>
              </button>
            )}

            {isRed && (
              <button
                type="button"
                onClick={() => setShowOverrideModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-700 border border-red-300 text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <span>Override</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <span>{showDetails ? 'Hide Audit' : 'Audit Details'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* EXPANDED STATUTORY AUDIT DETAILS */}
        {showDetails && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 space-y-3 text-xs">
            {/* Field Checks Grid */}
            {result.fieldChecks && (
              <div className="space-y-1.5">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Statutory Eligibility Checks Breakdown (CBDT AY {computation.assessmentYear || '2026-27'})</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(result.fieldChecks).map(([key, check]) => (
                    <div 
                      key={key}
                      className={`p-2 rounded-lg border flex items-start gap-2 bg-white ${
                        check.status === 'FAIL' 
                          ? 'border-red-200 text-red-950' 
                          : check.status === 'WARN' || check.status === 'INFO_REQUIRED'
                          ? 'border-amber-200 text-amber-950'
                          : 'border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {check.status === 'FAIL' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        ) : check.status === 'WARN' || check.status === 'INFO_REQUIRED' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-[11px] text-slate-700">{check.rule}</div>
                        <div className="text-[10.5px] leading-relaxed text-slate-600">{check.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasons List */}
            {result.reasons.length > 0 && (
              <div className="bg-red-100/70 border border-red-200 rounded-lg p-2.5 space-y-1">
                <span className="font-bold text-red-900 text-[11px] uppercase tracking-wide">
                  Statutory Disqualifications Identified:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-red-800">
                  {result.reasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings List */}
            {result.warnings.length > 0 && (
              <div className="bg-amber-100/70 border border-amber-200 rounded-lg p-2.5 space-y-1">
                <span className="font-bold text-amber-950 text-[11px] uppercase tracking-wide">
                  Notices & Warnings:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-amber-900">
                  {result.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Required Actions */}
            {result.requiredAction.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 space-y-1">
                <span className="font-bold text-blue-900 text-[11px] uppercase tracking-wide">
                  Mandatory Action to Resolve:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  {result.requiredAction.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Override status details */}
            {hasOverride && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-900">User Override Reason: </span>
                  <span className="text-purple-800">{computation.userOverrideReason || result.userOverride?.reason}</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline ml-2"
                >
                  Clear Override
                </button>
              </div>
            )}

            <div className="text-[10px] text-slate-500 text-right">
              Audit Evaluated at: {new Date(result.auditTimestamp).toLocaleString('en-IN')}
            </div>
          </div>
        )}
      </div>

      {/* USER OVERRIDE REASON MODAL */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600 border-b pb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">ITR Form Override Justification</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The selected form <strong>{computation.itrForm}</strong> is flagged as statutory non-compliant by the AY {computation.assessmentYear || '2026-27'} eligibility engine. 
              The recommended statutory form is <strong>{result.recommendedITR}</strong>.
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Practitioner / Tax Preparer Reason for Override *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Assessee opting out of presumptive taxation with audited books, or specific high court circular applicable..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!overrideReason.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition"
                >
                  Confirm Override & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
