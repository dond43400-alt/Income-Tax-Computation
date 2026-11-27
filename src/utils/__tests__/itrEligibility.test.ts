import { checkITREligibility } from '../itrEligibilityEngine';
import { TaxComputation } from '../../types';

// Helper to generate a baseline computation structure
function createMockComputation(overrides: Partial<TaxComputation> = {}): TaxComputation {
  const base: TaxComputation = {
    id: 'comp_test_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assessmentYear: '2026-27',
    financialYear: '2025-26',
    itrForm: 'ITR-1 (Sahaj)',
    filingSection: '139(1) - On or before due date',
    regimeOpted: 'new',
    client: {
      pan: 'ABCDE1234F',
      name: 'Ramesh Kumar',
      status: 'Individual',
      residentialStatus: 'Resident',
    },
    salary: {
      grossSalary: 600000,
      standardDeduction: 75000,
      allowancesExempt: 0,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 525000,
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
      turnoverOrGrossReceipts: 0,
      presumptiveSection: '44AD (8%/6%/Other)',
      netProfit: 0,
    },
    capitalGains: {
      netCapitalGains: 0,
    },
    otherSources: {
      savingsInterest: 5000,
      fdInterest: 0,
      dividendIncome: 0,
      otherIncome: 0,
      familyPension: 0,
      netOtherSources: 5000,
    },
    grossTotalIncome: 530000,
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
    totalTaxableIncome: 530000,
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

  return {
    ...base,
    ...overrides,
    client: { ...base.client, ...(overrides.client || {}) },
    salary: { ...base.salary, ...(overrides.salary || {}) },
    houseProperty: { ...base.houseProperty, ...(overrides.houseProperty || {}) },
    business: { ...base.business, ...(overrides.business || {}) },
    capitalGains: { ...base.capitalGains, ...(overrides.capitalGains || {}) },
    otherSources: { ...base.otherSources, ...(overrides.otherSources || {}) },
    deductions: { ...base.deductions, ...(overrides.deductions || {}) },
    taxesPaid: { ...base.taxesPaid, ...(overrides.taxesPaid || {}) },
  };
}

export function runAllITREligibilityTests(): { passed: number; failed: number; results: Array<{ test: string; status: 'PASS' | 'FAIL'; message: string }> } {
  const testResults: Array<{ test: string; status: 'PASS' | 'FAIL'; message: string }> = [];

  // --------------------------------------------------------------------------
  // TEST 1: Salary only, below applicable limit -> ITR-1
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      salary: { grossSalary: 800000, netSalary: 725000, allowancesExempt: 0, standardDeduction: 75000, entertainmentAllowance: 0, professionalTax: 0 },
      grossTotalIncome: 725000,
    });
    const res = checkITREligibility(comp);
    const pass = res.eligible && res.recommendedITR === 'ITR-1 (Sahaj)' && res.status === 'GREEN';
    testResults.push({
      test: 'TEST 1: Salary only, below applicable limit -> ITR-1',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}, Status: ${res.status}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 2: Salary + permitted income (savings/FD) -> ITR-1 where eligible
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      salary: { grossSalary: 900000, netSalary: 825000, allowancesExempt: 0, standardDeduction: 75000, entertainmentAllowance: 0, professionalTax: 0 },
      otherSources: { savingsInterest: 12000, fdInterest: 35000, dividendIncome: 4000, otherIncome: 0, familyPension: 0, netOtherSources: 51000 },
      grossTotalIncome: 876000,
    });
    const res = checkITREligibility(comp);
    const pass = res.eligible && res.recommendedITR === 'ITR-1 (Sahaj)' && res.status === 'GREEN';
    testResults.push({
      test: 'TEST 2: Salary + permitted income -> ITR-1 where eligible',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 3: Salary + prohibited capital gain -> ITR-2
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      salary: { grossSalary: 800000, netSalary: 725000, allowancesExempt: 0, standardDeduction: 75000, entertainmentAllowance: 0, professionalTax: 0 },
      capitalGains: { stcg111A: 50000, netCapitalGains: 50000 },
      grossTotalIncome: 775000,
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'RED';
    testResults.push({
      test: 'TEST 3: Salary + prohibited capital gain -> ITR-2 (ITR-1 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}, Status: ${res.status}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 4: Salary + capital gains + no business -> ITR-2
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-2',
      salary: { grossSalary: 1200000, netSalary: 1125000, allowancesExempt: 0, standardDeduction: 75000, entertainmentAllowance: 0, professionalTax: 0 },
      capitalGains: { ltcg112A: 150000, stcg111A: 80000, netCapitalGains: 230000 },
      grossTotalIncome: 1355000,
    });
    const res = checkITREligibility(comp);
    const pass = res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'GREEN';
    testResults.push({
      test: 'TEST 4: Salary + capital gains + no business -> ITR-2',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 5: Business under 44AD and eligible -> ITR-4
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      salary: { grossSalary: 0, netSalary: 0, allowancesExempt: 0, standardDeduction: 0, entertainmentAllowance: 0, professionalTax: 0 },
      business: {
        natureOfBusiness: 'Retail Kiryana Store',
        businessCode: '09005',
        turnoverOrGrossReceipts: 825000,
        turnoverDigital6: 500000,
        turnoverCash8: 325000,
        presumptiveSection: '44AD (8%/6%/Other)',
        netProfit: 56000,
      },
      grossTotalIncome: 56000 + 5000,
    });
    const res = checkITREligibility(comp);
    const pass = res.eligible && res.recommendedITR === 'ITR-4 (Sugam)' && res.status === 'GREEN';
    testResults.push({
      test: 'TEST 5: Business under 44AD and eligible -> ITR-4',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 6: Business but 44AD eligibility fails (turnover > 3Cr) -> ITR-3
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      business: {
        natureOfBusiness: 'Wholesale Commodity Trading',
        businessCode: '06001',
        turnoverOrGrossReceipts: 35000000, // 3.5 Crore (exceeds 3 Cr)
        turnoverDigital6: 34000000,
        turnoverCash8: 1000000,
        presumptiveSection: '44AD (8%/6%/Other)',
        netProfit: 2100000,
      },
      grossTotalIncome: 2100000,
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-3' && res.status === 'RED';
    testResults.push({
      test: 'TEST 6: Business but 44AD eligibility fails (turnover > 3Cr) -> ITR-3',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}, Status: ${res.status}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 7: Eligible profession under 44ADA -> ITR-4
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      business: {
        natureOfBusiness: 'Legal & Tax Consultancy',
        businessCode: '14001',
        turnoverOrGrossReceipts: 3800000, // 38 Lakhs (under 75L/50L)
        turnoverDigital6: 3800000,
        turnoverCash8: 0,
        presumptiveSection: '44ADA (50%)',
        netProfit: 1900000,
      },
      grossTotalIncome: 1900000,
    });
    const res = checkITREligibility(comp);
    const pass = res.eligible && res.recommendedITR === 'ITR-4 (Sugam)' && res.status === 'GREEN';
    testResults.push({
      test: 'TEST 7: Eligible profession under 44ADA -> ITR-4',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 8: Profession but 44ADA eligibility fails (gross receipts > 75L) -> ITR-3
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      business: {
        natureOfBusiness: 'Software Architecture Consulting',
        businessCode: '14005',
        turnoverOrGrossReceipts: 9000000, // 90 Lakhs (exceeds 75L)
        turnoverDigital6: 9000000,
        turnoverCash8: 0,
        presumptiveSection: '44ADA (50%)',
        netProfit: 4500000,
      },
      grossTotalIncome: 4500000,
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-3' && res.status === 'RED';
    testResults.push({
      test: 'TEST 8: Profession but 44ADA eligibility fails (gross receipts > 75L) -> ITR-3',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 9: Foreign asset -> appropriate ITR-2/ITR-3
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      client: {
        pan: 'ABCDE1234F',
        name: 'Amitabh Sharma',
        status: 'Individual',
        residentialStatus: 'Resident',
        hasForeignAssets: true,
        foreignAssetsDetails: { hasBankAccounts: true, foreignIncomeAmount: 150000 },
      },
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'RED';
    testResults.push({
      test: 'TEST 9: Foreign asset -> ITR-2 (ITR-1 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}, Reasons: ${res.reasons.length}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 10: Business + capital gains -> evaluate ITR-3/ITR-4 (ITR-3 required)
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      business: {
        natureOfBusiness: 'Cloth Boutique',
        businessCode: '21008',
        turnoverOrGrossReceipts: 1200000,
        turnoverDigital6: 800000,
        turnoverCash8: 400000,
        presumptiveSection: '44AD (8%/6%/Other)',
        netProfit: 80000,
      },
      capitalGains: {
        ltcg112A: 60000,
        netCapitalGains: 60000,
      },
      grossTotalIncome: 140000,
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-3' && res.status === 'RED';
    testResults.push({
      test: 'TEST 10: Business + capital gains -> ITR-3 (ITR-4 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 11: Brought-forward loss -> correct form validation (ITR-2/ITR-3)
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      client: {
        pan: 'ABCDE1234F',
        name: 'Gurpreet Singh',
        status: 'Individual',
        residentialStatus: 'Resident',
        hasBroughtForwardLosses: true,
        broughtForwardLossDetails: { hpLoss: 45000 },
      },
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'RED';
    testResults.push({
      test: 'TEST 11: Brought-forward loss -> ITR-2 (ITR-1 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 12: Agricultural income (> 5000) -> correct form eligibility (ITR-2)
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      agriculturalIncome: 250000, // 2.5 Lakhs (exceeds 5k limit)
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'RED';
    testResults.push({
      test: 'TEST 12: Agricultural income (> 5000) -> ITR-2 (ITR-1 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 13: Missing turnover -> YELLOW / Manual Verification Required
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-4 (Sugam)',
      business: {
        natureOfBusiness: 'Repair Center',
        businessCode: '19001',
        turnoverOrGrossReceipts: 0, // Missing turnover
        turnoverDigital6: 0,
        turnoverCash8: 0,
        presumptiveSection: '44AD (8%/6%/Other)',
        netProfit: 120000, // Net profit declared but turnover missing
      },
    });
    const res = checkITREligibility(comp);
    const pass = res.status === 'YELLOW' && res.warnings.some(w => w.toLowerCase().includes('turnover'));
    testResults.push({
      test: 'TEST 13: Missing turnover -> YELLOW / Manual Verification Required',
      status: pass ? 'PASS' : 'FAIL',
      message: `Status: ${res.status}, Warnings: ${res.warnings.join('; ')}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 14: Missing residential status -> YELLOW
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      client: {
        pan: 'ABCDE1234F',
        name: 'Sunita Devi',
        status: 'Individual',
        residentialStatus: undefined as any, // Missing residency
      },
    });
    const res = checkITREligibility(comp);
    const pass = res.status === 'YELLOW' && res.warnings.some(w => w.toLowerCase().includes('residential'));
    testResults.push({
      test: 'TEST 14: Missing residential status -> YELLOW',
      status: pass ? 'PASS' : 'FAIL',
      message: `Status: ${res.status}, Warnings: ${res.warnings.join('; ')}`,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 15: Unlisted shares / directorship -> apply current restrictions (ITR-2/ITR-3)
  // --------------------------------------------------------------------------
  {
    const comp = createMockComputation({
      itrForm: 'ITR-1 (Sahaj)',
      client: {
        pan: 'ABCDE1234F',
        name: 'Vikramaditya Rao',
        status: 'Individual',
        residentialStatus: 'Resident',
        isDirector: true,
        hasUnlistedShares: true,
      },
    });
    const res = checkITREligibility(comp);
    const pass = !res.eligible && res.recommendedITR === 'ITR-2' && res.status === 'RED';
    testResults.push({
      test: 'TEST 15: Unlisted shares / directorship -> ITR-2 (ITR-1 RED)',
      status: pass ? 'PASS' : 'FAIL',
      message: `Recommended: ${res.recommendedITR}, Eligible: ${res.eligible}`,
    });
  }

  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;

  return { passed, failed, results: testResults };
}

// Auto-run if executed directly via tsx
const eligibilityResults = runAllITREligibilityTests();
console.log('====================================================');
console.log(`ITR ELIGIBILITY AUDIT TESTS: ${eligibilityResults.passed}/${eligibilityResults.results.length} PASSED`);
console.log('====================================================');
eligibilityResults.results.forEach((t, i) => {
  console.log(`Test #${i + 1}: [${t.status}] ${t.test}`);
  if (t.status !== 'PASS') {
    console.error(`   Details: ${t.message}`);
  }
});
if (eligibilityResults.failed > 0) {
  process.exit(1);
}


