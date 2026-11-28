import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Edit3, 
  Scale, 
  FileSpreadsheet, 
  ArrowLeft, 
  Send,
  Lock,
  Unlock,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  CreditCard,
  Sparkles,
  Globe,
  Camera
} from 'lucide-react';
import { TaxComputation, FirmDetails, Language, TaxRegime } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { formatINR, generateComputationPdf, printComputationPdf } from '../utils/pdfGenerator';
import { exportSingleComputationToExcel } from '../utils/excelExporter';
import { recalculateFullComputation } from '../utils/taxCalculator';
import { BalanceSheetSection } from './BalanceSheetSection';
import { ITREligibilityBanner } from './ITREligibilityBanner';
import { TaxPaymentsChallanSection } from './TaxPaymentsChallanSection';

interface ComputationSheetProps {
  computation: TaxComputation;
  firm: FirmDetails;
  lang: Language;
  onUpdateComputation: (updated: TaxComputation) => void;
  onOpenEditModal: () => void;
  onOpenCompareModal: () => void;
  onOpenWhatsAppModal: () => void;
  onOpenAiScannerModal?: () => void;
  onOpenPortalSyncModal?: () => void;
  onBackToUpload: () => void;
}

export const ComputationSheet: React.FC<ComputationSheetProps> = ({
  computation,
  firm,
  lang,
  onUpdateComputation,
  onOpenEditModal,
  onOpenCompareModal,
  onOpenWhatsAppModal,
  onOpenAiScannerModal,
  onOpenPortalSyncModal,
  onBackToUpload,
}) => {
  const t = TRANSLATIONS[lang];
  const [copied, setCopied] = useState(false);

  // Toggle Table Protection
  const handleToggleProtection = () => {
    const isCurrentlyProtected = computation.isTableProtected ?? true;
    onUpdateComputation({
      ...computation,
      isTableProtected: !isCurrentlyProtected
    });
  };

  // Switch Regime
  const handleToggleRegime = (regime: TaxRegime) => {
    const updated = recalculateFullComputation({
      ...computation,
      regimeOpted: regime,
    });
    onUpdateComputation(updated);
  };

  // Switch Gender (Male / Female / Senior Citizen)
  const handleToggleGender = (gender: 'Male' | 'Female' | 'Senior Citizen') => {
    const updated = recalculateFullComputation({
      ...computation,
      client: {
        ...computation.client,
        gender,
      },
    });
    onUpdateComputation(updated);
  };

  // Copy Short Summary text
  const handleCopySummary = () => {
    const challanCount = computation.taxesPaid?.challans?.length || 0;
    const settlementOutcome = computation.finalSettlement?.settlementStatus || (computation.refundDue > 0 ? 'REFUND DUE' : computation.netTaxPayable > 0 ? 'ADDITIONAL TAX PAYABLE' : 'NO TAX PAYABLE / NO REFUND');
    const summaryText = `*INCOME TAX COMPUTATION STATEMENT (A.Y. ${computation.assessmentYear})*
---------------------------------------
👤 *Client:* ${computation.client.name}
🪪 *PAN:* ${computation.client.pan}
📋 *ITR Form:* ${computation.itrForm || 'ITR-4 (SUGAM)'} (${computation.regimeOpted === 'new' ? 'New Regime u/s 115BAC' : 'Old Regime'})
📅 *Filing Date:* ${computation.filingDate || '31-Jul-2026'} | *Ack No:* ${computation.acknowledgementNumber || '---'}

💰 *Gross Total Income (GTI):* ${formatINR(computation.grossTotalIncome)}
🎯 *Total Taxable Income:* ${formatINR(computation.totalTaxableIncome)}
📊 *Total Tax Liability:* ${formatINR(computation.grossTaxLiability)}
⚖️ *Interest (234A/B/C) & Fee (234F):* ${formatINR((computation.interest234A || 0) + (computation.interest234B || 0) + (computation.interest234C || 0))} + Fee ${formatINR(computation.fee234F || 0)}
💳 *Eligible Tax Credits (${challanCount} Challans):* ${formatINR(computation.finalSettlement?.totalEligibleTaxCredits ?? computation.taxesPaid.totalTaxesPaid)}
📌 *Settlement Status:* ${settlementOutcome}
---------------------------------------
${
  computation.refundDue > 0
    ? `🎉 *NET REFUND DUE:* ${formatINR(computation.refundDue)}`
    : computation.netTaxPayable > 0
    ? `⚠️ *NET TAX PAYABLE:* ${formatINR(computation.netTaxPayable)}`
    : `✅ *NET TAX PAYABLE:* ₹0 (NIL)`
}
---------------------------------------
🏦 *Bank:* ${computation.client.bankName || 'Capital Small Finance Bank'} | A/c: ${computation.client.accountNumber || '---'} | IFSC: ${computation.client.ifscCode || '---'}
🏢 *Prepared by:* ${firm.firmName || 'Tax Consultancy'}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    printComputationPdf(computation, firm);
  };

  const handleDownloadPdf = () => {
    generateComputationPdf(computation, firm);
  };

  const handleExcelExport = () => {
    exportSingleComputationToExcel(computation);
  };

  // Calculations for Part B (44AD / Business)
  const biz = computation.business;
  const bizDescText = biz.businessName || biz.natureOfBusiness || 'Boutique / Stitching of Clothes (21008)';
  const tElectronic = Number(biz.turnoverDigital6) || 0;
  const pElectronic = Number(biz.profitDigital6) > 0 ? Number(biz.profitDigital6) : (tElectronic > 0 ? Math.round(tElectronic * 0.06) : 0);
  const tCash = Number(biz.turnoverCash8) || 0;
  const pCash = Number(biz.profitCash8) > 0 ? Number(biz.profitCash8) : (tCash > 0 ? Math.round(tCash * 0.08) : 0);
  const tOther = Number(biz.turnoverOtherMode) || 0;
  const pOther = (biz.profitOtherMode !== undefined && !isNaN(Number(biz.profitOtherMode)))
    ? Number(biz.profitOtherMode) 
    : (tOther > 0 ? Math.round(tOther * ((Number(biz.otherModePercent) || 0) / 100)) : 0);

  const tTotal = (tElectronic + tCash + tOther) || Number(biz.turnoverOrGrossReceipts) || 0;
  const pTotal = Number(biz.netProfit) || (pElectronic + pCash + pOther);

  const grandTurnover = (biz.businessList && biz.businessList.length > 0)
    ? biz.businessList.reduce((sum, b) => sum + (Number(b.turnoverDigital6 || 0) + Number(b.turnoverCash8 || 0) + Number(b.turnoverOtherMode || 0)), 0)
    : tTotal;

  const grandProfit = (biz.businessList && biz.businessList.length > 0)
    ? biz.businessList.reduce((sum, b) => {
        const pDig = Number(b.profitDigital6) > 0 ? Number(b.profitDigital6) : Math.round((Number(b.turnoverDigital6) || 0) * 0.06);
        const pCsh = Number(b.profitCash8) > 0 ? Number(b.profitCash8) : Math.round((Number(b.turnoverCash8) || 0) * 0.08);
        const pOth = (b.profitOtherMode !== undefined && !isNaN(Number(b.profitOtherMode)))
          ? Number(b.profitOtherMode)
          : Math.round((Number(b.turnoverOtherMode) || 0) * ((Number(b.otherModePercent) || 0) / 100));
        return sum + (pDig + pCsh + pOth);
      }, 0)
    : pTotal;

  // Calculations for Part D (Slabs)
  const isAY2627 = computation.assessmentYear === '2026-27';
  const taxableTotal = computation.totalTaxableIncome;
  const slabHeaderLimit = isAY2627 ? '0 TO ₹4,00,000 SLAB' : computation.regimeOpted === 'new' ? '0 TO ₹3,00,000 SLAB' : 'OLD REGIME SLAB';

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 space-y-4 font-sans text-slate-800">
      
      {/* Top Action Toolbar (Hidden during Print) */}
      <div className="no-print bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Left: Back & Regime Switch */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onBackToUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-xs border border-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Upload Another</span>
          </button>

          {/* Regime Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => handleToggleRegime('new')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                computation.regimeOpted === 'new'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Regime (115BAC)
            </button>
            <button
              onClick={() => handleToggleRegime('old')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                computation.regimeOpted === 'old'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Old Tax Regime
            </button>
          </div>

          {/* Gender Quick Tick Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => handleToggleGender('Male')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${
                computation.client.gender === 'Male'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Select Male (ਪੁਰਸ਼)"
            >
              <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${
                computation.client.gender === 'Male' ? 'bg-white text-blue-700 font-black' : 'border border-slate-300'
              }`}>
                {computation.client.gender === 'Male' ? '✓' : ''}
              </span>
              <span>Male</span>
            </button>
            <button
              onClick={() => handleToggleGender('Female')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${
                (computation.client.gender === 'Female' || !computation.client.gender)
                  ? 'bg-pink-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Select Female (ਔਰਤ)"
            >
              <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${
                (computation.client.gender === 'Female' || !computation.client.gender) ? 'bg-white text-pink-700 font-black' : 'border border-slate-300'
              }`}>
                {(computation.client.gender === 'Female' || !computation.client.gender) ? '✓' : ''}
              </span>
              <span>Female</span>
            </button>
          </div>

          <button
            onClick={onOpenCompareModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-xs border border-indigo-200 transition"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Compare Regimes</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {onOpenAiScannerModal && (
            <button
              onClick={onOpenAiScannerModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-400/60 text-xs font-bold transition cursor-pointer active:scale-95"
              title="Upload PAN, Aadhaar, and Bank Passbook photos to extract data automatically"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>AI Photo Scan</span>
            </button>
          )}

          {onOpenPortalSyncModal && (
            <button
              onClick={onOpenPortalSyncModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:bg-emerald-500/20 text-emerald-900 border border-emerald-400/60 text-xs font-bold transition cursor-pointer active:scale-95"
              title="1-Click Income Tax Portal Data Sync"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>Portal Sync</span>
            </button>
          )}

          <button
            onClick={handleToggleProtection}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              (computation.isTableProtected ?? true)
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title={(computation.isTableProtected ?? true) ? 'Table is Protected (Strict 1-Page Layout)' : 'Table is Unlocked'}
          >
            {(computation.isTableProtected ?? true) ? (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Protected Table</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-amber-700" />
                <span>Unlock Table</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenEditModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs hover:shadow-sm cursor-pointer"
            title="Edit Assessee Profile, Multi-Bank Accounts, Income & Deductions"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-300" />
            <span>Edit Client / Data (ਕਲਾਇੰਟ ਐਡਿਟ ਕਰੋ)</span>
          </button>

          <button
            onClick={onOpenEditModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border cursor-pointer ${
              computation.balanceSheet?.enabled !== false
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="Add or Edit Schedule Balance Sheet (ਸੰਤੁਲਨ ਸ਼ੀਟ)"
          >
            <Scale className="w-3.5 h-3.5 text-amber-700" />
            <span>Balance Sheet (ਬੈਲੇਂਸ ਸ਼ੀਟ)</span>
          </button>

          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={onOpenWhatsAppModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-98"
            title="Send 1-Page PDF and Tax Summary to Client on WhatsApp"
          >
            <Send className="w-3.5 h-3.5 text-emerald-200" />
            <span>WhatsApp PDF</span>
          </button>

          <button
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>1-Page PDF</span>
          </button>
        </div>
      </div>

      {/* ITR FORM ELIGIBILITY & STATUTORY VALIDATION BANNER */}
      <div className="no-print max-w-4xl mx-auto">
        <ITREligibilityBanner 
          computation={computation} 
          onUpdateComputation={onUpdateComputation} 
          onOpenEditModal={onOpenEditModal} 
        />
      </div>

      {/* ========================================================================= */}
      {/* EXACT SAME-TO-SAME COMPUTATION SHEET (Matches screenshot precisely) */}
      {/* ========================================================================= */}
      <div 
        id="printable-computation"
        className="print-page bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-md max-w-4xl mx-auto text-slate-800 space-y-3.5 overflow-hidden text-[11px]"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}
      >
        {/* TOP CENTERED HEADER */}
        <div className="text-center pb-2 border-b-2 border-[#10366b] space-y-0.5">
          <h1 className="text-[17px] font-black text-[#10366b] tracking-tight uppercase">
            INCOME TAX COMPUTATION STATEMENT
          </h1>
          <p className="text-[12px] font-bold text-[#10366b]">
            Assessment Year {computation.assessmentYear || '2026-27'} | Financial Year {computation.financialYear || '2025-26'}
          </p>
          <p className="text-[10px] text-slate-600 font-medium">
            (Prepared from Form {(computation.itrForm || 'ITR-4 SUGAM').toUpperCase()} filed u/s {(computation.filingSection ? computation.filingSection.split(' - ')[0] : '139(1)')})
          </p>
        </div>

        {/* PART A: PERSONAL & FILING INFORMATION */}
        <div className="space-y-1">
          <div className="bg-[#f0f4ff] px-2.5 py-1 rounded-t border border-[#cbd5e1] border-b-0 flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART A: PERSONAL & FILING INFORMATION
            </h2>
            <button
              type="button"
              onClick={onOpenEditModal}
              className="no-print inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-300 shadow-2xs hover:bg-blue-50 transition cursor-pointer"
              title="Edit Assessee Profile Details (ਕਲਾਇੰਟ ਜਾਣਕਾਰੀ ਬਦਲੋ)"
            >
              <Edit3 className="w-3 h-3" />
              <span>ਕਲਾਇੰਟ ਐਡਿਟ ਕਰੋ (Edit Client)</span>
            </button>
          </div>
          <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
            <table className="w-full border-collapse text-[10.5px]">
              <tbody>
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="w-1/4 px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Assessee Name:</td>
                  <td className="w-1/4 px-2.5 py-1 font-bold text-slate-900 border-r border-[#cbd5e1]">{(computation.client.name || 'SARABJIT KAUR').toUpperCase()}</td>
                  <td className="w-1/4 px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">PAN:</td>
                  <td className="w-1/4 px-2.5 py-1 font-bold text-slate-900">{(computation.client.pan || 'HSIPK5617N').toUpperCase()}</td>
                </tr>
                <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Father's Name:</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">{(computation.client.fatherName || 'MUKHTIAR SINGH').toUpperCase()}</td>
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Status / Gender:</td>
                  <td className="px-2.5 py-1 text-slate-800">
                    <div className="flex items-center justify-between gap-1">
                      <span>{computation.client.status || 'Individual'} / <strong>{computation.client.gender || 'Female'}</strong></span>
                      <div className="no-print inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleGender('Male')}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition cursor-pointer ${
                            computation.client.gender === 'Male'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                          title="Tick Male"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full inline-flex items-center justify-center text-[7.5px] ${
                            computation.client.gender === 'Male' ? 'bg-white text-blue-700' : 'border border-slate-400'
                          }`}>
                            {computation.client.gender === 'Male' ? '✓' : ''}
                          </span>
                          M
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleGender('Female')}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition cursor-pointer ${
                            (computation.client.gender === 'Female' || !computation.client.gender)
                              ? 'bg-pink-600 text-white border-pink-700 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-pink-50 hover:text-pink-700'
                          }`}
                          title="Tick Female"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full inline-flex items-center justify-center text-[7.5px] ${
                            (computation.client.gender === 'Female' || !computation.client.gender) ? 'bg-white text-pink-700' : 'border border-slate-400'
                          }`}>
                            {(computation.client.gender === 'Female' || !computation.client.gender) ? '✓' : ''}
                          </span>
                          F
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Date of Birth:</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">{computation.client.dob || '15/04/1981'}</td>
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Tax Regime:</td>
                  <td className="px-2.5 py-1 text-slate-800">{computation.regimeOpted === 'new' ? 'New Tax Regime u/s 115BAC' : 'Old Tax Regime'}</td>
                </tr>
                <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">ITR Form Type:</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">{(computation.itrForm || 'ITR-4 (SUGAM)').toUpperCase()}</td>
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Section Filed U/s:</td>
                  <td className="px-2.5 py-1 text-slate-800">{computation.filingSection || '139(1) - On or before due date'}</td>
                </tr>
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Ack. Number:</td>
                  <td className="px-2.5 py-1 font-bold text-slate-900 border-r border-[#cbd5e1]">{computation.acknowledgementNumber || '923925200310726'}</td>
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1]">Date of Filing:</td>
                  <td className="px-2.5 py-1 text-slate-800">{computation.filingDate || '31-Jul-2026'}</td>
                </tr>
                <tr className="bg-[#f8fafc]">
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1] align-top">Mobile / Email:</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1] align-top">
                    <div>{computation.client.mobile || '8146463219'}</div>
                    <div className="text-slate-600">{computation.client.email || 'poonianranjeet@gmail.com'}</div>
                  </td>
                  <td className="px-2.5 py-1 font-bold text-[#10366b] border-r border-[#cbd5e1] align-top">Address:</td>
                  <td className="px-2.5 py-1 text-slate-800 align-top">
                    {computation.client.address || 'C/O RANJIT SINGH, VILLAGE POONIAN, POONIAN B.O, PUNIAN, JALANDHAR, PUNJAB - 144702'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PART B: PRESUMPTIVE BUSINESS INCOME (U/S 44AD) */}
        <div className="space-y-1">
          <div className="bg-[#f0f4ff] px-2.5 py-1 rounded-t border border-[#cbd5e1] border-b-0">
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART B: PRESUMPTIVE BUSINESS INCOME (U/S 44AD)
            </h2>
          </div>
          <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-[#10366b] text-white">
                  <th className="px-2.5 py-1.5 text-left font-bold border-r border-blue-900/40">Business Description</th>
                  <th className="px-2.5 py-1.5 text-left font-bold border-r border-blue-900/40">Turnover Mode</th>
                  <th className="w-36 px-2.5 py-1.5 text-right font-bold border-r border-blue-900/40 whitespace-nowrap">Gross Receipts (₹)</th>
                  <th className="w-36 px-2.5 py-1.5 text-right font-bold whitespace-nowrap">Net Income (₹)</th>
                </tr>
              </thead>
              <tbody>
                {biz.businessList && biz.businessList.length > 0 ? (
                  biz.businessList.map((bItem, bIdx) => {
                    const bTrade = bItem.businessName || bItem.tradeName || '';
                    const bCode = bItem.businessCode ? `Code: ${bItem.businessCode}` : '';
                    const bNature = bItem.natureOfBusiness || '';
                    const bDesc = bItem.businessDescription && bItem.businessDescription !== bNature ? bItem.businessDescription : '';
                    const bAddress = bItem.businessAddress || '';

                    const renderBizCell = () => (
                      <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                        <div className="font-bold text-slate-900 leading-tight">
                          {bTrade || bNature || `Business #${bIdx + 1}`}
                        </div>
                        {(bCode || bNature) && (
                          <div className="text-[9.5px] text-slate-600 font-medium">
                            {bCode && <span className="text-[#10366b] font-bold mr-1">[{bCode}]</span>}
                            {bNature && <span>{bNature}</span>}
                          </div>
                        )}
                        {bDesc && (
                          <div className="text-[9px] text-slate-500 italic leading-snug">{bDesc}</div>
                        )}
                        {bAddress && (
                          <div className="text-[9px] text-slate-600 font-normal leading-snug">
                            <span className="font-semibold text-slate-700">Add: </span>{bAddress}
                          </div>
                        )}
                      </td>
                    );

                    const tDig = Number(bItem.turnoverDigital6) || 0;
                    const pDig = Number(bItem.profitDigital6) || (tDig > 0 ? Math.round(tDig * 0.06) : 0);
                    const tCash = Number(bItem.turnoverCash8) || 0;
                    const pCash = Number(bItem.profitCash8) || (tCash > 0 ? Math.round(tCash * 0.08) : 0);
                    const tOth = Number(bItem.turnoverOtherMode) || 0;
                    const pOth = (bItem.profitOtherMode !== undefined && !isNaN(Number(bItem.profitOtherMode)))
                      ? Number(bItem.profitOtherMode) 
                      : (tOth > 0 ? Math.round(tOth * ((Number(bItem.otherModePercent) || 0) / 100)) : 0);

                    return (
                      <React.Fragment key={bItem.id || bIdx}>
                        {tDig > 0 ? (
                          <tr className="border-b border-[#cbd5e1] bg-white">
                            {renderBizCell()}
                            <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Electronic Modes (6%)</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(tDig).toLocaleString('en-IN')}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pDig).toLocaleString('en-IN')}</td>
                          </tr>
                        ) : null}
                        {(tCash > 0 || (tDig === 0 && tOth === 0 && (bItem.totalTurnover || 0) > 0)) ? (
                          <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                            {renderBizCell()}
                            <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Cash Modes (8%)</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(tCash || (bItem.totalTurnover || 0)).toLocaleString('en-IN')}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pCash || (bItem.netProfit || 0)).toLocaleString('en-IN')}</td>
                          </tr>
                        ) : null}
                        {tOth > 0 ? (
                          <tr className="border-b border-[#cbd5e1] bg-white">
                            {renderBizCell()}
                            <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Other Modes ({bItem.otherModePercent ?? 0}%)</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(tOth).toLocaleString('en-IN')}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pOth).toLocaleString('en-IN')}</td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <>
                    {tElectronic > 0 ? (
                      <tr className="border-b border-[#cbd5e1] bg-white">
                        <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                          <div className="font-bold text-slate-900">{bizDescText}</div>
                          {biz.businessCode && <div className="text-[9.5px] text-[#10366b] font-bold">[Code: {biz.businessCode}]</div>}
                          {biz.businessAddress && <div className="text-[9px] text-slate-600">Add: {biz.businessAddress}</div>}
                        </td>
                        <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Electronic Modes (6%)</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(tElectronic).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pElectronic).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                    {(tCash > 0 || (tElectronic === 0 && tOther === 0 && tTotal > 0)) ? (
                      <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                        <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                          <div className="font-bold text-slate-900">{bizDescText}</div>
                          {biz.businessCode && <div className="text-[9.5px] text-[#10366b] font-bold">[Code: {biz.businessCode}]</div>}
                          {biz.businessAddress && <div className="text-[9px] text-slate-600">Add: {biz.businessAddress}</div>}
                        </td>
                        <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Cash Modes (8%)</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(tCash || tTotal).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pCash || pTotal).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                    {(biz.turnoverOtherMode && biz.turnoverOtherMode > 0) ? (
                      <tr className="border-b border-[#cbd5e1] bg-white">
                        <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                          <div className="font-bold text-slate-900">{bizDescText}</div>
                          {biz.businessCode && <div className="text-[9.5px] text-[#10366b] font-bold">[Code: {biz.businessCode}]</div>}
                          {biz.businessAddress && <div className="text-[9px] text-slate-600">Add: {biz.businessAddress}</div>}
                        </td>
                        <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Through Other Modes ({biz.otherModePercent ?? 0}%)</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{Number(biz.turnoverOtherMode).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(pOther).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                  </>
                )}
                {/* Summary Row */}
                <tr className="bg-[#f0f4ff] font-bold text-slate-900">
                  <td colSpan={2} className="px-2.5 py-1 uppercase border-r border-[#cbd5e1]">TOTAL PRESUMPTIVE BUSINESS INCOME (u/s 44AD)</td>
                  <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]">{Number(grandTurnover).toLocaleString('en-IN')}</td>
                  <td className="px-2.5 py-1 text-right font-mono">{Number(grandProfit).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PART C: COMPUTATION OF TOTAL TAXABLE INCOME */}
        <div className="space-y-1">
          <div className="bg-[#f0f4ff] px-2.5 py-1 rounded-t border border-[#cbd5e1] border-b-0">
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART C: COMPUTATION OF TOTAL TAXABLE INCOME
            </h2>
          </div>
          <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-[#10366b] text-white">
                  <th className="px-2.5 py-1 text-left font-bold border-r border-blue-900/40">Head of Income / Particulars</th>
                  <th className="w-32 px-2.5 py-1 text-right font-bold border-r border-blue-900/40">Details (₹)</th>
                  <th className="w-32 px-2.5 py-1 text-right font-bold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {/* Salary Section in Part C (Full Multi-Employer Iteration) */}
                {(() => {
                  const grossSal = Number(computation.salary.grossSalary) || (Number(computation.salary.salarySection17_1 || 0) + Number(computation.salary.perquisites17_2 || 0) + Number(computation.salary.profitsInLieu17_3 || 0));
                  const netSal = Number(computation.salary.netSalary) || 0;
                  const salaryEntries = (computation.salary.salaryList && computation.salary.salaryList.length > 0)
                    ? computation.salary.salaryList
                    : (grossSal > 0 || netSal > 0 || (computation.salary.salarySection17_1 || 0) > 0)
                      ? [{
                          id: 'default_1',
                          employerName: computation.salary.employerName || 'Primary Employer',
                          employerTAN: computation.salary.employerTAN || '',
                          employerType: (computation.salary.employerType as any) || 'Private',
                          grossSalary: grossSal,
                          salarySection17_1: Number(computation.salary.salarySection17_1) || grossSal,
                          perquisites17_2: Number(computation.salary.perquisites17_2) || 0,
                          profitsInLieu17_3: Number(computation.salary.profitsInLieu17_3) || 0,
                          allowancesExempt: Number(computation.salary.allowancesExempt) || 0,
                          professionalTax: Number(computation.salary.professionalTax) || 0,
                          entertainmentAllowance: Number(computation.salary.entertainmentAllowance) || 0,
                          taxableSalaryBeforeStdDed: Math.max(0, grossSal - (Number(computation.salary.allowancesExempt) || 0) - (Number(computation.salary.professionalTax) || 0) - (Number(computation.salary.entertainmentAllowance) || 0)),
                          tdsSalary: Number(computation.taxesPaid.tdsSalary) || 0,
                          verificationStatus: 'Verified',
                        }]
                      : [];

                  if (salaryEntries.length === 0) return null;

                  const isMulti = salaryEntries.length > 1;
                  const empHeader = isMulti 
                    ? ` [Schedule Salary: ${salaryEntries.length} Employers]`
                    : (computation.salary.employerName ? ` [Employer: ${computation.salary.employerName}${computation.salary.employerType ? ` (${computation.salary.employerType})` : ''}]` : '');

                  const stdDedAmt = Number(computation.salary.standardDeduction || (computation.regimeOpted === 'new' ? Math.min(grossSal, (computation.assessmentYear?.includes('2024-25') ? 50000 : 75000)) : Math.min(grossSal, 50000)));
                  const stdDedLabel = computation.regimeOpted === 'new' ? `New Regime (Max ₹${(computation.assessmentYear?.includes('2024-25') ? 50000 : 75000).toLocaleString('en-IN')})` : 'Old Regime (Max ₹50,000)';

                  return (
                    <>
                      <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                        <td className="px-2.5 py-1 text-slate-800 font-bold border-r border-[#cbd5e1]">
                          1. Income from Salaries (Schedule Salary / Sec 15-17){empHeader}
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]"></td>
                        <td className="px-2.5 py-1 text-right font-mono font-bold text-slate-900">{Number(computation.salary.netSalary).toLocaleString('en-IN')}</td>
                      </tr>

                      {/* Employer-by-Employer breakdown */}
                      {salaryEntries.map((entry, idx) => {
                        const empNum = idx + 1;
                        const empName = entry.employerName || `Employer ${empNum}`;
                        const tanText = entry.employerTAN ? ` | TAN: ${entry.employerTAN}` : '';
                        const panText = entry.employerPAN ? ` | PAN: ${entry.employerPAN}` : '';
                        const natureText = entry.natureOfEmployment ? ` | Nature: ${entry.natureOfEmployment}` : '';
                        const datesText = (entry.fromDate || entry.toDate) ? ` | Period: ${entry.fromDate || 'N/A'} to ${entry.toDate || 'N/A'}` : '';
                        const empTypeBadge = entry.employerType ? ` (${entry.employerType})` : '';

                        const arrAmt = Number(entry.arrears || entry.salaryArrears || 0);
                        const entryGross = Number(entry.grossSalary) || (Number(entry.basicSalary || 0) + Number(entry.dearnessAllowance || 0) + Number(entry.hra || 0) + Number(entry.otherAllowances || 0) + Number(entry.bonus || 0) + Number(entry.commission || 0) + arrAmt + Number(entry.perquisites17_2 || 0) + Number(entry.profitsInLieu17_3 || 0));
                        const empTaxable = entry.taxableSalaryBeforeStdDed !== undefined 
                          ? Number(entry.taxableSalaryBeforeStdDed) 
                          : Math.max(0, entryGross - Number(entry.allowancesExempt || 0) - Number(entry.professionalTax || 0) - Number(entry.entertainmentAllowance || 0));

                        return (
                          <React.Fragment key={entry.id || idx}>
                            {/* Employer Header */}
                            <tr className="border-b border-[#cbd5e1] bg-[#f0f7ff] text-[10px] font-bold text-[#10366b]">
                              <td className="px-2.5 py-1 pl-4 border-r border-[#cbd5e1]" colSpan={2}>
                                ▶ EMPLOYER {empNum}: {empName.toUpperCase()}{empTypeBadge}
                                <span className="block text-[9px] font-normal text-slate-500">
                                  TAN: {entry.employerTAN || 'N/A'}{panText}{natureText}{datesText}
                                </span>
                              </td>
                              <td className="px-2.5 py-1 text-right font-mono text-slate-600 border-r border-[#cbd5e1]"></td>
                            </tr>

                            {/* Components if available */}
                            {Number(entry.basicSalary) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Basic Salary</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.basicSalary).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.dearnessAllowance) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Dearness Allowance (DA)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.dearnessAllowance).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.hra) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• House Rent Allowance (HRA Received)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.hra).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.bonus) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Bonus / Ex-gratia</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.bonus).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.commission) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Commission</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.commission).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.otherAllowances) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Other Allowances</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.otherAllowances).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {arrAmt > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Salary Arrears{entry.arrearsRelatingFY ? ` (F.Y. ${entry.arrearsRelatingFY})` : ''}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{arrAmt.toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.perquisites17_2) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Value of Perquisites u/s 17(2){entry.perquisiteDetails ? ` (${entry.perquisiteDetails})` : ''}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.perquisites17_2).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                            {Number(entry.profitsInLieu17_3) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Profits in lieu of Salary u/s 17(3)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-slate-800 border-r border-[#cbd5e1]">{Number(entry.profitsInLieu17_3).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}

                            {/* Gross Salary u/s 17(1) for this Employer */}
                            <tr className="border-b border-[#cbd5e1] bg-[#f8fafc] text-[10px] font-semibold">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-7 border-r border-[#cbd5e1]">• Gross Salary u/s 17(1) for this Employer</td>
                              <td className="px-2.5 py-0.5 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">{entryGross.toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>

                            {/* Exemptions u/s 10 */}
                            {Number(entry.allowancesExempt) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Less: Exempt Allowances u/s 10 (HRA / LTA etc.)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-rose-700 border-r border-[#cbd5e1]">(-) {Number(entry.allowancesExempt).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}

                            {/* Professional Tax */}
                            {Number(entry.professionalTax) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-slate-700 pl-7 border-r border-[#cbd5e1]">• Less: Professional Tax u/s 16(iii)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-rose-700 border-r border-[#cbd5e1]">(-) {Number(entry.professionalTax).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}

                            {/* Employer Subtotal */}
                            <tr className="border-b border-[#cbd5e1] bg-white text-[10px] font-semibold text-slate-800">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-7 border-r border-[#cbd5e1]">= Taxable Salary from Employer {empNum} (Before Std Ded)</td>
                              <td className="px-2.5 py-0.5 text-right font-mono text-[#10366b] border-r border-[#cbd5e1]">{empTaxable.toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>

                            {/* TDS Deducted u/s 192 */}
                            {Number(entry.tdsSalary) > 0 && (
                              <tr className="border-b border-[#cbd5e1] bg-blue-50/40 text-[9.5px]">
                                <td className="px-2.5 py-0.5 text-blue-800 pl-7 border-r border-[#cbd5e1]">• TDS Deducted by Employer {empNum} u/s 192 (Tax Credit)</td>
                                <td className="px-2.5 py-0.5 text-right font-mono text-blue-700 border-r border-[#cbd5e1]">{Number(entry.tdsSalary).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Summary Section across all employers */}
                      <tr className="border-b border-[#cbd5e1] bg-[#eef4ff] text-[10px] font-bold text-[#10366b]">
                        <td className="px-2.5 py-1 pl-4 border-r border-[#cbd5e1]" colSpan={2}>
                          === SALARY SUMMARY — ALL EMPLOYERS ===
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono"></td>
                      </tr>

                      <tr className="border-b border-[#cbd5e1] bg-white text-[10px]">
                        <td className="px-2.5 py-0.5 text-slate-800 font-semibold pl-6 border-r border-[#cbd5e1]">• Total Gross Salary Across All Employers</td>
                        <td className="px-2.5 py-0.5 text-right font-mono font-semibold text-slate-900 border-r border-[#cbd5e1]">{grossSal.toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>

                      {Number(computation.salary.allowancesExempt) > 0 && (
                        <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                          <td className="px-2.5 py-0.5 text-slate-700 pl-6 border-r border-[#cbd5e1]">• Less: Total Allowances Exempt u/s 10</td>
                          <td className="px-2.5 py-0.5 text-right font-mono text-rose-700 border-r border-[#cbd5e1]">(-) {Number(computation.salary.allowancesExempt).toLocaleString('en-IN')}</td>
                          <td className="px-2.5 py-0.5 text-right font-mono"></td>
                        </tr>
                      )}

                      {Number(computation.salary.professionalTax) > 0 && (
                        <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                          <td className="px-2.5 py-0.5 text-slate-700 pl-6 border-r border-[#cbd5e1]">• Less: Total Professional Tax u/s 16(iii)</td>
                          <td className="px-2.5 py-0.5 text-right font-mono text-rose-700 border-r border-[#cbd5e1]">(-) {Number(computation.salary.professionalTax).toLocaleString('en-IN')}</td>
                          <td className="px-2.5 py-0.5 text-right font-mono"></td>
                        </tr>
                      )}

                      {/* Less: Standard Deduction u/s 16(ia) - Applied ONCE at taxpayer level */}
                      <tr className="border-b border-[#cbd5e1] bg-white text-[10px]">
                        <td className="px-2.5 py-0.5 text-emerald-800 font-semibold pl-6 border-r border-[#cbd5e1]">
                          • Less: Standard Deduction u/s 16(ia) [{stdDedLabel} - Applied ONCE at Taxpayer Level]
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono font-bold text-emerald-800 border-r border-[#cbd5e1]">
                          (-) {stdDedAmt.toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>

                      {/* Net Taxable Salary row */}
                      <tr className="border-b border-[#cbd5e1] bg-[#f0f4ff] text-slate-900 text-[10px] font-bold">
                        <td className="px-2.5 py-0.5 text-[#10366b] pl-6 border-r border-[#cbd5e1]">
                          = Net Chargeable Income under 'Salaries' (u/s 15-17)
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-[#10366b] border-r border-[#cbd5e1]">
                          {Number(computation.salary.netSalary).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono font-bold text-[#10366b]">
                          {Number(computation.salary.netSalary).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </>
                  );
                })()}
                {/* Capital Gains Section in Part C */}
                {((computation.capitalGains.netCapitalGains || 0) > 0 || (computation.capitalGains.stcg111A || 0) > 0 || (computation.capitalGains.stcgNormal || 0) > 0 || (computation.capitalGains.ltcg112A || 0) > 0 || (computation.capitalGains.ltcg112 || 0) > 0 || (computation.capitalGains.stcg15 || 0) > 0 || (computation.capitalGains.ltcg10 || 0) > 0 || (computation.capitalGains.ltcg20 || 0) > 0) ? (
                  <>
                    <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                      <td className="px-2.5 py-1 text-slate-800 font-medium border-r border-[#cbd5e1]">
                        Income from Capital Gains (Schedule CG)
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]"></td>
                      <td className="px-2.5 py-1 text-right font-mono font-semibold text-slate-900">
                        {Number(computation.capitalGains.netCapitalGains || ((computation.capitalGains.stcg111A || computation.capitalGains.stcg15 || 0) + (computation.capitalGains.stcgNormal || 0) + (computation.capitalGains.ltcg112A || computation.capitalGains.ltcg10 || 0) + (computation.capitalGains.ltcg112 || computation.capitalGains.ltcg20 || 0))).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    {(Number(computation.capitalGains.stcg111A || computation.capitalGains.stcg15) > 0) && (
                      <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                        <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                          • Short-Term Capital Gains u/s 111A (STT Paid Equity / Mutual Funds @ {isAY2627 ? '20%' : '15%'})
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">
                          {Number(computation.capitalGains.stcg111A || computation.capitalGains.stcg15).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>
                    )}
                    {Number(computation.capitalGains.stcgNormal) > 0 && (
                      <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                        <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                          • Other Short-Term Capital Gains (Taxable at Applicable Normal Slab Rates)
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">
                          {Number(computation.capitalGains.stcgNormal).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>
                    )}
                    {(Number(computation.capitalGains.ltcg112A || computation.capitalGains.ltcg10) > 0) && (
                      <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                        <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                          • Long-Term Capital Gains u/s 112A (Listed Equity/MF over ₹{isAY2627 ? '1.25L' : '1.00L'} @ {isAY2627 ? '12.5%' : '10%'})
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">
                          {Number(computation.capitalGains.ltcg112A || computation.capitalGains.ltcg10).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>
                    )}
                    {(Number(computation.capitalGains.ltcg112 || computation.capitalGains.ltcg20) > 0) && (
                      <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                        <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                          • Long-Term Capital Gains u/s 112 (Unlisted/Immovable Property @ {isAY2627 ? '12.5%' : '20%'})
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900 border-r border-[#cbd5e1]">
                          {Number(computation.capitalGains.ltcg112 || computation.capitalGains.ltcg20).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>
                    )}
                    {(Number(computation.capitalGains.stclSetOff) > 0 || Number(computation.capitalGains.ltclSetOff) > 0) && (
                      <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                        <td className="px-2.5 py-0.5 text-emerald-800 font-medium pl-5 border-r border-[#cbd5e1]">
                          • Less: Intra-Head Loss Set-Off {Number(computation.capitalGains.stclSetOff) > 0 ? `(STCL: ₹${Number(computation.capitalGains.stclSetOff).toLocaleString('en-IN')})` : ''} {Number(computation.capitalGains.ltclSetOff) > 0 ? `(LTCL: ₹${Number(computation.capitalGains.ltclSetOff).toLocaleString('en-IN')})` : ''}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-emerald-800 border-r border-[#cbd5e1]">
                          (-) {Number((computation.capitalGains.stclSetOff || 0) + (computation.capitalGains.ltclSetOff || 0)).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono"></td>
                      </tr>
                    )}
                  </>
                ) : null}

                {computation.business.netProfit > 0 ? (
                  <tr className="border-b border-[#cbd5e1] bg-white">
                    <td className="px-2.5 py-1 text-slate-800 font-medium border-r border-[#cbd5e1]">1. Profits & Gains of Business or Profession (u/s 44AD)</td>
                    <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]"></td>
                    <td className="px-2.5 py-1 text-right font-mono font-semibold text-slate-900">{Number(computation.business.netProfit).toLocaleString('en-IN')}</td>
                  </tr>
                ) : null}
                {(computation.otherSources.netOtherSources > 0 || computation.otherSources.savingsInterest > 0 || (computation.otherSources.bankInterestItems && computation.otherSources.bankInterestItems.length > 0) || (computation.otherSources.dividendIncome || 0) > 0 || (computation.otherSources.indianCompanyDividend || 0) > 0 || (computation.otherSources.mutualFundDividend || 0) > 0 || (computation.otherSources.familyPension || 0) > 0 || (computation.otherSources.machineryHireGross || 0) > 0 || (computation.otherSources.lotteryWinnings || 0) > 0 || (computation.otherSources.otherIncomeItems && computation.otherSources.otherIncomeItems.length > 0)) ? (
                  <>
                    <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                      <td className="px-2.5 py-1 text-slate-800 font-medium border-r border-[#cbd5e1]">2. Income from Other Sources (Schedule OS)</td>
                      <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]"></td>
                      <td className="px-2.5 py-1 text-right font-mono font-semibold text-slate-900">{Number(computation.otherSources.netOtherSources).toLocaleString('en-IN')}</td>
                    </tr>

                    {/* Schedule OS Detailed Rows */}
                    {(() => {
                      const allItems = computation.otherSources.bankInterestItems || [];
                      const savingsItems = allItems.filter(it => it.interestType === 'Savings' || it.interestType === 'Post Office');
                      const fdItems = allItems.filter(it => it.interestType === 'Fixed Deposit (FD)');
                      const rdItems = allItems.filter(it => it.interestType === 'Recurring Deposit (RD)' || it.interestType === 'Other Interest');

                      const itRefundInt = Number(computation.otherSources.itRefundInterest) || 0;
                      const passThroughInt = Number(computation.otherSources.passThroughInterest) || 0;
                      const otherIntDirect = Number(computation.otherSources.otherInterestIncome) || 0;

                      const divInd = Number(computation.otherSources.indianCompanyDividend) || 0;
                      const divMf = Number(computation.otherSources.mutualFundDividend) || 0;
                      const divRaw = Number(computation.otherSources.dividendIncome) || 0;
                      const divTotal = (divInd + divMf > 0) ? (divInd + divMf) : divRaw;

                      const famPensionGross = Number(computation.otherSources.familyPension) || 0;
                      const famPensionDed = Number(computation.otherSources.familyPensionDeduction) || (famPensionGross > 0 ? Math.min(famPensionGross, Math.min(computation.regimeOpted === 'new' ? 25000 : 15000, Math.round(famPensionGross / 3))) : 0);
                      const famPensionNet = Math.max(0, famPensionGross - famPensionDed);

                      const machGross = Number(computation.otherSources.machineryHireGross) || 0;
                      const machExp = Number(computation.otherSources.machineryHireExpenses) || 0;
                      const machNet = Math.max(0, machGross - machExp);

                      const lottery = Number(computation.otherSources.lotteryWinnings) || 0;
                      const onlineGames = Number(computation.otherSources.onlineGamesWinnings) || 0;
                      const horseRaces = Number(computation.otherSources.horseRacesWinnings) || 0;
                      const unexplained = Number(computation.otherSources.unexplainedIncome115BBE) || 0;

                      const otherItemsList = computation.otherSources.otherIncomeItems || [];

                      return (
                        <>
                          {/* Savings Bank Section */}
                          {savingsItems.map((bItem, idx) => (
                            Number(bItem.amount) > 0 ? (
                              <tr key={bItem.id || `sav_${idx}`} className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                  • Savings Bank Interest ({bItem.bankName || 'Bank'}{bItem.accountNumber ? ` - A/c ${bItem.accountNumber}` : ''})
                                </td>
                                <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(bItem.amount).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            ) : null
                          ))}
                          {savingsItems.length === 0 && (computation.otherSources.savingsInterest || 0) > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Savings Bank Interest ({computation.otherSources.savingsBankName || `${computation.client.bankName || 'Bank'} - A/c ${computation.client.accountNumber || ''}`})
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(computation.otherSources.savingsInterest).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Fixed Deposit Section */}
                          {fdItems.map((bItem, idx) => (
                            Number(bItem.amount) > 0 ? (
                              <tr key={bItem.id || `fd_${idx}`} className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                  • Fixed Deposit (FD) Interest ({bItem.bankName || 'Bank'}{bItem.accountNumber ? ` - FDR/A/c ${bItem.accountNumber}` : ''})
                                </td>
                                <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(bItem.amount).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            ) : null
                          ))}
                          {fdItems.length === 0 && (computation.otherSources.fdInterest || 0) > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Fixed Deposit (FD) Interest ({computation.otherSources.fdBankName || 'Bank FD'})
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(computation.otherSources.fdInterest).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Recurring Deposit Section */}
                          {rdItems.map((bItem, idx) => (
                            Number(bItem.amount) > 0 ? (
                              <tr key={bItem.id || `rd_${idx}`} className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                  • Recurring Deposit (RD) Interest ({bItem.bankName || 'Bank'}{bItem.accountNumber ? ` - A/c ${bItem.accountNumber}` : ''})
                                </td>
                                <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(bItem.amount).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            ) : null
                          ))}
                          {rdItems.length === 0 && (computation.otherSources.rdInterest || 0) > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Recurring Deposit (RD) Interest ({computation.otherSources.rdBankName || 'Bank RD'})
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(computation.otherSources.rdInterest).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Income Tax Refund Interest u/s 244A */}
                          {itRefundInt > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Interest on Income Tax Refund u/s 244A
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(itRefundInt).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Pass-through Interest */}
                          {passThroughInt > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Pass-through Interest Income (Sec 115UA / 115UB)
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(passThroughInt).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Other Direct Interest */}
                          {otherIntDirect > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Other Direct Interest Income
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(otherIntDirect).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Dividend Income */}
                          {divTotal > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Dividend Income {divInd > 0 ? `(Companies: ₹${divInd.toLocaleString('en-IN')})` : ''} {divMf > 0 ? `(Mutual Funds: ₹${divMf.toLocaleString('en-IN')})` : ''}
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(divTotal).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Family Pension */}
                          {famPensionGross > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Family Pension (Gross: ₹{famPensionGross.toLocaleString('en-IN')} less u/s 57(iia) deduction: ₹{famPensionDed.toLocaleString('en-IN')})
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(famPensionNet).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Machinery / Plant Hire */}
                          {machGross > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Machinery/Plant/Furniture Hire (Gross: ₹{machGross.toLocaleString('en-IN')} less u/s 57 expenses: ₹{machExp.toLocaleString('en-IN')})
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(machNet).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Special Rate Winnings */}
                          {lottery > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-rose-900 pl-5 border-r border-[#cbd5e1]">
                                • Lottery / Crossword Puzzles / Betting u/s 115BB (@ 30%)
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(lottery).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}
                          {onlineGames > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-rose-900 pl-5 border-r border-[#cbd5e1]">
                                • Net Winnings from Online Games u/s 115BBJ (@ 30%)
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(onlineGames).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}
                          {horseRaces > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-rose-900 pl-5 border-r border-[#cbd5e1]">
                                • Winnings from Horse Races (@ 30%)
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(horseRaces).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}
                          {unexplained > 0 && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-rose-900 pl-5 border-r border-[#cbd5e1]">
                                • Unexplained Money / Investment u/s 115BBE (@ 60%)
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(unexplained).toLocaleString('en-IN')}</td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}

                          {/* Itemized Other Incomes */}
                          {otherItemsList.map((oItem, idx) => (
                            Number(oItem.netAmount) > 0 ? (
                              <tr key={oItem.id || `oth_${idx}`} className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                                <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                  • {oItem.category} {oItem.description ? `(${oItem.description})` : ''} {Number(oItem.deductionSec57) > 0 ? `[Gross: ₹${Number(oItem.grossAmount).toLocaleString('en-IN')} - Sec 57 Exp: ₹${Number(oItem.deductionSec57).toLocaleString('en-IN')}]` : ''}
                                </td>
                                <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">{Number(oItem.netAmount).toLocaleString('en-IN')}</td>
                                <td className="px-2.5 py-0.5 text-right font-mono"></td>
                              </tr>
                            ) : null
                          ))}

                          {/* Direct Other Income fallback */}
                          {otherItemsList.length === 0 && ((computation.otherSources.otherIncome || 0) > 0 || (computation.otherSources.anyOtherIncome || 0) > 0) && (
                            <tr className="border-b border-[#cbd5e1] bg-white text-slate-600 text-[10px]">
                              <td className="px-2.5 py-0.5 text-[#10366b] pl-5 border-r border-[#cbd5e1]">
                                • Any Other Miscellaneous Income
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono border-r border-[#cbd5e1]">
                                {Number((computation.otherSources.otherIncome || 0) + (computation.otherSources.anyOtherIncome || 0) - (computation.otherSources.anyOtherIncomeExpenses || 0)).toLocaleString('en-IN')}
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono"></td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : null}

                {/* 3. Agricultural Income (Exempt u/s 10(1)) */}
                {(() => {
                  const agriNet = computation.agriculturalIncome || computation.agriculturalDetails?.netAgriculturalIncome || computation.otherSources?.agriculturalIncome || 0;
                  const agriGross = computation.agriculturalDetails?.grossAgriculturalReceipts || (agriNet > 0 ? Math.round(agriNet * 1.4) : 0);
                  const agriExp = computation.agriculturalDetails?.agriculturalExpenses || (agriGross - agriNet > 0 ? agriGross - agriNet : 0);

                  if (agriNet > 0 || agriGross > 0) {
                    return (
                      <tr className="border-b border-[#cbd5e1] bg-[#f0fdf4]">
                        <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                          <div className="font-semibold text-emerald-950 flex items-center gap-1.5">
                            <span>3. Agricultural Income (Exempt u/s 10(1))</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">100% Exempt</span>
                          </div>
                          <div className="text-[9.5px] text-emerald-800 pl-3 font-medium">
                            • Gross Agri Receipts (ਜੇ-ਫਾਰਮ ਵਿਕਰੀ): ₹{Number(agriGross).toLocaleString('en-IN')} | Less Cultivation Exp (ਖਰਚੇ): ₹{Number(agriExp).toLocaleString('en-IN')}
                          </div>
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono text-emerald-900 border-r border-[#cbd5e1]">
                          {Number(agriNet).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono text-emerald-900 font-semibold">
                          0 <span className="text-[9px] text-slate-500 font-normal">(Exempt)</span>
                        </td>
                      </tr>
                    );
                  }
                  return null;
                })()}

                {/* Gross Total Income */}
                <tr className="border-b border-[#cbd5e1] bg-[#f0f4ff] font-bold text-slate-900">
                  <td className="px-2.5 py-1 uppercase border-r border-[#cbd5e1]">GROSS TOTAL INCOME (GTI)</td>
                  <td className="px-2.5 py-1 text-right font-mono border-r border-[#cbd5e1]"></td>
                  <td className="px-2.5 py-1 text-right font-mono text-[#10366b]">{Number(computation.grossTotalIncome).toLocaleString('en-IN')}</td>
                </tr>
                {/* Deductions */}
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 text-slate-700 border-r border-[#cbd5e1]">Less: Deductions under Chapter VI-A</td>
                  <td className="px-2.5 py-1 text-right font-mono text-slate-700 border-r border-[#cbd5e1]">{Number(computation.deductions.totalDeductions).toLocaleString('en-IN')}</td>
                  <td className="px-2.5 py-1 text-right font-mono text-slate-700">{Number(computation.deductions.totalDeductions).toLocaleString('en-IN')}</td>
                </tr>
                {/* Total Taxable Income */}
                <tr className="bg-[#e6f0fa] font-black text-slate-900">
                  <td className="px-2.5 py-1.5 uppercase border-r border-[#cbd5e1] text-[#10366b]">TOTAL TAXABLE INCOME (ROUNDED OFF U/S 288A)</td>
                  <td className="px-2.5 py-1.5 text-right font-mono border-r border-[#cbd5e1]"></td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-[#10366b] text-[11.5px]">{Number(computation.totalTaxableIncome).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PART D: TAX COMPUTATION & DETAILED SLAB BREAKDOWN */}
        <div className="space-y-1">
          <div className="bg-[#f0f4ff] px-2.5 py-1 rounded-t border border-[#cbd5e1] border-b-0">
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART D: TAX COMPUTATION & DETAILED SLAB BREAKDOWN ({slabHeaderLimit})
            </h2>
          </div>
          <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-[#10366b] text-white">
                  <th className="px-2.5 py-1 text-left font-bold border-r border-blue-900/40">Tax Slab / Particulars</th>
                  <th className="w-64 px-2.5 py-1 text-center font-bold border-r border-blue-900/40">Applicable Rate / Calculation</th>
                  <th className="w-32 px-2.5 py-1 text-right font-bold">Tax Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#cbd5e1] bg-white font-bold">
                  <td className="px-2.5 py-1 text-slate-900 border-r border-[#cbd5e1]">Taxable Total Income</td>
                  <td className="px-2.5 py-1 text-center font-normal text-slate-600 border-r border-[#cbd5e1]">Rounded off u/s 288A</td>
                  <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(computation.totalTaxableIncome).toLocaleString('en-IN')}</td>
                </tr>
                
                {/* Slabs Breakdown */}
                {computation.slabBreakdown && computation.slabBreakdown.length > 0 ? (
                  computation.slabBreakdown.map((item, idx) => (
                    <tr key={idx} className={`border-b border-[#cbd5e1] ${idx % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                      <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• {item.slab}</td>
                      <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">
                        {item.taxableInSlab > 0 
                          ? `${item.rate} on ₹${Number(item.taxableInSlab).toLocaleString('en-IN')}` 
                          : item.rate === 'Nil (0%)' ? 'NIL Exemption Limit' : item.rate}
                      </td>
                      <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">{Number(item.tax).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                ) : isAY2627 ? (
                  <>
                    <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                      <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• Income up to ₹4,00,000</td>
                      <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">NIL Exemption Limit</td>
                      <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">0</td>
                    </tr>
                    {taxableTotal > 400000 ? (
                      <tr className="border-b border-[#cbd5e1] bg-white">
                        <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• Income above ₹4,00,000 to ₹{Number(taxableTotal).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">5% on ₹{Number(Math.min(taxableTotal - 400000, 400000)).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">{Number(Math.round(Math.min(taxableTotal - 400000, 400000) * 0.05)).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                    {taxableTotal > 800000 ? (
                      <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                        <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• Income above ₹8,00,000 to ₹{Number(taxableTotal).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">10% on ₹{Number(Math.min(taxableTotal - 800000, 400000)).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">{Number(Math.round(Math.min(taxableTotal - 800000, 400000) * 0.10)).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                  </>
                ) : (
                  <>
                    <tr className="border-b border-[#cbd5e1] bg-[#f8fafc]">
                      <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• Income up to ₹3,00,000</td>
                      <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">NIL Exemption Limit</td>
                      <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">0</td>
                    </tr>
                    {taxableTotal > 300000 ? (
                      <tr className="border-b border-[#cbd5e1] bg-white">
                        <td className="px-2.5 py-0.5 text-slate-800 pl-4 border-r border-[#cbd5e1]">• Income above ₹3,00,000 to ₹{Number(taxableTotal).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">5% on ₹{Number(Math.min(taxableTotal - 300000, 400000)).toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">{Number(Math.round(Math.min(taxableTotal - 300000, 400000) * 0.05)).toLocaleString('en-IN')}</td>
                      </tr>
                    ) : null}
                  </>
                )}

                {/* Special Rate Tax Breakdown Rows */}
                {computation.specialRateBreakdown && computation.specialRateBreakdown.length > 0 ? (
                  <>
                    <tr className="border-b border-[#cbd5e1] bg-[#fdf2f8] font-semibold text-rose-950">
                      <td colSpan={3} className="px-2.5 py-1 uppercase text-[10px] tracking-wide">
                        Special Rate Incomes & Specific Section Tax Buckets
                      </td>
                    </tr>
                    {computation.specialRateBreakdown.map((sItem, sIdx) => (
                      <tr key={sIdx} className="border-b border-[#cbd5e1] bg-white text-slate-800 text-[10px]">
                        <td className="px-2.5 py-0.5 pl-4 border-r border-[#cbd5e1]">
                          • <span className="font-bold text-[#10366b]">{sItem.section}:</span> {sItem.description} (₹{Number(sItem.income).toLocaleString('en-IN')})
                        </td>
                        <td className="px-2.5 py-0.5 text-center text-slate-600 border-r border-[#cbd5e1]">
                          Tax @ {sItem.rate}
                        </td>
                        <td className="px-2.5 py-0.5 text-right font-mono text-slate-900">
                          {Number(sItem.tax).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </>
                ) : null}

                {/* Gross Tax Payable on Total Income */}
                <tr className="border-b border-[#cbd5e1] bg-[#f0f4ff] font-bold text-slate-900">
                  <td className="px-2.5 py-1 uppercase border-r border-[#cbd5e1]">GROSS TAX PAYABLE ON TOTAL INCOME</td>
                  <td className="px-2.5 py-1 text-center font-bold border-r border-[#cbd5e1]">
                    {computation.taxOnSpecialIncome ? `Normal: ₹${Number(computation.taxOnNormalIncome).toLocaleString('en-IN')} + Special: ₹${Number(computation.taxOnSpecialIncome).toLocaleString('en-IN')}` : 'Calculated Tax'}
                  </td>
                  <td className="px-2.5 py-1 text-right font-mono text-[#10366b]">
                    {Number(computation.totalTaxBeforeRebate || ((computation.taxOnNormalIncome || 0) + (computation.taxOnSpecialIncome || 0))).toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Rebate */}
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">Less: Rebate u/s 87A</td>
                  <td className="px-2.5 py-1 text-center text-slate-600 border-r border-[#cbd5e1]">
                    {computation.regimeOpted === 'new' 
                      ? (isAY2627 ? 'Full Rebate u/s 115BAC (Up to ₹12 Lakhs / Max ₹60,000)' : 'Full Rebate u/s 115BAC (Up to ₹7 Lakhs / Max ₹25,000)') 
                      : 'Rebate u/s 87A (Up to ₹5 Lakhs / Max ₹12,500)'}
                  </td>
                  <td className="px-2.5 py-1 text-right font-mono text-emerald-800 font-semibold">{Number(computation.rebate87A).toLocaleString('en-IN')}</td>
                </tr>

                {/* Tax after rebate */}
                <tr className="border-b border-[#cbd5e1] bg-[#f8fafc] font-bold text-slate-900">
                  <td className="px-2.5 py-1 uppercase border-r border-[#cbd5e1]">TAX PAYABLE AFTER REBATE</td>
                  <td className="px-2.5 py-1 text-center font-bold border-r border-[#cbd5e1]">Rebate Applied</td>
                  <td className="px-2.5 py-1 text-right font-mono">{Number(computation.taxAfterRebate).toLocaleString('en-IN')}</td>
                </tr>

                {/* Surcharge if applicable */}
                {Number(computation.surcharge) > 0 && (
                  <tr className="border-b border-[#cbd5e1] bg-white">
                    <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">Add: Surcharge</td>
                    <td className="px-2.5 py-1 text-center text-slate-600 border-r border-[#cbd5e1]">Applicable Surcharge Rate</td>
                    <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(computation.surcharge).toLocaleString('en-IN')}</td>
                  </tr>
                )}

                {/* Cess */}
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">Add: Health & Education Cess @ 4%</td>
                  <td className="px-2.5 py-1 text-center text-slate-600 border-r border-[#cbd5e1]">4% on Net Tax</td>
                  <td className="px-2.5 py-1 text-right font-mono text-slate-900">{Number(computation.healthAndEducationCess).toLocaleString('en-IN')}</td>
                </tr>

                {/* Total Tax Liability */}
                <tr className="border-b border-[#cbd5e1] bg-[#f0f4ff] font-bold text-slate-900">
                  <td className="px-2.5 py-1 uppercase border-r border-[#cbd5e1]">TOTAL TAX LIABILITY</td>
                  <td className="px-2.5 py-1 text-center font-bold border-r border-[#cbd5e1]">Final Tax Payable</td>
                  <td className="px-2.5 py-1 text-right font-mono">{Number(computation.grossTaxLiability).toLocaleString('en-IN')}</td>
                </tr>

                {/* Interest & Late Fee 234F */}
                {((computation.interest234A || 0) + (computation.interest234B || 0) + (computation.interest234C || 0) + (computation.fee234F || 0)) > 0 && (
                  <tr className="border-b border-[#cbd5e1] bg-amber-50/60">
                    <td className="px-2.5 py-1 text-amber-900 border-r border-[#cbd5e1]">
                      Add: Interest u/s 234A/B/C &amp; Late Filing Fee u/s 234F
                    </td>
                    <td className="px-2.5 py-1 text-center text-amber-800 border-r border-[#cbd5e1]">
                      Int: {formatINR((computation.interest234A || 0) + (computation.interest234B || 0) + (computation.interest234C || 0))} | 234F Fee: {formatINR(computation.fee234F || 0)}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono text-amber-900 font-semibold">
                      {Number((computation.interest234A || 0) + (computation.interest234B || 0) + (computation.interest234C || 0) + (computation.fee234F || 0)).toLocaleString('en-IN')}
                    </td>
                  </tr>
                )}

                {/* Taxes Paid */}
                <tr className="border-b border-[#cbd5e1] bg-white">
                  <td className="px-2.5 py-1 text-slate-800 border-r border-[#cbd5e1]">
                    Eligible Tax Credits (TDS / TCS / Advance Tax / Self Assessment Tax)
                  </td>
                  <td className="px-2.5 py-1 text-center text-slate-500 border-r border-[#cbd5e1]">
                    {(computation.taxesPaid?.challans?.length || 0) > 0
                      ? `${computation.taxesPaid.challans!.length} Challan(s) Recorded`
                      : 'Prepaid Credits'}
                  </td>
                  <td className="px-2.5 py-1 text-right font-mono text-slate-900">
                    {Number(computation.finalSettlement?.totalEligibleTaxCredits ?? computation.taxesPaid.totalTaxesPaid).toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Net Amount Payable / Refundable */}
                <tr className="bg-[#e6f0fa] font-black text-slate-900">
                  <td className="px-2.5 py-1.5 uppercase border-r border-[#cbd5e1] text-[#10366b]">
                    {computation.refundDue > 0 ? 'NET REFUND DUE TO ASSESSEE' : 'NET AMOUNT PAYABLE / (REFUNDABLE)'}
                  </td>
                  <td className="px-2.5 py-1.5 text-center text-slate-600 border-r border-[#cbd5e1] text-[9.5px] font-bold">
                    {computation.finalSettlement?.settlementStatus || (computation.refundDue > 0 ? 'REFUND DUE' : computation.netTaxPayable > 0 ? 'ADDITIONAL TAX PAYABLE' : 'SETTLED')}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-[#10366b] text-[11.5px]">
                    {Number(computation.refundDue > 0 ? computation.refundDue : computation.netTaxPayable).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PART E–H: TAX PAYMENTS, CHALLAN DETAILS, SEC 234F & FINAL SETTLEMENT */}
        <TaxPaymentsChallanSection
          computation={computation}
          onUpdateComputation={onUpdateComputation}
        />

        {/* PART I: BANK ACCOUNT DETAILS & VALIDATION STATUS */}
        <div className="space-y-1">
          <div className="bg-[#f0f4ff] px-2.5 py-1 rounded-t border border-[#cbd5e1] border-b-0 flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-[#10366b] uppercase tracking-wider">
              PART I: BANK ACCOUNT DETAILS &amp; REFUND VALIDATION STATUS
            </h2>
            <button
              type="button"
              onClick={onOpenEditModal}
              className="no-print inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-300 shadow-2xs hover:bg-blue-50 transition cursor-pointer"
              title="Manage Assessee Bank Accounts (ਬੈਂਕ ਖਾਤੇ ਸੋਧੋ)"
            >
              <Edit3 className="w-3 h-3" />
              <span>ਬੈਂਕ ਖਾਤੇ ਸੋਧੋ (Edit Banks)</span>
            </button>
          </div>
          <div className="border border-[#cbd5e1] rounded-b overflow-hidden">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-[#10366b] text-white">
                  <th className="px-2.5 py-1 text-left font-bold border-r border-blue-900/40">Bank Name</th>
                  <th className="px-2.5 py-1 text-left font-bold border-r border-blue-900/40">Account Number</th>
                  <th className="px-2.5 py-1 text-left font-bold border-r border-blue-900/40">IFSC Code</th>
                  <th className="px-2.5 py-1 text-left font-bold">Validation Status</th>
                </tr>
              </thead>
              <tbody>
                {computation.client.bankAccounts && computation.client.bankAccounts.length > 0 ? (
                  computation.client.bankAccounts.map((bAcc, idx) => (
                    <tr key={bAcc.id || idx} className={`border-b border-[#cbd5e1] ${idx % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                      <td className="px-2.5 py-1.5 text-slate-900 border-r border-[#cbd5e1] font-medium">
                        {bAcc.bankName || 'Bank Account'}
                        {bAcc.isRefundNominated && (
                          <span className="ml-2 px-1.5 py-0.2 bg-blue-100 text-[#10366b] font-bold text-[8.5px] rounded border border-blue-200">
                            ★ Primary Refund A/c
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 font-bold font-mono text-slate-900 border-r border-[#cbd5e1]">{bAcc.accountNumber || '-'}</td>
                      <td className="px-2.5 py-1.5 font-mono text-slate-800 border-r border-[#cbd5e1]">{bAcc.ifscCode || '-'}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[9.5px]">
                          {bAcc.isRefundNominated ? 'VALIDATED & ELECTED' : 'VALIDATED'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="bg-white">
                    <td className="px-2.5 py-1.5 text-slate-900 border-r border-[#cbd5e1] font-medium">{computation.client.bankName || 'Capital Small Finance Bank Limited'}</td>
                    <td className="px-2.5 py-1.5 font-bold font-mono text-slate-900 border-r border-[#cbd5e1]">{computation.client.accountNumber || '052200002279'}</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-800 border-r border-[#cbd5e1]">{computation.client.ifscCode || 'CLBL0000052'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[9.5px]">
                        {computation.client.validationStatus || 'VALIDATED & ELECTED'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURE AND FOOTER */}
        <div className="pt-3 text-right space-y-4 text-[10px] text-slate-700">
          <div>
            <span className="font-normal text-slate-600">Assessee Signature: </span>
            <span className="inline-block w-48 border-b border-slate-400"></span>
          </div>
          <div className="font-bold text-slate-900">
            Name: <span className="uppercase">{(computation.client.name || 'SARABJIT KAUR').toUpperCase()}</span> | Date: <span>{computation.filingDate || '31-Jul-2026'}</span> | Place: <span>{computation.client.placeOfFiling || 'LOHIAN KHAS'}</span>
          </div>
        </div>

        {/* Page 1 of 1 indicator */}
        <div className="text-right text-[9px] text-slate-400 pt-1">
          Page 1 of 1
        </div>

        {/* SCHEDULE BALANCE SHEET (ਸੰਤੁਲਨ ਸ਼ੀਟ - FINANCIAL PARTICULARS AS ON 31ST MARCH) */}
        {computation.balanceSheet && computation.balanceSheet.enabled !== false && (
          <BalanceSheetSection
            balanceSheet={computation.balanceSheet}
            assesseeName={computation.client.name}
            pan={computation.client.pan}
            assessmentYear={computation.assessmentYear}
            financialYear={computation.financialYear}
            onEdit={onOpenEditModal}
          />
        )}

      </div>

    </div>
  );
};
