import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  CreditCard, 
  Landmark, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Check, 
  ArrowRight,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { TaxComputation, ClientDetails } from '../types';
import { recalculateFullComputation } from '../utils/taxCalculator';

interface AiDocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  computation: TaxComputation;
  onUpdateComputation: (updated: TaxComputation) => void;
}

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  type: string;
  size: number;
}

interface ExtractedKycData {
  name?: string;
  fatherName?: string;
  pan?: string;
  aadhaarNumber?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Senior Citizen';
  mobile?: string;
  email?: string;
  address?: string;
  pincode?: string;
  state?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  placeOfFiling?: string;
  documentTypesDetected?: string[];
  summaryNotes?: string;
}

export const AiDocumentScannerModal: React.FC<AiDocumentScannerModalProps> = ({
  isOpen,
  onClose,
  computation,
  onUpdateComputation,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedKycData | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'applied'>('upload');

  if (!isOpen) return null;

  // Helper to resize & compress large camera photos to fast, lightweight JPEG for OCR
  const compressImage = (file: File): Promise<{ dataUrl: string; size: number }> => {
    return new Promise((resolve) => {
      // If PDF or small image, read directly
      if (file.type.includes('pdf')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          resolve({ dataUrl, size: file.size });
        };
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          // Calculate approx size
          const size = Math.round((dataUrl.length * 3) / 4);
          resolve({ dataUrl, size });
        } else {
          resolve({ dataUrl: img.src, size: file.size });
        }
      };
      img.onerror = () => {
        // Fallback to original
        const fallbackReader = new FileReader();
        fallbackReader.onload = (ev) => {
          resolve({ dataUrl: ev.target?.result as string, size: file.size });
        };
        fallbackReader.readAsDataURL(file);
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle file selections with auto-compression
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const files = Array.from(fileList);

    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
        setErrorMessage('ਕਿਰਪਾ ਕਰਕੇ ਸਿਰਫ਼ ਫੋਟੋਆਂ (JPG, PNG, WebP) ਜਾਂ PDF ਅਪਲੋਡ ਕਰੋ।');
        continue;
      }

      try {
        const { dataUrl, size } = await compressImage(file);
        setImages((prev) => [
          ...prev,
          {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            dataUrl,
            type: 'image/jpeg',
            size,
          },
        ]);
      } catch (err) {
        console.error('Error compressing file:', err);
      }
    }
  };

  // Remove single image
  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Clear all images
  const handleClearAll = () => {
    setImages([]);
    setExtractedData(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setStep('upload');
  };

  // Run AI OCR
  const handleRunAiOcr = async () => {
    if (images.length === 0) {
      setErrorMessage('ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਫੋਟੋ (PAN, Aadhaar ਜਾਂ ਬੈਂਕ ਪਾਸਬੁੱਕ) ਅਪਲੋਡ ਕਰੋ।');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payloadImages = images.map((img) => ({
        data: img.dataUrl,
        mimeType: img.type || 'image/jpeg',
      }));

      const res = await fetch('/api/ocr-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ images: payloadImages }),
      });

      const responseText = await res.text();
      let json: any;

      try {
        json = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Failed to parse server response as JSON:', responseText);
        throw new Error(
          res.status === 413
            ? 'ਫੋਟੋ ਦਾ ਸਾਈਜ਼ ਬਹੁਤ ਵੱਡਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਛੋਟੀਆਂ ਫੋਟੋਆਂ ਅਪਲੋਡ ਕਰੋ।'
            : 'ਸਰਵਰ ਵੱਲੋਂ ਗਲਤ ਜਵਾਬ ਮਿਲਿਆ ਹੈ (Server returned non-JSON response).'
        );
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'AI ਦੁਆਰਾ ਦਸਤਾਵੇਜ਼ ਸਕੈਨ ਕਰਨ ਵਿੱਚ ਅਸਮਰੱਥ।');
      }

      setExtractedData(json.data);
      setStep('preview');
      setSuccessMessage('✓ AI ਦੁਆਰਾ ਸਾਰਾ ਡਾਟਾ ਸਫਲਤਾਪੂਰਵਕ ਪੜ੍ਹ ਲਿਆ ਗਿਆ ਹੈ!');
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMessage(
        err.message || 'ਸਰਵਰ ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਵਿੱਚ ਸਮੱਸਿਆ ਆਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Load Sample Demo Data Helper for quick testing
  const handleLoadSampleDemo = () => {
    setExtractedData({
      name: 'SARABJIT KAUR',
      fatherName: 'MUKHTIAR SINGH',
      pan: 'HSIPK5617N',
      aadhaarNumber: '7845 9012 3456',
      dob: '15/04/1981',
      gender: 'Female',
      address: 'VPO LOHIAN KHAS, WARD NO 4, TEHSIL SHAHKOT, DISTT JALANDHAR',
      pincode: '144702',
      state: 'PUNJAB',
      bankName: 'CAPITAL SMALL FINANCE BANK',
      accountNumber: '00520100004589',
      ifscCode: 'CLBL0000052',
      branchName: 'LOHIAN KHAS',
      placeOfFiling: 'LOHIAN KHAS',
      documentTypesDetected: ['PAN Card', 'Aadhaar Card', 'Bank Passbook'],
      summaryNotes: 'PAN: HSIPK5617N, Bank: Capital Small Finance Bank, Lohian Khas',
    });
    setStep('preview');
    setSuccessMessage('✓ ਡੈਮੋ ਦਸਤਾਵੇਜ਼ ਡਾਟਾ ਲੋਡ ਹੋ ਗਿਆ ਹੈ (Sample Demo Loaded)!');
  };

  // Apply extracted data to computation
  const handleApplyToComputation = () => {
    if (!extractedData) return;

    const updatedClient: ClientDetails = {
      ...computation.client,
      name: extractedData.name ? extractedData.name.toUpperCase() : computation.client.name,
      fatherName: extractedData.fatherName ? extractedData.fatherName.toUpperCase() : computation.client.fatherName,
      pan: extractedData.pan ? extractedData.pan.toUpperCase() : computation.client.pan,
      aadhaarNumber: extractedData.aadhaarNumber || computation.client.aadhaarNumber,
      dob: extractedData.dob || computation.client.dob,
      gender: extractedData.gender || computation.client.gender || 'Male',
      address: extractedData.address ? extractedData.address.toUpperCase() : computation.client.address,
      pincode: extractedData.pincode || computation.client.pincode,
      state: extractedData.state || computation.client.state || 'PUNJAB',
      bankName: extractedData.bankName || computation.client.bankName,
      accountNumber: extractedData.accountNumber || computation.client.accountNumber,
      ifscCode: extractedData.ifscCode ? extractedData.ifscCode.toUpperCase() : computation.client.ifscCode,
      branchName: extractedData.branchName || computation.client.branchName,
      mobile: extractedData.mobile || computation.client.mobile,
      email: extractedData.email || computation.client.email,
      placeOfFiling: extractedData.placeOfFiling || computation.client.placeOfFiling,
    };

    const sourceTracking = { ...(computation.sourceTracking || {}) };
    if (extractedData.name) {
      sourceTracking['client.name'] = { source: 'OCR', document: 'KYC Document Scan', confidence: 92, verified: true };
    }
    if (extractedData.pan) {
      sourceTracking['client.pan'] = { source: 'OCR', document: 'PAN Card Scan', confidence: 95, verified: true };
    }
    if (extractedData.aadhaarNumber) {
      sourceTracking['client.aadhaarNumber'] = { source: 'OCR', document: 'Aadhaar Card Scan', confidence: 95, verified: true };
    }
    if (extractedData.bankName || extractedData.accountNumber || extractedData.ifscCode) {
      sourceTracking['client.bankName'] = { source: 'OCR', document: 'Bank Passbook / Statement Scan', confidence: 90, verified: true };
      sourceTracking['client.accountNumber'] = { source: 'OCR', document: 'Bank Passbook / Statement Scan', confidence: 90, verified: true };
      sourceTracking['client.ifscCode'] = { source: 'OCR', document: 'Bank Passbook / Statement Scan', confidence: 90, verified: true };
    }

    const updatedComputation = recalculateFullComputation({
      ...computation,
      client: updatedClient,
      sourceTracking,
    });

    onUpdateComputation(updatedComputation);
    setStep('applied');
    setSuccessMessage('✓ ਸਾਰੇ ਖੇਤਰ (Name, PAN, Aadhaar, DOB, Bank) ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਵਿੱਚ ਸਫਲਤਾਪੂਰਵਕ ਭਰ ਦਿੱਤੇ ਗਏ ਹਨ!');

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                AI Document & Photo Scanner (ਆਟੋ ਡਾਟਾ ਸਕੈਨਰ)
                <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                  AI OCR
                </span>
              </h3>
              <p className="text-[11px] text-blue-100/90">
                PAN Card, Aadhaar Card ਜਾਂ Bank Passbook ਦੀ ਫੋਟੋ ਤੋਂ ਸਾਰਾ ਡਾਟਾ ਆਪਣੇ ਆਪ ਭਰੋ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/15 text-blue-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* Banner */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="text-slate-700 leading-relaxed">
              <p className="font-bold text-blue-950 text-xs">
                3 ਦਸਤਾਵੇਜ਼ਾਂ ਦੀਆਂ ਫੋਟੋਆਂ ਇਕੱਠੀਆਂ ਅਪਲੋਡ ਕਰੋ (Upload Multiple Photos Together):
              </p>
              <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                <span className="bg-white px-2 py-0.5 rounded-md border border-blue-200 font-semibold text-blue-800">
                  💳 1. PAN Card (ਨਾਮ, ਪਿਤਾ ਦਾ ਨਾਮ, DOB, PAN)
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-blue-200 font-semibold text-blue-800">
                  🆔 2. Aadhaar Card (ਆਧਾਰ ਨੰਬਰ, ਪਤਾ, ਲਿੰਗ)
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-blue-200 font-semibold text-blue-800">
                  🏦 3. Bank Passbook / Cheque (ਖਾਤਾ ਨੰਬਰ, IFSC, ਬੈਂਕ ਨਾਮ)
                </span>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-4 sm:p-6 bg-slate-50/60 hover:bg-blue-50/20 transition text-center space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              type="file"
              ref={cameraInputRef}
              capture="environment"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
                <Camera className="w-6 h-6" />
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-800 text-sm">
                ਫੋਟੋਆਂ ਇੱਥੇ ਖਿੱਚ ਕੇ ਲਿਆਓ ਜਾਂ ਫੋਨ/ਕੰਪਿਊਟਰ ਵਿੱਚੋਂ ਚੁਣੋ
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Drag & Drop Photos (PAN, Aadhaar, Passbook) or click to browse
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>ਫੋਟੋਆਂ ਚੁਣੋ (Browse Files)</span>
              </button>
              
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ਕੈਮਰੇ ਨਾਲ ਫੋਟੋ ਲਓ (Camera)</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleDemo}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                title="ਟੈਸਟ ਲਈ ਸੈਂਪਲ ਪੈਨ ਅਤੇ ਆਧਾਰ ਡਾਟਾ ਲੋਡ ਕਰੋ"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>ਟੈਸਟ ਡੈਮੋ ਲੋਡ ਕਰੋ (Load Demo KYC)</span>
              </button>
            </div>
          </div>

          {/* Selected Images List */}
          {images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  ਚੁਣੀਆਂ ਗਈਆਂ ਫੋਟੋਆਂ ({images.length} Photos Selected):
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-red-600 hover:text-red-800 font-bold text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ਸਾਰੀਆਂ ਹਟਾਓ (Clear All)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {images.map((img) => (
                  <div key={img.id} className="relative group bg-slate-100 rounded-xl p-1.5 border border-slate-200 shadow-xs flex flex-col items-center">
                    <img 
                      src={img.dataUrl} 
                      alt={img.name}
                      className="w-full h-24 object-cover rounded-lg border border-slate-200" 
                    />
                    <div className="w-full mt-1 flex items-center justify-between text-[10px] text-slate-600 px-1">
                      <span className="truncate max-w-[100px] font-medium">{img.name}</span>
                      <span>{(img.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md hover:bg-red-700 transition"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Run OCR Button */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRunAiOcr}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>AI ਦੁਆਰਾ ਫੋਟੋਆਂ ਸਕੈਨ ਹੋ ਰਹੀਆਂ ਹਨ... (Scanning Documents with AI)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>AI ਨਾਲ ਫੋਟੋਆਂ ਸਕੈਨ ਕਰੋ ਅਤੇ ਡਾਟਾ ਪੜ੍ਹੋ (Extract Data with AI)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 text-red-800 p-3 rounded-xl border border-red-200 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-emerald-50 text-emerald-900 p-3 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Extracted Data Preview Section */}
          {extractedData && (
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl p-4 border border-indigo-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-indigo-950 text-xs uppercase tracking-wide">
                    Extracted KYC & Bank Details (ਪੜ੍ਹਿਆ ਗਿਆ ਡਾਟਾ):
                  </span>
                </div>
                {extractedData.documentTypesDetected && (
                  <div className="flex gap-1">
                    {extractedData.documentTypesDetected.map((d, i) => (
                      <span key={i} className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਕਲਾਇੰਟ ਦਾ ਨਾਮ (Name):</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">{extractedData.name || '---'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਪਿਤਾ ਦਾ ਨਾਮ (Father's Name):</span>
                  <span className="font-bold text-slate-800 font-mono">{extractedData.fatherName || '---'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">PAN ਨੰਬਰ:</span>
                  <span className="font-bold text-blue-700 font-mono text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {extractedData.pan || '---'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਆਧਾਰ ਨੰਬਰ (Aadhaar):</span>
                  <span className="font-bold text-slate-800 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {extractedData.aadhaarNumber || '---'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਜਨਮ ਮਿਤੀ (Date of Birth):</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">{extractedData.dob || '---'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਲਿੰਗ (Gender):</span>
                  <span className="font-bold text-slate-800">{extractedData.gender || 'Male'}</span>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ਪਤਾ (Residential Address):</span>
                  <span className="text-slate-800 font-medium text-[11px] block">{extractedData.address || '---'}</span>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">ਬੈਂਕ ਦਾ ਨਾਮ (Bank Name):</span>
                    <span className="font-bold text-indigo-900">{extractedData.bankName || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">ਖਾਤਾ ਨੰਬਰ (Account Number):</span>
                    <span className="font-bold text-slate-900 font-mono">{extractedData.accountNumber || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">IFSC ਕੋਡ:</span>
                    <span className="font-bold text-slate-800 font-mono">{extractedData.ifscCode || '---'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">ਬ੍ਰਾਂਚ (Branch):</span>
                    <span className="text-slate-700">{extractedData.branchName || '---'}</span>
                  </div>
                </div>

              </div>

              {/* 1-Click Auto Fill Action */}
              <button
                type="button"
                onClick={handleApplyToComputation}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-5 h-5 text-white" />
                <span>1-ਕਲਿੱਕ: ਇਹ ਡਾਟਾ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਵਿੱਚ ਭਰੋ (Auto-Fill to Computation Sheet)</span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition text-xs font-semibold"
          >
            ਰੱਦ ਕਰੋ (Close)
          </button>

          {extractedData && (
            <button
              type="button"
              onClick={handleApplyToComputation}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Save</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
