import {
  TaxComputation,
  TaxChallanRecord,
  TaxPaymentCategory,
  LateFilingFee234FDetails,
  FinalSettlementSummary,
  FinalSettlementOutcome,
  ChallanAuditEntry,
} from '../types';
import { toSafeString } from './safeFormat';

export const TAX_PAYMENT_CATEGORIES: TaxPaymentCategory[] = [
  'Self Assessment Tax – u/s 140A',
  'Advance Tax',
  'Regular Assessment Tax – u/s 156',
  'Tax on Regular Assessment',
  'Late Filing Fee – u/s 234F',
  'Interest u/s 234A',
  'Interest u/s 234B',
  'Interest u/s 234C',
  'TDS',
  'TCS',
  'Other applicable tax payments',
];

export const PAYMENT_MODES = [
  'Net Banking',
  'UPI',
  'Debit Card',
  'RTGS / NEFT',
  'Over the Counter (Bank)',
  'Book Adjustment',
  'Deducted at Source',
  'Not Found',
];

export const CHALLAN_FORMS = [
  'ITNS 280',
  'ITNS 281',
  'ITNS 282',
  'ITNS 283',
  'Form 26AS',
  'AIS / TIS',
  'ITR Acknowledgement',
  'Other Receipt',
];

export function roundToNearestTen(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num / 10) * 10;
}

export function normalizeNotFound(val?: unknown): string {
  if (val === null || val === undefined) return 'Not Found';
  const trimmed = toSafeString(val).trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '--' ||
    trimmed.toLowerCase() === 'n/a' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === '[object object]'
  ) {
    return 'Not Found';
  }
  return trimmed;
}

export function isMissingField(val?: unknown): boolean {
  if (val === null || val === undefined) return true;
  const t = toSafeString(val).trim().toLowerCase();
  return t === '' || t === 'not found' || t === 'n/a' || t === '-' || t === '--' || t === '[object object]';
}

export function parseFlexibleIndianDate(dateStr?: string): Date | null {
  if (!dateStr || isMissingField(dateStr)) return null;
  const trimmed = dateStr.trim();

  // Check DD-MMM-YYYY e.g. 31-Jul-2026
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const mmmMatch = trimmed.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monKey = mmmMatch[2].slice(0, 3).toLowerCase();
    const year = parseInt(mmmMatch[3], 10);
    if (monthMap[monKey] !== undefined) {
      const d = new Date(year, monthMap[monKey], day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Check YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getFinancialYearFromAY(ay: string): string {
  const startYear = parseInt((ay || '2026-27').split('-')[0], 10) || 2026;
  return `${startYear - 1}-${(startYear % 100).toString().padStart(2, '0')}`;
}

export function getOriginalDueDateForAY(ay: string = '2026-27', isAuditCase: boolean = false): string {
  const startYear = parseInt((ay || '2026-27').split('-')[0], 10) || 2026;
  if (isAuditCase) {
    return `31/10/${startYear}`;
  }
  // AY 2025-26 non-audit due date was extended by CBDT to 15/09/2025 (from 31/07/2025)
  if (ay.includes('2025-26')) {
    return '15/09/2025';
  }
  return `31/07/${startYear}`;
}

export function getBasicExemptionLimit(comp: Partial<TaxComputation>): number {
  const ay = comp.assessmentYear || '2026-27';
  const regime = comp.regimeOpted || 'new';
  if (regime === 'new') {
    if (ay.includes('2026-27')) return 400000;
    return 300000;
  }
  const ageCat = comp.client?.ageCategory;
  if (ageCat === 'Super Senior Citizen' || comp.client?.gender === 'Super Senior Citizen') return 500000;
  if (ageCat === 'Senior Citizen' || comp.client?.gender === 'Senior Citizen') return 300000;
  return 250000;
}

/**
 * Calculates applicable Late Filing Fee u/s 234F strictly as per Income Tax Act provisions
 * for the selected Assessment Year.
 */
export function calculateSection234FDetails(
  comp: TaxComputation,
  challans: TaxChallanRecord[]
): LateFilingFee234FDetails {
  const ay = comp.assessmentYear || '2026-27';
  const existing = comp.lateFilingFeeDetails;
  const isAuditCase = existing?.isAuditCase || false;
  const originalDueDate = existing?.originalDueDate || getOriginalDueDateForAY(ay, isAuditCase);
  const actualFilingDate = comp.filingDate || existing?.actualFilingDate || '';
  const filingSection = comp.filingSection || '139(1) - On or before due date';
  const taxableIncome = Math.max(0, Number(comp.totalTaxableIncome || 0));

  const dueDt = parseFlexibleIndianDate(originalDueDate);
  const actualDt = parseFlexibleIndianDate(actualFilingDate);

  const isSection139_1 = filingSection.startsWith('139(1)');
  const isBelatedSection = filingSection.startsWith('139(4)');
  const isRevisedSection = filingSection.startsWith('139(5)');
  const isUpdatedSection = filingSection.startsWith('139(8A)');

  let isLate = false;
  if (isBelatedSection) {
    isLate = true;
  } else if (!isSection139_1 && !isRevisedSection && !isUpdatedSection && dueDt && actualDt) {
    isLate = actualDt.getTime() > dueDt.getTime();
  } else if (isSection139_1 && dueDt && actualDt && actualDt.getTime() > dueDt.getTime()) {
    // Filed after due date despite 139(1) selection
    isLate = true;
  }

  let calculatedFee = 0;
  let ruleExplanation = '';
  const ayStartYear = parseInt(ay.split('-')[0], 10) || 2026;
  const basicExemption = getBasicExemptionLimit(comp);

  if (!isLate) {
    calculatedFee = 0;
    if (isRevisedSection) {
      ruleExplanation = `Revised Return u/s 139(5) — No additional 234F late fee if original return was filed u/s 139(1) on or before ${originalDueDate}.`;
    } else if (isUpdatedSection) {
      ruleExplanation = `Updated Return u/s 139(8A) — Additional tax applies u/s 140B; check if 234F was applicable on belated filing.`;
    } else {
      ruleExplanation = `Filed on or before due date (${originalDueDate}) u/s 139(1) — Section 234F Late Fee is ₹0.`;
    }
  } else {
    if (taxableIncome <= basicExemption && (comp.grossTotalIncome || 0) <= basicExemption) {
      calculatedFee = 0;
      ruleExplanation = `Total income (₹${taxableIncome.toLocaleString('en-IN')}) does not exceed basic exemption limit (₹${basicExemption.toLocaleString('en-IN')}) — Section 234F is ₹0 unless mandatory filing conditions (7th proviso to 139(1)) apply.`;
    } else if (taxableIncome <= 500000) {
      calculatedFee = 1000;
      ruleExplanation = `Belated filing for AY ${ay} with Total Taxable Income ≤ ₹5,00,000 — Maximum Fee u/s 234F is ₹1,000.`;
    } else if (ayStartYear >= 2021) {
      calculatedFee = 5000;
      ruleExplanation = `Belated filing for AY ${ay} with Total Taxable Income > ₹5,00,000 — Mandatory Fee u/s 234F is ₹5,000.`;
    } else {
      // Pre-AY 2021-22 rules (₹5,000 up to 31 Dec, ₹10,000 after 31 Dec)
      const dec31 = new Date(ayStartYear, 11, 31);
      if (actualDt && actualDt.getTime() > dec31.getTime()) {
        calculatedFee = 10000;
        ruleExplanation = `Belated filing after 31 Dec for AY ${ay} (Income > ₹5,00,000) — Fee u/s 234F is ₹10,000.`;
      } else {
        calculatedFee = 5000;
        ruleExplanation = `Belated filing on or before 31 Dec for AY ${ay} — Fee u/s 234F is ₹5,000.`;
      }
    }
  }

  const applicableFee =
    existing?.manualFeeOverride !== undefined && existing.manualFeeOverride !== null
      ? Math.max(0, Number(existing.manualFeeOverride))
      : comp.fee234F !== undefined && comp.fee234F > 0 && calculatedFee === 0 && isLate
      ? Number(comp.fee234F)
      : existing?.manualFeeOverride === undefined && comp.fee234F > 0 && isUpdatedSection
      ? Number(comp.fee234F)
      : calculatedFee;

  // Find challans paying 234F (either dedicated category 'Late Filing Fee – u/s 234F' or lateFilingFee component inside ITNS 280)
  const feeChallans = challans.filter(
    (c) => c.challanType === 'Late Filing Fee – u/s 234F' || Number(c.lateFilingFee || 0) > 0
  );

  let amountActuallyPaid = 0;
  feeChallans.forEach((c) => {
    if (c.challanType === 'Late Filing Fee – u/s 234F') {
      const explicitFee = Number(c.lateFilingFee || 0);
      amountActuallyPaid += explicitFee > 0 ? explicitFee : Number(c.totalAmountPaid || 0);
    } else {
      amountActuallyPaid += Number(c.lateFilingFee || 0);
    }
  });

  const primaryFeeChallan = feeChallans[0];
  const linkedChallanBsrCode = primaryFeeChallan ? normalizeNotFound(primaryFeeChallan.bsrCode) : 'Not Found';
  const linkedChallanSerialNumber = primaryFeeChallan ? normalizeNotFound(primaryFeeChallan.challanSerialNumber) : 'Not Found';
  const linkedChallanDate = primaryFeeChallan ? normalizeNotFound(primaryFeeChallan.challanTenderDate) : 'Not Found';

  let paymentVerificationStatus: LateFilingFee234FDetails['paymentVerificationStatus'] = 'Not Applicable';
  if (applicableFee === 0 && amountActuallyPaid === 0) {
    paymentVerificationStatus = 'Not Applicable';
  } else if (amountActuallyPaid === 0 && applicableFee > 0) {
    paymentVerificationStatus = 'Unpaid';
  } else if (feeChallans.some((c) => c.verificationStatus !== 'Verified')) {
    paymentVerificationStatus = 'Verification Required';
  } else if (amountActuallyPaid < applicableFee) {
    paymentVerificationStatus = 'Partially Paid';
  } else {
    paymentVerificationStatus = 'Verified';
  }

  return {
    assessmentYear: ay,
    originalDueDate,
    actualFilingDate: actualFilingDate || 'Not Found',
    filingSection,
    taxableIncome,
    applicableFee,
    manualFeeOverride: existing?.manualFeeOverride,
    isAuditCase,
    amountActuallyPaid,
    linkedChallanBsrCode,
    linkedChallanSerialNumber,
    linkedChallanDate,
    paymentVerificationStatus,
    ruleExplanation,
  };
}

/**
 * Computes totalAmountPaid strictly from components when components exist
 */
export function computeChallanTotal(c: Partial<TaxChallanRecord>): number {
  const sum =
    Math.max(0, Number(c.taxAmount || 0)) +
    Math.max(0, Number(c.surcharge || 0)) +
    Math.max(0, Number(c.cess || 0)) +
    Math.max(0, Number(c.interest || 0)) +
    Math.max(0, Number(c.lateFilingFee || 0)) +
    Math.max(0, Number(c.otherAmount || 0));
  return sum;
}

/**
 * Checks if a candidate challan duplicates an existing challan by CIN or (BSR + Serial + Date + Amount)
 */
export function findDuplicateChallan(
  candidate: Partial<TaxChallanRecord>,
  existingList: TaxChallanRecord[],
  excludeId?: string
): { isDuplicate: boolean; reason?: string; matchedChallan?: TaxChallanRecord } {
  const candCin = normalizeNotFound(candidate.cin).toUpperCase();
  const candBsr = normalizeNotFound(candidate.bsrCode).toUpperCase();
  const candSerial = normalizeNotFound(candidate.challanSerialNumber).toUpperCase();
  const candDate = normalizeNotFound(candidate.challanTenderDate).toUpperCase();
  const candAmt = Number(candidate.totalAmountPaid || 0);

  for (const existing of existingList) {
    if (excludeId && existing.id === excludeId) continue;

    const exCin = normalizeNotFound(existing.cin).toUpperCase();
    if (!isMissingField(candCin) && !isMissingField(exCin) && candCin === exCin) {
      return {
        isDuplicate: true,
        reason: `Duplicate CIN detected (${candCin}) matching existing challan dated ${existing.challanTenderDate}.`,
        matchedChallan: existing,
      };
    }

    const exBsr = normalizeNotFound(existing.bsrCode).toUpperCase();
    const exSerial = normalizeNotFound(existing.challanSerialNumber).toUpperCase();
    const exDate = normalizeNotFound(existing.challanTenderDate).toUpperCase();
    const exAmt = Number(existing.totalAmountPaid || 0);

    if (
      !isMissingField(candBsr) &&
      !isMissingField(candSerial) &&
      candBsr === exBsr &&
      candSerial === exSerial &&
      (isMissingField(candDate) || isMissingField(exDate) || candDate === exDate) &&
      candAmt === exAmt
    ) {
      return {
        isDuplicate: true,
        reason: `Duplicate Challan detected: BSR ${candBsr}, Serial ${candSerial}, Amount ₹${candAmt.toLocaleString('en-IN')}.`,
        matchedChallan: existing,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Validates a challan record and returns mismatch/verification flags without fabricating missing fields.
 */
export function auditChallanRecord(
  challan: TaxChallanRecord,
  allChallans: TaxChallanRecord[],
  targetComp?: Partial<TaxComputation>
): {
  mismatchReasons: string[];
  isDuplicateFlagged: boolean;
  requiresVerification: boolean;
} {
  const mismatchReasons: string[] = [];
  const isTdsOrTcs = challan.challanType === 'TDS' || challan.challanType === 'TCS';

  if (!isTdsOrTcs) {
    if (isMissingField(challan.bsrCode)) {
      mismatchReasons.push('BSR Code is Not Found');
    } else if (!/^\d{7}$/.test(challan.bsrCode.trim())) {
      mismatchReasons.push(`BSR Code "${challan.bsrCode}" is not a valid 7-digit code`);
    }

    if (isMissingField(challan.challanSerialNumber)) {
      mismatchReasons.push('Challan Serial Number is Not Found');
    }

    if (isMissingField(challan.challanTenderDate)) {
      mismatchReasons.push('Challan Tender Date is Not Found');
    }
  }

  if (targetComp?.client?.pan && !isMissingField(challan.pan)) {
    if (challan.pan.trim().toUpperCase() !== targetComp.client.pan.trim().toUpperCase()) {
      mismatchReasons.push(`Challan PAN (${challan.pan}) does not match Assessee PAN (${targetComp.client.pan})`);
    }
  }

  if (targetComp?.assessmentYear && !isMissingField(challan.assessmentYear)) {
    if (challan.assessmentYear.trim() !== targetComp.assessmentYear.trim()) {
      mismatchReasons.push(`Challan AY (${challan.assessmentYear}) differs from Return AY (${targetComp.assessmentYear})`);
    }
  }

  const componentSum = computeChallanTotal(challan);
  if (componentSum > 0 && Math.abs(componentSum - Number(challan.totalAmountPaid || 0)) > 2) {
    mismatchReasons.push(`Component sum (₹${componentSum.toLocaleString('en-IN')}) does not equal Total Amount Paid (₹${Number(challan.totalAmountPaid).toLocaleString('en-IN')})`);
  }

  const dupCheck = findDuplicateChallan(challan, allChallans, challan.id);
  if (dupCheck.isDuplicate && dupCheck.reason) {
    mismatchReasons.push(dupCheck.reason);
  }

  const requiresVerification =
    challan.verificationStatus !== 'Verified' ||
    mismatchReasons.length > 0 ||
    dupCheck.isDuplicate;

  return {
    mismatchReasons,
    isDuplicateFlagged: dupCheck.isDuplicate,
    requiresVerification,
  };
}

export function createAuditEntry(
  action: ChallanAuditEntry['action'],
  summary: string,
  changes?: ChallanAuditEntry['changes']
): ChallanAuditEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    summary,
    changes,
  };
}

export function diffChallanChanges(
  oldRec: TaxChallanRecord,
  newRec: TaxChallanRecord
): Array<{ field: string; oldValue: string; newValue: string }> {
  const fields: Array<{ key: keyof TaxChallanRecord; label: string }> = [
    { key: 'pan', label: 'PAN' },
    { key: 'assessmentYear', label: 'Assessment Year' },
    { key: 'challanType', label: 'Challan Type' },
    { key: 'bsrCode', label: 'BSR Code' },
    { key: 'challanSerialNumber', label: 'Challan Serial No' },
    { key: 'challanTenderDate', label: 'Tender Date' },
    { key: 'cin', label: 'CIN' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'taxAmount', label: 'Tax Amount' },
    { key: 'surcharge', label: 'Surcharge' },
    { key: 'cess', label: 'Cess' },
    { key: 'interest', label: 'Interest' },
    { key: 'lateFilingFee', label: 'Late Filing Fee (234F)' },
    { key: 'otherAmount', label: 'Other Amount' },
    { key: 'totalAmountPaid', label: 'Total Paid' },
    { key: 'paymentMode', label: 'Payment Mode' },
    { key: 'challanStatus', label: 'Challan Status' },
    { key: 'verificationStatus', label: 'Verification Status' },
  ];

  const diffs: Array<{ field: string; oldValue: string; newValue: string }> = [];
  for (const f of fields) {
    const ov = toSafeString(oldRec[f.key]);
    const nv = toSafeString(newRec[f.key]);
    if (ov !== nv) {
      diffs.push({ field: f.label, oldValue: ov, newValue: nv });
    }
  }
  return diffs;
}

/**
 * Authoritative Settlement & Reconciliation Engine (Steps A -> B -> C -> D).
 * - Never counts the same payment twice.
 * - Keeps Late Filing Fee u/s 234F separate and NEVER treats it as refundable tax credit.
 * - Flags PAYMENT VERIFICATION REQUIRED when challans are unverified, mismatched, or duplicate-flagged.
 */
export function computeTaxPaymentSettlement(
  comp: TaxComputation,
  explicitChallans?: TaxChallanRecord[]
): {
  lateFilingFeeDetails: LateFilingFee234FDetails;
  finalSettlement: FinalSettlementSummary;
  synchronizedTaxesPaid: TaxComputation['taxesPaid'];
} {
  const challans = explicitChallans ?? comp.taxesPaid?.challans ?? [];

  // Run Section 234F calculation
  const lateFilingFeeDetails = calculateSection234FDetails(comp, challans);

  // Deduplication check
  const verificationIssues: string[] = [];
  const reconciliationWarnings: string[] = [];
  const seenCins = new Set<string>();
  const seenKeys = new Set<string>();

  // Category accumulators from Challans (strictly separated, never mixed)
  let chTds = 0;
  let chTcs = 0;
  let chAdvTax = 0;
  let chSelfAssessmentTax = 0;
  let chRegularAssessmentTax = 0;
  let chOtherEligibleCredits = 0;
  let chLateFilingFeePaid = 0;
  let chInterestPaid = 0;

  let hasTdsChallan = false;
  let hasTcsChallan = false;
  let hasAdvChallan = false;
  let hasSatChallan = false;
  let hasRegChallan = false;
  let hasOtherChallan = false;

  challans.forEach((c, idx) => {
    const audit = auditChallanRecord(c, challans, comp);
    const cinNorm = normalizeNotFound(c.cin).toUpperCase();
    const keyNorm = `${normalizeNotFound(c.bsrCode)}|${normalizeNotFound(c.challanSerialNumber)}|${normalizeNotFound(c.challanTenderDate)}|${Number(c.totalAmountPaid || 0)}`;

    let isDup = false;
    if (!isMissingField(cinNorm)) {
      if (seenCins.has(cinNorm)) {
        isDup = true;
        verificationIssues.push(`Duplicate CIN "${cinNorm}" on Challan #${idx + 1} (${c.challanType}) — excluded from double counting.`);
      }
      seenCins.add(cinNorm);
    } else if (!isMissingField(c.bsrCode) && !isMissingField(c.challanSerialNumber)) {
      if (seenKeys.has(keyNorm)) {
        isDup = true;
        verificationIssues.push(`Duplicate Challan BSR/Serial "${c.bsrCode}/${c.challanSerialNumber}" on Challan #${idx + 1} — excluded from double counting.`);
      }
      seenKeys.add(keyNorm);
    }

    if (isDup) {
      return; // Never count duplicate payment twice!
    }

    if (audit.requiresVerification) {
      if (c.verificationStatus !== 'Verified') {
        verificationIssues.push(`Challan #${idx + 1} (${c.challanType}, ₹${Number(c.totalAmountPaid).toLocaleString('en-IN')}) status is "${c.verificationStatus}".`);
      }
      if (audit.mismatchReasons.length > 0) {
        verificationIssues.push(...audit.mismatchReasons.map((r) => `Challan #${idx + 1}: ${r}`));
      }
    }

    const taxPart = Math.max(0, Number(c.taxAmount || 0)) + Math.max(0, Number(c.surcharge || 0)) + Math.max(0, Number(c.cess || 0)) + Math.max(0, Number(c.otherAmount || 0));
    const interestPart = Math.max(0, Number(c.interest || 0));
    const feePart = Math.max(0, Number(c.lateFilingFee || 0));
    const totalAmt = Math.max(0, Number(c.totalAmountPaid || 0));

    // Separate strictly by category
    switch (c.challanType) {
      case 'TDS':
        hasTdsChallan = true;
        chTds += totalAmt > 0 ? totalAmt : taxPart;
        break;
      case 'TCS':
        hasTcsChallan = true;
        chTcs += totalAmt > 0 ? totalAmt : taxPart;
        break;
      case 'Advance Tax':
        hasAdvChallan = true;
        chAdvTax += taxPart > 0 ? taxPart : Math.max(0, totalAmt - interestPart - feePart);
        chInterestPaid += interestPart;
        chLateFilingFeePaid += feePart;
        break;
      case 'Self Assessment Tax – u/s 140A':
        hasSatChallan = true;
        chSelfAssessmentTax += taxPart > 0 ? taxPart : Math.max(0, totalAmt - interestPart - feePart);
        chInterestPaid += interestPart;
        chLateFilingFeePaid += feePart;
        break;
      case 'Regular Assessment Tax – u/s 156':
      case 'Tax on Regular Assessment':
        hasRegChallan = true;
        chRegularAssessmentTax += taxPart > 0 ? taxPart : Math.max(0, totalAmt - interestPart - feePart);
        chInterestPaid += interestPart;
        chLateFilingFeePaid += feePart;
        break;
      case 'Late Filing Fee – u/s 234F':
        // Strictly NOT an eligible refundable tax credit
        chLateFilingFeePaid += feePart > 0 ? feePart : totalAmt;
        chInterestPaid += interestPart;
        break;
      case 'Interest u/s 234A':
      case 'Interest u/s 234B':
      case 'Interest u/s 234C':
        chInterestPaid += interestPart > 0 ? interestPart : totalAmt;
        chLateFilingFeePaid += feePart;
        break;
      case 'Other applicable tax payments':
        hasOtherChallan = true;
        chOtherEligibleCredits += taxPart > 0 ? taxPart : Math.max(0, totalAmt - interestPart - feePart);
        chInterestPaid += interestPart;
        chLateFilingFeePaid += feePart;
        break;
    }
  });

  // Preserve manual/extracted summary totals if no challans exist in that category (backward compatibility)
  const manualTdsSalary = Math.max(0, Number(comp.taxesPaid?.tdsSalary || 0));
  const manualTdsOther = Math.max(0, Number(comp.taxesPaid?.tdsOther || 0));
  const manualTcs = Math.max(0, Number(comp.taxesPaid?.tcs || 0));
  const manualAdv = Math.max(0, Number(comp.taxesPaid?.advanceTax || 0));
  const manualSat = Math.max(0, Number(comp.taxesPaid?.selfAssessmentTax || 0));
  const manualReg = Math.max(0, Number(comp.taxesPaid?.regularAssessmentTax || 0));
  const manualOther = Math.max(0, Number(comp.taxesPaid?.otherEligibleCredits || 0));

  const totalTDS = hasTdsChallan ? chTds : manualTdsSalary + manualTdsOther;
  const totalTCS = hasTcsChallan ? chTcs : manualTcs;
  const totalAdvanceTax = hasAdvChallan ? chAdvTax : manualAdv;
  const totalSelfAssessmentTax = hasSatChallan ? chSelfAssessmentTax : manualSat;
  const totalRegularAssessmentTax = hasRegChallan ? chRegularAssessmentTax : manualReg;
  const totalOtherEligibleCredits = hasOtherChallan ? chOtherEligibleCredits : manualOther;

  // Reconciliation against Form 26AS if provided
  if (comp.reconciliation26AS) {
    const r = comp.reconciliation26AS;
    if (r.tdsAsPer26AS !== undefined && Math.abs(r.tdsAsPer26AS - totalTDS) > 10) {
      reconciliationWarnings.push(
        `TDS Mismatch vs Form 26AS: Computation/Challans = ₹${totalTDS.toLocaleString('en-IN')}, Form 26AS = ₹${r.tdsAsPer26AS.toLocaleString('en-IN')}.`
      );
    }
    if (r.tcsAsPer26AS !== undefined && Math.abs(r.tcsAsPer26AS - totalTCS) > 10) {
      reconciliationWarnings.push(
        `TCS Mismatch vs Form 26AS: Computation/Challans = ₹${totalTCS.toLocaleString('en-IN')}, Form 26AS = ₹${r.tcsAsPer26AS.toLocaleString('en-IN')}.`
      );
    }
    if (r.advanceTaxAsPer26AS !== undefined && Math.abs(r.advanceTaxAsPer26AS - totalAdvanceTax) > 10) {
      reconciliationWarnings.push(
        `Advance Tax Mismatch vs Form 26AS: Challans = ₹${totalAdvanceTax.toLocaleString('en-IN')}, Form 26AS = ₹${r.advanceTaxAsPer26AS.toLocaleString('en-IN')}.`
      );
    }
    if (r.satAsPer26AS !== undefined && Math.abs(r.satAsPer26AS - totalSelfAssessmentTax) > 10) {
      reconciliationWarnings.push(
        `Self Assessment Tax Mismatch vs Form 26AS: Challans = ₹${totalSelfAssessmentTax.toLocaleString('en-IN')}, Form 26AS = ₹${r.satAsPer26AS.toLocaleString('en-IN')}.`
      );
    }
  }

  // A. Income Tax Calculation
  const totalIncome = Math.max(0, Number(comp.grossTotalIncome || 0));
  const taxableIncome = Math.max(0, Number(comp.totalTaxableIncome || 0));
  const incomeTaxBeforeRebate = Math.max(0, Number(comp.totalTaxBeforeRebate ?? ((comp.taxOnNormalIncome || 0) + (comp.taxOnSpecialIncome || 0))));
  const rebate87A = Math.max(0, Number(comp.rebate87A || 0));
  const taxAfterRebate = Math.max(0, Number(comp.taxAfterRebate || 0));
  const surcharge = Math.max(0, Number(comp.surcharge || 0));
  const healthAndEducationCess = Math.max(0, Number(comp.healthAndEducationCess || 0));
  const relief89 = Math.max(0, Number(comp.relief89 || 0));
  const totalTaxLiability = Math.max(0, Number(comp.grossTaxLiability || 0) - relief89);

  // B. Interest & Fees
  const interest234A = Math.max(0, Number(comp.interest234A || 0));
  const interest234B = Math.max(0, Number(comp.interest234B || 0));
  const interest234C = Math.max(0, Number(comp.interest234C || 0));
  const fee234F = lateFilingFeeDetails.applicableFee;
  const otherLiabilities = Math.max(0, Number(comp.otherLiabilities || 0));
  const totalInterestAndFees = interest234A + interest234B + interest234C + fee234F + otherLiabilities;
  const totalGrossDemand = totalTaxLiability + totalInterestAndFees;

  // C. Taxes Already Paid
  const totalEligibleTaxCredits =
    totalTDS +
    totalTCS +
    totalAdvanceTax +
    totalSelfAssessmentTax +
    totalRegularAssessmentTax +
    totalOtherEligibleCredits;

  const totalLateFilingFeePaid = chLateFilingFeePaid > 0 ? chLateFilingFeePaid : Number(comp.taxesPaid?.lateFilingFeePaid || 0);
  const totalInterestPaid = chInterestPaid > 0 ? chInterestPaid : Number(comp.taxesPaid?.interestPaid || 0);
  const totalAllPaymentsDeposited = totalEligibleTaxCredits + totalLateFilingFeePaid + totalInterestPaid;

  // CRITICAL STATUTORY RULE:
  // Late Filing Fee paid u/s 234F can settle up to fee234F liability ONLY.
  // Any excess 234F fee paid is NOT a refundable tax credit!
  const fee234FSettledByFeePayment = Math.min(fee234F, totalLateFilingFeePaid);
  const nonCreditableExcessFeePaid = Math.max(0, totalLateFilingFeePaid - fee234F);
  const remainingFee234F = Math.max(0, fee234F - fee234FSettledByFeePayment);

  const totalInterestLiability = interest234A + interest234B + interest234C + otherLiabilities;
  const effectiveCreditsAvailable = totalEligibleTaxCredits + totalInterestPaid;
  const remainingLiabilityExcludingFee = totalTaxLiability + totalInterestLiability;

  const netDemandAfterCredits = remainingLiabilityExcludingFee + remainingFee234F - effectiveCreditsAvailable;

  let totalRefundDue = 0;
  let additionalAmountPayable = 0;

  if (netDemandAfterCredits < 0) {
    // Refund can ONLY come from excess Eligible Tax Credits (never from non-creditable 234F fee!)
    const rawRefund = Math.abs(netDemandAfterCredits);
    totalRefundDue = roundToNearestTen(Math.min(rawRefund, totalEligibleTaxCredits));
    additionalAmountPayable = 0;
  } else if (netDemandAfterCredits > 0) {
    additionalAmountPayable = roundToNearestTen(netDemandAfterCredits);
    totalRefundDue = 0;
  }

  let settlementStatus: FinalSettlementOutcome = 'NO TAX PAYABLE / NO REFUND';
  if (verificationIssues.length > 0 || reconciliationWarnings.length > 0) {
    settlementStatus = 'PAYMENT VERIFICATION REQUIRED';
  } else if (totalRefundDue > 0) {
    settlementStatus = 'REFUND DUE';
  } else if (additionalAmountPayable > 0) {
    settlementStatus = 'ADDITIONAL TAX PAYABLE';
  } else {
    settlementStatus = 'NO TAX PAYABLE / NO REFUND';
  }

  const breakdownSteps: FinalSettlementSummary['breakdownSteps'] = [
    { label: 'Gross Total Income (GTI)', formula: 'Sum of all 5 heads of income', amount: totalIncome, section: 'Sec 14 / 80B(5)' },
    { label: 'Total Taxable Income', formula: 'GTI − Chapter VI-A Deductions (Rounded u/s 288A)', amount: taxableIncome, section: 'Sec 288A' },
    { label: 'Income Tax Before Rebate', formula: 'Normal Slab Tax + Special Rate Tax', amount: incomeTaxBeforeRebate },
    { label: 'Less: Rebate u/s 87A', formula: 'Resident taxpayer rebate', amount: -rebate87A, section: 'Sec 87A' },
    { label: 'Add: Surcharge + 4% H&E Cess', formula: 'Surcharge + 4% Cess on (Tax + Surcharge)', amount: surcharge + healthAndEducationCess },
    { label: 'Total Income Tax Liability (A)', formula: 'Net Tax + Surcharge + Cess − Relief u/s 89', amount: totalTaxLiability },
    { label: 'Total Interest & Late Fee (B)', formula: `234A (₹${interest234A.toLocaleString('en-IN')}) + 234B (₹${interest234B.toLocaleString('en-IN')}) + 234C (₹${interest234C.toLocaleString('en-IN')}) + 234F (₹${fee234F.toLocaleString('en-IN')}) + Other (₹${otherLiabilities.toLocaleString('en-IN')})`, amount: totalInterestAndFees, section: 'Sec 234A/B/C/F' },
    { label: 'Total Tax, Interest & Fee Demand (A + B)', formula: 'Total Statutory Obligation', amount: totalGrossDemand },
    { label: 'Less: Eligible Tax Credits (C)', formula: `TDS (₹${totalTDS.toLocaleString('en-IN')}) + TCS (₹${totalTCS.toLocaleString('en-IN')}) + Adv Tax (₹${totalAdvanceTax.toLocaleString('en-IN')}) + SAT 140A (₹${totalSelfAssessmentTax.toLocaleString('en-IN')}) + Reg Tax (₹${totalRegularAssessmentTax.toLocaleString('en-IN')}) + Other (₹${totalOtherEligibleCredits.toLocaleString('en-IN')})`, amount: -totalEligibleTaxCredits },
    { label: 'Less: Verified 234F Fee & Interest Settled', formula: `Fee Settled: ₹${fee234FSettledByFeePayment.toLocaleString('en-IN')} + Interest Paid: ₹${totalInterestPaid.toLocaleString('en-IN')} (Non-creditable excess 234F: ₹${nonCreditableExcessFeePaid.toLocaleString('en-IN')})`, amount: -(fee234FSettledByFeePayment + totalInterestPaid) },
    {
      label: totalRefundDue > 0 ? 'Final Refund Due (Rounded u/s 288B)' : additionalAmountPayable > 0 ? 'Additional Tax Payable (Rounded u/s 288B)' : 'Final Net Balance (Nil)',
      formula: settlementStatus,
      amount: totalRefundDue > 0 ? totalRefundDue : additionalAmountPayable,
      section: 'Sec 288B',
    },
  ];

  const synchronizedTaxesPaid: TaxComputation['taxesPaid'] = {
    ...comp.taxesPaid,
    tdsSalary: hasTdsChallan ? chTds : manualTdsSalary,
    tdsOther: hasTdsChallan ? 0 : manualTdsOther,
    tcs: totalTCS,
    advanceTax: totalAdvanceTax,
    selfAssessmentTax: totalSelfAssessmentTax,
    regularAssessmentTax: totalRegularAssessmentTax,
    otherEligibleCredits: totalOtherEligibleCredits,
    lateFilingFeePaid: totalLateFilingFeePaid,
    interestPaid: totalInterestPaid,
    challans,
    totalTaxesPaid: totalEligibleTaxCredits,
  };

  return {
    lateFilingFeeDetails,
    finalSettlement: {
      totalIncome,
      taxableIncome,
      incomeTaxBeforeRebate,
      rebate87A,
      taxAfterRebate,
      surcharge,
      healthAndEducationCess,
      relief89,
      totalTaxLiability,
      interest234A,
      interest234B,
      interest234C,
      fee234F,
      otherLiabilities,
      totalInterestAndFees,
      totalGrossDemand,
      totalTDS,
      totalTCS,
      totalAdvanceTax,
      totalSelfAssessmentTax,
      totalRegularAssessmentTax,
      totalOtherEligibleCredits,
      totalEligibleTaxCredits,
      totalLateFilingFeePaid,
      totalInterestPaid,
      totalAllPaymentsDeposited,
      nonCreditableExcessFeePaid,
      settlementStatus,
      totalRefundDue,
      additionalAmountPayable,
      verificationIssues,
      reconciliationWarnings,
      breakdownSteps,
    },
    synchronizedTaxesPaid,
  };
}

/**
 * Parses challan entries directly from uploaded Official ITR JSON or AIS JSON without fabricating missing fields.
 */
export function extractChallansFromJsonContent(
  jsonText: string,
  fallbackPan?: string,
  fallbackName?: string,
  fallbackAy?: string,
  sourceFileName?: string
): TaxChallanRecord[] {
  const parsed = JSON.parse(jsonText);
  const root = parsed.ITR || parsed.ITR1 || parsed.ITR2 || parsed.ITR3 || parsed.ITR4 || parsed;
  const personal = root.PersonalInfo || root.personalInfo || {};
  const pan = normalizeNotFound(personal.PAN || root.PAN || parsed.pan || fallbackPan).toUpperCase();
  const rawAssesseeName =
    personal.AssesseeName && typeof personal.AssesseeName === 'object'
      ? `${toSafeString(personal.AssesseeName.FirstName)} ${toSafeString(personal.AssesseeName.MiddleName)} ${toSafeString(personal.AssesseeName.SurNameOrOrgName)}`.trim()
      : personal.AssesseeName || personal.Name || fallbackName;
  const name = normalizeNotFound(rawAssesseeName).toUpperCase();
  const ay = normalizeNotFound(root.Form_ITR1?.AssessmentYear || root.Form_ITR4?.AssessmentYear || root.AssessmentYear || parsed.assessmentYear || fallbackAy || '2026-27');
  const fy = isMissingField(ay) ? 'Not Found' : getFinancialYearFromAY(ay);

  const now = new Date().toISOString();
  const results: TaxChallanRecord[] = [];

  const pushRecord = (partial: Partial<TaxChallanRecord>) => {
    const taxAmount = Math.max(0, Number(partial.taxAmount || 0));
    const surcharge = Math.max(0, Number(partial.surcharge || 0));
    const cess = Math.max(0, Number(partial.cess || 0));
    const interest = Math.max(0, Number(partial.interest || 0));
    const lateFilingFee = Math.max(0, Number(partial.lateFilingFee || 0));
    const otherAmount = Math.max(0, Number(partial.otherAmount || 0));
    const totalAmountPaid = Number(partial.totalAmountPaid || 0) || (taxAmount + surcharge + cess + interest + lateFilingFee + otherAmount);

    results.push({
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pan,
      assesseeName: name,
      assessmentYear: ay,
      financialYear: fy,
      challanType: partial.challanType || 'Self Assessment Tax – u/s 140A',
      challanForm: normalizeNotFound(partial.challanForm) !== 'Not Found' ? normalizeNotFound(partial.challanForm) : 'ITR JSON',
      challanSerialNumber: normalizeNotFound(partial.challanSerialNumber),
      bsrCode: normalizeNotFound(partial.bsrCode),
      challanTenderDate: normalizeNotFound(partial.challanTenderDate),
      bankName: normalizeNotFound(partial.bankName),
      cin: normalizeNotFound(partial.cin),
      taxAmount,
      surcharge,
      cess,
      interest,
      lateFilingFee,
      otherAmount,
      totalAmountPaid,
      paymentMode: normalizeNotFound(partial.paymentMode),
      challanStatus: 'Deposited',
      verificationStatus: 'Verification Required',
      evidenceType: 'ITR JSON',
      sourceDocumentName: sourceFileName || 'ITR JSON',
      createdAt: now,
      updatedAt: now,
      editHistory: [createAuditEntry('OCR Extracted', `Extracted from JSON (${sourceFileName || 'ITR JSON'})`)],
    });
  };

  // 1. Schedule IT / TaxPayments (Advance Tax & Self Assessment Tax)
  const taxPayments =
    root.TaxPayments?.TaxPayment ||
    root.ScheduleIT?.TaxPayment ||
    root.TaxPaid?.TaxesPaid?.TaxPayments ||
    [];
  const listIT = Array.isArray(taxPayments) ? taxPayments : [taxPayments];
  listIT.forEach((tp: any) => {
    if (!tp || typeof tp !== 'object') return;
    const amt = Number(tp.Amt || tp.Amount || tp.TotalTaxPaid || 0);
    if (amt <= 0 && !tp.BSRCode && !tp.ChallanNo) return;
    pushRecord({
      challanType: toSafeString(tp.MinorHead) === '300' ? 'Self Assessment Tax – u/s 140A' : toSafeString(tp.MinorHead) === '400' ? 'Regular Assessment Tax – u/s 156' : 'Advance Tax',
      challanForm: 'ITNS 280',
      bsrCode: tp.BSRCode || tp.bsrCode,
      challanSerialNumber: tp.ChallanNo || tp.SrlNoOfChaln || tp.challanSerialNumber,
      challanTenderDate: tp.DateDep || tp.ChallanDate || tp.Date,
      cin: tp.CIN || tp.cin,
      bankName: tp.BankName || tp.bankName,
      taxAmount: Number(tp.Tax || amt),
      interest: Number(tp.Interest || 0),
      lateFilingFee: Number(tp.Fee234F || 0),
      totalAmountPaid: amt,
    });
  });

  // 2. Schedule TDS on Salary / Other
  const tdsSal = root.TDSonSals?.TDSonSal || [];
  (Array.isArray(tdsSal) ? tdsSal : [tdsSal]).forEach((t: any) => {
    if (!t || !Number(t.TotalTDSSal || t.TDSDeducted || 0)) return;
    const dedName = toSafeString(t.EmployerOrDeductorOrCollectDetl?.EmployerOrDeductorOrCollecterName);
    const dedTan = toSafeString(t.EmployerOrDeductorOrCollectDetl?.TAN);
    pushRecord({
      challanType: 'TDS',
      challanForm: 'Form 26AS',
      bankName: dedName || (dedTan ? `Employer TAN: ${dedTan}` : 'Not Found'),
      taxAmount: Number(t.TotalTDSSal || t.TDSDeducted || 0),
      totalAmountPaid: Number(t.TotalTDSSal || t.TDSDeducted || 0),
      paymentMode: 'Deducted at Source',
    });
  });

  const tdsOth = root.TDSonOthThanSals?.TDSonOthThanSal || [];
  (Array.isArray(tdsOth) ? tdsOth : [tdsOth]).forEach((t: any) => {
    if (!t || !Number(t.TDSAmount || t.ClaimedTDS || 0)) return;
    const dedName = toSafeString(t.EmployerOrDeductorOrCollectDetl?.EmployerOrDeductorOrCollecterName);
    const dedTan = toSafeString(t.EmployerOrDeductorOrCollectDetl?.TAN);
    pushRecord({
      challanType: 'TDS',
      challanForm: 'Form 26AS',
      bankName: dedName || (dedTan ? `Deductor TAN: ${dedTan}` : 'Not Found'),
      taxAmount: Number(t.TDSAmount || t.ClaimedTDS || 0),
      totalAmountPaid: Number(t.TDSAmount || t.ClaimedTDS || 0),
      paymentMode: 'Deducted at Source',
    });
  });

  return results;
}
