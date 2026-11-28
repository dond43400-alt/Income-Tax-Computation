import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Trash2,
  Plus,
  FileCheck2,
  Eye,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { TaxChallanRecord, TaxPaymentCategory } from '../types';
import {
  TAX_PAYMENT_CATEGORIES,
  PAYMENT_MODES,
  CHALLAN_FORMS,
  normalizeNotFound,
  isMissingField,
  computeChallanTotal,
  findDuplicateChallan,
  getFinancialYearFromAY,
  createAuditEntry,
  extractChallansFromJsonContent,
} from '../utils/challanEngine';

// Ensure pdfjs worker is configured consistently with existing pdfParser
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions.workerSrc) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface ChallanExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPan?: string;
  defaultName?: string;
  defaultAy?: string;
  defaultFy?: string;
  existingChallans: TaxChallanRecord[];
  onSaveChallans: (newChallans: TaxChallanRecord[]) => void;
}

interface EditableExtractedChallan extends TaxChallanRecord {
  selected: boolean;
  duplicateWarning?: string;
}

export const ChallanExtractionModal: React.FC<ChallanExtractionModalProps> = ({
  isOpen,
  onClose,
  defaultPan = '',
  defaultName = '',
  defaultAy = '2026-27',
  defaultFy = '2025-26',
  existingChallans,
  onSaveChallans,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [detectedDocType, setDetectedDocType] = useState<string>('');
  const [extractionNotes, setExtractionNotes] = useState<string>('');
  const [extractedRows, setExtractedRows] = useState<EditableExtractedChallan[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  if (!isOpen) return null;

  const mapPaymentCategory = (rawType?: string): TaxPaymentCategory => {
    if (!rawType) return 'Self Assessment Tax – u/s 140A';
    const found = TAX_PAYMENT_CATEGORIES.find(
      (cat) => cat.toLowerCase() === rawType.trim().toLowerCase()
    );
    if (found) return found;
    const low = rawType.toLowerCase();
    if (low.includes('140a') || low.includes('self')) return 'Self Assessment Tax – u/s 140A';
    if (low.includes('advance')) return 'Advance Tax';
    if (low.includes('156')) return 'Regular Assessment Tax – u/s 156';
    if (low.includes('regular')) return 'Tax on Regular Assessment';
    if (low.includes('234f') || low.includes('late')) return 'Late Filing Fee – u/s 234F';
    if (low.includes('234a')) return 'Interest u/s 234A';
    if (low.includes('234b')) return 'Interest u/s 234B';
    if (low.includes('234c')) return 'Interest u/s 234C';
    if (low.includes('tds') || low.includes('281')) return 'TDS';
    if (low.includes('tcs')) return 'TCS';
    return 'Other applicable tax payments';
  };

  const enrichExtractedRows = (rawList: any[], docType: string, fileName: string): EditableExtractedChallan[] => {
    const now = new Date().toISOString();
    return rawList.map((item, idx) => {
      const taxAmount = Math.max(0, Number(item.taxAmount || 0));
      const surcharge = Math.max(0, Number(item.surcharge || 0));
      const cess = Math.max(0, Number(item.cess || 0));
      const interest = Math.max(0, Number(item.interest || 0));
      const lateFilingFee = Math.max(0, Number(item.lateFilingFee || 0));
      const otherAmount = Math.max(0, Number(item.otherAmount || 0));
      const calcSum = taxAmount + surcharge + cess + interest + lateFilingFee + otherAmount;
      const totalAmountPaid = Number(item.totalAmountPaid || 0) || calcSum;

      // If AI gave totalAmountPaid without breakdown, set taxAmount (or fee for 234F)
      const challanType = mapPaymentCategory(item.paymentType || item.challanType);
      let adjTax = taxAmount;
      let adjFee = lateFilingFee;
      let adjInt = interest;
      if (calcSum === 0 && totalAmountPaid > 0) {
        if (challanType === 'Late Filing Fee – u/s 234F') {
          adjFee = totalAmountPaid;
        } else if (
          challanType === 'Interest u/s 234A' ||
          challanType === 'Interest u/s 234B' ||
          challanType === 'Interest u/s 234C'
        ) {
          adjInt = totalAmountPaid;
        } else {
          adjTax = totalAmountPaid;
        }
      }

      const rawAy = normalizeNotFound(item.assessmentYear);
      const ayVal = isMissingField(rawAy) ? defaultAy || 'Not Found' : rawAy;
      const fyVal = !isMissingField(item.financialYear)
        ? String(item.financialYear)
        : !isMissingField(ayVal)
        ? getFinancialYearFromAY(ayVal)
        : defaultFy || 'Not Found';

      const rec: TaxChallanRecord = {
        id: `ch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        pan: !isMissingField(item.pan) ? String(item.pan).toUpperCase() : defaultPan ? defaultPan.toUpperCase() : 'Not Found',
        assesseeName: !isMissingField(item.assesseeName)
          ? String(item.assesseeName).toUpperCase()
          : defaultName
          ? defaultName.toUpperCase()
          : 'Not Found',
        assessmentYear: ayVal,
        financialYear: fyVal,
        challanType,
        challanForm: normalizeNotFound(item.challanForm) !== 'Not Found' ? item.challanForm : docType || 'ITNS 280',
        challanSerialNumber: normalizeNotFound(item.challanSerialNumber),
        bsrCode: normalizeNotFound(item.bsrCode),
        challanTenderDate: normalizeNotFound(item.challanTenderDate),
        bankName: normalizeNotFound(item.bankName),
        cin: normalizeNotFound(item.cin),
        taxAmount: adjTax,
        surcharge,
        cess,
        interest: adjInt,
        lateFilingFee: adjFee,
        otherAmount,
        totalAmountPaid: totalAmountPaid || adjTax + surcharge + cess + adjInt + adjFee + otherAmount,
        paymentMode: normalizeNotFound(item.paymentMode),
        challanStatus: 'Deposited',
        verificationStatus: 'Verification Required',
        evidenceType: docType || 'Uploaded Document',
        sourceDocumentName: fileName,
        createdAt: now,
        updatedAt: now,
        editHistory: [createAuditEntry('OCR Extracted', `Extracted from ${fileName} (${docType || 'Tax Document'})`)],
      };

      const dup = findDuplicateChallan(rec, existingChallans);
      if (dup.isDuplicate) {
        rec.isDuplicateFlagged = true;
        rec.verificationStatus = 'Duplicate Flagged';
      }

      return {
        ...rec,
        selected: !dup.isDuplicate,
        duplicateWarning: dup.isDuplicate ? dup.reason : undefined,
      };
    });
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let fullText = '';
      for (let p = 1; p <= Math.min(pdf.numPages, 15); p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const strings = tc.items.map((it: any) => it.str || '');
        fullText += `\n--- Page ${p} ---\n` + strings.join(' ');
      }
      return fullText.trim();
    } catch {
      return '';
    }
  };

  const compressImageDataUrl = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      if (dataUrl.length < 1_000_000) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 1800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedFileName(file.name);
    setErrorMessage('');
    setExtractedRows([]);
    setDetectedDocType('');
    setExtractionNotes('');
    setIsExtracting(true);

    try {
      // 1. Handle ITR JSON / AIS JSON directly
      if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
        setStatusMessage('Parsing Income Tax JSON / AIS JSON file...');
        const text = await file.text();
        let jsonRecords: TaxChallanRecord[] = [];
        try {
          jsonRecords = extractChallansFromJsonContent(text, defaultPan, defaultName, defaultAy, file.name);
        } catch {
          throw new Error('Invalid JSON file. Please upload a valid Income Tax JSON, AIS JSON, or Challan PDF/image.');
        }
        if (jsonRecords.length === 0) {
          setErrorMessage('No challan, TDS, TCS, or TaxPayment entries found in this JSON file.');
          setIsExtracting(false);
          return;
        }
        setDetectedDocType('ITR / AIS JSON');
        setExtractionNotes(`Extracted ${jsonRecords.length} payment record(s) directly from JSON.`);
        setExtractedRows(enrichExtractedRows(jsonRecords, 'ITR JSON', file.name));
        setIsExtracting(false);
        return;
      }

      // 2. Handle PDF or Image via PDF text + Gemini AI OCR
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let rawText = '';
      let payloadFiles: Array<{ data: string; mimeType: string }> = [];

      if (isPdf) {
        setStatusMessage('Extracting text layer from PDF...');
        rawText = await extractTextFromPdf(file);
        // Only send binary PDF when text layer is empty/scanned (< 80 chars) to avoid oversized payloads
        if (rawText.trim().length < 80) {
          if (file.size > 15 * 1024 * 1024) {
            throw new Error('Scanned PDF is larger than 15 MB. Please upload a smaller PDF or clear photo of the challan.');
          }
          setStatusMessage('Scanned PDF detected — running AI visual OCR...');
          const dataUrl = await readFileAsDataUrl(file);
          payloadFiles = [{ data: dataUrl, mimeType: 'application/pdf' }];
        } else {
          setStatusMessage('Running AI Challan extraction on PDF text...');
        }
      } else {
        setStatusMessage('Optimizing image & running AI Challan OCR extraction...');
        const rawDataUrl = await readFileAsDataUrl(file);
        const compressed = await compressImageDataUrl(rawDataUrl);
        payloadFiles = [
          {
            data: compressed,
            mimeType: compressed.startsWith('data:image/jpeg') ? 'image/jpeg' : (file.type || 'image/jpeg'),
          },
        ];
      }

      const payload: any = {
        fileName: file.name,
        files: payloadFiles,
        rawText,
      };

      const resp = await fetch('/api/ocr-challan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await resp.text();
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch {
        console.error('Non-JSON response from /api/ocr-challan:', resp.status, responseText.slice(0, 300));
        throw new Error(
          resp.status === 413
            ? 'Uploaded document is too large. Please upload a smaller PDF or compressed image.'
            : resp.status >= 502 || responseText.startsWith('The page')
              ? 'Server request timed out or returned a gateway error. Please retry with a smaller file or clearer image.'
              : `Server returned an unexpected response (HTTP ${resp.status}).`
        );
      }

      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'OCR extraction failed.');
      }

      const data = json.data || {};
      const list = Array.isArray(data.challans) ? data.challans : [];
      setDetectedDocType(data.detectedDocumentType || 'Tax Document');
      setExtractionNotes(data.extractionNotes || '');

      if (list.length === 0) {
        setErrorMessage(
          'No challan or tax payment records could be detected in this document. You can add a manual entry below if needed.'
        );
      } else {
        setExtractedRows(enrichExtractedRows(list, data.detectedDocumentType || 'Uploaded Receipt', file.name));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to extract challan data.');
    } finally {
      setIsExtracting(false);
      setStatusMessage('');
    }
  };

  const updateRowField = (id: string, field: keyof EditableExtractedChallan, value: any) => {
    setExtractedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated: EditableExtractedChallan = { ...row, [field]: value };
        if (
          field === 'taxAmount' ||
          field === 'surcharge' ||
          field === 'cess' ||
          field === 'interest' ||
          field === 'lateFilingFee' ||
          field === 'otherAmount'
        ) {
          updated.totalAmountPaid = computeChallanTotal(updated);
        }
        // Re-check duplicates when CIN, BSR, Serial, Date or Amount changes
        const dup = findDuplicateChallan(updated, existingChallans);
        updated.isDuplicateFlagged = dup.isDuplicate;
        updated.duplicateWarning = dup.isDuplicate ? dup.reason : undefined;
        if (dup.isDuplicate) {
          updated.verificationStatus = 'Duplicate Flagged';
        } else if (updated.verificationStatus === 'Duplicate Flagged') {
          updated.verificationStatus = 'Verification Required';
        }
        return updated;
      })
    );
  };

  const handleSaveSelected = () => {
    const chosen = extractedRows.filter((r) => r.selected);
    if (chosen.length === 0) {
      setErrorMessage('Please select at least one challan row to save.');
      return;
    }

    const duplicateBlocked = chosen.find((r) => r.isDuplicateFlagged);
    if (duplicateBlocked) {
      setErrorMessage(
        `Cannot save duplicate challan: ${duplicateBlocked.duplicateWarning || 'Matching CIN or BSR/Serial already exists.'}`
      );
      return;
    }

    const cleanedToSave: TaxChallanRecord[] = chosen.map(({ selected, duplicateWarning, ...rec }) => {
      // Never mark Verified unless user explicitly checked or critical fields exist
      const hasMissingCritical =
        rec.challanType !== 'TDS' &&
        rec.challanType !== 'TCS' &&
        (isMissingField(rec.bsrCode) || isMissingField(rec.challanSerialNumber) || isMissingField(rec.challanTenderDate));

      const finalVerificationStatus =
        rec.verificationStatus === 'Verified' && !hasMissingCritical
          ? 'Verified'
          : hasMissingCritical
          ? 'Verification Required'
          : rec.verificationStatus;

      return {
        ...rec,
        bsrCode: normalizeNotFound(rec.bsrCode),
        challanSerialNumber: normalizeNotFound(rec.challanSerialNumber),
        challanTenderDate: normalizeNotFound(rec.challanTenderDate),
        bankName: normalizeNotFound(rec.bankName),
        cin: normalizeNotFound(rec.cin),
        pan: normalizeNotFound(rec.pan).toUpperCase(),
        assesseeName: normalizeNotFound(rec.assesseeName).toUpperCase(),
        verificationStatus: finalVerificationStatus,
      };
    });

    onSaveChallans(cleanedToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#10366b] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                Automatic Challan & Tax Payment OCR Extractor
              </h3>
              <p className="text-xs text-blue-100">
                Supports ITNS 280 / 281 / 282 / 283, Challan Receipts, Form 26AS, AIS, TIS, ITR JSON, ITR-V (PDF & Images)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 text-blue-100 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-xl p-6 text-center transition cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.json"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <div className="flex flex-col items-center gap-2">
              {isExtracting ? (
                <>
                  <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
                  <p className="font-bold text-blue-900 text-sm">{statusMessage || 'Extracting challan details...'}</p>
                </>
              ) : (
                <>
                  <Upload className="w-9 h-9 text-blue-600" />
                  <p className="font-bold text-slate-800 text-sm">
                    Click to Upload Challan Receipt, ITNS 280/281/282/283, Form 26AS, AIS/TIS or ITR JSON
                  </p>
                  <p className="text-slate-500 text-xs">
                    Missing or unreadable fields will strictly display <span className="font-bold text-amber-700">"Not Found"</span> — zero fabricated data.
                  </p>
                </>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          {detectedDocType && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-900">
                <FileCheck2 className="w-4 h-4 text-emerald-700" />
                <span className="font-bold">Detected Document: {detectedDocType}</span>
                <span className="text-emerald-700">· {uploadedFileName}</span>
              </div>
              {extractionNotes && <span className="text-emerald-800 text-[11px]">{extractionNotes}</span>}
            </div>
          )}

          {/* Editable Verification Screen */}
          {extractedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">
                  Editable Verification Screen ({extractedRows.length} Record{extractedRows.length > 1 ? 's' : ''} Extracted)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Verify BSR Code, Challan Serial No, Date, CIN, and Category before saving
                </span>
              </div>

              {extractedRows.map((row, idx) => (
                <div
                  key={row.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    row.isDuplicateFlagged
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRowField(row.id, 'selected', e.target.checked)}
                        className="w-4 h-4 accent-[#10366b]"
                      />
                      <span>Challan #{idx + 1}</span>
                      <span className="text-xs font-mono text-blue-700">₹{Number(row.totalAmountPaid).toLocaleString('en-IN')}</span>
                    </label>

                    <div className="flex items-center gap-2">
                      {row.isDuplicateFlagged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Duplicate Blocked
                        </span>
                      ) : (
                        <select
                          value={row.verificationStatus}
                          onChange={(e) => updateRowField(row.id, 'verificationStatus', e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        >
                          <option value="Verified">Verified (Evidence Checked)</option>
                          <option value="Verification Required">Verification Required</option>
                          <option value="Unverified">Unverified</option>
                          <option value="Mismatch Flagged">Mismatch Flagged</option>
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setExtractedRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {row.duplicateWarning && (
                    <div className="text-xs font-semibold text-rose-700 bg-rose-100/80 px-3 py-1.5 rounded-lg border border-rose-200">
                      ⚠ {row.duplicateWarning} Edit CIN / BSR / Serial or uncheck this duplicate before saving.
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Payment Category</label>
                      <select
                        value={row.challanType}
                        onChange={(e) => updateRowField(row.id, 'challanType', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                      >
                        {TAX_PAYMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">PAN</label>
                      <input
                        type="text"
                        value={row.pan}
                        onChange={(e) => updateRowField(row.id, 'pan', e.target.value.toUpperCase())}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.pan) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Assessment Year</label>
                      <input
                        type="text"
                        value={row.assessmentYear}
                        onChange={(e) => updateRowField(row.id, 'assessmentYear', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.assessmentYear) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Challan Form</label>
                      <select
                        value={row.challanForm || 'ITNS 280'}
                        onChange={(e) => updateRowField(row.id, 'challanForm', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      >
                        {CHALLAN_FORMS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">BSR Code (7-digit)</label>
                      <input
                        type="text"
                        value={row.bsrCode}
                        onChange={(e) => updateRowField(row.id, 'bsrCode', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.bsrCode) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Challan Serial Number</label>
                      <input
                        type="text"
                        value={row.challanSerialNumber}
                        onChange={(e) => updateRowField(row.id, 'challanSerialNumber', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.challanSerialNumber) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Challan Tender Date</label>
                      <input
                        type="text"
                        value={row.challanTenderDate}
                        onChange={(e) => updateRowField(row.id, 'challanTenderDate', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.challanTenderDate) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">CIN (Challan ID)</label>
                      <input
                        type="text"
                        value={row.cin}
                        onChange={(e) => updateRowField(row.id, 'cin', e.target.value.toUpperCase())}
                        className={`w-full p-1.5 rounded-lg border font-mono text-xs ${
                          isMissingField(row.cin) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Bank Name</label>
                      <input
                        type="text"
                        value={row.bankName}
                        onChange={(e) => updateRowField(row.id, 'bankName', e.target.value)}
                        className={`w-full p-1.5 rounded-lg border text-xs ${
                          isMissingField(row.bankName) ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Payment Mode</label>
                      <select
                        value={PAYMENT_MODES.includes(row.paymentMode) ? row.paymentMode : 'Not Found'}
                        onChange={(e) => updateRowField(row.id, 'paymentMode', e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Amount Breakdown */}
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Tax (₹)</label>
                      <input
                        type="number"
                        value={row.taxAmount}
                        onChange={(e) => updateRowField(row.id, 'taxAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Surcharge</label>
                      <input
                        type="number"
                        value={row.surcharge}
                        onChange={(e) => updateRowField(row.id, 'surcharge', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Cess</label>
                      <input
                        type="number"
                        value={row.cess}
                        onChange={(e) => updateRowField(row.id, 'cess', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Interest</label>
                      <input
                        type="number"
                        value={row.interest}
                        onChange={(e) => updateRowField(row.id, 'interest', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-800">234F Fee</label>
                      <input
                        type="number"
                        value={row.lateFilingFee}
                        onChange={(e) => updateRowField(row.id, 'lateFilingFee', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-amber-300 bg-amber-50/50 font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Other</label>
                      <input
                        type="number"
                        value={row.otherAmount}
                        onChange={(e) => updateRowField(row.id, 'otherAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#10366b]">Total Paid</label>
                      <input
                        type="number"
                        value={row.totalAmountPaid}
                        readOnly
                        className="w-full p-1.5 rounded border border-blue-300 bg-blue-50 font-mono font-bold text-right text-xs text-[#10366b]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Duplicate check runs automatically on CIN &amp; BSR+Serial+Date+Amount.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            {extractedRows.length > 0 && (
              <button
                type="button"
                onClick={handleSaveSelected}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#10366b] hover:bg-blue-900 text-white font-bold text-xs shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify &amp; Save Selected Challan(s)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
