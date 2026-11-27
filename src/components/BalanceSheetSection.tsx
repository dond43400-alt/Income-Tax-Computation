import React from 'react';
import { Scale, Printer, CheckCircle2, Edit3, Sparkles } from 'lucide-react';
import { BalanceSheetDetails } from '../types';

interface BalanceSheetSectionProps {
  balanceSheet?: BalanceSheetDetails;
  assesseeName: string;
  pan: string;
  assessmentYear: string;
  financialYear: string;
  onEdit?: () => void;
}

export const BalanceSheetSection: React.FC<BalanceSheetSectionProps> = ({
  balanceSheet,
  assesseeName,
  pan,
  assessmentYear,
  financialYear,
  onEdit,
}) => {
  if (!balanceSheet || balanceSheet.enabled === false) {
    return null;
  }

  const bs = balanceSheet;
  const asOnDate = bs.asOnDate || `31st March ${financialYear?.split('-')[1]?.length === 2 ? '20' + financialYear.split('-')[1] : '2026'}`;
  const diff = (bs.totalLiabilities || 0) - (bs.totalAssets || 0);
  const isTallied = Math.abs(diff) === 0;

  return (
    <div className={`mt-6 border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xs ${bs.showInPrint === false ? 'no-print' : 'print:break-inside-avoid'}`}>
      
      {/* Table Header / Title */}
      <div className="bg-[#10366b] text-white px-4 py-2.5 flex flex-wrap items-center justify-between border-b-2 border-slate-900">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-200" />
          <div>
            <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider">
              FINANCIAL PARTICULARS / SCHEDULE BALANCE SHEET (ਸੰਤੁਲਨ ਸ਼ੀਟ)
            </h3>
            <p className="text-[10px] text-blue-200">
              Statement of Affairs as on {asOnDate} (Relevant to A.Y. {assessmentYear}) - M/s {assesseeName} [{pan}]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          {isTallied ? (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-600/90 text-white font-bold px-2 py-0.5 rounded border border-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>TALLIED (ਬੈਲੇਂਸ ਬਰਾਬਰ)</span>
            </span>
          ) : (
            <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded">
              Diff: ₹{Math.abs(diff).toLocaleString('en-IN')}
            </span>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit BS</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Balance Sheet Table (ICAI T-Format) */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-slate-900 text-xs">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: LIABILITIES & CAPITAL (ਦੇਣਦਾਰੀਆਂ ਅਤੇ ਪੂੰਜੀ) */}
        {/* ======================================================== */}
        <div className="flex flex-col justify-between">
          <div>
            {/* Column Header */}
            <div className="bg-slate-100 px-3 py-1.5 font-black text-slate-900 border-b border-slate-300 flex items-center justify-between uppercase tracking-wider text-[11px]">
              <span>LIABILITIES & CAPITAL (ਦੇਣਦਾਰੀਆਂ)</span>
              <span>AMOUNT (₹)</span>
            </div>

            <div className="p-3 space-y-3">
              
              {/* 1. CAPITAL ACCOUNT */}
              <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1 bg-slate-50/60 p-2 rounded-lg border border-slate-200">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>CAPITAL A/C (ਪੂੰਜੀ ਖਾਤਾ / Proprietor's Capital):</span>
                  </div>
                  {bs.capitalAccountDetails ? (
                    <div className="text-[10px] text-slate-500 mt-0.5">{bs.capitalAccountDetails}</div>
                  ) : (
                    <div className="text-[10px] text-slate-500 mt-0.5">Proprietor's Capital Balance as on {asOnDate}</div>
                  )}
                </div>
                <span className="font-mono font-bold text-slate-900 text-xs">₹{(bs.closingCapital || 0).toLocaleString('en-IN')}</span>
              </div>

              {/* 2. SECURED LOANS */}
              {Boolean(bs.securedLoans && bs.securedLoans > 0) && (
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900">SECURED LOANS (ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ):</div>
                    {bs.securedLoansDetails && (
                      <div className="text-[10px] text-slate-500">{bs.securedLoansDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{bs.securedLoans.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* 3. UNSECURED LOANS */}
              {Boolean(bs.unsecuredLoans && bs.unsecuredLoans > 0) && (
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900">UNSECURED LOANS (ਗੈਰ-ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ):</div>
                    {bs.unsecuredLoansDetails && (
                      <div className="text-[10px] text-slate-500">{bs.unsecuredLoansDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{bs.unsecuredLoans.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* 4. SUNDRY CREDITORS */}
              <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>SUNDRY CREDITORS (ਵਪਾਰਕ ਲੈਣਦਾਰ - Trade Payables):</span>
                    <span className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-300">ITR-4</span>
                  </div>
                  {bs.sundryCreditorsDetails ? (
                    <div className="text-[10px] text-slate-500">{bs.sundryCreditorsDetails}</div>
                  ) : (
                    <div className="text-[10px] text-slate-400">Trade creditors for material/supplies</div>
                  )}
                </div>
                <span className="font-mono font-bold text-slate-900">₹{(bs.sundryCreditors || 0).toLocaleString('en-IN')}</span>
              </div>

              {/* 5. OTHER CURRENT LIABILITIES */}
              {Boolean(bs.otherCurrentLiabilities && bs.otherCurrentLiabilities > 0) && (
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900">OTHER CURRENT LIABILITIES & PROVISIONS:</div>
                    {bs.otherLiabilitiesDetails && (
                      <div className="text-[10px] text-slate-500">{bs.otherLiabilitiesDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{bs.otherCurrentLiabilities.toLocaleString('en-IN')}</span>
                </div>
              )}

            </div>
          </div>

          {/* TOTAL LIABILITIES BOTTOM ROW (Double Accounting Line) */}
          <div className="bg-slate-100 px-3 py-2 border-t-2 border-slate-900 flex justify-between items-center font-black text-slate-950 text-xs">
            <span className="uppercase tracking-wider">TOTAL LIABILITIES & CAPITAL:</span>
            <span className="font-mono text-sm underline decoration-double decoration-slate-950 font-black">
              ₹{(bs.totalLiabilities || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: PROPERTY & ASSETS (ਸੰਪਤੀਆਂ ਅਤੇ ਨਕਦੀ) */}
        {/* ======================================================== */}
        <div className="flex flex-col justify-between">
          <div>
            {/* Column Header */}
            <div className="bg-slate-100 px-3 py-1.5 font-black text-slate-900 border-b border-slate-300 flex items-center justify-between uppercase tracking-wider text-[11px]">
              <span>PROPERTY & ASSETS (ਜਾਇਦਾਦ ਅਤੇ ਸੰਪਤੀਆਂ)</span>
              <span>AMOUNT (₹)</span>
            </div>

            <div className="p-3 space-y-3">
              
              {/* 1. FIXED ASSETS (W.D.V.) */}
              {Boolean((bs.grossFixedAssets && bs.grossFixedAssets > 0) || (bs.netFixedAssets && bs.netFixedAssets > 0)) && (
                <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 space-y-1 text-[11px]">
                  <div className="font-bold text-slate-900 uppercase border-b border-slate-200 pb-1 text-[11px] flex items-center justify-between">
                    <span>FIXED ASSETS (ਸਥਿਰ ਸੰਪਤੀਆਂ):</span>
                    <span className="text-[10px] text-slate-600 font-medium">At W.D.V.</span>
                  </div>
                  
                  {Boolean(bs.grossFixedAssets && bs.grossFixedAssets > 0) && (
                    <div className="flex justify-between text-slate-700 pl-2">
                      <span>Gross Block (Cost):</span>
                      <span className="font-mono font-medium">₹{bs.grossFixedAssets.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {Boolean(bs.depreciation && bs.depreciation > 0) && (
                    <div className="flex justify-between text-slate-700 pl-2">
                      <span>Less: Depreciation for Year:</span>
                      <span className="font-mono font-medium text-rose-800">-₹{bs.depreciation.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {bs.fixedAssetsDetails && (
                    <div className="text-[10px] text-slate-500 pl-2 italic">
                      ({bs.fixedAssetsDetails})
                    </div>
                  )}

                  <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-slate-900 bg-emerald-50/60 px-2 py-0.5 rounded">
                    <span>Net Fixed Assets (W.D.V. as on 31st March):</span>
                    <span className="font-mono font-black text-emerald-950">₹{(bs.netFixedAssets || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* 2. INVESTMENTS */}
              {Boolean(bs.investments && bs.investments > 0) && (
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900">INVESTMENTS (ਨਿਵੇਸ਼):</div>
                    {bs.investmentsDetails && (
                      <div className="text-[10px] text-slate-500">{bs.investmentsDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{bs.investments.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* 3. CURRENT ASSETS */}
              <div className="space-y-2">
                
                {/* Closing Stock */}
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>STOCK-IN-TRADE / INVENTORIES (ਕਲੋਜ਼ਿੰਗ ਸਟਾਕ):</span>
                      <span className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-300">ITR-4</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Valued at Cost or Market Price whichever is lower</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{(bs.closingStock || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* Sundry Debtors */}
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>SUNDRY DEBTORS (ਵਪਾਰਕ ਦੇਣਦਾਰ - Receivables):</span>
                      <span className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-300">ITR-4</span>
                    </div>
                    {bs.sundryDebtorsDetails && (
                      <div className="text-[10px] text-slate-500">{bs.sundryDebtorsDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{(bs.sundryDebtors || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* Cash in Hand */}
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>CASH IN HAND (ਨਕਦ ਬਕਾਇਆ as on 31st March):</span>
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded border border-amber-300 font-bold">ITR-4</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Physical cash balance verified by proprietor</div>
                  </div>
                  <span className="font-mono font-black text-amber-950">₹{(bs.cashInHand || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* Bank Balances */}
                <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>BALANCE WITH SCHEDULED BANKS (ਬੈਂਕ ਬੈਲੇਂਸ):</span>
                      <span className="text-[9px] bg-blue-100 text-blue-900 px-1 py-0.2 rounded border border-blue-300 font-bold">ITR-4</span>
                    </div>
                    {bs.bankBalancesDetails && (
                      <div className="text-[10px] text-slate-500 font-mono">{bs.bankBalancesDetails}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{(bs.bankBalances || 0).toLocaleString('en-IN')}</span>
                </div>

                {/* Loans & Advances */}
                {Boolean(bs.loansAndAdvances && bs.loansAndAdvances > 0) && (
                  <div className="flex justify-between items-start text-[11px] border-b border-slate-200 pb-1.5 px-1">
                    <div>
                      <div className="font-bold text-slate-900">LOANS, ADVANCES & OTHER DEPOSITS:</div>
                      {bs.loansAndAdvancesDetails && (
                        <div className="text-[10px] text-slate-500">{bs.loansAndAdvancesDetails}</div>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900">₹{bs.loansAndAdvances.toLocaleString('en-IN')}</span>
                  </div>
                )}

              </div>

            </div>
          </div>

          {/* TOTAL ASSETS BOTTOM ROW (Double Accounting Line) */}
          <div className="bg-slate-100 px-3 py-2 border-t-2 border-slate-900 flex justify-between items-center font-black text-slate-950 text-xs">
            <span className="uppercase tracking-wider">TOTAL PROPERTY & ASSETS:</span>
            <span className="font-mono text-sm underline decoration-double decoration-slate-950 font-black">
              ₹{(bs.totalAssets || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

      </div>

      {/* Verification & Footnote */}
      <div className="bg-slate-50 p-2.5 px-4 border-t border-slate-300 text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="italic">
          * Note: Prepared from books/records produced by the assessee for filing return u/s 44AD / 44ADA / Presumptive scheme.
        </div>
        <div className="font-semibold text-slate-800">
          For M/s {assesseeName} (Proprietor)
        </div>
      </div>

    </div>
  );
};
