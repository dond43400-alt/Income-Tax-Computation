import React from 'react';
import { 
  FileText, 
  Upload, 
  Users, 
  Building2, 
  Languages, 
  FileSpreadsheet, 
  TrendingUp, 
  IndianRupee,
  CheckCircle2,
  Sparkles,
  Globe,
  Camera
} from 'lucide-react';
import { Language, FirmDetails, TaxComputation } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { formatINR } from '../utils/pdfGenerator';

interface HeaderProps {
  currentTab: 'upload' | 'sheet' | 'clients';
  setCurrentTab: (tab: 'upload' | 'sheet' | 'clients') => void;
  lang: Language;
  setLang: (lang: Language) => void;
  firm: FirmDetails;
  onOpenFirmModal: () => void;
  onOpenAiScannerModal?: () => void;
  onOpenPortalSyncModal?: () => void;
  onOpenManualClientModal?: () => void;
  computations: TaxComputation[];
  onExportAllExcel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
  firm,
  onOpenFirmModal,
  onOpenAiScannerModal,
  onOpenPortalSyncModal,
  onOpenManualClientModal,
  computations,
  onExportAllExcel,
}) => {
  const t = TRANSLATIONS[lang];

  const totalRefunds = computations.reduce((sum, c) => sum + (c.refundDue || 0), 0);
  const totalTaxComputed = computations.reduce((sum, c) => sum + (c.grossTaxLiability || 0), 0);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md no-print">
      {/* Top Banner with Firm Brand & Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-100 tracking-tight">
                  {t.appTitle}
                </h1>
                <span className="text-[10px] font-semibold tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
                  AY 2025-26 Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {firm.firmName} &bull; {firm.practitionerName || 'Tax Consultant'}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
            
            {/* Manual Client Add Button */}
            {onOpenManualClientModal && (
              <button
                type="button"
                onClick={onOpenManualClientModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="Add New Client Manually without PDF"
              >
                <Users className="w-3.5 h-3.5" />
                <span>+ {lang === 'pa' ? 'ਨਵਾਂ ਕਲਾਇੰਟ' : lang === 'hi' ? 'नया क्लाइंट' : 'Add Client'}</span>
              </button>
            )}

            {/* AI Document & Photo Scanner Button */}
            {onOpenAiScannerModal && (
              <button
                type="button"
                onClick={onOpenAiScannerModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="Scan PAN, Aadhaar, Bank Passbook photos with AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">AI Photo Scan</span>
                <span className="bg-amber-400 text-slate-900 text-[9px] px-1 py-0.2 rounded font-black">
                  OCR
                </span>
              </button>
            )}

            {/* Income Tax Portal Link / 1-Click Sync */}
            {onOpenPortalSyncModal && (
              <button
                type="button"
                onClick={onOpenPortalSyncModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="Income Tax Portal 1-Click Auto Sync & Pre-fill JSON"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Portal Sync</span>
                <span className="bg-emerald-400 text-slate-900 text-[9px] px-1 py-0.2 rounded font-black">
                  1-Click
                </span>
              </button>
            )}

            {/* Quick stats badges */}
            <div className="hidden xl:flex items-center gap-3 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Clients:</span>
                <span className="font-bold text-slate-200">{computations.length}</span>
              </div>
              <div className="w-px h-3 bg-slate-700"></div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Refunds:</span>
                <span className="font-bold text-emerald-300">{formatINR(totalRefunds)}</span>
              </div>
            </div>

            {/* Excel Export */}
            <button
              onClick={onExportAllExcel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Export all client records to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Excel</span>
            </button>

            {/* Firm Settings */}
            <button
              onClick={onOpenFirmModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Customize Letterhead & Firm Details"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Letterhead</span>
            </button>

            {/* Language Switch */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setLang('pa')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  lang === 'pa' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ਪੰਜਾਬੀ
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  lang === 'hi' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                हिंदी
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800 text-sm">
          <button
            onClick={() => setCurrentTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{t.uploadPdf}</span>
          </button>

          <button
            onClick={() => setCurrentTab('sheet')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'sheet'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t.compactSummary}</span>
          </button>

          <button
            onClick={() => setCurrentTab('clients')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'clients'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t.clientDirectory}</span>
            <span className="bg-slate-800 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
              {computations.length}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
