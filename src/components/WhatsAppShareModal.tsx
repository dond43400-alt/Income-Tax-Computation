import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, FileText, Download, Share2, PhoneCall, Sparkles } from 'lucide-react';
import { TaxComputation, FirmDetails } from '../types';
import { formatINR, createComputationPdfBlob } from '../utils/pdfGenerator';

interface WhatsAppShareModalProps {
  computation: TaxComputation;
  firm: FirmDetails;
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  computation,
  firm,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const [mobileNumber, setMobileNumber] = useState(
    computation.client.mobile ? computation.client.mobile.replace(/[^0-9]/g, '') : ''
  );
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const agriIncome = computation.agriculturalIncome || computation.agriculturalDetails?.netAgriculturalIncome || computation.otherSources?.agriculturalIncome || 0;
  const agriGross = computation.agriculturalDetails?.grossAgriculturalReceipts || 0;
  const agriExp = computation.agriculturalDetails?.agriculturalExpenses || 0;

  const agriLine = agriIncome > 0 || agriGross > 0
    ? (agriGross > 0
        ? `🌾 *Agricultural Income (u/s 10(1)):* ${formatINR(agriIncome)} (Exempt) [Gross: ${formatINR(agriGross)} | Exp: ${formatINR(agriExp)}]\n`
        : `🌾 *Agricultural Income (u/s 10(1)):* ${formatINR(agriIncome)} (Exempt)\n`)
    : '';

  const messageText = `*INCOME TAX RETURN COMPUTATION (A.Y. ${computation.assessmentYear})*
----------------------------------------
Dear *${computation.client.name || 'Client'}*,
Your Income Tax Return computation statement is ready:

📄 *PAN:* ${computation.client.pan}
📋 *ITR Form:* ${computation.itrForm} (${computation.regimeOpted === 'new' ? 'New Tax Regime u/s 115BAC' : 'Old Tax Regime'})
📅 *Filing Date:* ${computation.filingDate || 'Current'}
🔢 *Ack No:* ${computation.acknowledgementNumber || 'e-Filed'}

💵 *Gross Total Income (GTI):* ${formatINR(computation.grossTotalIncome)}
${agriLine}📉 *Chapter VI-A Deductions:* ${formatINR(computation.deductions.totalDeductions)}
🎯 *Net Taxable Income:* ${formatINR(computation.totalTaxableIncome)}

📊 *Gross Tax Liability:* ${formatINR(computation.grossTaxLiability)}
💳 *Total Taxes Paid (TDS/Adv):* ${formatINR(computation.taxesPaid.totalTaxesPaid)}
----------------------------------------
${
  computation.refundDue > 0
    ? `🎉 *NET REFUND DUE:* ${formatINR(computation.refundDue)}\n(Refund will be credited to Bank A/c: ${computation.client.bankName || 'Bank'} - ${computation.client.accountNumber || '---'})`
    : computation.netTaxPayable > 0
    ? `⚠️ *NET TAX PAYABLE:* ${formatINR(computation.netTaxPayable)}\n(Payable via Challan 280 / e-Pay Tax)`
    : `✅ *TAX STATUS:* NIL Return (No Tax Payable / No Refund)`
}
----------------------------------------
🏦 *Bank Details:* ${computation.client.bankName || 'Bank'} | IFSC: ${computation.client.ifscCode || '---'}

*Prepared & Verified by:*
🏢 *${firm.firmName}*
📞 ${firm.phone || ''} ${firm.email ? `| ✉️ ${firm.email}` : ''}`;

  // Helper to format clean 10/12 digit phone number
  const getCleanPhone = () => {
    let clean = mobileNumber.replace(/[^0-9]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    return clean;
  };

  // 1. DIRECT PDF GENERATION & SEND TO CLIENT'S WHATSAPP
  const handleDirectSendPdfAndWhatsApp = async () => {
    setIsProcessing(true);
    setStatusMessage('Generating 1-Page Computation PDF...');
    
    try {
      const { file, fileName, blob } = createComputationPdfBlob(computation, firm);
      const cleanPhone = getCleanPhone();

      // Check if Web Share API with files is supported (Mobile / Tablet / Modern desktop)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setStatusMessage('Opening WhatsApp Share sheet with attached PDF...');
        try {
          await navigator.share({
            title: `Computation AY ${computation.assessmentYear} - ${computation.client.name}`,
            text: messageText,
            files: [file],
          });
          setIsProcessing(false);
          setStatusMessage('✓ Shared successfully!');
          return;
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            console.warn('Navigator share error, falling back to download + wa.me link:', shareErr);
          } else {
            setIsProcessing(false);
            setStatusMessage(null);
            return;
          }
        }
      }

      // Fallback: Trigger direct PDF download so it's instantly available on computer/phone
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Copy summary text to clipboard automatically
      try {
        await navigator.clipboard.writeText(messageText);
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }

      // Open WhatsApp chat directly to the client's mobile number
      setStatusMessage('✓ PDF Downloaded! Opening client WhatsApp chat...');
      
      const encoded = encodeURIComponent(messageText);
      const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone}?text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;

      setTimeout(() => {
        window.open(waUrl, '_blank');
        setIsProcessing(false);
      }, 500);

    } catch (err) {
      console.error('Error generating PDF for WhatsApp:', err);
      setIsProcessing(false);
      setStatusMessage('Error creating PDF. Please try again.');
    }
  };

  // 2. Open WhatsApp with Text Summary Only
  const handleSendTextOnly = () => {
    const cleanPhone = getCleanPhone();
    const encoded = encodeURIComponent(messageText);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
    onClose();
  };

  // 3. Copy Summary
  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-1.5">
                Send to Client WhatsApp
                <span className="bg-emerald-500/40 text-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  ਸਿੱਧਾ ਵਟਸਐਪ 'ਤੇ ਭੇਜੋ
                </span>
              </h3>
              <p className="text-[11px] text-emerald-100/90">
                Directly generate 1-Page PDF and send to client's mobile number
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-emerald-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          
          {/* Client Target Banner */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Client</div>
              <div className="font-bold text-slate-900 text-sm">
                {(computation.client.name || 'Client Name').toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                PAN: <strong className="text-slate-800">{computation.client.pan || '---'}</strong> | A.Y. {computation.assessmentYear}
              </div>
            </div>
            <div className="text-right">
              {computation.refundDue > 0 ? (
                <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg text-xs border border-emerald-300">
                  Refund: {formatINR(computation.refundDue)}
                </span>
              ) : computation.netTaxPayable > 0 ? (
                <span className="inline-block bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-lg text-xs border border-amber-300">
                  Payable: {formatINR(computation.netTaxPayable)}
                </span>
              ) : (
                <span className="inline-block bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-lg text-xs border border-blue-300">
                  NIL Return
                </span>
              )}
            </div>
          </div>

          {/* Client Mobile Input */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-[#10366b]">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                Client WhatsApp Mobile Number (ਕਲਾਇੰਟ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ):
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Auto-detected from Client Info</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-bold text-xs">
                🇮🇳 +91
              </span>
              <input
                type="text"
                placeholder="Enter 10-digit mobile number (e.g. 8146463219)"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 font-mono text-sm font-bold text-slate-900 bg-white"
              />
            </div>
            {mobileNumber && mobileNumber.length !== 10 && (
              <p className="text-[10px] text-amber-600 mt-1">
                Note: 10-digit mobile number recommended (without 0 or +91 prefix)
              </p>
            )}
          </div>

          {/* Direct Send Action Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-blue-50/60 p-3.5 rounded-xl border-2 border-emerald-500/40 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                1-Click Direct WhatsApp PDF Send:
              </div>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                Fast & Direct
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-snug">
              ਇਹ ਬਟਨ ਸਿੱਧਾ ਕੰਪਿਊਟੇਸ਼ਨ ਦੀ <strong>1-Page A4 PDF</strong> ਤਿਆਰ ਕਰੇਗਾ ਅਤੇ ਕਲਾਇੰਟ <strong>(+91 {mobileNumber || 'XXXXXXXXXX'})</strong> ਦੇ ਵਟਸਐਪ 'ਤੇ ਪੂਰੇ ਟੈਕਸ ਸਮਰੀ ਸੰਦੇਸ਼ ਸਮੇਤ ਖੋਲ੍ਹ ਦੇਵੇਗਾ।
            </p>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDirectSendPdfAndWhatsApp}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Preparing PDF & Opening WhatsApp...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-200" />
                  <span>ਸਿੱਧਾ PDF ਬਣਾਓ ਅਤੇ ਵਟਸਐਪ 'ਤੇ ਭੇਜੋ (Send PDF to Client)</span>
                </>
              )}
            </button>

            {statusMessage && (
              <div className="text-[11px] text-center font-bold text-emerald-800 bg-emerald-100/80 py-1.5 px-3 rounded-lg border border-emerald-200">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold text-xs">Message Text Preview (ਸੰਦੇਸ਼):</label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={6}
              readOnly
              value={messageText}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[10.5px] text-slate-800 outline-none leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition text-xs font-semibold"
          >
            Close (ਬੰਦ ਕਰੋ)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendTextOnly}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition"
              title="Open WhatsApp with text summary only"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
              <span>Only Text WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDirectSendPdfAndWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send PDF Now</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

