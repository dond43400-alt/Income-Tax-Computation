import React from 'react';
import { 
  Scale, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, 
  RefreshCw, Landmark, Building2, Store, Briefcase, DollarSign,
  HelpCircle, Eye, Printer, ShieldCheck
} from 'lucide-react';
import { BalanceSheetDetails } from '../types';
import { calculateBalanceSheet } from '../utils/taxCalculator';

interface BalanceSheetEditorProps {
  balanceSheet: BalanceSheetDetails | undefined;
  onChange: (updated: BalanceSheetDetails) => void;
  businessProfit?: number;
  businessTurnover?: number;
  clientBankName?: string;
  clientAccountNumber?: string;
  financialYear?: string;
}

export const BalanceSheetEditor: React.FC<BalanceSheetEditorProps> = ({
  balanceSheet,
  onChange,
  businessProfit = 0,
  businessTurnover = 0,
  clientBankName = 'Capital Small Finance Bank',
  clientAccountNumber = '052200002279',
  financialYear = '2025-26',
}) => {
  const defaultAsOn = financialYear ? `31st March ${financialYear.split('-')[1]?.length === 2 ? '20' + financialYear.split('-')[1] : financialYear.split('-')[1]}` : '31st March 2026';
  
  // Safe resolved balance sheet with calculations
  const bs: BalanceSheetDetails = calculateBalanceSheet(
    balanceSheet || {
      enabled: false,
      asOnDate: defaultAsOn,
      showInPrint: true,
    },
    businessProfit,
    defaultAsOn
  );

  const isEnabled = bs.enabled ?? true;
  const diff = bs.totalLiabilities - bs.totalAssets;
  const isTallied = Math.abs(diff) === 0;

  const updateField = (field: keyof BalanceSheetDetails, value: any) => {
    const updated = {
      ...bs,
      [field]: value,
    };
    const recalculated = calculateBalanceSheet(updated, businessProfit, defaultAsOn);
    onChange(recalculated);
  };

  // 1-Click Auto-Populate from Business and Client Bank
  const handleAutoPopulate = () => {
    const profit = businessProfit > 0 ? businessProfit : 512090;
    const estTurnover = businessTurnover > 0 ? businessTurnover : 1455100;
    
    // Sensible ratios for small business / boutique / shop
    const opCap = Math.round(profit * 0.7);
    const drawings = Math.round(profit * 0.35);
    const closingCap = opCap + profit - drawings;

    const creditors = Math.round(estTurnover * 0.10);
    const unsecLoans = Math.round(profit * 0.25);
    const otherLiab = 25000;
    const totLiab = closingCap + creditors + unsecLoans + otherLiab;

    const fixedGross = Math.round(profit * 0.35);
    const dep = Math.round(fixedGross * 0.15);
    const netFixed = fixedGross - dep;

    const stock = Math.round(estTurnover * 0.22);
    const debtors = Math.round(estTurnover * 0.15);
    const bank = Math.round(profit * 0.30);
    const cash = Math.max(0, totLiab - (netFixed + stock + debtors + bank));

    const populated: BalanceSheetDetails = {
      enabled: true,
      asOnDate: defaultAsOn,
      showInPrint: true,
      openingCapital: opCap,
      capitalIntroduced: 0,
      netProfitAdded: profit,
      otherAdditions: 0,
      drawings: drawings,
      taxPaidFromCapital: 0,
      closingCapital: closingCap,
      securedLoans: 0,
      securedLoansDetails: '',
      unsecuredLoans: unsecLoans,
      unsecuredLoansDetails: 'From Family / Relatives for Business Capital',
      sundryCreditors: creditors,
      sundryCreditorsDetails: 'Suppliers & Material Wholesalers',
      otherCurrentLiabilities: otherLiab,
      otherLiabilitiesDetails: 'Shop Rent, Electricity & Wages Payable',
      totalLiabilities: totLiab,
      grossFixedAssets: fixedGross,
      depreciation: dep,
      netFixedAssets: netFixed,
      fixedAssetsDetails: 'Machinery, Tools, Counter & Furniture',
      investments: 0,
      investmentsDetails: '',
      closingStock: stock,
      sundryDebtors: debtors,
      sundryDebtorsDetails: 'Customer Receivables & Pending Balances',
      cashInHand: cash,
      bankBalances: bank,
      bankBalancesDetails: `${clientBankName} (A/c ${clientAccountNumber})`,
      loansAndAdvances: 0,
      loansAndAdvancesDetails: '',
      totalAssets: totLiab,
    };

    onChange(calculateBalanceSheet(populated, profit, defaultAsOn));
  };

  // Preset 1: Retail Shop / Trader Preset
  const handleApplyPresetRetail = () => {
    const profit = businessProfit > 0 ? businessProfit : 450000;
    const turnover = businessTurnover > 0 ? businessTurnover : 1200000;

    const opCap = Math.round(profit * 0.8);
    const drawings = Math.round(profit * 0.3);
    const closingCap = opCap + profit - drawings;

    const creditors = Math.round(turnover * 0.12);
    const totLiab = closingCap + creditors;

    const stock = Math.round(turnover * 0.25);
    const debtors = Math.round(turnover * 0.18);
    const bank = Math.round(profit * 0.25);
    const fixed = Math.round(profit * 0.20);
    const cash = Math.max(0, totLiab - (fixed + stock + debtors + bank));

    const retailBs: BalanceSheetDetails = {
      enabled: true,
      asOnDate: defaultAsOn,
      showInPrint: true,
      openingCapital: opCap,
      capitalIntroduced: 0,
      netProfitAdded: profit,
      otherAdditions: 0,
      drawings: drawings,
      taxPaidFromCapital: 0,
      closingCapital: closingCap,
      securedLoans: 0,
      securedLoansDetails: '',
      unsecuredLoans: 0,
      unsecuredLoansDetails: '',
      sundryCreditors: creditors,
      sundryCreditorsDetails: 'Trade Creditors / Wholesalers',
      otherCurrentLiabilities: 0,
      otherLiabilitiesDetails: '',
      totalLiabilities: totLiab,
      grossFixedAssets: Math.round(fixed * 1.15),
      depreciation: Math.round(fixed * 0.15),
      netFixedAssets: fixed,
      fixedAssetsDetails: 'Shop Racks, Counter, Computer & AC',
      investments: 0,
      investmentsDetails: '',
      closingStock: stock,
      sundryDebtors: debtors,
      sundryDebtorsDetails: 'Debtors for Goods Sold',
      cashInHand: cash,
      bankBalances: bank,
      bankBalancesDetails: `${clientBankName} (A/c ${clientAccountNumber})`,
      loansAndAdvances: 0,
      loansAndAdvancesDetails: '',
      totalAssets: totLiab,
    };
    onChange(calculateBalanceSheet(retailBs, profit, defaultAsOn));
  };

  // Preset 2: Service / Professional Preset
  const handleApplyPresetService = () => {
    const profit = businessProfit > 0 ? businessProfit : 500000;
    const opCap = Math.round(profit * 0.5);
    const drawings = Math.round(profit * 0.4);
    const closingCap = opCap + profit - drawings;

    const unsecLoan = Math.round(profit * 0.15);
    const totLiab = closingCap + unsecLoan;

    const fixed = Math.round(profit * 0.25);
    const debtors = Math.round(profit * 0.20);
    const bank = Math.round(profit * 0.35);
    const cash = Math.max(0, totLiab - (fixed + debtors + bank));

    const servBs: BalanceSheetDetails = {
      enabled: true,
      asOnDate: defaultAsOn,
      showInPrint: true,
      openingCapital: opCap,
      capitalIntroduced: 0,
      netProfitAdded: profit,
      otherAdditions: 0,
      drawings: drawings,
      taxPaidFromCapital: 0,
      closingCapital: closingCap,
      securedLoans: 0,
      securedLoansDetails: '',
      unsecuredLoans: unsecLoan,
      unsecuredLoansDetails: 'Unsecured Loan from Friends',
      sundryCreditors: 0,
      sundryCreditorsDetails: '',
      otherCurrentLiabilities: 0,
      otherLiabilitiesDetails: '',
      totalLiabilities: totLiab,
      grossFixedAssets: Math.round(fixed * 1.2),
      depreciation: Math.round(fixed * 0.2),
      netFixedAssets: fixed,
      fixedAssetsDetails: 'Professional Office Equipment & Laptops',
      investments: 0,
      investmentsDetails: '',
      closingStock: 0,
      sundryDebtors: debtors,
      sundryDebtorsDetails: 'Bills Receivable from Clients',
      cashInHand: cash,
      bankBalances: bank,
      bankBalancesDetails: `${clientBankName} (A/c ${clientAccountNumber})`,
      loansAndAdvances: 0,
      loansAndAdvancesDetails: '',
      totalAssets: totLiab,
    };
    onChange(calculateBalanceSheet(servBs, profit, defaultAsOn));
  };

  const [confirmingAdjustment, setConfirmingAdjustment] = React.useState<'cash' | 'capital' | null>(null);

  // Auto Tally Balance Sheet with explicit confirmation modal
  const handleAutoTallyRequest = (target: 'cash' | 'capital') => {
    if (diff === 0) return;
    setConfirmingAdjustment(target);
  };

  const handleConfirmAdjustment = () => {
    if (!confirmingAdjustment || diff === 0) {
      setConfirmingAdjustment(null);
      return;
    }
    if (confirmingAdjustment === 'cash') {
      const newCash = Math.max(0, (bs.cashInHand || 0) + diff);
      updateField('cashInHand', newCash);
    } else {
      const newCapital = Math.max(0, (bs.closingCapital || 0) - diff);
      updateField('closingCapital', newCapital);
    }
    setConfirmingAdjustment(null);
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/25 to-slate-50 p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs space-y-4">
      
      {/* Top Header with Enable Toggle & Print Checkbox */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-blue-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#10366b] text-white rounded-xl shadow-xs">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[#10366b] text-sm uppercase tracking-wide flex items-center gap-2">
              <span>SCHEDULE BALANCE SHEET (ਸੰਤੁਲਨ ਸ਼ੀਟ / FINANCIAL PARTICULARS)</span>
              <span className="text-[10px] bg-blue-100 text-[#10366b] font-bold px-2 py-0.5 rounded-full border border-blue-300">
                ITR-4 / ITR-3 Format
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Sources of Funds (Liabilities & Capital) vs Application of Funds (Assets & Cash) as on 31st March
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => updateField('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <span>Enable Balance Sheet (ਬੈਲੇਂਸ ਸ਼ੀਟ ਸ਼ਾਮਲ ਕਰੋ)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-300 shadow-2xs cursor-pointer hover:bg-blue-100/70">
            <input
              type="checkbox"
              checked={bs.showInPrint !== false}
              onChange={(e) => updateField('showInPrint', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <Printer className="w-3.5 h-3.5 text-blue-700" />
            <span>Show in Print & PDF (ਪ੍ਰਿੰਟ ਵਿੱਚ ਦਿਖਾਓ)</span>
          </label>
        </div>
      </div>

      {isEnabled && (
        <div className="space-y-4">
          
          {/* Action Bar: Presets & Auto Populate */}
          <div className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Auto-Fill (ਤੇਜ਼ੀ ਨਾਲ ਭਰੋ):
              </span>
              
              <button
                type="button"
                onClick={handleAutoPopulate}
                className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
                title="Populate from 44AD Net Profit & Client bank"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>⚡ Auto-Fill from Business (ਬਿਜ਼ਨਸ ਮੁਨਾਫ਼ੇ ਤੋਂ ਭਰੋ)</span>
              </button>

              <button
                type="button"
                onClick={handleApplyPresetRetail}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold border border-slate-300 shadow-2xs transition cursor-pointer"
              >
                <Store className="w-3 h-3 text-blue-600" />
                <span>🏪 Shop / Trader Preset</span>
              </button>

              <button
                type="button"
                onClick={handleApplyPresetService}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold border border-slate-300 shadow-2xs transition cursor-pointer"
              >
                <Briefcase className="w-3 h-3 text-emerald-600" />
                <span>💼 Service / Freelance Preset</span>
              </button>
            </div>

            {/* As on date input */}
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-slate-600 font-bold text-[11px]">As on Date:</label>
              <input
                type="text"
                value={bs.asOnDate || defaultAsOn}
                onChange={(e) => updateField('asOnDate', e.target.value)}
                placeholder="31st March 2026"
                className="p-1 px-2 border border-slate-300 rounded-md font-medium text-slate-900 bg-white text-xs outline-none focus:border-blue-600 w-32 font-mono"
              />
            </div>
          </div>

          {/* TALLY STATUS BANNER */}
          <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            isTallied 
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/90 border-amber-300 text-amber-950'
          }`}>
            <div className="flex items-center gap-2">
              {isTallied ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-black text-xs uppercase tracking-wide flex items-center gap-2">
                  <span>{isTallied ? '✅ BALANCE SHEET PERFECTLY TALLIED (ਸੰਤੁਲਨ ਸ਼ੀਟ ਬਰਾਬਰ ਹੈ)' : '⚠️ DIFFERENCE DETECTED IN BALANCE SHEET (ਅੰਤਰ ਹੈ)'}</span>
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-current font-bold">
                    Diff: ₹{Math.abs(diff).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[11px] font-medium opacity-85">
                  Total Liabilities & Capital: <strong className="font-mono">₹{bs.totalLiabilities.toLocaleString('en-IN')}</strong> | Total Property & Assets: <strong className="font-mono">₹{bs.totalAssets.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            {!isTallied && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoTallyRequest('cash')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ਆਟੋ ਬੈਲੇਂਸ ਕਰੋ (Adjust Cash in Hand)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAutoTallyRequest('capital')}
                  className="px-3 py-1 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Adjust Capital</span>
                </button>
              </div>
            )}
          </div>

          {/* EXPLICIT CONFIRMATION MODAL FOR AUTO-ADJUSTMENT */}
          {confirmingAdjustment && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Confirm Balance Sheet Adjustment
                    </h4>
                    <p className="text-xs text-slate-500">
                      Explicit Practitioner Confirmation Required
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Balance Sheet Difference:</span>
                    <strong className="font-mono text-amber-700">₹{Math.abs(diff).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Adjustment Target:</span>
                    <strong className="text-slate-900">
                      {confirmingAdjustment === 'cash' ? 'Cash in Hand (Application of Funds)' : 'Proprietor Closing Capital (Source of Funds)'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                    <span className="text-slate-800">Proposed Adjustment:</span>
                    <span className="font-mono text-blue-900">
                      {confirmingAdjustment === 'cash' 
                        ? `Set Cash in Hand to ₹${Math.max(0, (bs.cashInHand || 0) + diff).toLocaleString('en-IN')}` 
                        : `Set Closing Capital to ₹${Math.max(0, (bs.closingCapital || 0) - diff).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  ⚠️ Note: Statutory audit rules strictly forbid silent alterations to Capital or Cash accounts. Please confirm only if this reflects actual physical cash/capital.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingAdjustment(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAdjustment}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Confirm & Apply Adjustment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TWO MAIN COLUMNS: LIABILITIES (LEFT) & ASSETS (RIGHT) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* ======================================================== */}
            {/* COLUMN 1: LIABILITIES & CAPITAL (ਦੇਣਦਾਰੀਆਂ ਅਤੇ ਪੂੰਜੀ) */}
            {/* ======================================================== */}
            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10366b]"></span>
                    <h5 className="font-black text-[#10366b] text-xs uppercase tracking-wider">
                      A. CAPITAL & LIABILITIES (ਪੂੰਜੀ ਅਤੇ ਦੇਣਦਾਰੀਆਂ)
                    </h5>
                  </div>
                  <span className="text-[10px] text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Source of Funds
                  </span>
                </div>

                {/* 1. PROPRIETOR CAPITAL ACCOUNT BOX */}
                <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-200/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-1">
                    <span className="font-bold text-blue-950 text-xs uppercase flex items-center gap-1.5">
                      <span>1. Capital Account (ਪੂੰਜੀ ਖਾਤਾ / Proprietor Capital A/c)</span>
                    </span>
                    {businessProfit > 0 && (
                      <button
                        type="button"
                        onClick={() => updateField('closingCapital', businessProfit)}
                        className="text-[10px] text-blue-700 hover:text-blue-900 font-bold bg-blue-100/70 hover:bg-blue-200/70 px-2 py-0.5 rounded border border-blue-300 transition"
                        title="Set Capital equal to Net Profit"
                      >
                        Set = Net Profit (₹{businessProfit.toLocaleString('en-IN')})
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Capital A/c Balance as on 31st March (ਪੂੰਜੀ ਖਾਤਾ ₹)
                        </label>
                        <span className="text-[10px] font-mono font-bold text-blue-900">
                          ₹{(bs.closingCapital || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <input
                        type="number"
                        placeholder="e.g. 500000"
                        value={bs.closingCapital || ''}
                        onChange={(e) => updateField('closingCapital', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 text-sm border border-blue-300 rounded font-mono font-bold bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                        Capital Account Description / Particulars (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Proprietor's Capital Account as on 31st March"
                        value={bs.capitalAccountDetails || ''}
                        onChange={(e) => updateField('capitalAccountDetails', e.target.value)}
                        className="w-full p-1.5 text-xs border border-slate-200 rounded bg-white text-slate-800 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. LOANS & BORROWINGS */}
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-700 font-bold mb-0.5">
                        Secured Loans (ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ - Bank CC/Term Loan ₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.securedLoans || ''}
                        onChange={(e) => updateField('securedLoans', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Loan details (e.g. SBI CC Limit)"
                        value={bs.securedLoansDetails || ''}
                        onChange={(e) => updateField('securedLoansDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-700 font-bold mb-0.5">
                        Unsecured Loans (ਗੈਰ-ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ - Friends/Relatives ₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.unsecuredLoans || ''}
                        onChange={(e) => updateField('unsecuredLoans', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Lender name (e.g. From Family / Relatives)"
                        value={bs.unsecuredLoansDetails || ''}
                        onChange={(e) => updateField('unsecuredLoansDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  {/* 3. SUNDRY CREDITORS & CURRENT LIABILITIES */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Sundry Creditors (ਵਪਾਰਕ ਲੈਣਦਾਰ ₹)
                        </label>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 rounded">ITR-4</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.sundryCreditors || ''}
                        onChange={(e) => updateField('sundryCreditors', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-semibold bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Suppliers / Trade Payables details"
                        value={bs.sundryCreditorsDetails || ''}
                        onChange={(e) => updateField('sundryCreditorsDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-700 font-bold mb-0.5">
                        Other Current Liabilities & Expenses Payable (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.otherCurrentLiabilities || ''}
                        onChange={(e) => updateField('otherCurrentLiabilities', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="e.g. Shop Rent & Electricity Payable"
                        value={bs.otherLiabilitiesDetails || ''}
                        onChange={(e) => updateField('otherLiabilitiesDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Liabilities Bar */}
              <div className="bg-[#10366b] text-white p-3 rounded-xl flex items-center justify-between shadow-xs">
                <span className="font-bold text-xs uppercase tracking-wider">
                  TOTAL LIABILITIES & CAPITAL (ਕੁੱਲ ਦੇਣਦਾਰੀਆਂ):
                </span>
                <span className="font-mono font-black text-sm tracking-wider">
                  ₹{bs.totalLiabilities.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* ======================================================== */}
            {/* COLUMN 2: ASSETS & APPLICATION OF FUNDS (ਸੰਪਤੀਆਂ ਅਤੇ ਨਕਦੀ) */}
            {/* ======================================================== */}
            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <h5 className="font-black text-[#10366b] text-xs uppercase tracking-wider">
                      B. PROPERTY & ASSETS (ਜਾਇਦਾਦ ਅਤੇ ਸੰਪਤੀਆਂ)
                    </h5>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Application of Funds
                  </span>
                </div>

                {/* 1. FIXED ASSETS BOX */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                    <span className="font-bold text-slate-800 text-xs uppercase">
                      1. Fixed Assets / WDV (ਸਥਿਰ ਸੰਪਤੀਆਂ)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">WDV: ₹{bs.netFixedAssets?.toLocaleString('en-IN') || 0}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                        Gross Fixed Assets (ਕੁੱਲ ਸੰਪਤੀ ₹)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 180000"
                        value={bs.grossFixedAssets || ''}
                        onChange={(e) => updateField('grossFixedAssets', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                        Less: Depreciation (ਘਸਾਈ ₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.depreciation || ''}
                        onChange={(e) => updateField('depreciation', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Asset details (e.g. Sewing machines, furniture, shop counter)"
                    value={bs.fixedAssetsDetails || ''}
                    onChange={(e) => updateField('fixedAssetsDetails', e.target.value)}
                    className="w-full p-1 text-[10px] border border-slate-200 rounded bg-white text-slate-700 outline-none"
                  />
                </div>

                {/* 2. CURRENT ASSETS (ITR-4 SPECIFIC) */}
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    
                    {/* Closing Stock */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Stock-in-trade / Inventories (ਕਲੋਜ਼ਿੰਗ ਸਟਾਕ ₹)
                        </label>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 rounded">ITR-4</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.closingStock || ''}
                        onChange={(e) => updateField('closingStock', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-semibold bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                    </div>

                    {/* Sundry Debtors */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Sundry Debtors (ਵਪਾਰਕ ਦੇਣਦਾਰ ₹)
                        </label>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 rounded">ITR-4</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.sundryDebtors || ''}
                        onChange={(e) => updateField('sundryDebtors', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-semibold bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Debtors details (e.g. Customer Suit Receivables)"
                        value={bs.sundryDebtorsDetails || ''}
                        onChange={(e) => updateField('sundryDebtorsDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 outline-none"
                      />
                    </div>

                    {/* Cash in Hand */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Cash in Hand (ਨਕਦ ਬਕਾਇਆ ₹)
                        </label>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 rounded">ITR-4</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.cashInHand || ''}
                        onChange={(e) => updateField('cashInHand', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-amber-300 rounded font-mono font-black bg-amber-50/40 text-amber-950 focus:border-amber-500 outline-none"
                      />
                    </div>

                    {/* Bank Balances */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-700 font-bold">
                          Balance with Banks (ਬੈਂਕ ਬੈਲੇਂਸ ₹)
                        </label>
                        <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 rounded">ITR-4</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.bankBalances || ''}
                        onChange={(e) => updateField('bankBalances', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-semibold bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Bank account info"
                        value={bs.bankBalancesDetails || `${clientBankName} (A/c ${clientAccountNumber})`}
                        onChange={(e) => updateField('bankBalancesDetails', e.target.value)}
                        className="w-full mt-1 p-1 text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-700 outline-none"
                      />
                    </div>

                    {/* Investments & Other Advances */}
                    <div>
                      <label className="block text-[10px] text-slate-700 font-bold mb-0.5">
                        Investments (FDR / Shares / Mutual Funds ₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.investments || ''}
                        onChange={(e) => updateField('investments', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-700 font-bold mb-0.5">
                        Loans, Advances & Security Deposits (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={bs.loansAndAdvances || ''}
                        onChange={(e) => updateField('loansAndAdvances', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono bg-white text-slate-900 focus:border-blue-600 outline-none"
                      />
                    </div>

                  </div>
                </div>
              </div>

              {/* Total Assets Bar */}
              <div className="bg-[#10366b] text-white p-3 rounded-xl flex items-center justify-between shadow-xs">
                <span className="font-bold text-xs uppercase tracking-wider">
                  TOTAL PROPERTY & ASSETS (ਕੁੱਲ ਜਾਇਦਾਦ):
                </span>
                <span className="font-mono font-black text-sm tracking-wider">
                  ₹{bs.totalAssets.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
