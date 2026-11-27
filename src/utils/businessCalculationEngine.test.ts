/**
 * ============================================================================
 * STEP 6 AUDIT TEST SUITE: BUSINESS / PROFESSION / 44AD / 44ADA / 44AE / P&L
 * 18 Comprehensive Verification Test Cases
 * ============================================================================
 */

import {
  evaluate44AD,
  evaluate44ADA,
  evaluate44AE,
  calculateRegularBooksPL,
  calculateDairyBusiness,
  calculateSingleBusiness,
  calculateAllBusinesses,
  calculateCapitalAccount,
  auditBalanceSheet,
} from './businessCalculationEngine';
import { BusinessItem, BusinessProfessionDetails } from '../types';

export function runBusinessEngineAuditTests() {
  const results: { testNumber: number; title: string; passed: boolean; details: string }[] = [];

  // TEST 1: 44AD Normal Case (Turnover ₹1.8 Cr)
  {
    const res = evaluate44AD({
      turnoverDigital6: 10000000, // ₹1 Cr
      turnoverCash8: 8000000,     // ₹80 L
    });
    const expectedDigitalProfit = 600000;
    const expectedCashProfit = 640000;
    const expectedTotalProfit = 1240000;
    const passed = res.isEligible && 
      res.presumptiveDigitalProfit === expectedDigitalProfit &&
      res.presumptiveCashProfit === expectedCashProfit &&
      res.totalPresumptiveProfit === expectedTotalProfit;
    results.push({
      testNumber: 1,
      title: '44AD Normal Case (₹1.8 Cr: Digital ₹1 Cr @ 6%, Cash ₹80 L @ 8%)',
      passed,
      details: `Presumptive Profit: ₹${res.totalPresumptiveProfit} (Expected: ₹${expectedTotalProfit})`,
    });
  }

  // TEST 2: 44AD Enhanced Limit Valid (Turnover ₹2.8 Cr, Cash <= 5%)
  {
    const res = evaluate44AD({
      turnoverDigital6: 27000000, // ₹2.7 Cr
      turnoverCash8: 1000000,     // ₹10 L (3.57%)
    });
    const passed = res.isEligible && res.turnoverLimit === 30000000 && res.isCashLimitSatisfied === true;
    results.push({
      testNumber: 2,
      title: '44AD Enhanced Limit Valid (₹2.8 Cr turnover with 3.57% cash <= 5%)',
      passed,
      details: `Eligible: ${res.isEligible}, Limit: ₹${res.turnoverLimit / 10000000} Cr, Cash %: ${res.cashPercentage?.toFixed(2)}%`,
    });
  }

  // TEST 3: 44AD Enhanced Limit Ineligible (Turnover ₹2.5 Cr, Cash > 5%)
  {
    const res = evaluate44AD({
      turnoverDigital6: 23000000, // ₹2.3 Cr
      turnoverCash8: 2000000,     // ₹20 L (8%)
    });
    const passed = !res.isEligible && res.status === 'Error' && res.turnoverLimit === 20000000;
    results.push({
      testNumber: 3,
      title: '44AD Enhanced Limit Ineligible (₹2.5 Cr turnover with 8% cash > 5% exceeds ₹2 Cr limit)',
      passed,
      details: `Eligible: ${res.isEligible}, Status: ${res.status}, Cash %: ${res.cashPercentage?.toFixed(2)}%`,
    });
  }

  // TEST 4: 44AD Zero Fabrication - Turnover Missing
  {
    const res = evaluate44AD({
      turnoverDigital6: 0,
      turnoverCash8: 0,
      totalTurnover: 0,
      netProfit: 300000,
    });
    const passed = res.turnoverRequired === true && res.status === 'Manual Verification Required';
    results.push({
      testNumber: 4,
      title: '44AD Zero Fabrication (Profit ₹3,00,000 declared with Turnover = 0 -> Turnover Required)',
      passed,
      details: `Turnover Required: ${res.turnoverRequired}, Status: ${res.status}`,
    });
  }

  // TEST 5: 44ADA Normal Case (Doctor, ₹45 Lakh receipts)
  {
    const res = evaluate44ADA({
      businessCode: '14002',
      natureOfBusiness: 'Medical Practitioner / Doctor',
      totalTurnover: 4500000,
      turnoverDigital6: 4500000,
      turnoverCash8: 0,
    });
    const expectedProfit = 2250000;
    const passed = res.isEligible && res.presumptiveProfit === expectedProfit;
    results.push({
      testNumber: 5,
      title: '44ADA Normal Case (Doctor with ₹45 L receipts -> 50% = ₹22.5 L profit)',
      passed,
      details: `Eligible: ${res.isEligible}, Presumptive Profit: ₹${res.presumptiveProfit}`,
    });
  }

  // TEST 6: 44ADA Enhanced Limit Valid (Technical Consultant, ₹70 Lakh, Cash <= 5%)
  {
    const res = evaluate44ADA({
      businessCode: '14006',
      natureOfBusiness: 'Software Consultant / IT Technical Consultant',
      totalTurnover: 7000000,
      turnoverDigital6: 6800000,
      turnoverCash8: 200000, // 2.85%
    });
    const passed = res.isEligible && res.receiptLimit === 7500000 && res.presumptiveProfit === 3500000;
    results.push({
      testNumber: 6,
      title: '44ADA Enhanced Limit Valid (IT Consultant ₹70 L receipts with 2.85% cash <= 5% -> Eligible for ₹75 L limit)',
      passed,
      details: `Eligible: ${res.isEligible}, Limit: ₹${res.receiptLimit / 100000} L, Profit: ₹${res.presumptiveProfit}`,
    });
  }

  // TEST 7: 44ADA Enhanced Limit Ineligible (Architect, ₹65 Lakh, Cash > 5%)
  {
    const res = evaluate44ADA({
      businessCode: '14004',
      natureOfBusiness: 'Architectural Profession',
      totalTurnover: 6500000,
      turnoverDigital6: 5500000,
      turnoverCash8: 1000000, // 15.38%
    });
    const passed = !res.isEligible && res.status === 'Error' && res.receiptLimit === 5000000;
    results.push({
      testNumber: 7,
      title: '44ADA Enhanced Limit Ineligible (Architect ₹65 L receipts with 15.38% cash > 5% exceeds ₹50 L limit)',
      passed,
      details: `Eligible: ${res.isEligible}, Status: ${res.status}, Cash %: ${res.cashPercentage?.toFixed(2)}%`,
    });
  }

  // TEST 8: 44ADA Missing Code / Unspecified Profession (Kirana Store owner selecting 44ADA)
  {
    const res = evaluate44ADA({
      businessCode: '09028',
      natureOfBusiness: 'Retail Kirana / Grocery Store',
      totalTurnover: 3000000,
    });
    const passed = res.status === 'Manual Verification Required' && res.warnings.some(w => w.includes('not a recognized specified profession'));
    results.push({
      testNumber: 8,
      title: '44ADA Unspecified Profession (Kirana store code 09028 -> Manual Verification Required)',
      passed,
      details: `Status: ${res.status}, Warning: ${res.warnings[0]}`,
    });
  }

  // TEST 9: 44AE Heavy Vehicle (2 vehicles @ 16 MT, 12 months)
  {
    const res = evaluate44AE({
      natureOfBusiness: 'Goods Transport Carrier',
      carriages44AE: [
        { id: '1', vehicleType: 'Heavy Goods Vehicle', grossVehicleWeightTons: 16, monthsHeld: 12, vehicleOwnership: 'Owned', presumptiveRatePerMonth: 16000, presumptiveIncome: 192000 },
        { id: '2', vehicleType: 'Heavy Goods Vehicle', grossVehicleWeightTons: 16, monthsHeld: 12, vehicleOwnership: 'Owned', presumptiveRatePerMonth: 16000, presumptiveIncome: 192000 },
      ],
    });
    const expected = 2 * 16 * 1000 * 12; // ₹3,84,000
    const passed = res.isEligible && res.totalPresumptiveIncome === expected;
    results.push({
      testNumber: 9,
      title: '44AE Heavy Vehicle (2 Heavy Vehicles @ 16 MT for 12 months -> ₹3,84,000)',
      passed,
      details: `Presumptive Income: ₹${res.totalPresumptiveIncome} (Expected: ₹${expected})`,
    });
  }

  // TEST 10: 44AE Non-Heavy Vehicle (3 vehicles @ ₹7,500/mo, 10 months)
  {
    const res = evaluate44AE({
      natureOfBusiness: 'Goods Transport Carrier',
      carriages44AE: [
        { id: '1', vehicleType: 'Other than Heavy Goods Vehicle', monthsHeld: 10, vehicleOwnership: 'Owned', presumptiveRatePerMonth: 7500, presumptiveIncome: 75000 },
        { id: '2', vehicleType: 'Other than Heavy Goods Vehicle', monthsHeld: 10, vehicleOwnership: 'Owned', presumptiveRatePerMonth: 7500, presumptiveIncome: 75000 },
        { id: '3', vehicleType: 'Other than Heavy Goods Vehicle', monthsHeld: 10, vehicleOwnership: 'Owned', presumptiveRatePerMonth: 7500, presumptiveIncome: 75000 },
      ],
    });
    const expected = 3 * 7500 * 10; // ₹2,25,000
    const passed = res.isEligible && res.totalPresumptiveIncome === expected;
    results.push({
      testNumber: 10,
      title: '44AE Non-Heavy Vehicle (3 Non-Heavy Vehicles for 10 months -> ₹2,25,000)',
      passed,
      details: `Presumptive Income: ₹${res.totalPresumptiveIncome} (Expected: ₹${expected})`,
    });
  }

  // TEST 11: 44AE Max 10 Vehicles Limit Violation (12 vehicles)
  {
    const carriages = Array.from({ length: 12 }, (_, i) => ({
      id: `v_${i}`,
      vehicleType: 'Other than Heavy Goods Vehicle' as const,
      monthsHeld: 12,
      vehicleOwnership: 'Owned' as const,
      presumptiveRatePerMonth: 7500,
      presumptiveIncome: 90000,
    }));
    const res = evaluate44AE({ carriages44AE: carriages });
    const passed = !res.isEligible && res.status === 'Error' && res.warnings.some(w => w.includes('more than 10 goods carriages'));
    results.push({
      testNumber: 11,
      title: '44AE Max 10 Vehicles Limit Violation (12 vehicles -> Ineligible / Error)',
      passed,
      details: `Eligible: ${res.isEligible}, Status: ${res.status}`,
    });
  }

  // TEST 12: 44AE Disallowed for Non-Transport Business (Kirana/Boutique without carriages)
  {
    const res = evaluate44AE({
      natureOfBusiness: 'Boutique & Tailoring',
      carriages44AE: [],
    });
    const passed = !res.isEligible && res.status === 'Manual Verification Required';
    results.push({
      testNumber: 12,
      title: '44AE Disallowed for Non-Transport without carriages (Manual Verification Required)',
      passed,
      details: `Eligible: ${res.isEligible}, Status: ${res.status}`,
    });
  }

  // TEST 13: Regular Books P&L Profit Calculation
  {
    const res = calculateRegularBooksPL({
      grossSales: 5000000,
      otherBusinessIncome: 0,
      openingStock: 500000,
      purchases: 3000000,
      directLabour: 100000,
      freightAndCarriage: 50000,
      closingStock: 650000, // COGS = 5L + 30L + 1L + 0.5L - 6.5L = 30L -> GP = 20L
      expenses: [
        { id: '1', category: 'Rent', amount: 300000 },
        { id: '2', category: 'Salary/Wages', amount: 400000 },
        { id: '3', category: 'Electricity', amount: 100000 },
      ], // Indirect = 8L
      totalDepreciation: 200000, // Dep = 2L -> NP = 20L - 8L - 2L = 10L
    });
    const passed = res.costOfGoodsSold === 3000000 && res.grossProfit === 2000000 && res.netProfitOrLoss === 1000000 && !res.isLoss;
    results.push({
      testNumber: 13,
      title: 'Regular Books P&L Profit (Sales ₹50 L, COGS ₹30 L, Indirect ₹8 L, Dep ₹2 L -> NP ₹10 L)',
      passed,
      details: `COGS: ₹${res.costOfGoodsSold}, GP: ₹${res.grossProfit}, NP: ₹${res.netProfitOrLoss}`,
    });
  }

  // TEST 14: Regular Books P&L Business Loss Handling
  {
    const res = calculateRegularBooksPL({
      grossSales: 2000000,
      openingStock: 200000,
      purchases: 1800000,
      closingStock: 200000, // COGS = 18L -> GP = 2L
      expenses: [
        { id: '1', category: 'Rent', amount: 300000 },
        { id: '2', category: 'Salary/Wages', amount: 200000 },
      ], // Indirect = 5L -> Net Loss = 2L - 5L = -3L
      totalDepreciation: 0,
    });
    const passed = res.netProfitOrLoss === -300000 && res.isLoss === true && res.businessLoss === 300000;
    results.push({
      testNumber: 14,
      title: 'Regular Books Business Loss (Sales ₹20 L, COGS ₹18 L, Indirect ₹5 L -> Net Loss -₹3 L)',
      passed,
      details: `Net Loss: ₹${res.netProfitOrLoss}, isLoss: ${res.isLoss}, businessLoss: ₹${res.businessLoss}`,
    });
  }

  // TEST 15: Potentially Personal Expense Warning
  {
    const res = calculateRegularBooksPL({
      grossSales: 1000000,
      expenses: [
        { id: '1', category: 'Personal / Household Drawings (Non-Business)', amount: 150000, description: "Children's School Fees & Grocery" },
      ],
    });
    const passed = res.status === 'Manual Verification Required' && res.personalExpenseWarnings.length > 0;
    results.push({
      testNumber: 15,
      title: 'Personal Expense Warning (School fees & drawings flagged for manual verification)',
      passed,
      details: `Status: ${res.status}, Warnings: ${res.personalExpenseWarnings[0]}`,
    });
  }

  // TEST 16: Dairy Business Calculation
  {
    const res = calculateDairyBusiness({
      milkSales: 1200000,
      otherDairyReceipts: 50000,
      feedExpense: 500000,
      labourExpense: 150000,
      veterinaryExpense: 50000,
      transportExpense: 50000,
      otherExpenses: 0,
    });
    const expectedNet = (1200000 + 50000) - (500000 + 150000 + 50000 + 50000); // 12.5L - 7.5L = 5L
    const passed = res.totalRevenue === 1250000 && res.totalExpenses === 750000 && res.netDairyProfit === expectedNet;
    results.push({
      testNumber: 16,
      title: 'Dairy Business (Milk Sales ₹12 L + ₹50k, Feed & Vet ₹7.5 L -> Net Profit ₹5 L as Business Income)',
      passed,
      details: `Revenue: ₹${res.totalRevenue}, Expenses: ₹${res.totalExpenses}, Net Profit: ₹${res.netDairyProfit}`,
    });
  }

  // TEST 17: Multiple Businesses Combined
  {
    const bizDetails: BusinessProfessionDetails = {
      natureOfBusiness: 'Multiple',
      turnoverOrGrossReceipts: 0,
      presumptiveSection: '44AD (8%/6%)',
      netProfit: 0,
      businessList: [
        {
          id: 'biz-1',
          businessName: 'Sanjeev Super Store',
          natureOfBusiness: 'Retail Trading',
          businessCode: '09028',
          presumptiveSection: '44AD (8%/6%)',
          turnoverDigital6: 5000000,
          profitDigital6: 300000, // 6%
          turnoverCash8: 6250000,
          profitCash8: 500000, // 8%
          totalTurnover: 11250000,
          netProfit: 800000,
        },
        {
          id: 'biz-2',
          businessName: 'Bangu Dairy Farm',
          businessType: 'Dairy',
          natureOfBusiness: 'Dairy Farming & Milk Sales',
          businessCode: '01004',
          totalTurnover: 1200000,
          netProfit: 500000,
          dairyDetails: {
            milkSales: 1200000,
            otherDairyReceipts: 0,
            feedExpense: 500000,
            labourExpense: 150000,
            veterinaryExpense: 50000,
            transportExpense: 0,
            otherExpenses: 0,
            totalExpenses: 700000,
            netDairyProfit: 500000,
          },
          turnoverDigital6: 0,
          profitDigital6: 0,
          turnoverCash8: 0,
          profitCash8: 0,
        },
      ],
    };

    const summary = calculateAllBusinesses(bizDetails);
    const passed = summary.businessResults.length === 2 &&
      summary.grandTotalTurnover === (11250000 + 1200000) &&
      summary.netBusinessProfit === (800000 + 500000);
    results.push({
      testNumber: 17,
      title: 'Multiple Businesses Combined (Sanjeev Super Store ₹8 L + Bangu Dairy ₹5 L -> Total PGBP ₹13 L)',
      passed,
      details: `Businesses: ${summary.businessResults.length}, Grand Turnover: ₹${summary.grandTotalTurnover}, Net PGBP: ₹${summary.netBusinessProfit}`,
    });
  }

  // TEST 18: Balance Sheet Capital Account & Discrepancy Verification
  {
    const cap = calculateCapitalAccount({
      openingCapital: 1000000,
      capitalIntroduced: 0,
      netProfitAdded: 500000,
      drawings: 200000,
      taxPaidFromCapital: 0,
    }, 500000);

    const expectedClosingCap = 1000000 + 500000 - 200000; // ₹13,00,000

    const audit = auditBalanceSheet({
      enabled: true,
      openingCapital: 1000000,
      drawings: 200000,
      closingCapital: expectedClosingCap,
      sundryCreditors: 0,
      cashInHand: 500000,
      bankBalances: 1000000, // Total Assets = 15L vs Total Liab = 13L -> Diff = -2L
    }, 500000);

    const passed = cap.closingCapital === expectedClosingCap &&
      audit.totalLiabilities === 1300000 &&
      audit.totalAssets === 1500000 &&
      audit.difference === -200000 &&
      !audit.isTallied;

    results.push({
      testNumber: 18,
      title: 'Balance Sheet Capital Account & Discrepancy (Closing Cap ₹13 L vs Assets ₹15 L -> Discrepancy ₹2 L flagged)',
      passed,
      details: `Closing Cap: ₹${cap.closingCapital}, Liab: ₹${audit.totalLiabilities}, Assets: ₹${audit.totalAssets}, Diff: ₹${audit.difference}, Status: ${audit.status}`,
    });
  }

  return results;
}

// Auto-run if executed directly via tsx
const testResults = runBusinessEngineAuditTests();
console.log('====================================================');
console.log(`BUSINESS ENGINE AUDIT TESTS: ${testResults.filter(t => t.passed).length}/${testResults.length} PASSED`);
console.log('====================================================');
testResults.forEach(t => {
  console.log(`Test #${t.testNumber}: [${t.passed ? 'PASS' : 'FAIL'}] ${t.title}`);
  if (!t.passed) {
    console.error(`   Details: ${t.details}`);
  }
});
if (testResults.some(t => !t.passed)) {
  process.exit(1);
}

