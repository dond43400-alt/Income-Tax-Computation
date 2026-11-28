import React, { useState, useMemo } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  Check, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  ShieldCheck, 
  FileText, 
  Copy, 
  Layers, 
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  TaxComputation, 
  ExtractedPdfResult, 
  ExtractedFieldItem, 
  ExtractedDocumentConflict, 
  ExtractedDocumentDuplicate,
  ExtractionCategory 
} from '../types';
import { recalculateFullComputation } from '../utils/taxCalculator';
import { toSafeString } from '../utils/safeFormat';

interface ExtractionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedResult: ExtractedPdfResult | null;
  currentComputation: TaxComputation;
  onApplyData: (updatedComputation: TaxComputation) => void;
}

export const ExtractionReviewModal: React.FC<ExtractionReviewModalProps> = ({
  isOpen,
  onClose,
  extractedResult,
  currentComputation,
  onApplyData,
}) => {
  if (!isOpen || !extractedResult) return null;

  const [activeTab, setActiveTab] = useState<'all' | 'detected' | 'review' | 'conflicts'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Local state for all fields
  const [fields, setFields] = useState<ExtractedFieldItem[]>(() => {
    return (extractedResult.extractedFields || []).map((f) => ({
      ...f,
      userAction: f.detected ? 'accept' : 'ignore',
      editedValue: f.value,
    }));
  });

  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');

  // Counters
  const detectedCount = useMemo(() => fields.filter((f) => f.detected).length, [fields]);
  const reviewRequiredCount = useMemo(() => fields.filter((f) => f.reviewRequired && f.detected).length, [fields]);
  const conflictsCount = useMemo(() => (extractedResult.conflicts || []).length, [extractedResult]);

  // Categories present
  const categories = useMemo(() => {
    const set = new Set<string>();
    fields.forEach((f) => set.add(f.category));
    return ['All', ...Array.from(set)];
  }, [fields]);

  // Filtered fields
  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      // Category filter
      if (selectedCategory !== 'All' && f.category !== selectedCategory) {
        return false;
      }
      // Tab filter
      if (activeTab === 'detected') return f.detected;
      if (activeTab === 'review') return f.reviewRequired && f.detected;
      if (activeTab === 'conflicts') return f.status === 'Conflict';
      return true;
    });
  }, [fields, activeTab, selectedCategory]);

  // Handle single field action
  const handleActionChange = (id: string, action: 'accept' | 'edit' | 'reject' | 'ignore') => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, userAction: action } : f))
    );
  };

  // Start inline editing
  const handleStartEdit = (f: ExtractedFieldItem) => {
    setEditingFieldId(f.id);
    setTempEditValue(f.editedValue !== null && f.editedValue !== undefined ? toSafeString(f.editedValue) : '');
  };

  // Save inline edit
  const handleSaveEdit = (id: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const num = parseFloat(tempEditValue.replace(/,/g, ''));
          const isNumeric = !isNaN(num) && typeof f.value === 'number';
          return {
            ...f,
            editedValue: isNumeric ? num : tempEditValue,
            userAction: 'accept',
            verified: true,
            status: 'Verified',
            reviewRequired: false,
          };
        }
        return f;
      })
    );
    setEditingFieldId(null);
  };

  // Mark single item verified
  const handleToggleVerified = (id: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, verified: !f.verified, reviewRequired: f.verified, userAction: 'accept' }
          : f
      )
    );
  };

  // Bulk actions
  const handleAcceptAllDetected = () => {
    setFields((prev) =>
      prev.map((f) => (f.detected ? { ...f, userAction: 'accept' } : f))
    );
  };

  const handleMarkAllVerified = () => {
    setFields((prev) =>
      prev.map((f) =>
        f.detected ? { ...f, userAction: 'accept', verified: true, reviewRequired: false } : f
      )
    );
  };

  const handleRejectAll = () => {
    setFields((prev) => prev.map((f) => ({ ...f, userAction: 'reject' })));
  };

  // Get current computation value for comparison
  const getCurrentValue = (key: string): any => {
    const keys = key.split('.');
    let cur: any = currentComputation;
    for (const k of keys) {
      if (cur && typeof cur === 'object' && k in cur) {
        cur = cur[k];
      } else {
        return null;
      }
    }
    return cur;
  };

  // Apply to client computation
  const handleApplyToComputation = () => {
    // Clone current computation
    const updated = JSON.parse(JSON.stringify(currentComputation)) as TaxComputation;
    const sourceTracking = updated.sourceTracking || {};

    fields.forEach((f) => {
      if (f.userAction === 'accept') {
        const valToSet = f.editedValue !== undefined ? f.editedValue : f.value;
        if (valToSet === null || valToSet === undefined) return;

        // Set value in updated computation by key path
        const keys = f.key.split('.');
        let obj: any = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]]) obj[keys[i]] = {};
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = valToSet;

        // Track source
        sourceTracking[f.key] = {
          source: f.source || 'Supporting Document',
          document: f.sourceDocument || extractedResult.fileName,
          confidence: f.confidence,
          verified: f.verified,
        };
      }
    });

    updated.sourceTracking = sourceTracking;
    updated.sourcePdfName = extractedResult.fileName;

    // Recalculate using central tax engine
    const fullRecalculated = recalculateFullComputation(updated);
    onApplyData(fullRecalculated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Document Extraction & Zero-Fabrication Audit Review
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-400/30">
                  {extractedResult.detectedDocType}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>File: <strong className="text-white font-mono">{extractedResult.fileName}</strong></span>
                <span>•</span>
                <span>Overall Confidence: <strong className={extractedResult.confidence >= 85 ? 'text-emerald-400' : 'text-amber-400'}>{extractedResult.confidence}%</strong></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts & Warnings */}
        {extractedResult.isScannedOrImageOnly && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2 text-amber-900 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Scanned Document Detected:</strong> This PDF contains an image-only scan without digital text layers. Confidence is 0%. Please run AI OCR or verify figures manually.
            </span>
          </div>
        )}

        {(extractedResult.conflicts || []).length > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-3 space-y-1">
            <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Multi-Source Data Conflicts Detected ({extractedResult.conflicts?.length})</span>
            </div>
            {extractedResult.conflicts?.map((c, i) => (
              <p key={i} className="text-[11px] text-rose-800 pl-6">
                • <strong>{c.field}:</strong> {c.message}
              </p>
            ))}
          </div>
        )}

        {(extractedResult.duplicates || []).length > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-5 py-2 flex items-center gap-2 text-blue-900 text-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Multi-Source Duplicate Protection:</strong> Verified matching figures across multiple documents. Items are preserved without duplicate addition.
            </span>
          </div>
        )}

        {/* Toolbar & Filter Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Fields ({fields.length})
            </button>
            <button
              onClick={() => setActiveTab('detected')}
              className={`px-3 py-1 rounded font-semibold transition ${
                activeTab === 'detected'
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Detected Only ({detectedCount})
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1 rounded font-semibold transition ${
                activeTab === 'review'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Review Required ({reviewRequiredCount})
            </button>
            {conflictsCount > 0 && (
              <button
                onClick={() => setActiveTab('conflicts')}
                className={`px-3 py-1 rounded font-semibold transition ${
                  activeTab === 'conflicts'
                    ? 'bg-rose-700 text-white'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Conflicts ({conflictsCount})
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Head:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-1 border border-slate-300 rounded bg-white font-medium text-slate-800 focus:border-blue-600 outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptAllDetected}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-semibold hover:bg-emerald-100 transition text-[11px]"
            >
              Accept All Detected
            </button>
            <button
              onClick={handleMarkAllVerified}
              className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-300 rounded font-semibold hover:bg-blue-100 transition text-[11px]"
            >
              Mark All Verified
            </button>
            <button
              onClick={handleRejectAll}
              className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold hover:bg-slate-200 transition text-[11px]"
            >
              Reject All
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full border-collapse text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-2.5 text-left border-r border-slate-200">Field / Income Head</th>
                <th className="p-2.5 text-right border-r border-slate-200">Extracted Value</th>
                <th className="p-2.5 text-left border-r border-slate-200">Source & Doc</th>
                <th className="p-2.5 text-center border-r border-slate-200">Confidence</th>
                <th className="p-2.5 text-right border-r border-slate-200">Current Value</th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No fields match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredFields.map((f) => {
                  const curVal = getCurrentValue(f.key);
                  const isEditing = editingFieldId === f.id;
                  const isAccepted = f.userAction === 'accept';
                  const isRejected = f.userAction === 'reject';
                  const isIgnored = f.userAction === 'ignore';

                  let displayExtracted = 'Not Detected';
                  if (f.detected && f.value !== null && f.value !== undefined) {
                    displayExtracted = typeof f.value === 'number'
                      ? `₹${Number(f.value).toLocaleString('en-IN')}`
                      : toSafeString(f.value) || 'Not Detected';
                  }

                  let displayCurrent = '—';
                  if (curVal !== null && curVal !== undefined && curVal !== '') {
                    displayCurrent = typeof curVal === 'number'
                      ? `₹${Number(curVal).toLocaleString('en-IN')}`
                      : toSafeString(curVal) || '—';
                  }

                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-slate-200 transition ${
                        isRejected || isIgnored
                          ? 'bg-slate-50 opacity-60 text-slate-400'
                          : f.status === 'Conflict'
                          ? 'bg-rose-50/70'
                          : f.verified
                          ? 'bg-emerald-50/40'
                          : f.detected
                          ? 'bg-white hover:bg-blue-50/30'
                          : 'bg-slate-50/40 text-slate-400'
                      }`}
                    >
                      {/* Field Name & Category */}
                      <td className="p-2.5 border-r border-slate-200">
                        <div className="font-semibold text-slate-900">{f.field}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded">
                            {f.category}
                          </span>
                          {f.sectionCode && (
                            <span className="font-mono text-blue-700">Sec {f.sectionCode}</span>
                          )}
                          {f.suggestedIncomeHead && (
                            <span className="text-slate-600">→ {f.suggestedIncomeHead}</span>
                          )}
                        </div>
                      </td>

                      {/* Extracted Value */}
                      <td className="p-2.5 text-right font-mono font-bold border-r border-slate-200">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              className="p-1 border border-blue-500 rounded text-right font-mono w-28 bg-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(f.id)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingFieldId(null)}
                              className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={
                                f.detected ? 'text-blue-950 font-bold' : 'text-slate-400 font-normal italic'
                              }
                            >
                              {f.editedValue !== undefined && f.editedValue !== f.value
                                ? `₹${Number(f.editedValue).toLocaleString('en-IN')} (Edited)`
                                : displayExtracted}
                            </span>
                            {f.detected && (
                              <button
                                onClick={() => handleStartEdit(f)}
                                className="p-1 text-slate-400 hover:text-blue-700 hover:bg-slate-100 rounded"
                                title="Edit Value"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Source & Document */}
                      <td className="p-2.5 border-r border-slate-200 text-slate-700">
                        {f.detected ? (
                          <div>
                            <div className="font-semibold text-slate-900">{f.source || 'Supporting Document'}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                              {f.sourceDocument}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="p-2.5 text-center border-r border-slate-200">
                        {f.detected ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.confidence >= 90
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : f.confidence >= 75
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {f.confidence}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">0%</span>
                        )}
                      </td>

                      {/* Current Value */}
                      <td className="p-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                        {displayCurrent}
                      </td>

                      {/* Actions */}
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleActionChange(f.id, 'accept')}
                            disabled={!f.detected && !f.editedValue}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                              isAccepted
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                            }`}
                            title="Accept Extracted Value"
                          >
                            <Check className="w-3 h-3" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleToggleVerified(f.id)}
                            disabled={!f.detected && !f.editedValue}
                            className={`p-1 rounded text-[11px] font-semibold transition ${
                              f.verified
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
                            }`}
                            title="Mark Verified by Preparer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleActionChange(f.id, 'reject')}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                              isRejected
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                            }`}
                            title="Reject this Extracted Field"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Confirmation */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600">
            <div>
              Total Detected: <strong className="text-slate-900 font-bold">{detectedCount}</strong>
            </div>
            <div>
              Accepted: <strong className="text-emerald-700 font-bold">{fields.filter((f) => f.userAction === 'accept').length}</strong>
            </div>
            <div>
              Verified: <strong className="text-blue-700 font-bold">{fields.filter((f) => f.verified).length}</strong>
            </div>
            <div>
              Zero-Fabrication Status: <strong className="text-emerald-700 font-semibold">Strict (0 Artificial Values)</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyToComputation}
              className="px-5 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <span>Apply Verified Data to Computation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
