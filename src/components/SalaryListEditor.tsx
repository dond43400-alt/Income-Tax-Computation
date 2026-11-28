import React, { useState, useRef } from 'react';
import { 
  Building2, Plus, Trash2, Copy, ChevronDown, ChevronUp, 
  ArrowUp, ArrowDown, Upload, AlertTriangle, CheckCircle2, 
  Info, FileText, Sparkles, ShieldAlert, X
} from 'lucide-react';
import { SalaryDetails, SalaryEntry, TaxRegime } from '../types';
import { extractTextFromPdf, parseTaxDocumentText } from '../utils/pdfParser';
import { 
  calculateAllSalaries, 
  getEligibleStandardDeduction, 
  checkEmploymentPeriodOverlap, 
  detectDuplicateSalaryEntries 
} from '../utils/taxCalculator';
import { getReadableErrorMessage } from '../utils/safeFormat';

interface SalaryListEditorProps {
  salary: SalaryDetails;
  regime: TaxRegime;
  assessmentYear: string;
  onChange: (updatedSalary: SalaryDetails, totalTds?: number) => void;
}

export const SalaryListEditor: React.FC<SalaryListEditorProps> = ({
  salary,
  regime,
  assessmentYear,
  onChange,
}) => {
  // Ensure we have a populated salaryList
  const currentEntries: SalaryEntry[] = React.useMemo(() => {
    if (salary.salaryList && salary.salaryList.length > 0) {
      return salary.salaryList;
    }
    // Fallback: migrate single salary to list item
    const g = Number(salary.grossSalary || 0);
    const s17_1 = Number(salary.salarySection17_1 || g);
    const s17_2 = Number(salary.perquisites17_2 || 0);
    const s17_3 = Number(salary.profitsInLieu17_3 || 0);
    const ex = Number(salary.allowancesExempt || 0);
    const pt = Number(salary.professionalTax || 0);
    const ent = Number(salary.entertainmentAllowance || 0);
    const arr = Number(salary.salaryArrears || 0);

    return [{
      id: 'sal_1',
      employerName: salary.employerName || '',
      employerType: salary.employerType || 'Private',
      employerTAN: salary.employerTAN || '',
      grossSalary: g,
      salarySection17_1: s17_1,
      perquisites17_2: s17_2,
      profitsInLieu17_3: s17_3,
      allowancesExempt: ex,
      professionalTax: pt,
      entertainmentAllowance: ent,
      arrears: arr,
      tdsSalary: 0,
      taxableSalaryBeforeStdDed: Math.max(0, g - ex - pt - ent),
      isCollapsed: false,
    }];
  }, [salary]);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    salaryId: string;
    employerName: string;
    hasForm16: boolean;
  } | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<{ id: string; msg: string } | null>(null);
  const [duplicateDismissed, setDuplicateDismissed] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Recalculate salary details & trigger parent update
  const syncSalaryChanges = (newList: SalaryEntry[]) => {
    const updatedSalaryObj: SalaryDetails = {
      ...salary,
      salaryList: newList,
    };
    const agg = calculateAllSalaries(updatedSalaryObj, regime, assessmentYear);
    onChange({
      ...updatedSalaryObj,
      grossSalary: agg.grossSalary,
      salarySection17_1: agg.salarySection17_1,
      perquisites17_2: agg.perquisites17_2,
      profitsInLieu17_3: agg.profitsInLieu17_3,
      allowancesExempt: agg.allowancesExempt,
      professionalTax: agg.professionalTax,
      entertainmentAllowance: agg.entertainmentAllowance,
      standardDeduction: agg.standardDeduction,
      netSalary: agg.netSalary,
      salaryArrears: agg.salaryArrears,
      hasOverlappingPeriods: agg.hasOverlappingPeriods,
      overlapWarning: agg.overlapWarning,
      employerName: agg.primaryEmployerName,
      employerType: agg.primaryEmployerType,
      employerTAN: agg.primaryEmployerTAN,
    }, agg.totalTDSSalary);
  };

  // Add Employer
  const handleAddEmployer = () => {
    const newId = `sal_${Date.now()}`;
    const newEntry: SalaryEntry = {
      id: newId,
      employerName: '',
      employerType: 'Private',
      employerTAN: '',
      grossSalary: 0,
      salarySection17_1: 0,
      perquisites17_2: 0,
      profitsInLieu17_3: 0,
      allowancesExempt: 0,
      professionalTax: 0,
      entertainmentAllowance: 0,
      tdsSalary: 0,
      taxableSalaryBeforeStdDed: 0,
      isCollapsed: false,
    };
    const updated = [...currentEntries, newEntry];
    syncSalaryChanges(updated);
  };

  // Update specific employer fields
  const handleUpdateEntry = (id: string, updates: Partial<SalaryEntry>) => {
    const updated = currentEntries.map(entry => {
      if (entry.id !== id) return entry;
      const combined = { ...entry, ...updates };

      // Compute individual entry gross if components changed
      const s17_1 = Number(combined.salarySection17_1 || 0);
      const s17_2 = Number(combined.perquisites17_2 || 0);
      const s17_3 = Number(combined.profitsInLieu17_3 || 0);
      const basic = Number(combined.basicSalary || 0);
      const da = Number(combined.dearnessAllowance || 0);
      const hra = Number(combined.hra || 0);
      const other = Number(combined.otherAllowances || 0);
      const bonus = Number(combined.bonus || 0);
      const comm = Number(combined.commission || 0);
      const arr = Number(combined.arrears || 0);

      const compSum = basic + da + hra + other + bonus + comm + arr + s17_2 + s17_3;
      let finalGross = Number(combined.grossSalary || 0);
      
      // If user typed into detailed breakdown, update gross
      if (updates.basicSalary !== undefined || updates.dearnessAllowance !== undefined || 
          updates.hra !== undefined || updates.otherAllowances !== undefined || 
          updates.bonus !== undefined || updates.commission !== undefined || 
          updates.arrears !== undefined || updates.perquisites17_2 !== undefined || 
          updates.profitsInLieu17_3 !== undefined) {
        if (compSum > 0) {
          finalGross = compSum;
        }
      }

      const exempt = Number(combined.allowancesExempt || 0);
      const pt = Number(combined.professionalTax || 0);
      const ent = Number(combined.entertainmentAllowance || 0);
      const taxableBeforeStd = Math.max(0, finalGross - (regime === 'old' ? exempt : 0) - (regime === 'old' ? pt : 0) - (regime === 'old' ? ent : 0));

      return {
        ...combined,
        grossSalary: finalGross,
        taxableSalaryBeforeStdDed: taxableBeforeStd,
      };
    });
    syncSalaryChanges(updated);
  };

  // Duplicate employer
  const handleDuplicateEntry = (id: string) => {
    const target = currentEntries.find(e => e.id === id);
    if (!target) return;

    const duplicated: SalaryEntry = {
      ...target,
      id: `sal_${Date.now()}`,
      employerName: target.employerName ? `${target.employerName} (Copy)` : 'Employer (Copy)',
      sourceDocument: undefined,
      sourceType: undefined,
      isCollapsed: false,
    };
    const index = currentEntries.findIndex(e => e.id === id);
    const updated = [...currentEntries];
    updated.splice(index + 1, 0, duplicated);
    syncSalaryChanges(updated);
  };

  // Move employer up / down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentEntries.length) return;
    const updated = [...currentEntries];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    syncSalaryChanges(updated);
  };

  // Delete initiation
  const promptDelete = (entry: SalaryEntry) => {
    const hasForm16 = Boolean(entry.sourceType === 'Form 16' || entry.sourceDocument);
    setDeleteModal({
      isOpen: true,
      salaryId: entry.id,
      employerName: entry.employerName || 'Employer',
      hasForm16,
    });
  };

  const confirmDelete = () => {
    if (!deleteModal) return;
    const updated = currentEntries.filter(e => e.id !== deleteModal.salaryId);
    if (updated.length === 0) {
      // Keep at least one blank entry
      const newEntry: SalaryEntry = {
        id: `sal_${Date.now()}`,
        employerName: '',
        employerType: 'Private',
        employerTAN: '',
        grossSalary: 0,
        salarySection17_1: 0,
        perquisites17_2: 0,
        profitsInLieu17_3: 0,
        allowancesExempt: 0,
        professionalTax: 0,
        entertainmentAllowance: 0,
        tdsSalary: 0,
        taxableSalaryBeforeStdDed: 0,
        isCollapsed: false,
      };
      syncSalaryChanges([newEntry]);
    } else {
      syncSalaryChanges(updated);
    }
    setDeleteModal(null);
  };

  // Upload Form 16 per employer
  const handleForm16Upload = async (salaryId: string, file: File) => {
    if (!file) return;
    setUploadingId(salaryId);
    setUploadSuccessMsg(null);

    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const res = await extractTextFromPdf(file);
        if (res.isPasswordProtected) {
          alert('This PDF is password protected. Please remove the password and try again.');
          setUploadingId(null);
          return;
        }
        text = res.text;
      } else {
        text = await file.text();
      }

      if (!text || text.trim().length === 0) {
        alert('Could not read text from this document. Please ensure it is a digital PDF or Form 16 text.');
        setUploadingId(null);
        return;
      }

      const extracted = parseTaxDocumentText(text, file.name, file.size);
      const parsedSalary = extracted.parsedComputation?.salary;
      const parsedTaxes = extracted.parsedComputation?.taxesPaid;
      
      // Extract specific Form 16 fields
      const f16EmpName = parsedSalary?.employerName || '';
      const f16TAN = parsedSalary?.employerTAN || '';
      const f16Gross = Number(parsedSalary?.grossSalary || parsedSalary?.salarySection17_1 || 0);
      const f16S17_1 = Number(parsedSalary?.salarySection17_1 || f16Gross);
      const f16S17_2 = Number(parsedSalary?.perquisites17_2 || 0);
      const f16S17_3 = Number(parsedSalary?.profitsInLieu17_3 || 0);
      const f16Exempt = Number(parsedSalary?.allowancesExempt || 0);
      const f16ProfTax = Number(parsedSalary?.professionalTax || 0);
      const f16TDS = Number(parsedTaxes?.tdsSalary || 0);

      handleUpdateEntry(salaryId, {
        employerName: f16EmpName || undefined,
        employerTAN: f16TAN || undefined,
        grossSalary: f16Gross > 0 ? f16Gross : undefined,
        salarySection17_1: f16S17_1 > 0 ? f16S17_1 : undefined,
        perquisites17_2: f16S17_2,
        profitsInLieu17_3: f16S17_3,
        allowancesExempt: f16Exempt,
        professionalTax: f16ProfTax,
        tdsSalary: f16TDS,
        sourceDocument: file.name,
        sourceType: 'Form 16',
        confidence: 95,
        verificationStatus: 'Verified',
      });

      setUploadSuccessMsg({
        id: salaryId,
        msg: `Successfully imported Form 16 for ${f16EmpName || 'Employer'} (Gross: ₹${f16Gross.toLocaleString('en-IN')}, TDS: ₹${f16TDS.toLocaleString('en-IN')})`,
      });
    } catch (err: unknown) {
      alert(`Error extracting Form 16: ${getReadableErrorMessage(err, 'Unknown error')}`);
    } finally {
      setUploadingId(null);
    }
  };

  // Perform calculations & warnings
  const aggResult = calculateAllSalaries(salary, regime, assessmentYear);
  const overlapInfo = checkEmploymentPeriodOverlap(currentEntries);
  const duplicateWarnings = detectDuplicateSalaryEntries(currentEntries);
  const maxStdDed = getEligibleStandardDeduction(regime, assessmentYear);

  return (
    <div className="space-y-4">
      {/* Top Header with Add Employer & Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#10366b]" />
          <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
            Schedule Salary (Sec 15–17) — Multiple Employers Supported
          </span>
          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            {currentEntries.length} {currentEntries.length === 1 ? 'Employer' : 'Employers'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddEmployer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10366b] hover:bg-[#0c2a54] text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Salary / Employer</span>
        </button>
      </div>

      {/* Employment Period Overlap Warning Banner */}
      {overlapInfo.hasOverlap && (
        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Employment periods overlap — please verify.</span>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Multiple employment date intervals coincide: {overlapInfo.overlappingPairs.map(p => `${p.emp1} (${p.period1}) & ${p.emp2} (${p.period2})`).join('; ')}. If this represents dual employment or job transition within the same month, verify standard deduction and tax credits.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate Form 16 / Salary Warnings */}
      {duplicateWarnings.length > 0 && duplicateWarnings.map((warn, idx) => {
        if (duplicateDismissed[idx]) return null;
        return (
          <div key={idx} className="p-3 bg-rose-50/90 border border-rose-300 rounded-lg flex items-start justify-between gap-2.5 text-rose-900 text-xs">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Duplicate Salary / Form 16 Alert</span>
                <p className="text-rose-800 text-[11px] mt-0.5">{warn}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateDismissed(prev => ({ ...prev, [idx]: true }))}
              className="text-xs px-2 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded font-medium shrink-0"
            >
              Keep Both
            </button>
          </div>
        );
      })}

      {/* Salary Entries List */}
      <div className="space-y-3">
        {currentEntries.map((entry, index) => {
          const isCollapsed = entry.isCollapsed || false;
          const entryGross = Number(entry.grossSalary || 0);
          const entryTDS = Number(entry.tdsSalary || 0);
          const entryTaxableBeforeStd = Number(entry.taxableSalaryBeforeStdDed || 0);

          return (
            <div 
              key={entry.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-150 hover:border-slate-300"
            >
              {/* Entry Card Header */}
              <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#10366b] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs">
                        {entry.employerName || `Employer ${index + 1}`}
                      </span>
                      {entry.employerTAN && (
                        <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                          TAN: {entry.employerTAN}
                        </span>
                      )}
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                        {entry.employerType || 'Private'}
                      </span>
                      {entry.sourceType === 'Form 16' && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Form 16
                        </span>
                      )}
                    </div>
                    {(entry.fromDate || entry.toDate) && (
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Period: {entry.fromDate || 'N/A'} → {entry.toDate || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Numbers & Card Action Buttons */}
                <div className="flex items-center gap-2">
                  <div className="text-right pr-2 hidden sm:block">
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      Gross: ₹{entryGross.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Taxable before Std Ded: <strong className="text-blue-700">₹{entryTaxableBeforeStd.toLocaleString('en-IN')}</strong> | TDS: ₹{entryTDS.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500 rounded"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === currentEntries.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500 rounded"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Duplicate Button */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateEntry(entry.id)}
                    className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg text-xs"
                    title="Duplicate Employer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => promptDelete(entry)}
                    className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                    title="Delete Employer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Collapse Toggle */}
                  <button
                    type="button"
                    onClick={() => handleUpdateEntry(entry.id, { isCollapsed: !isCollapsed })}
                    className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                    title={isCollapsed ? 'Expand Details' : 'Collapse Details'}
                  >
                    {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Upload Success Alert */}
              {uploadSuccessMsg && uploadSuccessMsg.id === entry.id && (
                <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-emerald-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{uploadSuccessMsg.msg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Entry Body Form Inputs */}
              {!isCollapsed && (
                <div className="p-4 space-y-4">
                  {/* Employer Profile & Form 16 Upload Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#10366b]" />
                      <div className="text-xs font-semibold text-slate-700">
                        Employer & Form 16 Import
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={el => (fileInputRefs.current[entry.id] = el)}
                        accept=".pdf,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleForm16Upload(entry.id, f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingId === entry.id}
                        onClick={() => fileInputRefs.current[entry.id]?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-[#10366b] hover:bg-blue-50 text-xs font-semibold rounded-lg shadow-sm transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingId === entry.id ? 'Importing Form 16...' : 'Upload Form 16 (PDF)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Core Employer Meta Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-600 mb-1 font-semibold">
                        Employer Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={entry.employerName || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { employerName: e.target.value })}
                        placeholder="e.g. Infosys Ltd / ABC Technologies / Dept of Education"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Employer Category</label>
                      <select
                        value={entry.employerType || 'Private'}
                        onChange={(e) => handleUpdateEntry(entry.id, { employerType: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                      >
                        <option value="Private">Private / Corporate</option>
                        <option value="Central Govt">Central Govt</option>
                        <option value="State Govt">State Govt</option>
                        <option value="PSU">PSU / Public Sector</option>
                        <option value="Pensioners">Pensioners</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Employer TAN</label>
                      <input
                        type="text"
                        value={entry.employerTAN || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { employerTAN: e.target.value.toUpperCase() })}
                        placeholder="e.g. PNEA12345B"
                        maxLength={10}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>
                  </div>

                  {/* Employment Period Dates & Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Employment From</label>
                      <input
                        type="date"
                        value={entry.fromDate || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { fromDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Employment To</label>
                      <input
                        type="date"
                        value={entry.toDate || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { toDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Employer PAN (Optional)</label>
                      <input
                        type="text"
                        value={entry.employerPAN || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { employerPAN: e.target.value.toUpperCase() })}
                        placeholder="e.g. AAACP1234A"
                        maxLength={10}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">City / Town of Employer</label>
                      <input
                        type="text"
                        value={entry.employerAddress || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { employerAddress: e.target.value })}
                        placeholder="e.g. Bengaluru, Karnataka"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Salary Components & Gross */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                      <span>Salary Structure & Components (Sec 17(1))</span>
                      <span className="text-[11px] font-mono text-blue-900 normal-case">
                        Gross Salary: <strong className="text-[#10366b]">₹{entryGross.toLocaleString('en-IN')}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1 font-semibold">
                          Total Gross Salary (₹)
                        </label>
                        <input
                          type="number"
                          value={entry.grossSalary || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { grossSalary: parseFloat(e.target.value) || 0, salarySection17_1: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 750000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono font-bold text-[#10366b]"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Basic Salary (₹)</label>
                        <input
                          type="number"
                          value={entry.basicSalary || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { basicSalary: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 400000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">House Rent Allowance (HRA) (₹)</label>
                        <input
                          type="number"
                          value={entry.hra || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { hra: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 150000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Dearness Allowance (DA) (₹)</label>
                        <input
                          type="number"
                          value={entry.dearnessAllowance || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { dearnessAllowance: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 50000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div>
                        <label className="block text-slate-600 mb-1">Other Allowances (₹)</label>
                        <input
                          type="number"
                          value={entry.otherAllowances || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { otherAllowances: parseFloat(e.target.value) || 0 })}
                          placeholder="Special / Conveyance etc."
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Bonus & Incentives (₹)</label>
                        <input
                          type="number"
                          value={entry.bonus || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { bonus: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 50000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Commission (₹)</label>
                        <input
                          type="number"
                          value={entry.commission || ''}
                          onChange={(e) => handleUpdateEntry(entry.id, { commission: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 25000"
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Arrears, Perquisites (17(2)) & Profits in Lieu (17(3)) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-amber-900">Salary Arrears (₹)</label>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                          Relief u/s 89
                        </span>
                      </div>
                      <input
                        type="number"
                        value={entry.arrears || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { arrears: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 75000"
                        className="w-full p-2 border border-amber-300 rounded-lg outline-none focus:border-amber-600 font-mono bg-white"
                      />
                      <input
                        type="text"
                        value={entry.arrearsFinancialYear || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { arrearsFinancialYear: e.target.value })}
                        placeholder="Relating to FY (e.g. 2023-24)"
                        className="w-full p-1.5 border border-amber-200 rounded-lg text-[11px] bg-white"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <label className="font-semibold text-slate-700 block">Perquisites u/s 17(2) (₹)</label>
                      <input
                        type="number"
                        value={entry.perquisites17_2 || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { perquisites17_2: parseFloat(e.target.value) || 0 })}
                        placeholder="Rent-free accom / Car etc."
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono bg-white"
                      />
                      <input
                        type="text"
                        value={entry.perquisitesDetails || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { perquisitesDetails: e.target.value })}
                        placeholder="Perquisite nature/description"
                        className="w-full p-1.5 border border-slate-200 rounded-lg text-[11px] bg-white"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <label className="font-semibold text-slate-700 block">Profits in Lieu u/s 17(3) (₹)</label>
                      <input
                        type="number"
                        value={entry.profitsInLieu17_3 || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { profitsInLieu17_3: parseFloat(e.target.value) || 0 })}
                        placeholder="Retrenchment / VRS etc."
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono bg-white"
                      />
                      <span className="text-[10px] text-slate-500 block">
                        Compensation & taxable receipts in connection with employment.
                      </span>
                    </div>
                  </div>

                  {/* Exemptions, Professional Tax & TDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">
                        Allowances Exempt u/s 10 (₹)
                      </label>
                      <input
                        type="number"
                        value={entry.allowancesExempt || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { allowancesExempt: parseFloat(e.target.value) || 0 })}
                        placeholder="HRA / LTA exempt"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {regime === 'new' ? 'Note: Most allowances are not exempt in New Regime' : 'Exempt in Old Regime'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">
                        Professional Tax u/s 16(iii) (₹)
                      </label>
                      <input
                        type="number"
                        value={entry.professionalTax || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { professionalTax: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 2400"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Deducted by this employer
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">
                        TDS u/s 192 Deducted (₹)
                      </label>
                      <input
                        type="number"
                        value={entry.tdsSalary || ''}
                        onChange={(e) => handleUpdateEntry(entry.id, { tdsSalary: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 45000"
                        className="w-full p-2 border border-blue-300 rounded-lg outline-none focus:border-blue-600 font-mono font-bold text-blue-900 bg-blue-50/40"
                      />
                      <span className="text-[10px] text-blue-700 mt-0.5 block font-semibold">
                        Tax Credit synchronized to Part Taxes Paid
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggregate Salary Summary Table (Single Standard Deduction Applied) */}
      <div className="bg-[#10366b]/5 border border-[#10366b]/20 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#10366b]/20">
          <span className="font-bold text-[#10366b] text-xs uppercase tracking-wide">
            Total Salary Aggregation ({currentEntries.length} {currentEntries.length === 1 ? 'Employer' : 'Employers'})
          </span>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
            Standard Deduction: ₹{aggResult.standardDeduction.toLocaleString('en-IN')} (Applied ONCE)
          </span>
        </div>

        {/* Employer-by-Employer Scannable Breakdown */}
        {currentEntries.length > 1 && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Employer Name / TAN</th>
                  <th className="p-2 text-right">Gross Salary</th>
                  <th className="p-2 text-right">Exemptions</th>
                  <th className="p-2 text-right">Prof Tax</th>
                  <th className="p-2 text-right">Taxable (Pre-Std Ded)</th>
                  <th className="p-2 text-right">TDS (192)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {currentEntries.map((e, idx) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-500 font-sans">{idx + 1}</td>
                    <td className="p-2 font-sans font-medium text-slate-800">
                      {e.employerName || `Employer ${idx + 1}`}
                      {e.employerTAN && <span className="text-[10px] text-slate-500 font-mono ml-1">({e.employerTAN})</span>}
                    </td>
                    <td className="p-2 text-right font-bold text-slate-800">₹{Number(e.grossSalary || 0).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right text-rose-700">₹{Number(e.allowancesExempt || 0).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right text-rose-700">₹{Number(e.professionalTax || 0).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right font-bold text-blue-900">₹{Number(e.taxableSalaryBeforeStdDed || 0).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right font-semibold text-emerald-700">₹{Number(e.tdsSalary || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Aggregated Totals Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total Gross Salary</span>
            <span className="font-mono font-bold text-slate-800 text-sm">
              ₹{aggResult.grossSalary.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total Exemptions u/s 10</span>
            <span className="font-mono font-bold text-rose-700 text-sm">
              ₹{aggResult.allowancesExempt.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Standard Deduction u/s 16(ia)</span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              ₹{aggResult.standardDeduction.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-[#10366b]/30 bg-blue-50/50">
            <span className="text-blue-900 font-semibold block text-[11px]">Net Chargeable Salary</span>
            <span className="font-mono font-bold text-[#10366b] text-base">
              ₹{aggResult.netSalary.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Delete Salary / Employer Record</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the salary record for <strong className="text-slate-800">"{deleteModal.employerName}"</strong>?
            </p>

            {deleteModal.hasForm16 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This entry contains imported Form 16 data. Deleting it will remove the extracted salary figures and associated TDS credits.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
