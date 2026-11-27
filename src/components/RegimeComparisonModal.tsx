import React from 'react';
import { X, Scale, CheckCircle2, TrendingDown, ArrowRight } from 'lucide-react';
import { TaxComputation, TaxRegime } from '../types';
import { recalculateFullComputation, computeTaxLiability } from '../utils/taxCalculator';
import { formatINR } from '../utils/pdfGenerator';

interface RegimeComparisonModalProps {
  computation: TaxComputation;
  isOpen: boolean;
  onClose: () => void;
  onSelectRegime: (regime: TaxRegime) => void;
}

export const RegimeComparisonModal: React.FC<RegimeComparisonModalProps> = ({
  computation,
  isOpen,
  onClose,
  onSelectRegime,
}) => {
  if (!isOpen) return null;

  // Calculate both regimes
  const compNew = recalculateFullComputation({
    ...computation,
    regimeOpted: 'new',
  });

  const compOld = recalculateFullComputation({
    ...computation,
    regimeOpted: 'old',
  });

  const taxDiff = compOld.grossTaxLiability - compNew.grossTaxLiability;
  const isNewBetter = compNew.grossTaxLiability <= compOld.grossTaxLiability;
  const savings = Math.abs(taxDiff);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base">New Regime vs Old Regime Comparison</h3>
              <p className="text-[11px] text-slate-300">
                Assessment Year {computation.assessmentYear} &bull; Client: {computation.client.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Recommendation Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isNewBetter ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <strong className="text-xs sm:text-sm font-bold block">
                  Recommended: {isNewBetter ? 'NEW TAX REGIME (u/s 115BAC)' : 'OLD TAX REGIME'}
                </strong>
                <span className="text-xs">
                  {savings > 0 
                    ? `Client saves ${formatINR(savings)} extra tax under the ${isNewBetter ? 'New' : 'Old'} Regime!`
                    : 'Tax liability is identical under both regimes.'}
                </span>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 bg-blue-50/50 text-blue-900">New Regime (115BAC)</th>
                  <th className="py-2.5 px-3">Old Tax Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-3 text-slate-600">Gross Total Income (GTI)</td>
                  <td className="py-2 px-3 font-semibold text-slate-900 bg-blue-50/20">{formatINR(compNew.grossTotalIncome)}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{formatINR(compOld.grossTotalIncome)}</td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-slate-600">Standard Deduction</td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold bg-blue-50/20">{formatINR(compNew.salary.standardDeduction)}</td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold">{formatINR(compOld.salary.standardDeduction)}</td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-slate-600">Chapter VI-A Deductions (80C/80D)</td>
                  <td className="py-2 px-3 text-slate-500 bg-blue-50/20">{formatINR(compNew.deductions.totalDeductions)} (Restricted)</td>
                  <td className="py-2 px-3 text-slate-800 font-semibold">{formatINR(compOld.deductions.totalDeductions)}</td>
                </tr>

                <tr className="bg-slate-50 font-bold">
                  <td className="py-2.5 px-3 text-slate-900">Net Taxable Income</td>
                  <td className="py-2.5 px-3 text-blue-950 bg-blue-100/50">{formatINR(compNew.totalTaxableIncome)}</td>
                  <td className="py-2.5 px-3 text-slate-900">{formatINR(compOld.totalTaxableIncome)}</td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-slate-600">Tax at Normal Slabs</td>
                  <td className="py-2 px-3 bg-blue-50/20">{formatINR(compNew.taxOnNormalIncome)}</td>
                  <td className="py-2 px-3">{formatINR(compOld.taxOnNormalIncome)}</td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-slate-600">Rebate u/s 87A</td>
                  <td className="py-2 px-3 text-emerald-700 bg-blue-50/20">{formatINR(compNew.rebate87A)}</td>
                  <td className="py-2 px-3 text-emerald-700">{formatINR(compOld.rebate87A)}</td>
                </tr>

                <tr>
                  <td className="py-2 px-3 text-slate-600">4% Health & Education Cess</td>
                  <td className="py-2 px-3 bg-blue-50/20">{formatINR(compNew.healthAndEducationCess)}</td>
                  <td className="py-2 px-3">{formatINR(compOld.healthAndEducationCess)}</td>
                </tr>

                <tr className="bg-slate-100 font-black text-sm">
                  <td className="py-3 px-3 text-slate-900">Total Tax Liability</td>
                  <td className={`py-3 px-3 ${isNewBetter ? 'bg-emerald-100 text-emerald-900 font-black' : 'bg-blue-50 text-slate-900'}`}>
                    {formatINR(compNew.grossTaxLiability)}
                  </td>
                  <td className={`py-3 px-3 ${!isNewBetter ? 'bg-emerald-100 text-emerald-900 font-black' : 'text-slate-900'}`}>
                    {formatINR(compOld.grossTaxLiability)}
                  </td>
                </tr>

                <tr className="font-bold">
                  <td className="py-2.5 px-3 text-slate-800">Final Outcome (with Taxes Paid)</td>
                  <td className="py-2.5 px-3 bg-blue-50/20">
                    {compNew.refundDue > 0 ? (
                      <span className="text-emerald-700">Refund {formatINR(compNew.refundDue)}</span>
                    ) : compNew.netTaxPayable > 0 ? (
                      <span className="text-red-700">Payable {formatINR(compNew.netTaxPayable)}</span>
                    ) : (
                      <span className="text-slate-700">NIL</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {compOld.refundDue > 0 ? (
                      <span className="text-emerald-700">Refund {formatINR(compOld.refundDue)}</span>
                    ) : compOld.netTaxPayable > 0 ? (
                      <span className="text-red-700">Payable {formatINR(compOld.netTaxPayable)}</span>
                    ) : (
                      <span className="text-slate-700">NIL</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                onSelectRegime('old');
                onClose();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                computation.regimeOpted === 'old'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Apply Old Tax Regime
            </button>

            <button
              onClick={() => {
                onSelectRegime('new');
                onClose();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
                computation.regimeOpted === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Apply New Tax Regime (115BAC)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
