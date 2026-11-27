import { 
  TaxComputation, 
  ITRFormType, 
  ValidationSeverity, 
  ITREligibilityResult, 
  ITREligibilityFieldCheck,
  ClientProfile,
  OtherSourcesDetails
} from '../types';

// ============================================================================
// 1. AY-SPECIFIC ELIGIBILITY CONFIGURATION (CBDT STATUTORY RULES)
// ============================================================================

export interface AYEligibilityRules {
  assessmentYear: string;
  financialYear: string;
  itr1: {
    maxTotalIncome: number;
    maxAgriculturalIncome: number;
    allowCapitalGains: boolean;
    allowBusiness: boolean;
    allowForeignAssets: boolean;
    allowDirectorship: boolean;
    allowUnlistedShares: boolean;
    allowBroughtForwardLosses: boolean;
    allowWinnings115BB_115BBJ: boolean;
    allowMultipleHouseProperties: boolean;
  };
  itr4: {
    maxTotalIncome: number;
    sec44AD_ThresholdStandard: number;
    sec44AD_ThresholdDigital: number; // If cash receipts <= 5% (digital >= 95%)
    sec44ADA_ThresholdStandard: number;
    sec44ADA_ThresholdDigital: number; // If cash receipts <= 5% (digital >= 95%)
    sec44AE_MaxVehicles: number;
    maxAgriculturalIncome: number;
    allowCapitalGains: boolean;
    allowForeignAssets: boolean;
    allowDirectorship: boolean;
    allowUnlistedShares: boolean;
    allowBroughtForwardLosses: boolean;
    allowWinnings115BB_115BBJ: boolean;
    allowMultipleHouseProperties: boolean;
  };
}

export const ITR_ELIGIBILITY_RULES: Record<string, AYEligibilityRules> = {
  '2026-27': {
    assessmentYear: '2026-27',
    financialYear: '2025-26',
    itr1: {
      maxTotalIncome: 5000000, // ₹50 Lakhs
      maxAgriculturalIncome: 5000, // ₹5,000
      allowCapitalGains: false,
      allowBusiness: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
    itr4: {
      maxTotalIncome: 5000000, // ₹50 Lakhs
      sec44AD_ThresholdStandard: 20000000, // ₹2 Crore
      sec44AD_ThresholdDigital: 30000000,  // ₹3 Crore (where cash receipts <= 5%)
      sec44ADA_ThresholdStandard: 5000000, // ₹50 Lakh
      sec44ADA_ThresholdDigital: 7500000,  // ₹75 Lakh (where cash receipts <= 5%)
      sec44AE_MaxVehicles: 10,
      maxAgriculturalIncome: 5000,
      allowCapitalGains: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
  },
  '2025-26': {
    assessmentYear: '2025-26',
    financialYear: '2024-25',
    itr1: {
      maxTotalIncome: 5000000,
      maxAgriculturalIncome: 5000,
      allowCapitalGains: false,
      allowBusiness: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
    itr4: {
      maxTotalIncome: 5000000,
      sec44AD_ThresholdStandard: 20000000,
      sec44AD_ThresholdDigital: 30000000,
      sec44ADA_ThresholdStandard: 5000000,
      sec44ADA_ThresholdDigital: 7500000,
      sec44AE_MaxVehicles: 10,
      maxAgriculturalIncome: 5000,
      allowCapitalGains: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
  },
  '2024-25': {
    assessmentYear: '2024-25',
    financialYear: '2023-24',
    itr1: {
      maxTotalIncome: 5000000,
      maxAgriculturalIncome: 5000,
      allowCapitalGains: false,
      allowBusiness: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
    itr4: {
      maxTotalIncome: 5000000,
      sec44AD_ThresholdStandard: 20000000,
      sec44AD_ThresholdDigital: 30000000,
      sec44ADA_ThresholdStandard: 5000000,
      sec44ADA_ThresholdDigital: 7500000,
      sec44AE_MaxVehicles: 10,
      maxAgriculturalIncome: 5000,
      allowCapitalGains: false,
      allowForeignAssets: false,
      allowDirectorship: false,
      allowUnlistedShares: false,
      allowBroughtForwardLosses: false,
      allowWinnings115BB_115BBJ: false,
      allowMultipleHouseProperties: false,
    },
  },
};

export function getAYEligibilityRules(assessmentYear: string = '2026-27'): AYEligibilityRules {
  return ITR_ELIGIBILITY_RULES[assessmentYear] || ITR_ELIGIBILITY_RULES['2026-27'];
}

// ============================================================================
// 2. CENTRAL ITR ELIGIBILITY & VALIDATION FUNCTION
// ============================================================================

/**
 * Validates the selected ITR form against statutory CBDT eligibility rules for AY 2026-27.
 * Determines the true recommended ITR form and generates field-level checks, warnings, and reasons.
 * 
 * Never fabricates missing data (returns YELLOW / INFO_REQUIRED if required information is missing).
 */
export function checkITREligibility(computation: TaxComputation): ITREligibilityResult {
  const ay = computation.assessmentYear || '2026-27';
  const rules = getAYEligibilityRules(ay);
  const selectedITR: ITRFormType = computation.itrForm || 'ITR-4 (Sugam)';
  
  const reasons: string[] = [];
  const warnings: string[] = [];
  const requiredAction: string[] = [];
  const rulesEvaluated: string[] = [];

  // Extract taxpayer inputs
  const client: Partial<ClientProfile> = computation.client || {};
  const status = client.status || 'Individual';
  const residentialStatus = client.residentialStatus;
  const totalIncome = Number(computation.grossTotalIncome) || 0;
  
  // Income Heads & Components
  const hasSalary = (Number(computation.salary?.grossSalary) > 0 || Number(computation.salary?.netSalary) > 0);
  const hasHouseProperty = (Number(computation.houseProperty?.grossRentReceived) > 0 || Number(computation.houseProperty?.netHousePropertyIncome) !== 0);
  
  // Business & Profession
  const biz = computation.business || { turnoverOrGrossReceipts: 0, netProfit: 0, natureOfBusiness: '', presumptiveSection: '' };
  const hasBusiness = (
    Number(biz.turnoverOrGrossReceipts) > 0 || 
    Number(biz.netProfit) > 0 || 
    Boolean(biz.natureOfBusiness && biz.natureOfBusiness.trim() !== '') ||
    (biz.businessList && biz.businessList.length > 0 && biz.businessList.some(b => Number(b.totalTurnover) > 0 || Number(b.netProfit) > 0))
  );

  const businessTurnover = Number(biz.turnoverOrGrossReceipts) || 
    (biz.businessList ? biz.businessList.reduce((acc, b) => acc + (Number(b.totalTurnover) || 0), 0) : 0);
  const digitalTurnover = Number(biz.turnoverDigital6) || 
    (biz.businessList ? biz.businessList.reduce((acc, b) => acc + (Number(b.turnoverDigital6) || 0), 0) : 0);
  const cashTurnover = Number(biz.turnoverCash8) || 
    (biz.businessList ? biz.businessList.reduce((acc, b) => acc + (Number(b.turnoverCash8) || 0), 0) : 0);
  
  const presumptiveSection = biz.presumptiveSection || '44AD (8%/6%/Other)';
  const is44ADA = presumptiveSection.includes('44ADA') || (biz.businessCode && ['14001', '14002', '14003', '14005'].includes(biz.businessCode));
  const is44AE = presumptiveSection.includes('44AE');
  const is44AD = !is44ADA && !is44AE && (presumptiveSection.includes('44AD') || presumptiveSection.includes('8%') || presumptiveSection.includes('6%'));
  const isNormalBooks = presumptiveSection.includes('Normal Books') || presumptiveSection.includes('P&L');

  // Capital Gains
  const cg = computation.capitalGains || { netCapitalGains: 0 };
  const stcg111A = Number(cg.stcg111A || cg.stcg15) || 0;
  const stcgNormal = Number(cg.stcgNormal) || 0;
  const ltcg112A = Number(cg.ltcg112A || cg.ltcg10) || 0;
  const ltcg112 = Number(cg.ltcg112 || cg.ltcg20) || 0;
  const hasCapitalGains = (stcg111A > 0 || stcgNormal > 0 || ltcg112A > 0 || ltcg112 > 0 || Number(cg.netCapitalGains) > 0 || (cg.currentYearSTCL || 0) > 0 || (cg.currentYearLTCL || 0) > 0);

  // Other Sources Special Income
  const os: Partial<OtherSourcesDetails> = computation.otherSources || {};
  const lotteryWinnings = Number(os.lotteryWinnings) || 0;
  const onlineGamesWinnings = Number(os.onlineGamesWinnings) || 0;
  const horseRacesWinnings = Number(os.horseRacesWinnings) || 0;
  const unexplained115BBE = Number(os.unexplainedIncome115BBE) || 0;
  const hasSpecialWinnings115BB_115BBJ = (lotteryWinnings > 0 || onlineGamesWinnings > 0 || horseRacesWinnings > 0 || unexplained115BBE > 0);

  // Agricultural Income
  const agriIncome = Number(computation.agriculturalIncome || os.agriculturalIncome || (computation.agriculturalDetails?.netAgriculturalIncome)) || 0;

  // Disclosures & Statutory flags
  const isDirector = Boolean(client.isDirector);
  const hasUnlistedShares = Boolean(client.hasUnlistedShares);
  const hasForeignAssets = Boolean(
    client.hasForeignAssets || 
    client.foreignAssetsDetails?.hasBankAccounts || 
    client.foreignAssetsDetails?.hasShares || 
    client.foreignAssetsDetails?.hasProperty || 
    client.foreignAssetsDetails?.hasIncome ||
    (client.foreignAssetsDetails?.foreignIncomeAmount && client.foreignAssetsDetails.foreignIncomeAmount > 0)
  );

  const hasBroughtForwardLosses = Boolean(
    client.hasBroughtForwardLosses ||
    (cg.broughtForwardSTCL && cg.broughtForwardSTCL > 0) ||
    (cg.broughtForwardLTCL && cg.broughtForwardLTCL > 0) ||
    (client.broughtForwardLossDetails && (
      (client.broughtForwardLossDetails.hpLoss || 0) > 0 ||
      (client.broughtForwardLossDetails.businessLoss || 0) > 0 ||
      (client.broughtForwardLossDetails.stcl || 0) > 0 ||
      (client.broughtForwardLossDetails.ltcl || 0) > 0
    ))
  );

  // ============================================================================
  // 3. STEP-BY-STEP FIELD-LEVEL CHECKS
  // ============================================================================

  // 1. PAN Check
  const pan = (client.pan || '').toUpperCase().trim();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isPanValid = panRegex.test(pan);
  const panStatus: ITREligibilityFieldCheck = {
    status: isPanValid ? 'PASS' : (pan ? 'FAIL' : 'INFO_REQUIRED'),
    rule: 'CBDT Section 139A — Valid 10-digit Permanent Account Number (PAN)',
    message: isPanValid 
      ? `Valid PAN structure (${pan}) with 4th character '${pan[3]}' matching status '${status}'.`
      : (pan ? `Invalid PAN format '${pan}'. Must be 5 letters, 4 digits, 1 letter.` : 'PAN is missing. Tax return requires mandatory PAN disclosure.'),
  };
  rulesEvaluated.push(panStatus.rule);

  // 2. Residential Status Check
  let isResidencyMissing = false;
  let isResidencyEligibleForSimplified = false; // ITR-1 and ITR-4 require Resident
  if (!residentialStatus) {
    isResidencyMissing = true;
  } else if (residentialStatus === 'Resident') {
    isResidencyEligibleForSimplified = true;
  }

  const residentialCheck: ITREligibilityFieldCheck = {
    status: isResidencyMissing ? 'INFO_REQUIRED' : (isResidencyEligibleForSimplified ? 'PASS' : 'WARN'),
    rule: 'Section 6 Residential Status — Simplified Returns (ITR-1 / ITR-4) Restricted to Resident Individuals/HUFs',
    message: isResidencyMissing
      ? 'Residential status is not specified. Please verify whether the assessee is Resident, Non-Resident, or RNOR.'
      : (isResidencyEligibleForSimplified
          ? 'Taxpayer is Resident (eligible for ITR-1/ITR-4 subject to income limits).'
          : `Taxpayer is '${residentialStatus}'. Non-Resident and RNOR assessees cannot file ITR-1 or ITR-4; ITR-2 or ITR-3 is mandatory.`),
  };
  rulesEvaluated.push(residentialCheck.rule);

  // 3. Total Income Limit Check
  const incomeLimitCheck: ITREligibilityFieldCheck = {
    status: totalIncome <= 5000000 ? 'PASS' : 'FAIL',
    rule: 'Rule 12 — ₹50,00,000 Total Income Ceiling for Simplified Returns (ITR-1 / ITR-4)',
    message: totalIncome <= 5000000
      ? `Gross Total Income ₹${totalIncome.toLocaleString('en-IN')} is within the ₹50,00,000 statutory limit.`
      : `Gross Total Income ₹${totalIncome.toLocaleString('en-IN')} exceeds the ₹50,00,000 ceiling. ITR-1 and ITR-4 are not permissible; use ITR-2 or ITR-3.`,
    details: { totalIncome, limit: 5000000 },
  };
  rulesEvaluated.push(incomeLimitCheck.rule);

  // 4. Business & Profession Check
  const isBusinessPresent = hasBusiness;
  let isTurnoverMissing = false;
  let is44ADTurnoverBreached = false;
  let is44ADATurnoverBreached = false;
  let applicableThreshold = 0;

  if (hasBusiness) {
    if (businessTurnover <= 0 && Number(biz.netProfit) > 0) {
      isTurnoverMissing = true;
    }

    if (is44AD) {
      // AY 2026-27: ₹3 Cr if cash <= 5% (digital >= 95%), else ₹2 Cr
      const cashPortion = businessTurnover > 0 ? (cashTurnover / businessTurnover) : 0;
      const isDigitalEligible = cashPortion <= 0.05;
      applicableThreshold = isDigitalEligible ? rules.itr4.sec44AD_ThresholdDigital : rules.itr4.sec44AD_ThresholdStandard;
      if (businessTurnover > applicableThreshold) {
        is44ADTurnoverBreached = true;
      }
    } else if (is44ADA) {
      // AY 2026-27: ₹75 Lakh if cash <= 5%, else ₹50 Lakh
      const cashPortion = businessTurnover > 0 ? (cashTurnover / businessTurnover) : 0;
      const isDigitalEligible = cashPortion <= 0.05;
      applicableThreshold = isDigitalEligible ? rules.itr4.sec44ADA_ThresholdDigital : rules.itr4.sec44ADA_ThresholdStandard;
      if (businessTurnover > applicableThreshold) {
        is44ADATurnoverBreached = true;
      }
    }
  }

  const businessIncomeCheck: ITREligibilityFieldCheck = {
    status: !hasBusiness ? 'PASS' : (isNormalBooks ? 'FAIL' : (isTurnoverMissing ? 'INFO_REQUIRED' : 'PASS')),
    rule: 'Section 28 to 44DB — Income from Profits & Gains of Business or Profession (PGBP)',
    message: !hasBusiness
      ? 'No business or professional income declared.'
      : (isNormalBooks
          ? 'Business income under Normal Books / Audit (P&L) declared. ITR-3 is mandatory; ITR-1, ITR-2, and ITR-4 are not eligible.'
          : `Presumptive business/profession declared (${presumptiveSection}).`),
  };
  rulesEvaluated.push(businessIncomeCheck.rule);

  const turnoverCheck: ITREligibilityFieldCheck = {
    status: isTurnoverMissing ? 'INFO_REQUIRED' : (is44ADTurnoverBreached || is44ADATurnoverBreached ? 'FAIL' : 'PASS'),
    rule: 'Section 44AD / 44ADA Statutory Turnover Limits (AY 2026-27: 44AD ₹3Cr / ₹2Cr, 44ADA ₹75L / ₹50L)',
    message: isTurnoverMissing
      ? 'Business turnover is missing or zero while net profit is present. Manual verification required to verify 44AD/44ADA limits.'
      : (is44ADTurnoverBreached
          ? `Turnover of ₹${businessTurnover.toLocaleString('en-IN')} exceeds Section 44AD threshold of ₹${applicableThreshold.toLocaleString('en-IN')}. Taxpayer must file ITR-3 with regular books/audit.`
          : is44ADATurnoverBreached
          ? `Gross receipts of ₹${businessTurnover.toLocaleString('en-IN')} exceed Section 44ADA limit of ₹${applicableThreshold.toLocaleString('en-IN')}. Taxpayer must file ITR-3.`
          : `Turnover / Gross Receipts of ₹${businessTurnover.toLocaleString('en-IN')} are within permissible limits.`),
  };
  rulesEvaluated.push(turnoverCheck.rule);

  // 5. Capital Gains Check
  const capitalGainsCheck: ITREligibilityFieldCheck = {
    status: !hasCapitalGains ? 'PASS' : 'WARN',
    rule: 'Section 45 to 55A — Capital Gains Income Reporting (Schedule CG)',
    message: !hasCapitalGains
      ? 'No Capital Gains income or losses declared.'
      : `Capital Gains detected (STCG: ₹${(stcg111A + stcgNormal).toLocaleString('en-IN')}, LTCG: ₹${(ltcg112A + ltcg112).toLocaleString('en-IN')}). Capital Gains cannot be reported in ITR-1 or ITR-4; requires ITR-2 or ITR-3.`,
  };
  rulesEvaluated.push(capitalGainsCheck.rule);

  // 6. Foreign Assets & Foreign Income Check
  const foreignAssetsCheck: ITREligibilityFieldCheck = {
    status: !hasForeignAssets ? 'PASS' : 'FAIL',
    rule: 'Schedule FA — Foreign Assets, Foreign Bank Accounts, Foreign Income & Signing Authority',
    message: !hasForeignAssets
      ? 'No foreign assets, offshore accounts, or foreign income reported.'
      : 'Foreign assets/income detected. Assessee is strictly prohibited from filing ITR-1 or ITR-4. Schedule FA must be filed in ITR-2 or ITR-3.',
  };
  rulesEvaluated.push(foreignAssetsCheck.rule);

  // 7. Agricultural Income Check
  const agriculturalIncomeCheck: ITREligibilityFieldCheck = {
    status: agriIncome <= 5000 ? 'PASS' : 'WARN',
    rule: 'Section 10(1) — Agricultural Income Limit for Simplified Returns (Max ₹5,000 in ITR-1 / ITR-4)',
    message: agriIncome <= 5000
      ? `Agricultural income of ₹${agriIncome.toLocaleString('en-IN')} is within the ₹5,000 threshold.`
      : `Agricultural income of ₹${agriIncome.toLocaleString('en-IN')} exceeds ₹5,000. Schedule EI (Exempt Income) must be filed in ITR-2 (non-business) or ITR-3 (business).`,
  };
  rulesEvaluated.push(agriculturalIncomeCheck.rule);

  // 8. Directorship & Unlisted Shares Check
  const isDirectorshipOrUnlistedDisqualified = (isDirector || hasUnlistedShares);
  const directorshipOrUnlistedCheck: ITREligibilityFieldCheck = {
    status: !isDirectorshipOrUnlistedDisqualified ? 'PASS' : 'FAIL',
    rule: 'CBDT Mandate — Company Directorships & Unlisted Equity Shareholdings',
    message: !isDirectorshipOrUnlistedDisqualified
      ? 'Taxpayer holds no unlisted shares and is not a company director.'
      : `${isDirector ? 'Directorship in company held. ' : ''}${hasUnlistedShares ? 'Unlisted equity shares held during FY. ' : ''}ITR-1 and ITR-4 are prohibited; requires ITR-2 or ITR-3.`,
  };
  rulesEvaluated.push(directorshipOrUnlistedCheck.rule);

  // 9. Brought-Forward Losses Check
  const broughtForwardLossesCheck: ITREligibilityFieldCheck = {
    status: !hasBroughtForwardLosses ? 'PASS' : 'FAIL',
    rule: 'Section 70 to 80 — Brought-Forward & Carried-Forward Losses (Schedule CFL)',
    message: !hasBroughtForwardLosses
      ? 'No brought-forward or carried-forward losses claimed.'
      : 'Brought-forward losses detected. Cannot be adjusted in ITR-1 or ITR-4; Schedule CFL requires ITR-2 or ITR-3.',
  };
  rulesEvaluated.push(broughtForwardLossesCheck.rule);

  // 10. Special-Rate Income (115BB / 115BBJ / 115BBE)
  const specialRateIncomeCheck: ITREligibilityFieldCheck = {
    status: !hasSpecialWinnings115BB_115BBJ ? 'PASS' : 'WARN',
    rule: 'Section 115BB / 115BBJ / 115BBE — Special Rate Winnings & Unexplained Incomes',
    message: !hasSpecialWinnings115BB_115BBJ
      ? 'No special rate winnings or unexplained incomes reported.'
      : 'Special rate winnings (lottery, online gaming u/s 115BB/115BBJ) detected. Prohibited in ITR-1 and ITR-4; requires ITR-2 or ITR-3.',
  };
  rulesEvaluated.push(specialRateIncomeCheck.rule);

  // ============================================================================
  // 4. STATUTORY RECOMMENDED ITR DETERMINATION
  // ============================================================================

  let recommendedITR: ITRFormType = 'ITR-1 (Sahaj)';

  if (hasBusiness) {
    // Has Business or Professional Income (PGBP)
    // Evaluate if eligible for ITR-4 (Sugam)
    let canUseITR4 = true;
    const itr4Disqualifiers: string[] = [];

    // Condition 1: Must be Individual, HUF, or Partnership Firm (not LLP/Company)
    if (status === 'Company' || status === 'LLP') {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Entity status '${status}' cannot file ITR-4`);
    }

    // Condition 2: Must be Resident (not Non-Resident or RNOR)
    if (residentialStatus && residentialStatus !== 'Resident') {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Non-resident/RNOR cannot file ITR-4 (${residentialStatus})`);
    }

    // Condition 3: Total Income <= ₹50 Lakhs
    if (totalIncome > rules.itr4.maxTotalIncome) {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Total income (₹${totalIncome.toLocaleString('en-IN')}) exceeds ₹50,00,000 ceiling`);
    }

    // Condition 4: Presumptive business under 44AD, 44ADA, or 44AE
    if (isNormalBooks) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Regular books of accounts / P&L (not presumptive)');
    }

    // Condition 5: 44AD / 44ADA Turnover Threshold
    if (is44ADTurnoverBreached) {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Section 44AD turnover exceeds statutory ceiling of ₹${applicableThreshold.toLocaleString('en-IN')}`);
    }
    if (is44ADATurnoverBreached) {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Section 44ADA gross receipts exceed statutory limit of ₹${applicableThreshold.toLocaleString('en-IN')}`);
    }

    // Condition 6: Section 44AE Goods Carriage vehicle count
    if (is44AE && (client.goodsCarriageCount || 0) > rules.itr4.sec44AE_MaxVehicles) {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Section 44AE vehicles count (${client.goodsCarriageCount}) exceeds 10 vehicles`);
    }

    // Condition 7: No Capital Gains
    if (hasCapitalGains) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Capital Gains income present (Schedule CG required)');
    }

    // Condition 8: Agricultural income <= ₹5,000
    if (agriIncome > rules.itr4.maxAgriculturalIncome) {
      canUseITR4 = false;
      itr4Disqualifiers.push(`Agricultural income (₹${agriIncome.toLocaleString('en-IN')}) exceeds ₹5,000 limit`);
    }

    // Condition 9: No Foreign Assets / Foreign Income
    if (hasForeignAssets) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Foreign assets or foreign income present (Schedule FA required)');
    }

    // Condition 10: No Directorship / Unlisted Shares
    if (isDirector) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Directorship in company held');
    }
    if (hasUnlistedShares) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Holding unlisted equity shares');
    }

    // Condition 11: No Brought-forward losses
    if (hasBroughtForwardLosses) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Brought-forward losses present (Schedule CFL required)');
    }

    // Condition 12: No special rate winnings (115BB / 115BBJ)
    if (hasSpecialWinnings115BB_115BBJ) {
      canUseITR4 = false;
      itr4Disqualifiers.push('Special rate winnings u/s 115BB / 115BBJ present');
    }

    if (canUseITR4) {
      recommendedITR = 'ITR-4 (Sugam)';
    } else {
      recommendedITR = 'ITR-3';
    }
  } else {
    // No Business Income (Salaried / House Property / Capital Gains / Other Sources)
    let canUseITR1 = true;
    const itr1Disqualifiers: string[] = [];

    // Condition 1: Individual only (not HUF, Firm, Company)
    if (status !== 'Individual') {
      canUseITR1 = false;
      itr1Disqualifiers.push(`Taxpayer status '${status}' cannot file ITR-1 (Individual only)`);
    }

    // Condition 2: Resident and Ordinarily Resident (ROR)
    if (residentialStatus && residentialStatus !== 'Resident') {
      canUseITR1 = false;
      itr1Disqualifiers.push(`Non-Resident or RNOR cannot file ITR-1 (${residentialStatus})`);
    }

    // Condition 3: Total Income <= ₹50 Lakhs
    if (totalIncome > rules.itr1.maxTotalIncome) {
      canUseITR1 = false;
      itr1Disqualifiers.push(`Total income (₹${totalIncome.toLocaleString('en-IN')}) exceeds ₹50,00,000 ceiling`);
    }

    // Condition 4: No Capital Gains
    if (hasCapitalGains) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Capital Gains income present');
    }

    // Condition 5: Agricultural income <= ₹5,000
    if (agriIncome > rules.itr1.maxAgriculturalIncome) {
      canUseITR1 = false;
      itr1Disqualifiers.push(`Agricultural income (₹${agriIncome.toLocaleString('en-IN')}) exceeds ₹5,000 limit`);
    }

    // Condition 6: No Foreign Assets / Foreign Income
    if (hasForeignAssets) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Foreign assets or foreign income present (Schedule FA required)');
    }

    // Condition 7: No Directorship / Unlisted Shares
    if (isDirector) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Directorship in company held');
    }
    if (hasUnlistedShares) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Holding unlisted equity shares');
    }

    // Condition 8: No Brought-forward losses
    if (hasBroughtForwardLosses) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Brought-forward losses present');
    }

    // Condition 9: No Special Rate Winnings (115BB / 115BBJ)
    if (hasSpecialWinnings115BB_115BBJ) {
      canUseITR1 = false;
      itr1Disqualifiers.push('Lottery or online gaming winnings u/s 115BB/115BBJ present');
    }

    if (canUseITR1) {
      recommendedITR = 'ITR-1 (Sahaj)';
    } else {
      recommendedITR = 'ITR-2';
    }
  }

  // ============================================================================
  // 5. VALIDATION OF SELECTED ITR FORM VS STATUTORY RULES
  // ============================================================================

  let eligible = true;
  let statusSeverity: ValidationSeverity = 'GREEN';

  // Normalize selected ITR form string for comparison
  const normSelected = selectedITR.toLowerCase();
  
  if (normSelected.includes('itr-1') || normSelected.includes('sahaj')) {
    // --- AUDIT ITR-1 ---
    if (status !== 'Individual') {
      eligible = false;
      reasons.push(`ITR-1 (Sahaj) is strictly for Individual taxpayers. Status '${status}' is not eligible.`);
    }
    if (residentialStatus && residentialStatus !== 'Resident') {
      eligible = false;
      reasons.push(`ITR-1 (Sahaj) is only for Resident individuals. Assessee is '${residentialStatus}'.`);
    }
    if (totalIncome > rules.itr1.maxTotalIncome) {
      eligible = false;
      reasons.push(`Total Income of ₹${totalIncome.toLocaleString('en-IN')} exceeds the ₹50,00,000 statutory limit for ITR-1.`);
    }
    if (hasBusiness) {
      eligible = false;
      reasons.push('Income from Business or Profession (PGBP) is strictly prohibited in ITR-1 (Sahaj).');
    }
    if (hasCapitalGains) {
      eligible = false;
      reasons.push('Capital Gains cannot be reported in ITR-1 (Sahaj). Form ITR-2 or ITR-3 is required.');
    }
    if (agriIncome > rules.itr1.maxAgriculturalIncome) {
      eligible = false;
      reasons.push(`Agricultural Income of ₹${agriIncome.toLocaleString('en-IN')} exceeds the ₹5,000 statutory limit for ITR-1.`);
    }
    if (hasForeignAssets) {
      eligible = false;
      reasons.push('Taxpayer holding foreign assets, foreign accounts, or foreign income cannot file ITR-1.');
    }
    if (isDirector) {
      eligible = false;
      reasons.push('Taxpayer holding Directorship in any company is prohibited from filing ITR-1 (Sahaj).');
    }
    if (hasUnlistedShares) {
      eligible = false;
      reasons.push('Taxpayer holding unlisted equity shares at any time during the financial year cannot file ITR-1.');
    }
    if (hasBroughtForwardLosses) {
      eligible = false;
      reasons.push('Brought-forward or carried-forward loss under any head cannot be claimed in ITR-1.');
    }
    if (hasSpecialWinnings115BB_115BBJ) {
      eligible = false;
      reasons.push('Winnings from lotteries or online games u/s 115BB / 115BBJ are prohibited in ITR-1.');
    }
  } else if (normSelected.includes('itr-4') || normSelected.includes('sugam')) {
    // --- AUDIT ITR-4 ---
    if (status === 'Company' || status === 'LLP') {
      eligible = false;
      reasons.push(`Entity status '${status}' is not eligible to file ITR-4 (Sugam).`);
    }
    if (residentialStatus && residentialStatus !== 'Resident') {
      eligible = false;
      reasons.push(`ITR-4 (Sugam) is only permitted for Resident taxpayers. Assessee is '${residentialStatus}'.`);
    }
    if (totalIncome > rules.itr4.maxTotalIncome) {
      eligible = false;
      reasons.push(`Total Income of ₹${totalIncome.toLocaleString('en-IN')} exceeds the ₹50,00,000 statutory limit for ITR-4.`);
    }
    if (!hasBusiness) {
      warnings.push('ITR-4 (Sugam) is selected but no business or professional presumptive income u/s 44AD/44ADA/44AE is declared.');
    }
    if (isNormalBooks) {
      eligible = false;
      reasons.push('Business maintained under regular books of accounts / P&L cannot be filed under ITR-4 (Sugam). ITR-3 is required.');
    }
    if (is44ADTurnoverBreached) {
      eligible = false;
      reasons.push(`Turnover of ₹${businessTurnover.toLocaleString('en-IN')} exceeds Section 44AD threshold of ₹${applicableThreshold.toLocaleString('en-IN')}. Taxpayer must file ITR-3.`);
    }
    if (is44ADATurnoverBreached) {
      eligible = false;
      reasons.push(`Gross Receipts of ₹${businessTurnover.toLocaleString('en-IN')} exceed Section 44ADA threshold of ₹${applicableThreshold.toLocaleString('en-IN')}. Taxpayer must file ITR-3.`);
    }
    if (hasCapitalGains) {
      eligible = false;
      reasons.push('Capital Gains cannot be reported in ITR-4 (Sugam). Form ITR-3 is required for business assessees with capital gains.');
    }
    if (agriIncome > rules.itr4.maxAgriculturalIncome) {
      eligible = false;
      reasons.push(`Agricultural Income of ₹${agriIncome.toLocaleString('en-IN')} exceeds the ₹5,000 statutory limit for ITR-4.`);
    }
    if (hasForeignAssets) {
      eligible = false;
      reasons.push('Taxpayer holding foreign assets or foreign income cannot file ITR-4 (Sugam).');
    }
    if (isDirector) {
      eligible = false;
      reasons.push('Company Directors are strictly prohibited from filing ITR-4 (Sugam). Form ITR-3 is required.');
    }
    if (hasUnlistedShares) {
      eligible = false;
      reasons.push('Holding unlisted equity shares disqualifies from filing ITR-4 (Sugam). Form ITR-3 is required.');
    }
    if (hasBroughtForwardLosses) {
      eligible = false;
      reasons.push('Brought-forward losses cannot be adjusted or carried forward in ITR-4 (Sugam). Form ITR-3 is required.');
    }
    if (hasSpecialWinnings115BB_115BBJ) {
      eligible = false;
      reasons.push('Lottery or online gaming winnings u/s 115BB / 115BBJ cannot be filed in ITR-4.');
    }
  } else if (normSelected === 'itr-2') {
    // --- AUDIT ITR-2 ---
    if (status !== 'Individual' && status !== 'HUF') {
      eligible = false;
      reasons.push(`ITR-2 is restricted to Individuals and HUFs. Status '${status}' is not eligible.`);
    }
    if (hasBusiness) {
      eligible = false;
      reasons.push('Income from Business or Profession (PGBP) cannot be filed in ITR-2. Form ITR-3 or ITR-4 is required.');
    }
  } else if (normSelected === 'itr-3') {
    // --- AUDIT ITR-3 ---
    if (status !== 'Individual' && status !== 'HUF') {
      eligible = false;
      reasons.push(`ITR-3 is restricted to Individuals and HUFs. Status '${status}' is not eligible.`);
    }
    if (!hasBusiness) {
      warnings.push('ITR-3 is selected but no Business or Professional (PGBP) income is declared. If no business income exists, evaluate ITR-1 or ITR-2 for simplified compliance.');
    }
  }

  // Check for Missing / Information Required scenarios (YELLOW)
  if (isTurnoverMissing) {
    warnings.push('Turnover is missing while net profit is declared. Turnover is required to verify 44AD/44ADA statutory limits.');
    requiredAction.push('Enter gross turnover/receipts in Business Details to confirm Section 44AD/44ADA threshold eligibility.');
  }

  if (isResidencyMissing) {
    warnings.push('Residential status is unconfirmed. Resident status is mandatory for ITR-1 and ITR-4.');
    requiredAction.push('Specify whether assessee is Resident, Non-Resident, or RNOR in Assessee Profile.');
  }

  if (!isPanValid) {
    warnings.push(panStatus.message);
    requiredAction.push('Provide a valid 10-digit PAN in the format AAAAA9999A.');
  }

  // Determine Overall Status Severity
  if (!eligible) {
    statusSeverity = 'RED';
    requiredAction.push(`Switch ITR Form to recommended form '${recommendedITR}' or provide statutory override justification.`);
  } else if (isTurnoverMissing || isResidencyMissing || !isPanValid || warnings.length > 0) {
    statusSeverity = 'YELLOW';
  } else {
    statusSeverity = 'GREEN';
  }

  // Generate audit timestamp
  const auditTimestamp = new Date().toISOString();

  // User Override handling
  const userOverride = computation.userOverrideITR ? {
    overridden: true,
    reason: computation.userOverrideReason || 'Practitioner professional judgment override',
  } : (client.userOverrideITR ? {
    overridden: true,
    reason: client.userOverrideReason || 'Practitioner professional judgment override',
  } : undefined);

  return {
    eligible,
    selectedITR,
    recommendedITR,
    status: statusSeverity,
    reasons,
    warnings,
    requiredAction,
    rulesEvaluated,
    auditTimestamp,
    userOverride,
    fieldChecks: {
      panStatus,
      residentialStatus: residentialCheck,
      incomeLimit: incomeLimitCheck,
      businessIncome: businessIncomeCheck,
      turnoverCheck,
      capitalGains: capitalGainsCheck,
      foreignAssets: foreignAssetsCheck,
      agriculturalIncome: agriculturalIncomeCheck,
      directorshipOrUnlisted: directorshipOrUnlistedCheck,
      broughtForwardLosses: broughtForwardLossesCheck,
      specialRateIncome: specialRateIncomeCheck,
    },
  };
}
