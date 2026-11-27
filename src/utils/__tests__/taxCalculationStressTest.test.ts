import { 
  computeComprehensiveTax, 
  recalculateFullComputation, 
  createEmptyComputation, 
  getTaxSlabs,
  calculateNormalSlabTax,
  calculateSurcharge,
  calculateHealthEducationCess,
  roundToNearestTen
} from '../taxCalculator';
import { calculateRegularBooksPL } from '../businessCalculationEngine';
import { TaxComputation, TaxRegime } from '../../types';

export interface StressTestResult {
  testId: string;
  testName: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runAllTaxCalculationStressTests(): {
  total: number;
  passed: number;
  failed: number;
  results: StressTestResult[];
} {
  const results: StressTestResult[] = [];

  // ==========================================================================
  // TEST A: AY 2026-27 NEW REGIME (Salary ₹12,00,000 -> Taxable ₹11,25,000 -> Nil Tax)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 1200000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 1125000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Slabs: 0-4L (0%), 4-8L (5% = 20k), 8-11.25L (10% = 32.5k) -> Total = 52,500
    // Taxable income <= 12,00,000 -> 87A rebate = 52,500 -> Tax after rebate = 0, Cess = 0
    const pass = 
      calculated.salary.netSalary === 1125000 &&
      calculated.totalTaxableIncome === 1125000 &&
      calculated.taxOnNormalIncome === 52500 &&
      calculated.rebate87A === 52500 &&
      calculated.taxAfterRebate === 0 &&
      calculated.healthAndEducationCess === 0 &&
      calculated.grossTaxLiability === 0;

    results.push({
      testId: 'TEST_A',
      testName: 'AY 2026-27 New Regime (Salary ₹12L -> Taxable ₹11.25L -> 87A Rebate -> ₹0 Tax)',
      category: 'New Regime Slabs & 87A',
      passed: pass,
      expected: 'Taxable Income: ₹11,25,000, Tax Before Rebate: ₹52,500, 87A Rebate: ₹52,500, Final Tax: ₹0',
      actual: `Taxable Income: ₹${calculated.totalTaxableIncome.toLocaleString('en-IN')}, Tax Before Rebate: ₹${calculated.taxOnNormalIncome.toLocaleString('en-IN')}, 87A Rebate: ₹${calculated.rebate87A.toLocaleString('en-IN')}, Final Tax: ₹${calculated.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST B: AY 2026-27 NEW REGIME (Salary ₹13,00,000 -> Taxable ₹12,25,000 -> Marginal Relief 87A)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 1300000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 1225000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Slabs: 0-4L (0), 4-8L (20k), 8-12L (40k), 12-12.25L (15% on 25k = 3,750) -> Raw Tax = 63,750
    // Excess over ₹12,00,000 = ₹25,000. Marginal relief: Tax cannot exceed ₹25,000.
    // Rebate/Relief = 63,750 - 25,000 = ₹38,750.
    // Tax after rebate = ₹25,000. Cess @ 4% = ₹1,000. Final Tax = ₹26,000.
    const pass = 
      calculated.totalTaxableIncome === 1225000 &&
      calculated.taxOnNormalIncome === 63750 &&
      calculated.rebate87A === 38750 &&
      calculated.taxAfterRebate === 25000 &&
      calculated.healthAndEducationCess === 1000 &&
      calculated.grossTaxLiability === 26000;

    results.push({
      testId: 'TEST_B',
      testName: 'AY 2026-27 New Regime Marginal Relief (Salary ₹13L -> Taxable ₹12.25L -> Final Tax ₹26,000)',
      category: '87A Marginal Relief',
      passed: pass,
      expected: 'Raw Tax: ₹63,750, Marginal Relief Rebate: ₹38,750, Tax After Rebate: ₹25,000, Cess: ₹1,000, Final Tax: ₹26,000',
      actual: `Raw Tax: ₹${calculated.taxOnNormalIncome.toLocaleString('en-IN')}, Marginal Relief: ₹${calculated.rebate87A.toLocaleString('en-IN')}, Tax After Rebate: ₹${calculated.taxAfterRebate.toLocaleString('en-IN')}, Cess: ₹${calculated.healthAndEducationCess.toLocaleString('en-IN')}, Final Tax: ₹${calculated.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST C: AY 2026-27 BUSINESS 44AD (Turnover ₹10,00,000, 100% Digital -> 6% Profit = ₹60,000)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.business = {
      businessName: 'Apex Digital Services',
      natureOfBusiness: 'Digital Trade',
      presumptiveSection: '44AD (8%/6%/Other)',
      turnoverDigital6: 1000000,
      profitDigital6: 0, // Auto compute 6%
      turnoverCash8: 0,
      profitCash8: 0,
      turnoverOtherMode: 0,
      profitOtherMode: 0,
      turnoverOrGrossReceipts: 1000000,
      netProfit: 0,
    };

    const calculated = recalculateFullComputation(comp);
    const pass = 
      calculated.business.turnoverOrGrossReceipts === 1000000 &&
      calculated.business.profitDigital6 === 60000 &&
      calculated.business.netProfit === 60000 &&
      calculated.grossTotalIncome === 60000;

    results.push({
      testId: 'TEST_C',
      testName: 'AY 2026-27 Business 44AD (₹10L Digital Turnover -> 6% Presumptive Profit = ₹60,000)',
      category: 'Presumptive Business 44AD',
      passed: pass,
      expected: 'Turnover: ₹10,00,000, Digital Presumptive Rate: 6%, Presumptive Profit: ₹60,000, PGBP Head: ₹60,000',
      actual: `Turnover: ₹${calculated.business.turnoverOrGrossReceipts?.toLocaleString('en-IN')}, Profit: ₹${calculated.business.netProfit.toLocaleString('en-IN')}, PGBP Head: ₹${calculated.grossTotalIncome.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST D: REGULAR BUSINESS (Sales ₹20L, Op ₹2L, Purchases ₹10L, Cl ₹3L, Direct ₹1L, Indirect ₹2L)
  // ==========================================================================
  {
    const plResult = calculateRegularBooksPL({
      grossSales: 2000000,
      openingStock: 200000,
      purchases: 1000000,
      directLabour: 100000,
      freightAndCarriage: 0,
      closingStock: 300000,
      expenses: [
        { id: 'exp_1', category: 'Rent', amount: 200000 }
      ]

    });


    // COGS = 2,00,000 + 10,00,000 + 1,00,000 - 3,00,000 = 10,00,000
    // Gross Profit = 20,00,000 - 10,00,000 = 10,00,000
    // Net Profit = 10,00,000 - 2,00,000 = 8,00,000
    const pass = 
      plResult.costOfGoodsSold === 1000000 &&
      plResult.grossProfit === 1000000 &&
      plResult.netProfitOrLoss === 800000;

    results.push({
      testId: 'TEST_D',
      testName: 'Regular Books P&L (Sales ₹20L, COGS ₹10L, GP ₹10L, Net Profit ₹8L)',
      category: 'Regular Books P&L',
      passed: pass,
      expected: 'COGS: ₹10,00,000, Gross Profit: ₹10,00,000, Net Profit: ₹8,00,000',
      actual: `COGS: ₹${plResult.costOfGoodsSold.toLocaleString('en-IN')}, Gross Profit: ₹${plResult.grossProfit.toLocaleString('en-IN')}, Net Profit: ₹${plResult.netProfitOrLoss.toLocaleString('en-IN')}`,
    });

  }

  // ==========================================================================
  // TEST E: SALARY + BUSINESS (Salary ₹8,00,000 + 44AD Profit ₹2,00,000)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 800000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 725000,
    };
    comp.business = {
      businessName: 'M/s Retail Hub',
      natureOfBusiness: 'Retail',
      presumptiveSection: '44AD (8%/6%/Other)',
      turnoverDigital6: 0,
      profitDigital6: 0,
      turnoverCash8: 2500000,
      profitCash8: 200000,
      turnoverOtherMode: 0,
      profitOtherMode: 0,
      turnoverOrGrossReceipts: 2500000,
      netProfit: 200000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Net Salary = 8,00,000 - 75,000 = 7,25,000
    // Net Business = 2,00,000
    // Total Income = 7,25,000 + 2,00,000 = 9,25,000
    const pass = 
      calculated.salary.netSalary === 725000 &&
      calculated.business.netProfit === 200000 &&
      calculated.grossTotalIncome === 925000 &&
      calculated.totalTaxableIncome === 925000;

    results.push({
      testId: 'TEST_E',
      testName: 'Salary + Business Aggregation (Net Salary ₹7.25L + PGBP ₹2L = Total Income ₹9.25L)',
      category: 'Inter-Head Aggregation',
      passed: pass,
      expected: 'Net Salary: ₹7,25,000, PGBP: ₹2,00,000, Total Income: ₹9,25,000',
      actual: `Net Salary: ₹${calculated.salary.netSalary.toLocaleString('en-IN')}, PGBP: ₹${calculated.business.netProfit.toLocaleString('en-IN')}, Total Income: ₹${calculated.totalTaxableIncome.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST F: SALARY + 111A STCG (Salary ₹10,00,000 + Section 111A STCG ₹1,00,000)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 1000000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 925000,
    };
    comp.capitalGains = {
      stcg111A: 100000,
      stcgNormal: 0,
      ltcg112A: 0,
      ltcg112: 0,
      netCapitalGains: 100000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Normal taxable income = ₹9,25,000
    // Tax on normal income: 0-4L (0), 4-8L (20k), 8-9.25L (10% on 1.25L = 12.5k) = ₹32,500
    // Special Tax on 111A STCG (20% in AY 2026-27 on ₹1,00,000) = ₹20,000
    // Total Tax before rebate = 32,500 + 20,000 = ₹52,500
    // Total income = ₹10,25,000 (<= ₹12,00,000) -> 87A rebate = ₹52,500 -> Final Tax = ₹0
    const pass = 
      calculated.salary.netSalary === 925000 &&
      calculated.capitalGains.stcg111A === 100000 &&
      calculated.taxOnNormalIncome === 32500 &&
      calculated.taxOnSpecialIncome === 20000 &&
      calculated.totalTaxBeforeRebate === 52500;

    results.push({
      testId: 'TEST_F',
      testName: 'Salary + 111A STCG (Normal Tax ₹32,500 + 111A Special Tax ₹20,000 kept separate)',
      category: 'Special Rate Incomes',
      passed: pass,
      expected: 'Normal Tax: ₹32,500, 111A Tax: ₹20,000, Total Tax Before Rebate: ₹52,500',
      actual: `Normal Tax: ₹${calculated.taxOnNormalIncome.toLocaleString('en-IN')}, 111A Tax: ₹${calculated.taxOnSpecialIncome.toLocaleString('en-IN')}, Total: ₹${calculated.totalTaxBeforeRebate.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST G: SALARY + 112A LTCG (Salary ₹10,00,000 + 112A LTCG ₹2,00,000)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 1000000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 925000,
    };
    comp.capitalGains = {
      stcg111A: 0,
      stcgNormal: 0,
      ltcg112A: 200000,
      ltcg112: 0,
      netCapitalGains: 200000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // In AY 2026-27, Section 112A exemption threshold is ₹1,25,000 (Finance Act / Budget 2024)
    // Taxable 112A = 2,00,000 - 1,25,000 = ₹75,000 @ 12.5% = ₹9,375
    // Normal tax on 9,25,000 = ₹32,500
    // Total tax before rebate = 32,500 + 9,375 = ₹41,875
    const pass = 
      calculated.taxOnNormalIncome === 32500 &&
      calculated.taxOnSpecialIncome === 9375 &&
      calculated.totalTaxBeforeRebate === 41875;

    results.push({
      testId: 'TEST_G',
      testName: 'Salary + 112A LTCG (Exemption ₹1.25L, Taxable ₹75,000 @ 12.5% = ₹9,375)',
      category: 'Capital Gains 112A',
      passed: pass,
      expected: '112A Taxable: ₹75,000, 112A Special Tax: ₹9,375, Normal Tax: ₹32,500',
      actual: `Normal Tax: ₹${calculated.taxOnNormalIncome.toLocaleString('en-IN')}, 112A Tax: ₹${calculated.taxOnSpecialIncome.toLocaleString('en-IN')}, Total: ₹${calculated.totalTaxBeforeRebate.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST H: LOTTERY WINNINGS u/s 115BB (₹1,00,000 flat 30%, no slab, no std deduction)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.otherSources = {
      savingsInterest: 0,
      fdInterest: 0,
      dividendIncome: 0,
      otherIncome: 0,
      familyPension: 0,
      lotteryWinnings: 100000,
      netOtherSources: 100000,
    };
    comp.deductions = {
      sec80C: 150000, // Should NOT be allowed against lottery
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
    };

    const calculated = recalculateFullComputation(comp);
    
    // Flat 30% on ₹1,00,000 = ₹30,000
    // No standard deduction, no Chapter VI-A deduction against 115BB
    // Cess @ 4% = ₹1,200 -> Total Tax = ₹31,200
    const pass = 
      calculated.taxOnNormalIncome === 0 &&
      calculated.taxOnSpecialIncome === 30000 &&
      calculated.healthAndEducationCess === 1200 &&
      calculated.grossTaxLiability === 31200;

    results.push({
      testId: 'TEST_H',
      testName: 'Section 115BB Lottery Winnings (Flat 30% = ₹30,000 + 4% Cess = ₹31,200, No Deductions)',
      category: 'Section 115BB Special Tax',
      passed: pass,
      expected: 'Normal Tax: ₹0, Special Tax 115BB: ₹30,000, Cess: ₹1,200, Final Tax: ₹31,200',
      actual: `Special Tax: ₹${calculated.taxOnSpecialIncome.toLocaleString('en-IN')}, Cess: ₹${calculated.healthAndEducationCess.toLocaleString('en-IN')}, Final Tax: ₹${calculated.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST I: SECTION 115BBE UNEXPLAINED INCOME (₹1,00,000 -> 60% + 25% Surch + 4% Cess = 78%)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.otherSources = {
      savingsInterest: 0,
      fdInterest: 0,
      dividendIncome: 0,
      otherIncome: 0,
      familyPension: 0,
      unexplainedIncome115BBE: 100000,
      netOtherSources: 100000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Base Tax @ 60% = ₹60,000
    // Mandatory Surcharge @ 25% on Base Tax = ₹15,000
    // Cess @ 4% on (60,000 + 15,000) = ₹3,000
    // Total Tax Liability = ₹78,000 (Effective 78%)
    // Rebate 87A MUST NOT apply to 115BBE
    const pass = 
      calculated.taxOnSpecialIncome === 60000 &&
      calculated.rebate87A === 0 &&
      calculated.surcharge === 15000 &&
      calculated.healthAndEducationCess === 3000 &&
      calculated.grossTaxLiability === 78000;

    results.push({
      testId: 'TEST_I',
      testName: 'Section 115BBE Unexplained Income (60% Tax ₹60k + 25% Surcharge ₹15k + 4% Cess ₹3k = ₹78k)',
      category: 'Section 115BBE Special Tax',
      passed: pass,
      expected: 'Base Tax: ₹60,000, Surcharge: ₹15,000, Cess: ₹3,000, Final Tax: ₹78,000 (No 87A Rebate)',
      actual: `Base Tax: ₹${calculated.taxOnSpecialIncome.toLocaleString('en-IN')}, Surcharge: ₹${calculated.surcharge.toLocaleString('en-IN')}, Cess: ₹${calculated.healthAndEducationCess.toLocaleString('en-IN')}, Final Tax: ₹${calculated.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST J: BUSINESS LOSS SET-OFF RESTRICTION (Salary ₹8,00,000 + Business Loss ₹2,00,000)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 800000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 725000,
    };
    comp.business = {
      businessName: 'Loss Making Enterprise',
      natureOfBusiness: 'Manufacturing',
      presumptiveSection: 'Normal Books of Accounts (Schedule P&L)',
      turnoverDigital6: 0,
      profitDigital6: 0,
      turnoverCash8: 0,
      profitCash8: 0,
      turnoverOtherMode: 0,
      profitOtherMode: 0,
      turnoverOrGrossReceipts: 1000000,
      netProfit: -200000, // ₹2,00,000 loss
      regularBooks: {
        grossSales: 1000000,
        openingStock: 0,
        purchases: 800000,
        directLabour: 100000,
        freightAndCarriage: 0,
        closingStock: 0,
        expenses: [
          { id: 'exp_1', category: 'Rent', amount: 300000 }
        ]

      }
    };

    const calculated = recalculateFullComputation(comp);
    
    // Under Section 71(2A), business loss CANNOT be set off against Salary income.
    // Gross Total Income remains ₹7,25,000 (Salary untouched).
    // Business loss ₹2,00,000 must be carried forward.
    const pass = 
      calculated.salary.netSalary === 725000 &&
      calculated.grossTotalIncome === 725000 &&
      calculated.totalTaxableIncome === 725000;

    results.push({
      testId: 'TEST_J',
      testName: 'Section 71(2A) Business Loss Prohibition (Business Loss ₹2L cannot reduce Salary ₹7.25L)',
      category: 'Loss Set-Off Rules',
      passed: pass,
      expected: 'Net Salary: ₹7,25,000, Allowed Set-off against Salary: ₹0, Gross Total Income: ₹7,25,000',
      actual: `Net Salary: ₹${calculated.salary.netSalary.toLocaleString('en-IN')}, Gross Total Income: ₹${calculated.grossTotalIncome.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST K: SHORT TERM CAPITAL LOSS SET-OFF (STCL ₹1L, STCG ₹50k, LTCG ₹50k)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.capitalGains = {
      stcgNormal: 50000,
      ltcg112: 50000,
      currentYearSTCL: 100000,
      currentYearLTCL: 0,
      netCapitalGains: 0,
    };

    const calculated = recalculateFullComputation(comp);
    
    // STCL ₹1,00,000 sets off against STCG ₹50,000 first, then remaining ₹50,000 sets off against LTCG ₹50,000.
    // Net Capital Gains = ₹0. Carried forward STCL = ₹0.
    const pass = 
      calculated.capitalGains.netCapitalGains === 0 &&
      calculated.capitalGains.carriedForwardSTCL === 0 &&
      calculated.capitalGains.stclSetOff === 100000;

    results.push({
      testId: 'TEST_K',
      testName: 'STCL Set-Off (STCL ₹1L sets off against STCG ₹50k & LTCG ₹50k -> Net CG ₹0, CF ₹0)',
      category: 'Capital Loss Set-Off',
      passed: pass,
      expected: 'Set-off against STCG: ₹50,000, Set-off against LTCG: ₹50,000, Remaining Loss: ₹0',
      actual: `STCL Total Set-off: ₹${calculated.capitalGains.stclSetOff?.toLocaleString('en-IN')}, Net CG: ₹${calculated.capitalGains.netCapitalGains.toLocaleString('en-IN')}, Carried Forward: ₹${calculated.capitalGains.carriedForwardSTCL?.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST L: LONG TERM CAPITAL LOSS RESTRICTION (LTCL ₹1L, STCG ₹1.5L, LTCG ₹50k)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.capitalGains = {
      stcgNormal: 150000,
      ltcg112: 50000,
      currentYearSTCL: 0,
      currentYearLTCL: 100000,
      netCapitalGains: 0,
    };


    const calculated = recalculateFullComputation(comp);
    
    // LTCL can ONLY set off against LTCG (never against STCG).
    // LTCL ₹1,00,000 sets off ₹50,000 against LTCG. Remaining ₹50,000 LTCL is CARRIED FORWARD.
    // STCG remains ₹1,50,000 untouched. Net Capital Gains = ₹1,50,000.
    const pass = 
      calculated.capitalGains.netCapitalGains === 150000 &&
      calculated.capitalGains.ltclSetOff === 50000 &&
      calculated.capitalGains.carriedForwardLTCL === 50000;

    results.push({
      testId: 'TEST_L',
      testName: 'LTCL Set-Off Restriction (LTCL ₹1L sets off ONLY against LTCG ₹50k, STCG ₹1.5L Untouched)',
      category: 'Capital Loss Set-Off',
      passed: pass,
      expected: 'Set-off against LTCG: ₹50,000, Set-off against STCG: ₹0 (Disallowed), Carried Forward LTCL: ₹50,000',
      actual: `LTCL Set-off: ₹${calculated.capitalGains.ltclSetOff?.toLocaleString('en-IN')}, Net CG: ₹${calculated.capitalGains.netCapitalGains.toLocaleString('en-IN')}, Carried Forward LTCL: ₹${calculated.capitalGains.carriedForwardLTCL?.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST M: TAX CREDITS & PAYABLE/REFUND (TDS ₹50k, TCS ₹5k, Adv ₹10k, SA ₹5k)
  // ==========================================================================
  {
    const comp = createEmptyComputation('2026-27');
    comp.regimeOpted = 'new';
    comp.salary = {
      grossSalary: 1500000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: 1425000,
    };
    comp.taxesPaid = {
      tdsSalary: 50000,
      tdsOther: 0,
      tcs: 5000,
      advanceTax: 10000,
      selfAssessmentTax: 5000,
      totalTaxesPaid: 70000,
    };

    const calculated = recalculateFullComputation(comp);
    
    // Total Taxes Paid = 50,000 + 5,000 + 10,000 + 5,000 = ₹70,000
    // Tax on 14,25,000: Slabs: 0-4L (0), 4-8L (20k), 8-12L (40k), 12-14.25L (15% on 2.25L = 33,750) -> Base Tax = 93,750
    // Cess @ 4% = 3,750 -> Total Tax Liability = ₹97,500
    // Net Tax Payable = 97,500 - 70,000 = ₹27,500. Refund Due = ₹0.
    const pass = 
      calculated.taxesPaid.totalTaxesPaid === 70000 &&
      calculated.grossTaxLiability === 97500 &&
      calculated.netTaxPayable === 27500 &&
      calculated.refundDue === 0;

    results.push({
      testId: 'TEST_M',
      testName: 'Tax Credits Reconciliation (Liability ₹97,500 - Taxes Paid ₹70,000 = Net Payable ₹27,500)',
      category: 'Tax Payments & Credits',
      passed: pass,
      expected: 'Total Taxes Paid: ₹70,000, Gross Tax: ₹97,500, Net Tax Payable: ₹27,500, Refund: ₹0',
      actual: `Total Taxes Paid: ₹${calculated.taxesPaid.totalTaxesPaid.toLocaleString('en-IN')}, Gross Tax: ₹${calculated.grossTaxLiability.toLocaleString('en-IN')}, Net Tax Payable: ₹${calculated.netTaxPayable.toLocaleString('en-IN')}, Refund: ₹${calculated.refundDue.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // TEST N: STATUTORY ROUNDING (u/s 288A & u/s 288B)
  // ==========================================================================
  {
    const roundedIncome = roundToNearestTen(1234567.45); // Should round to 12,34,570
    const roundedTax = roundToNearestTen(45674.20);       // Should round to 45,670
    const roundedPayable = roundToNearestTen(125.60);     // Should round to 130

    const pass = roundedIncome === 1234570 && roundedTax === 45670 && roundedPayable === 130;

    results.push({
      testId: 'TEST_N',
      testName: 'Statutory Rounding u/s 288A & 288B (Nearest multiple of ₹10)',
      category: 'Statutory Rounding',
      passed: pass,
      expected: 'Income: ₹12,34,570, Tax: ₹45,670, Payable: ₹130',
      actual: `Income: ₹${roundedIncome.toLocaleString('en-IN')}, Tax: ₹${roundedTax.toLocaleString('en-IN')}, Payable: ₹${roundedPayable.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // REGIME COMPARISON: TEST A, B, E (Independent Calculation Paths)
  // ==========================================================================
  {
    // Test A under Old Regime: Salary ₹12,00,000 -> Std Ded ₹50,000 -> Taxable ₹11,50,000
    // Slabs Old: 0-2.5L (0), 2.5-5L (12.5k), 5-10L (100k), >10L (30% on 1.5L = 45k) -> Tax = 1,57,500 + 4% = ₹1,63,800
    const compOldA = createEmptyComputation('2026-27');
    compOldA.regimeOpted = 'old';
    compOldA.salary = { grossSalary: 1200000, allowancesExempt: 0, standardDeduction: 50000, entertainmentAllowance: 0, professionalTax: 0, netSalary: 1150000 };
    const calcOldA = recalculateFullComputation(compOldA);

    const passOldA = calcOldA.salary.netSalary === 1150000 && calcOldA.grossTaxLiability === 163800;

    results.push({
      testId: 'REGIME_COMP_A',
      testName: 'Regime Comparison Test A (New Regime Tax: ₹0 vs Old Regime Tax: ₹1,63,800)',
      category: 'Regime Comparison',
      passed: passOldA,
      expected: 'Old Regime Taxable: ₹11,50,000 (Std Ded ₹50k), Old Regime Tax: ₹1,63,800',
      actual: `Old Regime Taxable: ₹${calcOldA.totalTaxableIncome.toLocaleString('en-IN')}, Old Regime Tax: ₹${calcOldA.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // AY COMPARISON: AY 2024-25 vs AY 2025-26 vs AY 2026-27
  // ==========================================================================
  {
    const income = 1000000; // ₹10,00,000 taxable income
    
    // AY 2024-25 New: 0-3L (0), 3-6L (15k), 6-9L (30k), 9-10L (15% on 1L = 15k) -> Raw Tax = 60,000 + 4% = ₹62,400
    const tax24 = recalculateFullComputation({
      ...createEmptyComputation('2024-25'),
      regimeOpted: 'new',
      salary: { grossSalary: income + 50000, netSalary: income, standardDeduction: 50000, allowancesExempt: 0, entertainmentAllowance: 0, professionalTax: 0 }
    });

    // AY 2025-26 New: 0-3L (0), 3-7L (20k), 7-10L (30k) -> Raw Tax = 50,000 + 4% = ₹52,000
    const tax25 = recalculateFullComputation({
      ...createEmptyComputation('2025-26'),
      regimeOpted: 'new',
      salary: { grossSalary: income + 75000, netSalary: income, standardDeduction: 75000, allowancesExempt: 0, entertainmentAllowance: 0, professionalTax: 0 }
    });

    // AY 2026-27 New: 0-4L (0), 4-8L (20k), 8-10L (20k) -> Raw Tax = 40,000 -> 87A full rebate (since <= 12L) -> ₹0 Tax
    const tax26 = recalculateFullComputation({
      ...createEmptyComputation('2026-27'),
      regimeOpted: 'new',
      salary: { grossSalary: income + 75000, netSalary: income, standardDeduction: 75000, allowancesExempt: 0, entertainmentAllowance: 0, professionalTax: 0 }
    });

    const passAY = 
      tax24.grossTaxLiability === 62400 &&
      tax25.grossTaxLiability === 52000 &&
      tax26.grossTaxLiability === 0;

    results.push({
      testId: 'AY_COMPARISON',
      testName: 'AY Comparison on ₹10L Taxable (AY 24-25: ₹62,400 | AY 25-26: ₹52,000 | AY 26-27: ₹0)',
      category: 'Assessment Year Rules',
      passed: passAY,
      expected: 'AY 24-25 Tax: ₹62,400, AY 25-26 Tax: ₹52,000, AY 26-27 Tax: ₹0',
      actual: `AY 24-25: ₹${tax24.grossTaxLiability.toLocaleString('en-IN')}, AY 25-26: ₹${tax25.grossTaxLiability.toLocaleString('en-IN')}, AY 26-27: ₹${tax26.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  // ==========================================================================
  // HIGH-INCOME STRESS TEST & SURCHARGE (Income: ₹36,56,60,447)
  // ==========================================================================
  {
    const highIncome = 365660447;
    const compHigh = createEmptyComputation('2026-27');
    compHigh.regimeOpted = 'new';
    compHigh.salary = {
      grossSalary: highIncome + 75000,
      allowancesExempt: 0,
      standardDeduction: 75000,
      entertainmentAllowance: 0,
      professionalTax: 0,
      netSalary: highIncome,
    };

    const calcHigh = recalculateFullComputation(compHigh);

    // AY 2026-27 New Regime Slabs:
    // 0-4L: 0
    // 4-8L: 20,000
    // 8-12L: 40,000
    // 12-16L: 60,000
    // 16-20L: 80,000
    // 20-24L: 1,00,000
    // >24L (30% on 36,32,60,450 rounded u/s 288A: 36,56,60,450 - 24,00,000 = 36,32,60,450 * 0.3 = 10,89,78,135)
    // Base Tax = 3,00,000 + 10,89,78,135 = 10,92,78,135
    // Surcharge @ 25% = 27,319,534
    // Tax + Surcharge = 136,597,669
    // Cess @ 4% = 5,463,907
    // Total Tax = ₹14,20,61,580 (Rounded u/s 288B)
    const passHigh = 
      calcHigh.totalTaxableIncome === 365660450 &&
      calcHigh.taxOnNormalIncome === 109278135 &&
      calcHigh.surcharge === 27319534 &&
      calcHigh.healthAndEducationCess === 5463907 &&
      calcHigh.grossTaxLiability === 142061580;

    results.push({
      testId: 'HIGH_INCOME_STRESS',
      testName: 'High Income Stress Test ₹36,56,60,447 (Base Tax ₹10.92 Cr + Surcharge ₹2.73 Cr + Cess ₹54.63 L = ₹14.20 Cr)',
      category: 'High Income & Surcharge',
      passed: passHigh,
      expected: 'Rounded Income: ₹36,56,60,450, Base Tax: ₹10,92,78,135, Surcharge: ₹2,73,19,534, Cess: ₹54,63,907, Total: ₹14,20,61,580',
      actual: `Income: ₹${calcHigh.totalTaxableIncome.toLocaleString('en-IN')}, Base Tax: ₹${calcHigh.taxOnNormalIncome.toLocaleString('en-IN')}, Surcharge: ₹${calcHigh.surcharge.toLocaleString('en-IN')}, Cess: ₹${calcHigh.healthAndEducationCess.toLocaleString('en-IN')}, Total: ₹${calcHigh.grossTaxLiability.toLocaleString('en-IN')}`,
    });
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

// Auto-run if executed directly via tsx
const stressTestSummary = runAllTaxCalculationStressTests();
console.log('================================================================================');
console.log(`TAX CALCULATION STRESS TEST AUDIT: ${stressTestSummary.passed}/${stressTestSummary.total} PASSED`);
console.log('================================================================================');
stressTestSummary.results.forEach((r, idx) => {
  console.log(`Test #${idx + 1} [${r.testId}]: [${r.passed ? 'PASS' : 'FAIL'}] ${r.testName}`);
  if (!r.passed) {
    console.error(`   Expected: ${r.expected}`);
    console.error(`   Actual:   ${r.actual}`);
    if (r.details) console.error(`   Details:  ${r.details}`);
  }
});
if (stressTestSummary.failed > 0) {
  process.exit(1);
}
