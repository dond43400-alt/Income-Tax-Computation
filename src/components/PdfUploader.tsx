import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  FileCode, 
  UserCheck, 
  UserPlus,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  Camera,
  CreditCard,
  Globe,
  Landmark,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { Language, TaxComputation, ExtractedPdfResult } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { extractTextFromPdf, parseTaxDocumentText } from '../utils/pdfParser';
import { createEmptyComputation } from '../utils/taxCalculator';
import { SAMPLE_COMPUTATIONS, SAMPLE_RAW_PDF_TEXT } from '../utils/sampleData';
import { formatINR } from '../utils/pdfGenerator';
import { ExtractionReviewModal } from './ExtractionReviewModal';

interface PdfUploaderProps {
  lang: Language;
  onComputationLoaded: (computation: TaxComputation) => void;
  onOpenAiScannerModal?: () => void;
  onOpenPortalSyncModal?: () => void;
  onOpenManualClientModal?: () => void;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({
  lang,
  onComputationLoaded,
  onOpenAiScannerModal,
  onOpenPortalSyncModal,
  onOpenManualClientModal,
}) => {
  const t = TRANSLATIONS[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastResult, setLastResult] = useState<ExtractedPdfResult | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('upload');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle uploaded file
  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setErrorMessage('Please upload a valid PDF file (ITR-V, Form 16, or AIS/TIS)');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);
    setProgressMessage('Reading PDF digital text layers securely in browser...');

    try {
      const extractionRes = await extractTextFromPdf(file);

      if (extractionRes.isPasswordProtected) {
        setErrorMessage(extractionRes.errorMessage || 'This PDF is password-protected. Please remove the password and re-upload.');
        setIsProcessing(false);
        return;
      }

      if (extractionRes.isCorruptedOrUnreadable) {
        setErrorMessage(extractionRes.errorMessage || 'Unable to read this PDF file. It may be corrupted or unreadable.');
        setIsProcessing(false);
        return;
      }

      setProgressMessage('Auditing fields & checking zero-fabrication rules...');
      
      const parsed = parseTaxDocumentText(
        extractionRes.text, 
        file.name, 
        file.size, 
        extractionRes.isScannedOrImageOnly
      );
      
      setLastResult(parsed);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      console.error('PDF Parse error:', err);
      setErrorMessage('Error reading PDF: ' + (err?.message || 'Unknown error occurred.'));
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Parse Pasted Text
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste some ITR text or acknowledgment content');
      return;
    }
    setErrorMessage('');
    setIsProcessing(true);
    setProgressMessage('Auditing text format and tax fields with zero-fabrication...');

    try {
      const parsed = parseTaxDocumentText(pastedText, 'Pasted_ITR_Data.txt', pastedText.length, false);
      setLastResult(parsed);
      setIsReviewModalOpen(true);
    } catch (e: any) {
      setErrorMessage('Could not parse text: ' + e.message);
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  // Load Preset Sample
  const handleLoadSample = (sample: TaxComputation) => {
    onComputationLoaded(sample);
  };

  const baseComputationForReview = createEmptyComputation('2026-27');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      
      {/* Hero Box / Quick Intro */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            Fast ITR PDF to 1-Page Compact Computation Converter
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            PDF ਵਿੱਚੋਂ ਆਈਟੀਆਰ ਡਾਟਾ ਕੱਢੋ ਤੇ 1-ਸਫ਼ੇ ਦੀ ਸੰਖੇਪ ਸ਼ੀਟ ਬਣਾਓ
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
            Upload your ITR-V Ack, Form 16, or AIS/TIS PDF. The system automatically extracts PAN, Gross Total Income, Chapter VI-A Deductions, TDS claimed, and creates a client-ready, bank-ready 1-Page Compact Computation.
          </p>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Client-Side Privacy (Files stay on your PC)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span>AY 2025-26 & AY 2024-25 Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Quick Automation & Client Entry Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Manual Client Addition */}
        <div 
          onClick={onOpenManualClientModal}
          className="group bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-white p-5 rounded-2xl border-2 border-blue-400/60 hover:border-blue-500 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Direct Entry
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-blue-700 transition">
              ਮੈਨੂਅਲ ਕਲਾਇੰਟ ਸ਼ਾਮਲ ਕਰੋ (Manual Client Entry)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ਬਿਨਾਂ ਪੀਡੀਐਫ ਦੇ ਸਿੱਧਾ ਕਲਾਇੰਟ ਦਾ ਨਾਮ, PAN, ਬੈਂਕ ਖਾਤਾ, ਦੁਕਾਨ/44AD ਟਰਨਓਵਰ ਜਾਂ ਖੇਤੀਬਾੜੀ ਆਮਦਨ ਭਰ ਕੇ ਨਵੀਂ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਬਣਾਓ।
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between text-xs font-bold text-blue-700">
            <span className="flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>ਨਵਾਂ ਕਲਾਇੰਟ ਭਰੋ (Add Client)</span>
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Card 2: AI Document Photo OCR */}
        <div 
          onClick={onOpenAiScannerModal}
          className="group bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white p-5 rounded-2xl border-2 border-amber-400/60 hover:border-amber-500 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Camera className="w-5 h-5" />
              </div>
              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                AI Photo OCR
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-amber-700 transition">
              PAN, Aadhaar ਤੇ Passbook ਫੋਟੋ ਸਕੈਨ
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ਕਲਾਇੰਟ ਦੇ ਪੈਨ ਕਾਰਡ, ਆਧਾਰ ਕਾਰਡ ਜਾਂ ਬੈਂਕ ਪਾਸਬੁੱਕ ਦੀ ਫੋਟੋ ਅਪਲੋਡ ਕਰੋ। AI ਸਾਰਾ ਡਾਟਾ ਆਪਣੇ ਆਪ ਪੜ੍ਹ ਕੇ ਕੰਪਿਊਟੇਸ਼ਨ ਵਿੱਚ ਭਰ ਦੇਵੇਗਾ।
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs font-bold text-amber-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>ਫੋਟੋ ਸਕੈਨ ਕਰੋ (Scan Photos)</span>
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Card 3: Income Tax Portal 1-Click Sync */}
        <div 
          onClick={onOpenPortalSyncModal}
          className="group bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white p-5 rounded-2xl border-2 border-emerald-400/60 hover:border-emerald-500 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Globe className="w-5 h-5" />
              </div>
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                1-Click Sync
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-emerald-700 transition">
              ਇਨਕਮ ਟੈਕਸ ਪੋਰਟਲ ਤੋਂ ਡਾਟਾ ਸਿੰਕ
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ਪੋਰਟਲ ਨਾਲ ਕਨੈਕਟ ਕਰੋ ਜਾਂ Pre-fill JSON / AIS ਫਾਈਲ ਅਪਲੋਡ ਕਰੋ। 26AS TDS, 44AD ਟਰਨਓਵਰ ਤੇ ਬੈਂਕ ਵੇਰਵੇ ਆਟੋ ਸਿੰਕ ਕਰੋ।
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>ਪੋਰਟਲ ਸਿੰਕ (1-Click Sync)</span>
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>

      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveInputMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeInputMode === 'upload'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload PDF Document</span>
        </button>

        <button
          onClick={() => setActiveInputMode('paste')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeInputMode === 'paste'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Paste Text / JSON Code</span>
        </button>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MAIN INPUT AREA */}
      {activeInputMode === 'upload' ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
              : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-inner">
            {isProcessing ? (
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {isProcessing ? progressMessage : 'Click to Upload or Drag & Drop ITR PDF'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Supports ITR-V Acknowledgement (ITR-1, 2, 3, 4), Form 16 (Part A & B), AIS/TIS and Computation files.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm shadow-md hover:bg-blue-700 transition">
            <Upload className="w-4 h-4" />
            <span>Select PDF from Computer</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Paste ITR-V Text / Acknowledgment Text:
          </label>
          <textarea
            rows={7}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste text copied from ITR PDF, Form 16 or email acknowledgement here..."
            className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <div className="flex justify-between items-center">
            <button
              onClick={() => setPastedText(SAMPLE_RAW_PDF_TEXT)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Insert Sample ITR-V Text
            </button>
            <button
              onClick={handleParsePastedText}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              {isProcessing ? 'Processing...' : 'Parse & Generate Computation'}
            </button>
          </div>
        </div>
      )}

      {/* QUICK PRESET SAMPLES (1-Click Test) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              Quick Test with Demo ITR Files (1-Click Test):
            </h3>
            <p className="text-xs text-slate-500">
              ਕਲਿੱਕ ਕਰੋ ਅਤੇ ਤੁਰੰਤ ਦੇਖੋ ਕਿ ਸੰਖੇਪ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਕਿਵੇਂ ਬਣਦੀ ਹੈ:
            </p>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            3 Sample Scenarios
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sample 1: Salaried Employee */}
          <div 
            onClick={() => handleLoadSample(SAMPLE_COMPUTATIONS[0])}
            className="group p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition relative"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                ITR-1 (Sahaj)
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Refund ₹15,880
              </span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mt-2 group-hover:text-blue-600 transition">
              {SAMPLE_COMPUTATIONS[0].client.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              PAN: {SAMPLE_COMPUTATIONS[0].client.pan} &bull; Salary ₹8.40L
            </p>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition duration-200">
              <span>Generate Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Sample 2: Small Business / 44AD */}
          <div 
            onClick={() => handleLoadSample(SAMPLE_COMPUTATIONS[1])}
            className="group p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition relative"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                ITR-4 (Sugam)
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Refund ₹12,400
              </span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mt-2 group-hover:text-blue-600 transition">
              {SAMPLE_COMPUTATIONS[1].client.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              PAN: {SAMPLE_COMPUTATIONS[1].client.pan} &bull; Turnover ₹68L (44AD)
            </p>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition duration-200">
              <span>Generate Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Sample 3: Senior Citizen */}
          <div 
            onClick={() => handleLoadSample(SAMPLE_COMPUTATIONS[2])}
            className="group p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition relative"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                ITR-2 (Sr. Citizen)
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Refund ₹20,370
              </span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mt-2 group-hover:text-blue-600 transition">
              {SAMPLE_COMPUTATIONS[2].client.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              PAN: {SAMPLE_COMPUTATIONS[2].client.pan} &bull; Rent, FD & Capital Gains
            </p>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition duration-200">
              <span>Generate Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Zero-Fabrication Extraction Review Modal */}
      {isReviewModalOpen && lastResult && (
        <ExtractionReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          extractedResult={lastResult}
          currentComputation={baseComputationForReview}
          onApplyData={(updatedComputation) => {
            onComputationLoaded(updatedComputation);
            setIsReviewModalOpen(false);
          }}
        />
      )}

    </div>
  );
};
