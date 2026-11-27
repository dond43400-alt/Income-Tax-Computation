import { 
  TaxComputation, 
  TaxRegime, 
  SalaryDetails, 
  SalaryEntry,
  HousePropertyDetails, 
  BusinessProfessionDetails, 
  CapitalGainsDetails, 
  OtherSourcesDetails, 
  AgriculturalIncomeDetails,
  BalanceSheetDetails,
  ChapterVIA_Deductions, 
  TaxesPaidDetails,
  ClientProfile
} from '../types';
import { checkITREligibility } from './itrEligibilityEngine';
import { calculateAllBusinesses, calculateCapitalAccount } from './businessCalculationEngine';

// ============================================================================
// 1. STATUTORY ROUNDING (SECTION 288A & SECTION 288B)
// ============================================================================

/**
 * Rounds off an amount to the nearest multiple of ten.
 * - Used for Total Income under Section 288A
 * - Used for Net Tax Payable / Refund Due under Section 288B
 */
export function roundToNearestTen(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num / 10) * 10;
}

// ============================================================================
// 2. AGE & AGE CATEGORY DETERMINATION (DATE OF BIRTH LOGIC)
// ============================================================================

export type AgeCategory = 'Below 60' | 'Senior Citizen' | 'Super Senior Citizen';

/**
 * Calculates taxpayer age from Date of Birth as on the end of the relevant financial year.
 * As per CBDT circular, an assessee born on 1st April attains age on 31st March of the preceding FY.
 */
export function calculateAge(dob?: string, asOnDate?: string | Date): number | undefined {
  if (!dob || typeof dob !== 'string') return undefined;
  
  const trimmed = dob.trim();
  if (!trimmed) return undefined;

  let birthDate: Date | null = null;
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  if (trimmed.includes('/') || (trimmed.includes('-') && trimmed.split('-')[0].length <= 2)) {
    const parts = trimmed.split(/[/.-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        birthDate = new Date(year, month, day);
      }
    }
  } else {
    // Standard ISO YYYY-MM-DD
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      birthDate = parsed;
    }
  }

  if (!birthDate || isNaN(birthDate.getTime())) return undefined;

  const targetDate = asOnDate ? (typeof asOnDate === 'string' ? new Date(asOnDate) : asOnDate) : new Date(2026, 2, 31); // Default 31st March 2026
  
  let age = targetDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = targetDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * Determines the Age Category of the taxpayer without conflating gender demographics with age.
 */
export function determineAgeCategory(
  client?: Partial<ClientProfile>,
  assessmentYear: string = '2026-27'
): AgeCategory {
  if (!client) return 'Below 60';

  // 1. Explicit ageCategory field
  if (client.ageCategory === 'Super Senior Citizen') return 'Super Senior Citizen';
  if (client.ageCategory === 'Senior Citizen') return 'Senior Citizen';
  if (client.ageCategory === 'Below 60') return 'Below 60';

  // 2. Explicit age field
  if (typeof client.age === 'number' && client.age > 0) {
    if (client.age >= 80) return 'Super Senior Citizen';
    if (client.age >= 60) return 'Senior Citizen';
    return 'Below 60';
  }

  // 3. Calculated from DOB / dateOfBirth
  const dobStr = client.dateOfBirth || client.dob;
  if (dobStr) {
    // Set FY end date based on Assessment Year
    const endYear = assessmentYear.includes('2024-25') ? 2024 : assessmentYear.includes('2025-26') ? 2025 : 2026;
    const fyEndDate = new Date(endYear, 2, 31); // 31st March
    const calculatedAge = calculateAge(dobStr, fyEndDate);
    if (calculatedAge !== undefined) {
      if (calculatedAge >= 80) return 'Super Senior Citizen';
      if (calculatedAge >= 60) return 'Senior Citizen';
      return 'Below 60';
    }
  }

  // 4. Fallback legacy gender-select backward compatibility if 'Senior Citizen' was selected in gender
  if (client.gender === 'Super Senior Citizen') return 'Super Senior Citizen';
  if (client.gender === 'Senior Citizen') return 'Senior Citizen';

  return 'Below 60';
}

// ============================================================================
// 3. HEAD 1: SALARIES (MULTIPLE EMPLOYERS & STANDARD DEDUCTION AUDIT)
// ============================================================================

export function getEligibleStandardDeduction(regime: TaxRegime, ay: string = '2026-27'): number {
  if (regime === 'new') {
    return ay.includes('2024-25') ? 50000 : 75000;
  }
  return 50000;
}

/**
 * Parse flexible date strings (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) into Date timestamps for comparison
 */
function parseFlexibleDate(dateStr?: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try standard Date parse (YYYY-MM-DD)
  const d1 = new Date(trimmed);
  if (!isNaN(d1.getTime())) return d1.getTime();

  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = trimmed.split(/[-/.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) return d2.getTime();
    }
  }
  return null;
}

/**
 * Detects whether any distinct employers have overlapping employment date ranges
 */
export function checkEmploymentPeriodOverlap(entries: SalaryEntry[]): {
  hasOverlap: boolean;
  overlapWarning?: string;
  overlappingPairs: Array<{ emp1: string; emp2: string; period1: string; period2: string }>;
} {
  const overlappingPairs: Array<{ emp1: string; emp2: string; period1: string; period2: string }> = [];
  if (!entries || entries.length < 2) {
    return { hasOverlap: false, overlappingPairs: [] };
  }

  for (let i = 0; i < entries.length; i++) {
    const e1 = entries[i];
    const s1 = parseFlexibleDate(e1.fromDate);
    const end1 = parseFlexibleDate(e1.toDate);

    if (s1 === null || end1 === null) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const e2 = entries[j];
      const s2 = parseFlexibleDate(e2.fromDate);
      const end2 = parseFlexibleDate(e2.toDate);

      if (s2 === null || end2 === null) continue;

      // Check overlap: Start1 <= End2 and Start2 <= End1
      if (s1 <= end2 && s2 <= end1) {
        overlappingPairs.push({
          emp1: e1.employerName || `Employer ${i + 1}`,
          emp2: e2.employerName || `Employer ${j + 1}`,
          period1: `${e1.fromDate} to ${e1.toDate}`,
          period2: `${e2.fromDate} to ${e2.toDate}`,
        });
      }
    }
  }

  const hasOverlap = overlappingPairs.length > 0;
  const overlapWarning = hasOverlap
    ? `Employment periods overlap (${overlappingPairs.map(p => `${p.emp1} & ${p.emp2}`).join(', ')}) — please verify.`
    : undefined;

  return { hasOverlap, overlapWarning, overlappingPairs };
}

/**
 * Detects duplicate Form 16 / Salary entries based on identical TAN or Employer Name, Gross Salary, and TDS
 */
export function detectDuplicateSalaryEntries(entries: SalaryEntry[]): string[] {
  const warnings: string[] = [];
  if (!entries || entries.length < 2) return warnings;

  for (let i = 0; i < entries.length; i++) {
    const e1 = entries[i];
    for (let j = i + 1; j < entries.length; j++) {
      const e2 = entries[j];
      const sameTAN = Boolean(e1.employerTAN && e2.employerTAN && e1.employerTAN.trim().toUpperCase() === e2.employerTAN.trim().toUpperCase());
      const sameName = Boolean(e1.employerName && e2.employerName && e1.employerName.trim().toLowerCase() === e2.employerName.trim().toLowerCase());
      const sameGross = Number(e1.grossSalary || 0) === Number(e2.grossSalary || 0) && Number(e1.grossSalary || 0) > 0;
      const sameTDS = Number(e1.tdsSalary || 0) === Number(e2.tdsSalary || 0);

      if ((sameTAN || sameName) && sameGross && sameTDS) {
        warnings.push(
          `Possible Duplicate Form 16 / Salary Entry: ${e1.employerName || e1.employerTAN} (Gross: ₹${Number(e1.grossSalary).toLocaleString('en-IN')}, TDS: ₹${Number(e1.tdsSalary).toLocaleString('en-IN')})`
        );
      }
    }
  }
  return warnings;
}

export interface AggregateSalaryResult {
  grossSalary: number;
  salarySection17_1: number;
  perquisites17_2: number;
  profitsInLieu17_3: number;
  allowancesExempt: number;
  professionalTax: number;
  entertainmentAllowance: number;
  standardDeduction: number; // Applied ONCE at taxpayer level
  netSalary: number;
  salaryArrears: number;
  totalTDSSalary: number;
  hasOverlappingPeriods: boolean;
  overlapWarning?: string;
  duplicateWarnings: string[];
  salaryList: SalaryEntry[];
  employerCount: number;
  primaryEmployerName?: string;
  primaryEmployerType?: string;
  primaryEmployerTAN?: string;
}

/**
 * Calculates complete salary aggregation across multiple employers, applying Standard Deduction strictly ONCE
 */
export function calculateAllSalaries(
  salary: SalaryDetails | SalaryEntry[],
  regime: TaxRegime,
  ay: string = '2026-27'
): AggregateSalaryResult {
  if (!salary) {
    const maxStd = getEligibleStandardDeduction(regime, ay);
    return {
      grossSalary: 0,
      salarySection17_1: 0,
      perquisites17_2: 0,
      profitsInLieu17_3: 0,
      allowancesExempt: 0,
      professionalTax: 0,
      entertainmentAllowance: 0,
      standardDeduction: 0,
      netSalary: 0,
      salaryArrears: 0,
      totalTDSSalary: 0,
      hasOverlappingPeriods: false,
      duplicateWarnings: [],
      salaryList: [],
      employerCount: 0,
    };
  }

  // Normalize entries whether passed as array or SalaryDetails object
  const entries = Array.isArray(salary)
    ? salary
    : (salary.salaryList && salary.salaryList.length > 0 ? salary.salaryList : []);

  // If no multiple salary entries exist and it's a SalaryDetails object, construct single-entry view from root fields
  if (entries.length === 0 && !Array.isArray(salary)) {
    const s17_1 = Math.max(0, salary.salarySection17_1 || 0);
    const s17_2 = Math.max(0, salary.perquisites17_2 || 0);
    const s17_3 = Math.max(0, salary.profitsInLieu17_3 || 0);
    const compGross = (s17_1 + s17_2 + s17_3 > 0) ? (s17_1 + s17_2 + s17_3) : Math.max(0, salary.grossSalary || 0);
    const gross = compGross;

    const maxStdDed = getEligibleStandardDeduction(regime, ay);
    const exemptions = regime === 'old' ? Math.max(0, salary.allowancesExempt || 0) : 0;
    const eligibleForStdDed = Math.max(0, gross - exemptions);
    const applicableStdDed = Math.min(eligibleForStdDed, maxStdDed);

    const profTax = regime === 'old' ? Math.max(0, salary.professionalTax || 0) : 0;
    const entAll = regime === 'old' ? Math.max(0, salary.entertainmentAllowance || 0) : 0;
    const net = Math.max(0, eligibleForStdDed - applicableStdDed - profTax - entAll);

    return {
      grossSalary: gross,
      salarySection17_1: s17_1 || gross,
      perquisites17_2: s17_2,
      profitsInLieu17_3: s17_3,
      allowancesExempt: salary.allowancesExempt || 0,
      professionalTax: salary.professionalTax || 0,
      entertainmentAllowance: salary.entertainmentAllowance || 0,
      standardDeduction: applicableStdDed,
      netSalary: net,
      salaryArrears: salary.salaryArrears || 0,
      totalTDSSalary: 0,
      hasOverlappingPeriods: false,
      duplicateWarnings: [],
      salaryList: [],
      employerCount: gross > 0 ? 1 : 0,
      primaryEmployerName: salary.employerName,
      primaryEmployerType: salary.employerType,
      primaryEmployerTAN: salary.employerTAN,
    };
  }

  // Multiple entries processing
  let totalGross = 0;
  let totalS17_1 = 0;
  let totalS17_2 = 0;
  let totalS17_3 = 0;
  let totalExempt = 0;
  let totalProfTax = 0;
  let totalEntAll = 0;
  let totalArrears = 0;
  let totalTDS = 0;

  const processedList: SalaryEntry[] = entries.map((entry, idx) => {
    const rawGross = Number(entry.grossSalary || 0);
    const s17_1 = Number(entry.salarySection17_1 || 0);
    const s17_2 = Number(entry.perquisites17_2 || 0);
    const s17_3 = Number(entry.profitsInLieu17_3 || 0);
    const basic = Number(entry.basicSalary || 0);
    const da = Number(entry.dearnessAllowance || 0);
    const hra = Number(entry.hra || 0);
    const other = Number(entry.otherAllowances || 0);
    const bonus = Number(entry.bonus || 0);
    const comm = Number(entry.commission || 0);
    const arr = Number(entry.salaryArrears || entry.arrears || 0);

    const compSum = basic + da + hra + other + bonus + comm + arr + s17_2 + s17_3;
    const gross = (rawGross > 0) ? rawGross : (compSum > 0 ? compSum : (s17_1 + s17_2 + s17_3));

    const exempt = Math.max(0, Number(entry.allowancesExempt || 0));
    const profTax = Math.max(0, Number(entry.professionalTax || 0));
    const entAll = Math.max(0, Number(entry.entertainmentAllowance || 0));
    const tds = Math.max(0, Number(entry.tdsSalary || 0));

    // Employer-level taxable salary BEFORE taxpayer-level Standard Deduction
    const taxableBeforeStdDed = Math.max(0, gross - (regime === 'old' ? exempt : 0) - (regime === 'old' ? profTax : 0) - (regime === 'old' ? entAll : 0));

    totalGross += gross;
    totalS17_1 += (s17_1 > 0 ? s17_1 : gross - s17_2 - s17_3);
    totalS17_2 += s17_2;
    totalS17_3 += s17_3;
    totalExempt += exempt;
    totalProfTax += profTax;
    totalEntAll += entAll;
    totalArrears += arr;
    totalTDS += tds;

    return {
      ...entry,
      grossSalary: gross,
      salarySection17_1: s17_1 > 0 ? s17_1 : Math.max(0, gross - s17_2 - s17_3),
      perquisites17_2: s17_2,
      profitsInLieu17_3: s17_3,
      allowancesExempt: exempt,
      professionalTax: profTax,
      entertainmentAllowance: entAll,
      tdsSalary: tds,
      taxableSalaryBeforeStdDed: taxableBeforeStdDed,
    };
  });

  // Calculate Single Taxpayer-Level Standard Deduction
  const maxStdDed = getEligibleStandardDeduction(regime, ay);
  const eligibleForStdDed = Math.max(0, totalGross - (regime === 'old' ? totalExempt : 0));
  const standardDeduction = Math.min(eligibleForStdDed, maxStdDed);

  // Net Chargeable Salary
  const netSalary = Math.max(
    0,
    eligibleForStdDed - standardDeduction - (regime === 'old' ? totalProfTax : 0) - (regime === 'old' ? totalEntAll : 0)
  );

  // Period Overlap & Duplicate Checks
  const overlapCheck = checkEmploymentPeriodOverlap(processedList);
  const duplicateWarnings = detectDuplicateSalaryEntries(processedList);

  const primary = processedList[0];

  return {
    grossSalary: totalGross,
    salarySection17_1: totalS17_1,
    perquisites17_2: totalS17_2,
    profitsInLieu17_3: totalS17_3,
    allowancesExempt: totalExempt,
    professionalTax: totalProfTax,
    entertainmentAllowance: totalEntAll,
    standardDeduction,
    netSalary,
    salaryArrears: totalArrears,
    totalTDSSalary: totalTDS,
    hasOverlappingPeriods: overlapCheck.hasOverlap,
    overlapWarning: overlapCheck.overlapWarning,
    duplicateWarnings,
    salaryList: processedList,
    employerCount: processedList.length,
    primaryEmployerName: primary?.employerName,
    primaryEmployerType: primary?.employerType,
    primaryEmployerTAN: primary?.employerTAN,
  };
}

export function calculateNetSalary(salary: SalaryDetails, regime: TaxRegime, ay: string = '2026-27'): number {
  if (!salary) return 0;
  if (salary.salaryList && salary.salaryList.length > 0) {
    return calculateAllSalaries(salary, regime, ay).netSalary;
  }

  const s17_1 = Math.max(0, salary.salarySection17_1 || 0);
  const s17_2 = Math.max(0, salary.perquisites17_2 || 0);
  const s17_3 = Math.max(0, salary.profitsInLieu17_3 || 0);
  const compGross = (s17_1 + s17_2 + s17_3 > 0) ? (s17_1 + s17_2 + s17_3) : Math.max(0, salary.grossSalary || 0);
  const gross = compGross;

  const maxStdDed = getEligibleStandardDeduction(regime, ay);
  const exemptions = regime === 'old' ? Math.max(0, salary.allowancesExempt || 0) : 0;
  const eligibleForStdDed = Math.max(0, gross - exemptions);
  const applicableStdDed = Math.min(eligibleForStdDed, maxStdDed);
  
  const profTax = regime === 'old' ? Math.max(0, salary.professionalTax || 0) : 0;
  const entAll = regime === 'old' ? Math.max(0, salary.entertainmentAllowance || 0) : 0;
  
  return Math.max(0, eligibleForStdDed - applicableStdDed - profTax - entAll);
}

// ============================================================================
// 4. HEAD 2: HOUSE PROPERTY
// ============================================================================

export function calculateNetHouseProperty(hp: HousePropertyDetails, regime: TaxRegime): number {
  const rent = Math.max(0, hp.grossRentReceived || 0);
  const taxes = Math.max(0, hp.municipalTaxes || 0);
  const netAnnualVal = Math.max(0, rent - taxes);
  
  if (netAnnualVal === 0 && (hp.homeLoanInterest24b || 0) > 0) {
    // Self-occupied property
    if (regime === 'new') {
      return 0; // Self occupied home loan loss is not deductible in New Regime
    }
    return -Math.min(200000, Math.max(0, hp.homeLoanInterest24b || 0));
  }
  
  const std30 = Math.round(netAnnualVal * 0.3);
  const interest = Math.max(0, hp.homeLoanInterest24b || 0);
  
  const net = netAnnualVal - std30 - interest;
  if (net < 0 && regime === 'new') {
    return 0; // No set-off against other heads under New Regime
  }
  return net < 0 ? Math.max(-200000, net) : net;
}

// ============================================================================
// 5. HEAD 3: PROFITS & GAINS OF BUSINESS OR PROFESSION (44AD / 44ADA / REGULAR)
// ============================================================================

export function calculateNetBusiness(biz: BusinessProfessionDetails, assessmentYear: string = '2026-27'): {
  netProfit: number;
  totalTurnover: number;
  profitDigital6: number;
  profitCash8: number;
  profitOtherMode: number;
  turnoverOtherMode: number;
  businessLoss: number;
  isLoss: boolean;
  verificationStatus: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  verificationWarnings: string[];
} {
  if (!biz) {
    return {
      netProfit: 0,
      totalTurnover: 0,
      profitDigital6: 0,
      profitCash8: 0,
      profitOtherMode: 0,
      turnoverOtherMode: 0,
      businessLoss: 0,
      isLoss: false,
      verificationStatus: 'Valid',
      verificationWarnings: [],
    };
  }

  const summary = calculateAllBusinesses(biz, assessmentYear);

  let pDig = 0;
  let pCash = 0;
  let pOth = 0;
  let tOth = 0;

  summary.businessResults.forEach(r => {
    pDig += r.presumptiveDigitalProfit;
    pCash += r.presumptiveCashProfit;
    pOth += r.presumptiveOtherProfit;
    tOth += r.otherReceipts;
  });

  return {
    netProfit: summary.netBusinessProfit,
    totalTurnover: summary.grandTotalTurnover,
    profitDigital6: pDig,
    profitCash8: pCash,
    profitOtherMode: pOth,
    turnoverOtherMode: tOth,
    businessLoss: summary.grandTotalBusinessLoss,
    isLoss: summary.netBusinessProfit < 0,
    verificationStatus: summary.overallVerificationStatus,
    verificationWarnings: summary.overallWarnings,
  };
}

// ============================================================================
// 5B. HEAD 4: CAPITAL GAINS & INTRA-HEAD LOSS SET-OFF
// ============================================================================

export interface NetCapitalGainsResult {
  stcg111A: number;
  stcgNormal: number;
  ltcg112A: number;
  ltcg112: number;
  totalSTCG: number;
  totalLTCG: number;
  netCapitalGains: number;
  stclSetOff: number;
  ltclSetOff: number;
  carriedForwardSTCL: number;
  carriedForwardLTCL: number;
}

/**
 * Calculates net capital gains by bucket after applying legal loss set-off rules:
 * 1. STCL can be set off against both STCG and LTCG.
 * 2. LTCL can ONLY be set off against LTCG (never against STCG).
 * 3. Capital losses cannot be set off against any other head of income.
 */
export function calculateNetCapitalGains(cg?: Partial<CapitalGainsDetails>): NetCapitalGainsResult {
  if (!cg) {
    return {
      stcg111A: 0,
      stcgNormal: 0,
      ltcg112A: 0,
      ltcg112: 0,
      totalSTCG: 0,
      totalLTCG: 0,
      netCapitalGains: 0,
      stclSetOff: 0,
      ltclSetOff: 0,
      carriedForwardSTCL: 0,
      carriedForwardLTCL: 0,
    };
  }

  let stcg111A = Math.max(0, cg.stcg111A ?? cg.stcg15 ?? 0);
  let stcgNormal = Math.max(0, cg.stcgNormal ?? 0);
  let ltcg112A = Math.max(0, cg.ltcg112A ?? cg.ltcg10 ?? 0);
  let ltcg112 = Math.max(0, cg.ltcg112 ?? cg.ltcg20 ?? 0);

  let stcl = Math.max(0, (cg.currentYearSTCL || 0) + (cg.broughtForwardSTCL || 0));
  let ltcl = Math.max(0, (cg.currentYearLTCL || 0) + (cg.broughtForwardLTCL || 0));

  let stclSetOff = 0;
  let ltclSetOff = 0;

  // 1. Set off LTCL against LTCG first (LTCL can ONLY set off against LTCG)
  if (ltcl > 0) {
    // Set off against LTCG 112
    const setOff112 = Math.min(ltcg112, ltcl);
    ltcg112 -= setOff112;
    ltcl -= setOff112;
    ltclSetOff += setOff112;

    // Set off remaining LTCL against LTCG 112A
    const setOff112A = Math.min(ltcg112A, ltcl);
    ltcg112A -= setOff112A;
    ltcl -= setOff112A;
    ltclSetOff += setOff112A;
  }

  // 2. Set off STCL against STCG first, then remaining against LTCG
  if (stcl > 0) {
    // Set off against STCG Normal (slab rate) first
    const setOffStcgNorm = Math.min(stcgNormal, stcl);
    stcgNormal -= setOffStcgNorm;
    stcl -= setOffStcgNorm;
    stclSetOff += setOffStcgNorm;

    // Set off against STCG 111A
    const setOff111A = Math.min(stcg111A, stcl);
    stcg111A -= setOff111A;
    stcl -= setOff111A;
    stclSetOff += setOff111A;

    // Set off against remaining LTCG 112
    const setOffLtcg112 = Math.min(ltcg112, stcl);
    ltcg112 -= setOffLtcg112;
    stcl -= setOffLtcg112;
    stclSetOff += setOffLtcg112;

    // Set off against remaining LTCG 112A
    const setOffLtcg112A = Math.min(ltcg112A, stcl);
    ltcg112A -= setOffLtcg112A;
    stcl -= setOffLtcg112A;
    stclSetOff += setOffLtcg112A;
  }

  const totalSTCG = stcg111A + stcgNormal;
  const totalLTCG = ltcg112A + ltcg112;
  const netCapitalGains = totalSTCG + totalLTCG;

  return {
    stcg111A,
    stcgNormal,
    ltcg112A,
    ltcg112,
    totalSTCG,
    totalLTCG,
    netCapitalGains,
    stclSetOff,
    ltclSetOff,
    carriedForwardSTCL: stcl,
    carriedForwardLTCL: ltcl,
  };
}

export function calculateNetOtherSources(os: OtherSourcesDetails, regime: TaxRegime): number {
  let savings = Math.max(0, os.savingsInterest || 0);
  let fd = Math.max(0, os.fdInterest || 0);
  let rd = Math.max(0, os.rdInterest || 0);
  let otherInterest = Math.max(0, os.otherInterestIncome || 0);

  if (os.bankInterestItems && os.bankInterestItems.length > 0) {
    let itemSavings = 0;
    let itemFd = 0;
    let itemRd = 0;
    let itemOther = 0;

    os.bankInterestItems.forEach(item => {
      const amt = Math.max(0, item.amount || 0);
      if (item.interestType === 'Savings' || item.interestType === 'Post Office') {
        itemSavings += amt;
      } else if (item.interestType === 'Fixed Deposit (FD)') {
        itemFd += amt;
      } else if (item.interestType === 'Recurring Deposit (RD)') {
        itemRd += amt;
      } else {
        itemOther += amt;
      }
    });

    savings = itemSavings;
    fd = itemFd;
    rd = itemRd;
    if (itemOther > 0) {
      otherInterest = itemOther;
    }
  }

  const itRefund = Math.max(0, os.itRefundInterest || 0);
  const passThrough = Math.max(0, os.passThroughInterest || 0);
  const totalInterest = savings + fd + rd + otherInterest + itRefund + passThrough;
  const div = Math.max(0, os.dividendIncome || 0);

  // Family Pension with 57(iia) deduction
  let pensionDed = 0;
  const famPension = Math.max(0, os.familyPension || 0);
  if (famPension > 0) {
    pensionDed = regime === 'new' 
      ? Math.min(famPension, Math.min(25000, Math.round(famPension / 3)))
      : Math.min(famPension, Math.min(15000, Math.round(famPension / 3)));
  }
  const netPension = Math.max(0, famPension - pensionDed);

  // Machinery / Plant rental with 57(ii) expenses
  const machGross = Math.max(0, os.machineryHireGross || 0);
  const machExp = Math.max(0, os.machineryHireExpenses || 0);
  const netMachinery = Math.max(0, machGross - machExp);

  // Special rate incomes (Lottery, online gaming 115BBJ, horse races, unexplained 115BBE)
  const lottery = Math.max(0, os.lotteryWinnings || 0);
  const onlineGames = Math.max(0, os.onlineGamesWinnings || 0);
  const horseRaces = Math.max(0, os.horseRacesWinnings || 0);
  const unexplained = Math.max(0, os.unexplainedIncome115BBE || 0);
  const totalSpecial = lottery + onlineGames + horseRaces + unexplained;

  let netOther = 0;
  if (os.otherIncomeItems && os.otherIncomeItems.length > 0) {
    netOther = os.otherIncomeItems.reduce((acc, item) => {
      const g = Math.max(0, item.grossAmount || 0);
      const d = Math.max(0, item.deductionSec57 || 0);
      return acc + Math.max(0, g - d);
    }, 0);
  } else {
    const rawOther = Math.max(0, os.otherIncome || 0) + Math.max(0, os.anyOtherIncome || 0);
    const expOther = Math.max(0, os.anyOtherIncomeExpenses || 0);
    netOther = Math.max(0, rawOther - expOther);
  }
  
  return totalInterest + div + netPension + netMachinery + totalSpecial + netOther;
}

// ============================================================================
// 7. AGRICULTURAL INCOME & INTEGRATION
// ============================================================================

export function calculateAgriculturalIncome(
  agriDetails?: AgriculturalIncomeDetails,
  fallbackNet?: number
): AgriculturalIncomeDetails {
  const gross = Math.max(0, agriDetails?.grossAgriculturalReceipts || 0);
  const exp = Math.max(0, agriDetails?.agriculturalExpenses || 0);
  let net = 0;
  if (gross > 0 || exp > 0) {
    net = Math.max(0, gross - exp);
  } else if (agriDetails?.netAgriculturalIncome !== undefined && agriDetails.netAgriculturalIncome > 0) {
    net = agriDetails.netAgriculturalIncome;
  } else if (fallbackNet !== undefined && fallbackNet > 0) {
    net = fallbackNet;
  }
  return {
    grossAgriculturalReceipts: gross,
    agriculturalExpenses: exp,
    netAgriculturalIncome: net,
  };
}

// ============================================================================
// 8. CHAPTER VI-A DEDUCTIONS CALCULATION
// ============================================================================

export function calculateTotalDeductions(
  ded: ChapterVIA_Deductions, 
  regime: TaxRegime, 
  grossTotalIncome: number
): number {
  if (regime === 'new') {
    // Under New Regime (Section 115BAC), only 80CCD(2) (Employer's Contribution to NPS) is permissible
    const empNps = Math.min(grossTotalIncome, Math.max(0, ded.sec80CCD2 || 0));
    return empNps;
  }

  // Old Regime
  const sec80cTotal = Math.min(150000, Math.max(0, ded.sec80C || 0) + Math.max(0, ded.sec80CCC || 0));
  const npsAdd = Math.min(50000, Math.max(0, ded.sec80CCD1B || 0));
  const npsEmployer = Math.max(0, ded.sec80CCD2 || 0);
  const sec80d = Math.min(100000, Math.max(0, ded.sec80D || 0));
  const sec80e = Math.max(0, ded.sec80E || 0);
  const sec80tta = Math.min(10000, Math.max(0, ded.sec80TTA || 0));
  const sec80ttb = Math.min(50000, Math.max(0, ded.sec80TTB || 0));
  const sec80g = Math.max(0, ded.sec80G || 0);
  const others = Math.max(0, ded.otherDeductions || 0) + Math.max(0, ded.sec80DD || 0) + Math.max(0, ded.sec80U || 0);

  const total = sec80cTotal + npsAdd + npsEmployer + sec80d + sec80e + (sec80ttb > 0 ? sec80ttb : sec80tta) + sec80g + others;
  return Math.min(grossTotalIncome, total);
}

// ============================================================================
// 9. INCOME TAX SLAB DEFINITIONS & COMPUTATION BUCKETS
// ============================================================================

export interface SlabRange {
  min: number;
  max: number;
  rate: number;
  label: string;
  rateLabel: string;
}

export interface SlabBreakdownItem {
  slab: string;
  rate: string;
  taxableInSlab: number;
  tax: number;
}

export interface NormalSlabTaxResult {
  slabBreakdown: SlabBreakdownItem[];
  taxBeforeRebate: number;
  rebate87A: number;
  marginalRelief87A: number;
  taxAfterRebate: number;
}

/**
 * Returns official slab ranges for a given AY, regime, and age category.
 */
export function getTaxSlabs(
  regime: TaxRegime,
  ay: string = '2026-27',
  ageCategory: AgeCategory = 'Below 60'
): SlabRange[] {
  if (regime === 'new') {
    // ------------------------------------------------------------------------
    // AY 2026-27 NEW TAX REGIME (Finance Act / Budget 2025 Section 115BAC)
    // Slabs: 0-4L (Nil), 4L-8L (5%), 8L-12L (10%), 12L-16L (15%), 16L-20L (20%), 20L-24L (25%), >24L (30%)
    // ------------------------------------------------------------------------
    if (ay.includes('2026-27')) {
      return [
        { min: 0, max: 400000, rate: 0, label: 'Upto Rs. 4,00,000', rateLabel: 'Nil (0%)' },
        { min: 400000, max: 800000, rate: 0.05, label: 'Rs. 4,00,001 to Rs. 8,00,000', rateLabel: '5%' },
        { min: 800000, max: 1200000, rate: 0.10, label: 'Rs. 8,00,001 to Rs. 12,00,000', rateLabel: '10%' },
        { min: 1200000, max: 1600000, rate: 0.15, label: 'Rs. 12,00,001 to Rs. 16,00,000', rateLabel: '15%' },
        { min: 1600000, max: 2000000, rate: 0.20, label: 'Rs. 16,00,001 to Rs. 20,00,000', rateLabel: '20%' },
        { min: 2000000, max: 2400000, rate: 0.25, label: 'Rs. 20,00,001 to Rs. 24,00,000', rateLabel: '25%' },
        { min: 2400000, max: Infinity, rate: 0.30, label: 'Above Rs. 24,00,000', rateLabel: '30%' },
      ];
    }

    // AY 2024-25 New Regime Slabs:
    if (ay.includes('2024-25')) {
      return [
        { min: 0, max: 300000, rate: 0, label: 'Upto Rs. 3,00,000', rateLabel: 'Nil (0%)' },
        { min: 300000, max: 600000, rate: 0.05, label: 'Rs. 3,00,001 to Rs. 6,00,000', rateLabel: '5%' },
        { min: 600000, max: 900000, rate: 0.10, label: 'Rs. 6,00,001 to Rs. 9,00,000', rateLabel: '10%' },
        { min: 900000, max: 1200000, rate: 0.15, label: 'Rs. 9,00,001 to Rs. 12,00,000', rateLabel: '15%' },
        { min: 1200000, max: 1500000, rate: 0.20, label: 'Rs. 12,00,001 to Rs. 15,00,000', rateLabel: '20%' },
        { min: 1500000, max: Infinity, rate: 0.30, label: 'Above Rs. 15,00,000', rateLabel: '30%' },
      ];
    }

    // AY 2025-26 New Regime Slabs:
    return [
      { min: 0, max: 300000, rate: 0, label: 'Upto Rs. 3,00,000', rateLabel: 'Nil (0%)' },
      { min: 300000, max: 700000, rate: 0.05, label: 'Rs. 3,00,001 to Rs. 7,00,000', rateLabel: '5%' },
      { min: 700000, max: 1000000, rate: 0.10, label: 'Rs. 7,00,001 to Rs. 10,00,000', rateLabel: '10%' },
      { min: 1000000, max: 1200000, rate: 0.15, label: 'Rs. 10,00,001 to Rs. 12,00,000', rateLabel: '15%' },
      { min: 1200000, max: 1500000, rate: 0.20, label: 'Rs. 12,00,001 to Rs. 15,00,000', rateLabel: '20%' },
      { min: 1500000, max: Infinity, rate: 0.30, label: 'Above Rs. 15,00,000', rateLabel: '30%' },
    ];
  }

  // --------------------------------------------------------------------------
  // OLD REGIME SLABS (BASED ON AGE CATEGORY)
  // --------------------------------------------------------------------------
  let exemptionLimit = 250000;
  let exemptionLabel = 'Rs. 2,50,000';
  if (ageCategory === 'Senior Citizen') {
    exemptionLimit = 300000;
    exemptionLabel = 'Rs. 3,00,000';
  } else if (ageCategory === 'Super Senior Citizen') {
    exemptionLimit = 500000;
    exemptionLabel = 'Rs. 5,00,000';
  }

  if (ageCategory === 'Super Senior Citizen') {
    return [
      { min: 0, max: 500000, rate: 0, label: 'Upto Rs. 5,00,000', rateLabel: 'Nil (0%)' },
      { min: 500000, max: 1000000, rate: 0.20, label: 'Rs. 5,00,001 to Rs. 10,00,000', rateLabel: '20%' },
      { min: 1000000, max: Infinity, rate: 0.30, label: 'Above Rs. 10,00,000', rateLabel: '30%' },
    ];
  }

  return [
    { min: 0, max: exemptionLimit, rate: 0, label: `Upto ${exemptionLabel}`, rateLabel: 'Nil (0%)' },
    { min: exemptionLimit, max: 500000, rate: 0.05, label: `${exemptionLabel} to Rs. 5,00,000`, rateLabel: '5%' },
    { min: 500000, max: 1000000, rate: 0.20, label: 'Rs. 5,00,001 to Rs. 10,00,000', rateLabel: '20%' },
    { min: 1000000, max: Infinity, rate: 0.30, label: 'Above Rs. 10,00,000', rateLabel: '30%' },
  ];
}

// ============================================================================
// 10. AUTHORITATIVE NORMAL SLAB TAX CALCULATION
// ============================================================================

export interface CalculateNormalSlabTaxParams {
  taxableIncome: number;
  regime: TaxRegime;
  assessmentYear: string;
  ageCategory?: AgeCategory;
  isResident?: boolean;
}

/**
 * Authoritative function to calculate normal slab tax, 87A rebate & marginal relief.
 */
export function calculateNormalSlabTax({
  taxableIncome,
  regime,
  assessmentYear,
  ageCategory = 'Below 60',
  isResident = true,
}: CalculateNormalSlabTaxParams): NormalSlabTaxResult {
  const roundedIncome = roundToNearestTen(Math.max(0, taxableIncome));
  const slabs = getTaxSlabs(regime, assessmentYear, ageCategory);

  const slabBreakdown: SlabBreakdownItem[] = [];
  let rawTax = 0;

  for (const r of slabs) {
    const taxableInSlab = roundedIncome > r.min ? Math.min(roundedIncome - r.min, r.max - r.min) : 0;
    const tax = Math.round(taxableInSlab * r.rate);
    rawTax += tax;
    slabBreakdown.push({
      slab: r.label,
      rate: r.rateLabel,
      taxableInSlab,
      tax,
    });
  }

  // --------------------------------------------------------------------------
  // REBATE UNDER SECTION 87A & MARGINAL RELIEF
  // --------------------------------------------------------------------------
  let rebate87A = 0;
  let marginalRelief87A = 0;

  if (isResident) {
    if (regime === 'new') {
      if (assessmentYear.includes('2026-27')) {
        // AY 2026-27 New Regime:
        // Threshold = ₹12,00,000 (Max rebate = ₹60,000)
        // Full rebate for taxable income <= ₹12,00,000
        if (roundedIncome <= 1200000) {
          rebate87A = Math.min(rawTax, 60000);
        } else {
          // Marginal relief for income > ₹12,00,000:
          // Tax payable (before cess) cannot exceed (Taxable Income - ₹12,00,000)
          const excessIncome = roundedIncome - 1200000;
          if (rawTax > excessIncome) {
            marginalRelief87A = rawTax - excessIncome;
            rebate87A = marginalRelief87A;
          }
        }
      } else if (assessmentYear.includes('2024-25') || assessmentYear.includes('2025-26')) {
        // AY 2024-25 & AY 2025-26 New Regime:
        // Threshold = ₹7,00,000 (Max rebate = ₹25,000)
        if (roundedIncome <= 700000) {
          rebate87A = Math.min(rawTax, 25000);
        } else {
          const excessIncome = roundedIncome - 700000;
          if (rawTax > excessIncome) {
            marginalRelief87A = rawTax - excessIncome;
            rebate87A = marginalRelief87A;
          }
        }
      }
    } else {
      // Old Regime:
      // Threshold = ₹5,00,000 (Max rebate = ₹12,500)
      if (roundedIncome <= 500000) {
        rebate87A = Math.min(rawTax, 12500);
      }
    }
  }

  const taxAfterRebate = Math.max(0, rawTax - rebate87A);

  return {
    slabBreakdown,
    taxBeforeRebate: rawTax,
    rebate87A,
    marginalRelief87A,
    taxAfterRebate,
  };
}

// ============================================================================
// 11. SURCHARGE & MARGINAL RELIEF CALCULATION
// ============================================================================

export interface SurchargeCalculationResult {
  surchargeRate: number;
  surchargeBeforeRelief: number;
  marginalReliefSurcharge: number;
  finalSurcharge: number;
}

export function calculateSurcharge({
  taxAfterRebate,
  totalIncome,
  regime,
  assessmentYear,
  ageCategory = 'Below 60',
}: {
  taxAfterRebate: number;
  totalIncome: number;
  regime: TaxRegime;
  assessmentYear: string;
  ageCategory?: AgeCategory;
}): SurchargeCalculationResult {
  const roundedIncome = roundToNearestTen(Math.max(0, totalIncome));
  if (roundedIncome <= 5000000 || taxAfterRebate <= 0) {
    return {
      surchargeRate: 0,
      surchargeBeforeRelief: 0,
      marginalReliefSurcharge: 0,
      finalSurcharge: 0,
    };
  }

  let surchargeRate = 0;
  let threshold = 5000000;

  if (roundedIncome > 5000000 && roundedIncome <= 10000000) {
    surchargeRate = 0.10;
    threshold = 5000000;
  } else if (roundedIncome > 10000000 && roundedIncome <= 20000000) {
    surchargeRate = 0.15;
    threshold = 10000000;
  } else if (roundedIncome > 20000000 && roundedIncome <= 50000000) {
    surchargeRate = 0.25;
    threshold = 20000000;
  } else if (roundedIncome > 50000000) {
    // Under New Regime max surcharge is 25%; in Old regime max is 37%
    surchargeRate = regime === 'new' ? 0.25 : 0.37;
    threshold = 50000000;
  }

  const surchargeBeforeRelief = Math.round(taxAfterRebate * surchargeRate);

  // --------------------------------------------------------------------------
  // MARGINAL RELIEF ON SURCHARGE
  // Total Tax + Surcharge on Income cannot exceed (Tax on Threshold) + (Income - Threshold)
  // --------------------------------------------------------------------------
  const taxOnThresholdResult = calculateNormalSlabTax({
    taxableIncome: threshold,
    regime,
    assessmentYear,
    ageCategory,
    isResident: true,
  });

  // Threshold surcharge rate (surcharge applicable at exactly the threshold limit)
  let thresholdSurcharge = 0;
  if (threshold === 10000000) {
    thresholdSurcharge = Math.round(taxOnThresholdResult.taxAfterRebate * 0.10);
  } else if (threshold === 20000000) {
    thresholdSurcharge = Math.round(taxOnThresholdResult.taxAfterRebate * 0.15);
  } else if (threshold === 50000000) {
    thresholdSurcharge = Math.round(taxOnThresholdResult.taxAfterRebate * 0.25);
  }

  const maxAllowableTaxAndSurcharge = taxOnThresholdResult.taxAfterRebate + thresholdSurcharge + (roundedIncome - threshold);
  const currentTotalTaxAndSurcharge = taxAfterRebate + surchargeBeforeRelief;

  let marginalRelief = 0;
  if (currentTotalTaxAndSurcharge > maxAllowableTaxAndSurcharge) {
    marginalRelief = currentTotalTaxAndSurcharge - maxAllowableTaxAndSurcharge;
  }

  const finalSurcharge = Math.max(0, surchargeBeforeRelief - marginalRelief);

  return {
    surchargeRate,
    surchargeBeforeRelief,
    marginalReliefSurcharge: marginalRelief,
    finalSurcharge,
  };
}

// ============================================================================
// 12. HEALTH & EDUCATION CESS (4%)
// ============================================================================

export function calculateHealthEducationCess(taxPlusSurcharge: number): number {
  if (taxPlusSurcharge <= 0) return 0;
  return Math.round(taxPlusSurcharge * 0.04);
}

// ============================================================================
// 13. COMPREHENSIVE TAX BREAKDOWN INTERFACE & SPECIAL RATE BUCKET ENGINE
// ============================================================================

export interface SpecialTaxBucketItem {
  section: string;
  description: string;
  rate: string;
  income: number;
  tax: number;
}

export interface SpecialRateIncomeBreakdown {
  stcg111A: number; // 20% in AY 2026-27 (or 15% pre-Budget 2024)
  stcg111ATax: number;
  ltcg112A: number; // 12.5% in AY 2026-27 exceeding ₹1.25L threshold
  ltcg112ATaxable: number;
  ltcg112ATax: number;
  ltcg112: number;  // 12.5% without indexation / 20%
  ltcg112Tax: number;
  winnings115BB: number; // 30% flat
  winnings115BBTax: number;
  onlineGames115BBJ: number; // 30% flat
  onlineGames115BBJTax: number;
  unexplained115BBE: number; // 60% flat (+ 25% surcharge + 4% cess = 78% effective)
  unexplained115BBETax: number;
  unexplained115BBESurcharge: number;
  totalSpecialIncome: number;
  totalSpecialTax: number;
  items: SpecialTaxBucketItem[];
}

export interface TaxCalculationBreakdown {
  taxOnNormalIncome: number;
  taxOnSpecialIncome: number;
  totalTaxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess4: number;
  totalTaxPayable: number;
  slabBreakdown: SlabBreakdownItem[];
  specialRateBreakdown: SpecialTaxBucketItem[];
  marginalRelief87A?: number;
  marginalReliefSurcharge?: number;
  specialRateDetails?: SpecialRateIncomeBreakdown;
  normalTaxableIncome?: number;
  totalTaxableIncome?: number;
}

export interface ComputeComprehensiveTaxParams {
  salary?: SalaryDetails;
  houseProperty?: HousePropertyDetails;
  business?: BusinessProfessionDetails;
  capitalGains?: CapitalGainsDetails;
  otherSources?: OtherSourcesDetails;
  deductions?: ChapterVIA_Deductions;
  regime: TaxRegime;
  ay?: string;
  genderOrAgeCategory?: string;
  agriculturalIncome?: number;
  isResident?: boolean;
}

/**
 * Computes complete authoritative tax liability with distinct buckets for:
 * A. Normal Slab Income
 * B. Section 111A STCG (20% in AY 2026-27 / 15% pre-Budget 2024)
 * C. Other STCG (Taxable at slab rates)
 * D. Section 112 LTCG (12.5% in AY 2026-27 / 20% with indexation)
 * E. Section 112A LTCG (12.5% above ₹1.25L threshold in AY 2026-27)
 * F. Section 115BB Winnings (30% flat)
 * G. Section 115BBJ Online Games (30% flat)
 * H. Section 115BBE Unexplained (60% flat + 25% mandatory surcharge + 4% cess)
 *
 * Rules strictly followed:
 * 1. Special rate incomes are NEVER added to normal slab income.
 * 2. Chapter VI-A deductions are allowed ONLY against normal slab income (and normal STCG), NOT against 111A, 112, 112A, 115BB, 115BBJ, 115BBE.
 * 3. Resident taxpayers can set off unexhausted basic exemption limit against 111A, 112, 112A (never against 115BB, 115BBJ, 115BBE).
 * 4. Section 87A rebate applies against total tax on eligible total income (subject to section exclusions).
 */
export function computeComprehensiveTax(params: ComputeComprehensiveTaxParams): TaxCalculationBreakdown {
  const ay = params.ay || '2026-27';
  const regime = params.regime || 'new';
  const isResident = params.isResident !== false;

  let ageCategory: AgeCategory = 'Below 60';
  if (params.genderOrAgeCategory === 'Senior Citizen') ageCategory = 'Senior Citizen';
  if (params.genderOrAgeCategory === 'Super Senior Citizen') ageCategory = 'Super Senior Citizen';

  const slabs = getTaxSlabs(regime, ay, ageCategory);
  const basicExemptionLimit = slabs[0]?.max || (regime === 'new' ? 400000 : (ageCategory === 'Super Senior Citizen' ? 500000 : (ageCategory === 'Senior Citizen' ? 300000 : 250000)));

  // 1. Calculate Heads of Income
  const netSalary = params.salary ? calculateNetSalary(params.salary, regime, ay) : 0;
  const netHP = params.houseProperty ? calculateNetHouseProperty(params.houseProperty, regime) : 0;
  const bizResult = params.business ? calculateNetBusiness(params.business) : { netProfit: 0, totalTurnover: 0, profitDigital6: 0, profitCash8: 0, profitOtherMode: 0, turnoverOtherMode: 0 };
  const netBiz = bizResult.netProfit;

  // Capital gains intra-head set-off
  const cgResult = calculateNetCapitalGains(params.capitalGains);

  // Other Sources
  const os = params.otherSources || { savingsInterest: 0, fdInterest: 0, dividendIncome: 0, familyPension: 0, otherIncome: 0, netOtherSources: 0 };
  
  // Normal Other Sources (Interest, Dividend, Net Pension, Net Machinery, Net Other General Income)
  let savings = Math.max(0, os.savingsInterest || 0);
  let fd = Math.max(0, os.fdInterest || 0);
  let rd = Math.max(0, os.rdInterest || 0);
  let otherInterest = Math.max(0, os.otherInterestIncome || 0);

  if (os.bankInterestItems && os.bankInterestItems.length > 0) {
    let itemSavings = 0, itemFd = 0, itemRd = 0, itemOther = 0;
    os.bankInterestItems.forEach(item => {
      const amt = Math.max(0, item.amount || 0);
      if (item.interestType === 'Savings' || item.interestType === 'Post Office') itemSavings += amt;
      else if (item.interestType === 'Fixed Deposit (FD)') itemFd += amt;
      else if (item.interestType === 'Recurring Deposit (RD)') itemRd += amt;
      else itemOther += amt;
    });
    savings = itemSavings;
    fd = itemFd;
    rd = itemRd;
    if (itemOther > 0) otherInterest = itemOther;
  }

  const itRefund = Math.max(0, os.itRefundInterest || 0);
  const passThrough = Math.max(0, os.passThroughInterest || 0);
  const totalInterest = savings + fd + rd + otherInterest + itRefund + passThrough;
  const dividend = Math.max(0, os.dividendIncome || 0);

  let pensionDed = 0;
  const famPension = Math.max(0, os.familyPension || 0);
  if (famPension > 0) {
    pensionDed = regime === 'new' 
      ? Math.min(famPension, Math.min(25000, Math.round(famPension / 3)))
      : Math.min(famPension, Math.min(15000, Math.round(famPension / 3)));
  }
  const netPension = Math.max(0, famPension - pensionDed);

  const machGross = Math.max(0, os.machineryHireGross || 0);
  const machExp = Math.max(0, os.machineryHireExpenses || 0);
  const netMachinery = Math.max(0, machGross - machExp);

  let netOtherGeneral = 0;
  if (os.otherIncomeItems && os.otherIncomeItems.length > 0) {
    netOtherGeneral = os.otherIncomeItems.reduce((acc, item) => {
      const g = Math.max(0, item.grossAmount || 0);
      const d = Math.max(0, item.deductionSec57 || 0);
      return acc + Math.max(0, g - d);
    }, 0);
  } else {
    const rawOther = Math.max(0, os.otherIncome || 0) + Math.max(0, os.anyOtherIncome || 0);
    const expOther = Math.max(0, os.anyOtherIncomeExpenses || 0);
    netOtherGeneral = Math.max(0, rawOther - expOther);
  }

  const normalOtherSources = totalInterest + dividend + netPension + netMachinery + netOtherGeneral;

  // Special Rate Incomes from Other Sources
  const winnings115BB = Math.max(0, os.lotteryWinnings || 0) + Math.max(0, os.horseRacesWinnings || 0);
  const onlineGames115BBJ = Math.max(0, os.onlineGamesWinnings || 0);
  const unexplained115BBE = Math.max(0, os.unexplainedIncome115BBE || 0);

  // Capital Gains Buckets
  const stcg111A = cgResult.stcg111A;
  const stcgNormal = cgResult.stcgNormal;
  const ltcg112A = cgResult.ltcg112A;
  const ltcg112 = cgResult.ltcg112;

  // 2. Normal Slab Income before deductions with Section 71(2A) set-off rules
  // Business loss cannot be set off against Salary income u/s 71(2A).
  let normalGrossIncome = 0;
  if (netBiz < 0) {
    const businessLoss = Math.abs(netBiz);
    const otherNormalIncome = Math.max(0, netHP) + Math.max(0, stcgNormal) + Math.max(0, normalOtherSources);
    const setOffAgainstOther = Math.min(businessLoss, otherNormalIncome);
    const remainingOtherNormal = otherNormalIncome - setOffAgainstOther;
    normalGrossIncome = netSalary + remainingOtherNormal;
  } else {
    normalGrossIncome = Math.max(0, netSalary + netHP + netBiz + stcgNormal + normalOtherSources);
  }

  // 3. Deductions Chapter VI-A (Applicable ONLY against normal income / normal STCG)
  const totalDeductions = params.deductions 
    ? calculateTotalDeductions(params.deductions, regime, normalGrossIncome)
    : 0;

  // Normal Taxable Income after Chapter VI-A deductions
  const normalTaxableIncome = Math.max(0, normalGrossIncome - totalDeductions);

  // Total Gross Income across all heads & buckets
  const totalGrossIncome = normalGrossIncome + stcg111A + ltcg112A + ltcg112 + winnings115BB + onlineGames115BBJ + unexplained115BBE;
  const totalTaxableIncome = roundToNearestTen(Math.max(0, totalGrossIncome - totalDeductions));

  // 4. Calculate Tax on Normal Slab Income
  let normalTaxResult = calculateNormalSlabTax({
    taxableIncome: normalTaxableIncome,
    regime,
    assessmentYear: ay,
    ageCategory,
    isResident,
  });

  // Agricultural Income Partial Integration (Old Regime & Net Agri > ₹5,000)
  const agriIncome = Math.max(0, params.agriculturalIncome || 0);
  if (regime === 'old' && agriIncome > 5000 && normalTaxableIncome > basicExemptionLimit) {
    const taxOnTotalAndAgri = calculateNormalSlabTax({
      taxableIncome: normalTaxableIncome + agriIncome,
      regime: 'old',
      assessmentYear: ay,
      ageCategory,
      isResident,
    }).taxBeforeRebate;

    const taxOnExemptAndAgri = calculateNormalSlabTax({
      taxableIncome: basicExemptionLimit + agriIncome,
      regime: 'old',
      assessmentYear: ay,
      ageCategory,
      isResident,
    }).taxBeforeRebate;

    const integratedTax = Math.max(0, taxOnTotalAndAgri - taxOnExemptAndAgri);
    normalTaxResult = {
      ...normalTaxResult,
      taxBeforeRebate: integratedTax,
      taxAfterRebate: integratedTax,
    };
  }

  // 5. Unexhausted Basic Exemption Set-off for Resident Individuals
  // If Normal Taxable Income < basicExemptionLimit, unexhausted limit can reduce 111A, 112, 112A in that order.
  let unexhaustedExemption = isResident ? Math.max(0, basicExemptionLimit - normalTaxableIncome) : 0;

  // 6. Calculate Special-Rate Tax Buckets
  const specialItems: SpecialTaxBucketItem[] = [];

  // Bucket B: Section 111A STCG (20% for AY 2026-27 / 15% pre-Budget 2024)
  const stcg111ARate = ay.includes('2026-27') ? 0.20 : 0.15;
  const stcg111ARateLabel = ay.includes('2026-27') ? '20%' : '15%';
  let taxable111A = stcg111A;
  if (unexhaustedExemption > 0 && taxable111A > 0) {
    const setOff = Math.min(taxable111A, unexhaustedExemption);
    taxable111A -= setOff;
    unexhaustedExemption -= setOff;
  }
  const stcg111ATax = Math.round(taxable111A * stcg111ARate);
  if (stcg111A > 0) {
    specialItems.push({
      section: 'Sec 111A',
      description: 'Short Term Capital Gains (Equity / Units @ STT)',
      rate: stcg111ARateLabel,
      income: stcg111A,
      tax: stcg111ATax,
    });
  }

  // Bucket D: Section 112 LTCG (12.5% in AY 2026-27 / 20% in earlier years)
  const ltcg112Rate = ay.includes('2026-27') ? 0.125 : 0.20;
  const ltcg112RateLabel = ay.includes('2026-27') ? '12.5%' : '20%';
  let taxable112 = ltcg112;
  if (unexhaustedExemption > 0 && taxable112 > 0) {
    const setOff = Math.min(taxable112, unexhaustedExemption);
    taxable112 -= setOff;
    unexhaustedExemption -= setOff;
  }
  const ltcg112Tax = Math.round(taxable112 * ltcg112Rate);
  if (ltcg112 > 0) {
    specialItems.push({
      section: 'Sec 112',
      description: 'Long Term Capital Gains (Unlisted / Property / Other Assets)',
      rate: ltcg112RateLabel,
      income: ltcg112,
      tax: ltcg112Tax,
    });
  }

  // Bucket E: Section 112A LTCG (12.5% above ₹1.25L in AY 2026-27 / 10% above ₹1L pre-Budget 2024)
  const ltcg112AExemptionThreshold = ay.includes('2026-27') ? 125000 : 100000;
  const ltcg112ARate = ay.includes('2026-27') ? 0.125 : 0.10;
  const ltcg112ARateLabel = ay.includes('2026-27') ? '12.5% (Above ₹1.25L)' : '10% (Above ₹1L)';
  
  let taxable112A = Math.max(0, ltcg112A - ltcg112AExemptionThreshold);
  if (unexhaustedExemption > 0 && taxable112A > 0) {
    const setOff = Math.min(taxable112A, unexhaustedExemption);
    taxable112A -= setOff;
    unexhaustedExemption -= setOff;
  }
  const ltcg112ATax = Math.round(taxable112A * ltcg112ARate);
  if (ltcg112A > 0) {
    specialItems.push({
      section: 'Sec 112A',
      description: `Long Term Capital Gains (Listed Equity/MF over ₹${ltcg112AExemptionThreshold.toLocaleString('en-IN')})`,
      rate: ltcg112ARateLabel,
      income: ltcg112A,
      tax: ltcg112ATax,
    });
  }

  // Bucket F: Section 115BB Winnings (Lotteries, Crossword, Betting @ 30%)
  const winnings115BBTax = Math.round(winnings115BB * 0.30);
  if (winnings115BB > 0) {
    specialItems.push({
      section: 'Sec 115BB',
      description: 'Winnings from Lotteries, Crosswords, Betting & Horse Races',
      rate: '30%',
      income: winnings115BB,
      tax: winnings115BBTax,
    });
  }

  // Bucket G: Section 115BBJ Online Gaming Winnings (@ 30%)
  const onlineGames115BBJTax = Math.round(onlineGames115BBJ * 0.30);
  if (onlineGames115BBJ > 0) {
    specialItems.push({
      section: 'Sec 115BBJ',
      description: 'Net Winnings from Online Games',
      rate: '30%',
      income: onlineGames115BBJ,
      tax: onlineGames115BBJTax,
    });
  }

  // Bucket H: Section 115BBE Unexplained Money / Credit (@ 60% + mandatory 25% surcharge + 4% cess)
  const unexplained115BBETax = Math.round(unexplained115BBE * 0.60);
  const unexplained115BBESurcharge = Math.round(unexplained115BBETax * 0.25); // Mandatory 25% surcharge u/s 115BBE
  if (unexplained115BBE > 0) {
    specialItems.push({
      section: 'Sec 115BBE',
      description: 'Unexplained Cash Credit / Money / Investments u/s 68/69',
      rate: '60%',
      income: unexplained115BBE,
      tax: unexplained115BBETax,
    });
  }

  const totalSpecialIncome = stcg111A + ltcg112A + ltcg112 + winnings115BB + onlineGames115BBJ + unexplained115BBE;
  const totalSpecialTax = stcg111ATax + ltcg112Tax + ltcg112ATax + winnings115BBTax + onlineGames115BBJTax + unexplained115BBETax;

  // Aggregate Tax before Rebate
  const rawTaxOnNormal = normalTaxResult.taxBeforeRebate;
  const totalTaxBeforeRebate = rawTaxOnNormal + totalSpecialTax;

  // 7. Section 87A Rebate & Marginal Relief
  // In AY 2026-27 New Regime: Threshold is ₹12,00,000, Max Rebate ₹60,000.
  // In AY 2024-25/2025-26 New Regime: Threshold is ₹7,00,000, Max Rebate ₹25,000.
  // In Old Regime: Threshold is ₹5,00,000, Max Rebate ₹12,500.
  // Note: Section 115BBE, Section 115BB (Lottery), and Section 115BBJ (Online Games) are strictly ineligible for 87A rebate.
  let rebate87A = 0;
  let marginalRelief87A = 0;
  const nonRebateableTax = unexplained115BBETax + winnings115BBTax + onlineGames115BBJTax;
  const eligibleTaxForRebate = Math.max(0, totalTaxBeforeRebate - nonRebateableTax);


  if (isResident) {
    if (regime === 'new') {
      if (ay.includes('2026-27')) {
        if (totalTaxableIncome <= 1200000) {
          rebate87A = Math.min(eligibleTaxForRebate, 60000);
        } else {
          // Marginal relief for income marginally above ₹12,00,000:
          // Tax payable (before cess) cannot exceed (Total Taxable Income - ₹12,00,000)
          const excessIncome = totalTaxableIncome - 1200000;
          if (eligibleTaxForRebate > excessIncome) {
            marginalRelief87A = eligibleTaxForRebate - excessIncome;
            rebate87A = marginalRelief87A;
          }
        }
      } else {
        if (totalTaxableIncome <= 700000) {
          rebate87A = Math.min(eligibleTaxForRebate, 25000);
        } else {
          const excessIncome = totalTaxableIncome - 700000;
          if (eligibleTaxForRebate > excessIncome) {
            marginalRelief87A = eligibleTaxForRebate - excessIncome;
            rebate87A = marginalRelief87A;
          }
        }
      }
    } else {
      // Old Regime
      if (totalTaxableIncome <= 500000) {
        rebate87A = Math.min(eligibleTaxForRebate, 12500);
      }
    }
  }

  const taxAfterRebate = Math.max(0, totalTaxBeforeRebate - rebate87A);

  // 8. Surcharge & Marginal Relief on Surcharge
  // Income without 115BBE follows general surcharge limits (10%, 15%, 25%, 37% old / 25% new)
  // Section 115BBE has a mandatory fixed 25% surcharge
  const taxAfterRebateWithout115BBE = Math.max(0, taxAfterRebate - unexplained115BBETax);
  const generalSurchargeResult = calculateSurcharge({
    taxAfterRebate: taxAfterRebateWithout115BBE,
    totalIncome: totalTaxableIncome,
    regime,
    assessmentYear: ay,
    ageCategory,
  });

  const totalSurcharge = generalSurchargeResult.finalSurcharge + unexplained115BBESurcharge;

  // 9. Health & Education Cess (4%)
  const cess = calculateHealthEducationCess(taxAfterRebate + totalSurcharge);

  // 10. Total Tax Payable (Rounded u/s 288B)
  const totalTaxPayable = roundToNearestTen(taxAfterRebate + totalSurcharge + cess);

  return {
    taxOnNormalIncome: rawTaxOnNormal,
    taxOnSpecialIncome: totalSpecialTax,
    totalTaxBeforeRebate,
    rebate87A,
    taxAfterRebate,
    surcharge: totalSurcharge,
    cess4: cess,
    totalTaxPayable,
    slabBreakdown: normalTaxResult.slabBreakdown,
    specialRateBreakdown: specialItems,
    marginalRelief87A,
    marginalReliefSurcharge: generalSurchargeResult.marginalReliefSurcharge,
    normalTaxableIncome,
    totalTaxableIncome,
    specialRateDetails: {
      stcg111A,
      stcg111ATax,
      ltcg112A,
      ltcg112ATaxable: taxable112A,
      ltcg112ATax,
      ltcg112,
      ltcg112Tax,
      winnings115BB,
      winnings115BBTax,
      onlineGames115BBJ,
      onlineGames115BBJTax,
      unexplained115BBE,
      unexplained115BBETax,
      unexplained115BBESurcharge,
      totalSpecialIncome,
      totalSpecialTax,
      items: specialItems,
    },
  };
}

/**
 * Backward compatibility wrapper for computeTaxLiability
 */
export function computeTaxLiability(
  taxableIncome: number,
  regime: TaxRegime,
  ay: string = '2026-27',
  genderOrAgeCategory: string = 'Below 60',
  agriculturalIncome: number = 0,
  isResident: boolean = true
): TaxCalculationBreakdown {
  return computeComprehensiveTax({
    regime,
    ay,
    genderOrAgeCategory,
    agriculturalIncome,
    isResident,
    salary: { 
      grossSalary: taxableIncome, 
      netSalary: taxableIncome, 
      standardDeduction: 0,
      allowancesExempt: 0,
      entertainmentAllowance: 0,
      professionalTax: 0,
    },
  });
}

// ============================================================================
// 14. AUTHORITATIVE FULL COMPUTATION ENGINE (TAX COMPUTATION MASTER)
// ============================================================================

export function recalculateFullComputation(comp: TaxComputation): TaxComputation {
  const ay = comp.assessmentYear || '2026-27';
  const regime = comp.regimeOpted || 'new';
  const isResident = comp.client?.residentialStatus !== 'Non-Resident';
  const ageCategory = determineAgeCategory(comp.client, ay);

  const agriDetails = calculateAgriculturalIncome(
    comp.agriculturalDetails ?? comp.otherSources?.agriculturalDetails,
    comp.agriculturalIncome ?? comp.otherSources?.agriculturalIncome
  );
  const agriIncome = agriDetails.netAgriculturalIncome;
  
  // 1. Calculate Income across Heads (Multiple Salaries Supported)
  const salarySummary = calculateAllSalaries(comp.salary, regime, ay);
  const netSalary = salarySummary.netSalary;
  const netHP = calculateNetHouseProperty(comp.houseProperty, regime);
  const bizResult = calculateNetBusiness(comp.business);
  const netBiz = bizResult.netProfit;
  
  // Capital Gains Intra-Head Set-off
  const cgResult = calculateNetCapitalGains(comp.capitalGains);
  const netCG = cgResult.netCapitalGains;

  // Other Sources
  const netOS = calculateNetOtherSources(comp.otherSources, regime);
  
  // 2. Gross Total Income with Section 71(2A) inter-head loss set-off rules
  // Business loss cannot be set off against Salary income u/s 71(2A).
  let grossTotalIncome = 0;
  if (netBiz < 0) {
    const businessLoss = Math.abs(netBiz);
    const nonSalaryIncome = Math.max(0, netHP) + Math.max(0, netCG) + Math.max(0, netOS);
    const setOffAgainstOther = Math.min(businessLoss, nonSalaryIncome);
    const remainingNonSalary = nonSalaryIncome - setOffAgainstOther;
    grossTotalIncome = Math.max(0, netSalary + remainingNonSalary);
  } else {
    grossTotalIncome = Math.max(0, netSalary + netHP + netBiz + netCG + netOS);
  }
  
  // 3. Chapter VI-A Deductions
  const totalDeductions = calculateTotalDeductions(comp.deductions, regime, grossTotalIncome);
  
  // 4. Total Taxable Income u/s 288A
  const totalTaxableIncome = roundToNearestTen(Math.max(0, grossTotalIncome - totalDeductions));
  
  // Prepare synchronized salary object for comprehensive tax calculation
  const synchronizedSalary: SalaryDetails = {
    ...comp.salary,
    grossSalary: salarySummary.grossSalary,
    salarySection17_1: salarySummary.salarySection17_1,
    perquisites17_2: salarySummary.perquisites17_2,
    profitsInLieu17_3: salarySummary.profitsInLieu17_3,
    allowancesExempt: salarySummary.allowancesExempt,
    professionalTax: salarySummary.professionalTax,
    entertainmentAllowance: salarySummary.entertainmentAllowance,
    standardDeduction: salarySummary.standardDeduction,
    netSalary: salarySummary.netSalary,
    salaryArrears: salarySummary.salaryArrears,
    salaryList: salarySummary.salaryList.length > 0 ? salarySummary.salaryList : comp.salary?.salaryList,
    hasOverlappingPeriods: salarySummary.hasOverlappingPeriods,
    overlapWarning: salarySummary.overlapWarning,
    employerName: salarySummary.primaryEmployerName || comp.salary?.employerName,
    employerType: salarySummary.primaryEmployerType || comp.salary?.employerType,
    employerTAN: salarySummary.primaryEmployerTAN || comp.salary?.employerTAN,
  };

  // 5. Comprehensive Tax Liability Calculation with Special Buckets
  const taxBreakdown = computeComprehensiveTax({
    salary: synchronizedSalary,
    houseProperty: comp.houseProperty,
    business: comp.business,
    capitalGains: comp.capitalGains,
    otherSources: comp.otherSources,
    deductions: comp.deductions,
    regime,
    ay,
    genderOrAgeCategory: ageCategory,
    agriculturalIncome: agriIncome,
    isResident,
  });
  
  // 6. Relief & Interest
  const relief89 = Math.max(0, comp.relief89 || 0);
  const int234A = Math.max(0, comp.interest234A || 0);
  const int234B = Math.max(0, comp.interest234B || 0);
  const int234C = Math.max(0, comp.interest234C || 0);
  const fee234F = Math.max(0, comp.fee234F || 0);
  
  const grossTax = Math.max(0, taxBreakdown.totalTaxPayable - relief89);
  const totalTaxAndInterest = roundToNearestTen(grossTax + int234A + int234B + int234C + fee234F);
  
  // 7. Taxes Paid - Synchronize with multiple employer TDS if salaryList is present and has TDS
  const taxesPaidObj = { ...comp.taxesPaid };
  if (salarySummary.salaryList.length > 0 && salarySummary.totalTDSSalary > 0) {
    taxesPaidObj.tdsSalary = salarySummary.totalTDSSalary;
  }

  const totalTaxesPaid = (taxesPaidObj.tdsSalary || 0) + 
                         (taxesPaidObj.tdsOther || 0) + 
                         (taxesPaidObj.tcs || 0) + 
                         (taxesPaidObj.advanceTax || 0) + 
                         (taxesPaidObj.selfAssessmentTax || 0);
  
  // 8. Balance Payable or Refund Due u/s 288B
  let netTaxPayable = 0;
  let refundDue = 0;
  
  if (totalTaxesPaid >= totalTaxAndInterest) {
    refundDue = roundToNearestTen(totalTaxesPaid - totalTaxAndInterest);
    netTaxPayable = 0;
  } else {
    netTaxPayable = roundToNearestTen(totalTaxAndInterest - totalTaxesPaid);
    refundDue = 0;
  }
  
  // 9. Schedule Balance Sheet (as on 31st March)
  let calculatedBalanceSheet: BalanceSheetDetails | undefined = undefined;
  if (comp.balanceSheet) {
    const defaultAsOn = comp.financialYear 
      ? `31st March ${comp.financialYear.split('-')[1]?.length === 2 ? '20' + comp.financialYear.split('-')[1] : comp.financialYear.split('-')[1]}` 
      : '31st March 2026';
    calculatedBalanceSheet = calculateBalanceSheet(comp.balanceSheet, netBiz, defaultAsOn);
  }

  const resultComputation: TaxComputation = {
    ...comp,
    updatedAt: new Date().toISOString(),
    client: {
      ...comp.client,
      ageCategory,
    },
    salary: synchronizedSalary,
    houseProperty: {
      ...comp.houseProperty,
      netHousePropertyIncome: netHP,
    },
    business: {
      ...comp.business,
      turnoverOrGrossReceipts: bizResult.totalTurnover,
      profitDigital6: bizResult.profitDigital6,
      profitCash8: bizResult.profitCash8,
      turnoverOtherMode: bizResult.turnoverOtherMode,
      profitOtherMode: bizResult.profitOtherMode,
      netProfit: netBiz,
    },
    capitalGains: {
      ...comp.capitalGains,
      stcg111A: cgResult.stcg111A,
      stcgNormal: cgResult.stcgNormal,
      ltcg112A: cgResult.ltcg112A,
      ltcg112: cgResult.ltcg112,
      stclSetOff: cgResult.stclSetOff,
      ltclSetOff: cgResult.ltclSetOff,
      carriedForwardSTCL: cgResult.carriedForwardSTCL,
      carriedForwardLTCL: cgResult.carriedForwardLTCL,
      netCapitalGains: netCG,
    },
    otherSources: {
      ...comp.otherSources,
      agriculturalIncome: agriIncome,
      agriculturalDetails: agriDetails,
      netOtherSources: netOS,
      totalSpecialRateIncome: (comp.otherSources.lotteryWinnings || 0) + (comp.otherSources.onlineGamesWinnings || 0) + (comp.otherSources.horseRacesWinnings || 0) + (comp.otherSources.unexplainedIncome115BBE || 0),
    },
    agriculturalIncome: agriIncome,
    agriculturalDetails: agriDetails,
    grossTotalIncome,
    deductions: {
      ...comp.deductions,
      totalDeductions,
    },
    totalTaxableIncome,
    taxOnNormalIncome: taxBreakdown.taxOnNormalIncome,
    taxOnSpecialIncome: taxBreakdown.taxOnSpecialIncome,
    totalTaxBeforeRebate: taxBreakdown.totalTaxBeforeRebate,
    rebate87A: taxBreakdown.rebate87A,
    taxAfterRebate: taxBreakdown.taxAfterRebate,
    surcharge: taxBreakdown.surcharge,
    healthAndEducationCess: taxBreakdown.cess4,
    grossTaxLiability: taxBreakdown.totalTaxPayable,
    slabBreakdown: taxBreakdown.slabBreakdown,
    specialRateBreakdown: taxBreakdown.specialRateBreakdown,
    marginalRelief87A: taxBreakdown.marginalRelief87A,
    marginalReliefSurcharge: taxBreakdown.marginalReliefSurcharge,
    totalTaxAndInterest,
    taxesPaid: {
      ...taxesPaidObj,
      totalTaxesPaid,
    },
    netTaxPayable,
    refundDue,
    balanceSheet: calculatedBalanceSheet,
  };

  // Run central ITR eligibility audit engine
  const eligibilityResult = checkITREligibility(resultComputation);
  resultComputation.eligibilityResult = eligibilityResult;

  return resultComputation;
}

// ============================================================================
// 15. BALANCE SHEET CALCULATION
// ============================================================================

export function calculateBalanceSheet(
  bs?: Partial<BalanceSheetDetails>, 
  defaultProfit: number = 0,
  defaultAsOnDate: string = '31st March 2026'
): BalanceSheetDetails {
  const currentBs = bs || {};
  
  let computedClosingCapital = 0;
  if (currentBs.closingCapital !== undefined) {
    computedClosingCapital = Math.max(0, currentBs.closingCapital);
  } else if (currentBs.openingCapital || currentBs.netProfitAdded) {
    const opCap = Math.max(0, currentBs.openingCapital || 0);
    const intro = Math.max(0, currentBs.capitalIntroduced || 0);
    const profit = currentBs.netProfitAdded !== undefined ? Number(currentBs.netProfitAdded) : defaultProfit;
    const additions = Math.max(0, currentBs.otherAdditions || 0);
    const draw = Math.max(0, currentBs.drawings || 0);
    const taxPaid = Math.max(0, currentBs.taxPaidFromCapital || 0);
    computedClosingCapital = Math.max(0, opCap + intro + profit + additions - draw - taxPaid);
  } else if (defaultProfit > 0) {
    computedClosingCapital = defaultProfit;
  }

  const opCap = Math.max(0, currentBs.openingCapital || 0);
  const intro = Math.max(0, currentBs.capitalIntroduced || 0);
  const profit = currentBs.netProfitAdded !== undefined ? Number(currentBs.netProfitAdded) : defaultProfit;
  const additions = Math.max(0, currentBs.otherAdditions || 0);
  const draw = Math.max(0, currentBs.drawings || 0);
  const taxPaid = Math.max(0, currentBs.taxPaidFromCapital || 0);

  const securedLoans = Math.max(0, currentBs.securedLoans || 0);
  const unsecuredLoans = Math.max(0, currentBs.unsecuredLoans || 0);
  const sundryCreditors = Math.max(0, currentBs.sundryCreditors || 0);
  const otherLiabilities = Math.max(0, currentBs.otherCurrentLiabilities || 0);

  const totalLiabilities = computedClosingCapital + securedLoans + unsecuredLoans + sundryCreditors + otherLiabilities;

  // Assets
  const grossFixed = Math.max(0, currentBs.grossFixedAssets || 0);
  const dep = Math.max(0, currentBs.depreciation || 0);
  const netFixedAssets = (grossFixed > 0 || dep > 0) ? Math.max(0, grossFixed - dep) : Math.max(0, currentBs.netFixedAssets || 0);

  const investments = Math.max(0, currentBs.investments || 0);
  const closingStock = Math.max(0, currentBs.closingStock || 0);
  const sundryDebtors = Math.max(0, currentBs.sundryDebtors || 0);
  const cashInHand = Math.max(0, currentBs.cashInHand || 0);
  const bankBalances = Math.max(0, currentBs.bankBalances || 0);
  const loansAndAdvances = Math.max(0, currentBs.loansAndAdvances || 0);

  const totalAssets = netFixedAssets + investments + closingStock + sundryDebtors + cashInHand + bankBalances + loansAndAdvances;

  return {
    enabled: currentBs.enabled !== undefined ? currentBs.enabled : (totalLiabilities > 0 || totalAssets > 0),
    asOnDate: currentBs.asOnDate || defaultAsOnDate,
    showInPrint: currentBs.showInPrint !== undefined ? currentBs.showInPrint : true,
    openingCapital: opCap,
    capitalIntroduced: intro,
    netProfitAdded: profit,
    otherAdditions: additions,
    drawings: draw,
    taxPaidFromCapital: taxPaid,
    closingCapital: computedClosingCapital,
    capitalAccountDetails: currentBs.capitalAccountDetails || '',
    securedLoans,
    securedLoansDetails: currentBs.securedLoansDetails || '',
    unsecuredLoans,
    unsecuredLoansDetails: currentBs.unsecuredLoansDetails || '',
    sundryCreditors,
    sundryCreditorsDetails: currentBs.sundryCreditorsDetails || '',
    otherCurrentLiabilities: otherLiabilities,
    otherLiabilitiesDetails: currentBs.otherLiabilitiesDetails || '',
    totalLiabilities,
    grossFixedAssets: grossFixed,
    depreciation: dep,
    netFixedAssets,
    fixedAssetsDetails: currentBs.fixedAssetsDetails || '',
    investments,
    investmentsDetails: currentBs.investmentsDetails || '',
    closingStock,
    sundryDebtors,
    sundryDebtorsDetails: currentBs.sundryDebtorsDetails || '',
    cashInHand,
    bankBalances,
    bankBalancesDetails: currentBs.bankBalancesDetails || '',
    loansAndAdvances,
    loansAndAdvancesDetails: currentBs.loansAndAdvancesDetails || '',
    totalAssets,
    notes: currentBs.notes || '',
  };
}

/**
 * Creates a clean zero-initialized Tax Computation without any fabricated or assumed taxpayer data
 */
export function createEmptyComputation(ay: string = '2026-27'): TaxComputation {
  const startYear = parseInt(ay.split('-')[0]) || 2026;
  const fy = `${startYear - 1}-${(startYear % 100).toString().padStart(2, '0')}`;

  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assessmentYear: ay,
    financialYear: fy,
    itrForm: 'ITR-1 (Sahaj)',
    filingSection: '139(1) - On or before due date',
    filingDate: '',
    acknowledgementNumber: '',
    regimeOpted: 'new',
    client: {
      pan: '',
      name: '',
      status: 'Individual',
      residentialStatus: 'Resident',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
    },
    salary: {
      grossSalary: 0,
      allowancesExempt: 0,
      standardDeduction: 0,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 0,
    },
    houseProperty: {
      grossRentReceived: 0,
      municipalTaxes: 0,
      annualValue: 0,
      standardDeduction30: 0,
      homeLoanInterest24b: 0,
      netHousePropertyIncome: 0,
    },
    business: {
      natureOfBusiness: '',
      turnoverDigital6: 0,
      profitDigital6: 0,
      turnoverCash8: 0,
      profitCash8: 0,
      turnoverOrGrossReceipts: 0,
      presumptiveSection: '44AD (8%/6%)',
      netProfit: 0,
    },
    capitalGains: {
      stcg111A: 0,
      stcgNormal: 0,
      ltcg112A: 0,
      ltcg112: 0,
      netCapitalGains: 0,
    },
    otherSources: {
      savingsInterest: 0,
      fdInterest: 0,
      dividendIncome: 0,
      otherIncome: 0,
      familyPension: 0,
      netOtherSources: 0,
    },
    agriculturalIncome: 0,
    agriculturalDetails: {
      grossAgriculturalReceipts: 0,
      agriculturalExpenses: 0,
      netAgriculturalIncome: 0,
    },
    grossTotalIncome: 0,
    deductions: {
      sec80C: 0,
      sec80CCC: 0,
      sec80CCD1B: 0,
      sec80CCD2: 0,
      sec80D: 0,
      sec80DD: 0,
      sec80DDB: 0,
      sec80E: 0,
      sec80EEA: 0,
      sec80G: 0,
      sec80GG: 0,
      sec80TTA: 0,
      sec80TTB: 0,
      sec80U: 0,
      otherDeductions: 0,
      totalDeductions: 0,
    },
    totalTaxableIncome: 0,
    taxOnNormalIncome: 0,
    taxOnSpecialIncome: 0,
    totalTaxBeforeRebate: 0,
    rebate87A: 0,
    taxAfterRebate: 0,
    surcharge: 0,
    healthAndEducationCess: 0,
    grossTaxLiability: 0,
    relief89: 0,
    interest234A: 0,
    interest234B: 0,
    interest234C: 0,
    fee234F: 0,
    totalTaxAndInterest: 0,
    taxesPaid: {
      tdsSalary: 0,
      tdsOther: 0,
      tcs: 0,
      advanceTax: 0,
      selfAssessmentTax: 0,
      totalTaxesPaid: 0,
    },
    netTaxPayable: 0,
    refundDue: 0,
    status: 'Draft',
  };
}
