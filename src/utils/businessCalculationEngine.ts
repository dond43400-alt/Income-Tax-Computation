/**
 * ============================================================================
 * BUSINESS / PROFESSION / PRESUMPTIVE TAX / P&L / BALANCE SHEET CALCULATION ENGINE
 * Assessment Year 2026-27 / Statutory Compliance / Zero-Fabrication Architecture
 * ============================================================================
 * 
 * Rules Enforced:
 * 1. Section 44AD: ₹2 Cr standard vs ₹3 Cr enhanced (if cash receipts <= 5%).
 *    Digital turnover @ 6%, Cash turnover @ 8%. No back-calculation of turnover.
 * 2. Section 44ADA: ₹50 L standard vs ₹75 L enhanced (if cash receipts <= 5%).
 *    Requires identifiable profession. Presumptive profit @ min 50%.
 * 3. Section 44AE: Goods carriages only (max 10). ₹1000/ton/month for HGV (>12 MT),
 *    ₹7500/month for non-HGV. Disallow for non-transport activities.
 * 4. Regular Books P&L: Revenue - COGS = Gross Profit. Gross Profit - Indirect Expenses
 *    - Depreciation = Net Profit/Loss. Retains business loss (< 0).
 * 5. Personal Expenses: Flags non-business expenses with warnings.
 * 6. Depreciation: Calculated via WDV schedule separately from cash expenses.
 * 7. Dairy Business: Milk sales & feed/vet/labour expenses handled as business income.
 * 8. Balance Sheet & Capital Account: Assets = Liabilities verification, explicit diff,
 *    no silent auto-adjustments without user confirmation, zero-fabrication of cash/bank.
 * 9. Multi-business: Retains independent records for each business & aggregates PGBP.
 */

import { 
  BusinessItem, 
  BusinessProfessionDetails, 
  BusinessExpenseItem, 
  DepreciationAssetItem, 
  GoodsCarriage44AEItem, 
  DairyBusinessDetails, 
  RegularBooksDetails, 
  BalanceSheetDetails 
} from '../types';

// Specified professions recognized under Section 44AA(1) / Section 44ADA
export const SPECIFIED_PROFESSION_CODES = [
  '14001', // Legal profession (Advocate, Legal consultant)
  '14002', // Medical profession (Doctor, Physician, Surgeon, Dentist)
  '14003', // Engineering profession (Consulting Engineer)
  '14004', // Architectural profession (Architect)
  '14005', // Accountancy profession (Chartered Accountant)
  '14006', // Technical consultancy (IT / Software consultant / Technical expert)
  '14007', // Interior decoration
  '14008', // Authorized representative
  '14009', // Film artist (Actor, Director, Producer, Music Director, Editor, Singer)
  '14010', // Company Secretary
  '14011', // Information Technology profession
];

export interface BusinessCalculationResult {
  businessId: string;
  businessName: string;
  businessCode?: string;
  natureOfBusiness?: string;
  businessType?: string;
  presumptiveSection?: string;
  
  // Turnover & Receipts
  totalTurnover: number;
  digitalReceipts: number;
  cashReceipts: number;
  otherReceipts: number;
  cashReceiptPercentage?: number;
  isCashConditionSatisfied?: boolean;

  // Profits & Loss
  presumptiveDigitalProfit: number;
  presumptiveCashProfit: number;
  presumptiveOtherProfit: number;
  totalPresumptiveProfit: number;
  actualProfit: number;
  businessLoss: number; // Positive value representing loss
  isLoss: boolean;
  netProfit: number; // Can be negative for loss

  // Status & Validation
  verificationStatus: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  verificationWarnings: string[];
  turnoverRequired?: boolean;
  businessCodeRequired?: boolean;
  
  // P&L & Balance Sheet metrics
  grossProfit?: number;
  totalIndirectExpenses?: number;
  totalDepreciation?: number;
  closingStock?: number;
  debtors?: number;
  creditors?: number;
  cashInHand?: number;
  bankBalance?: number;
}

export interface MultiBusinessSummary {
  grandTotalTurnover: number;
  grandTotalPresumptiveProfit: number;
  grandTotalActualProfit: number;
  grandTotalBusinessLoss: number;
  netBusinessProfit: number; // Aggregate PGBP income (can be negative for loss)
  businessResults: BusinessCalculationResult[];
  overallVerificationStatus: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  overallWarnings: string[];
}

/**
 * Evaluates Section 44AD for a business
 */
export function evaluate44AD(
  biz: Partial<BusinessItem>, 
  assessmentYear: string = '2026-27'
): {
  isEligible: boolean;
  turnoverLimit: number;
  cashPercentage?: number;
  isCashLimitSatisfied?: boolean;
  presumptiveDigitalProfit: number;
  presumptiveCashProfit: number;
  presumptiveOtherProfit: number;
  totalPresumptiveProfit: number;
  status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  warnings: string[];
  turnoverRequired: boolean;
} {
  const warnings: string[] = [];
  let status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';
  let turnoverRequired = false;

  const tDig = Math.max(0, biz.turnoverDigital6 ?? biz.digitalReceipts ?? 0);
  const tCash = Math.max(0, biz.turnoverCash8 ?? biz.cashReceipts ?? 0);
  const tOther = Math.max(0, biz.turnoverOtherMode ?? biz.otherReceipts ?? 0);
  const declaredTotalTurnover = Number(biz.totalTurnover ?? biz.grossReceipts ?? 0);
  
  const totalTurnover = (tDig + tCash + tOther > 0) ? (tDig + tCash + tOther) : declaredTotalTurnover;

  // Zero-fabrication check: declared profit with missing turnover
  const declaredProfit = Number(biz.netProfit ?? biz.actualProfit ?? 0);
  if (totalTurnover === 0 && declaredProfit > 0) {
    turnoverRequired = true;
    status = 'Manual Verification Required';
    warnings.push('Turnover Required: Profit is declared (₹' + declaredProfit.toLocaleString('en-IN') + ') but turnover is missing. Under statutory rules, turnover cannot be back-calculated.');
  }

  // Cash receipt percentage calculation
  let cashPercentage: number | undefined = undefined;
  let isCashLimitSatisfied: boolean | undefined = undefined;

  if (totalTurnover > 0) {
    if (biz.turnoverCash8 !== undefined || biz.cashReceipts !== undefined) {
      cashPercentage = (tCash / totalTurnover) * 100;
      isCashLimitSatisfied = cashPercentage <= 5.0001;
    } else if (tDig > 0 && tCash === 0 && tOther === 0) {
      cashPercentage = 0;
      isCashLimitSatisfied = true;
    } else {
      // Cash information missing
      status = 'Manual Verification Required';
      warnings.push('Cash receipts breakdown not fully provided. Manual verification required to check 5% cash threshold for enhanced ₹3 Cr limit.');
    }
  }

  // Statutory turnover limit: ₹2 Cr standard vs ₹3 Cr enhanced
  const standardLimit = 20000000; // ₹2 Crore
  const enhancedLimit = 30000000; // ₹3 Crore
  const applicableLimit = isCashLimitSatisfied ? enhancedLimit : standardLimit;

  let isEligible = true;
  if (totalTurnover > applicableLimit) {
    isEligible = false;
    status = 'Error';
    warnings.push(`Turnover of ₹${totalTurnover.toLocaleString('en-IN')} exceeds statutory limit of ₹${(applicableLimit / 10000000).toFixed(1)} Cr for Section 44AD (Cash receipts: ${cashPercentage !== undefined ? cashPercentage.toFixed(2) + '%' : 'Unconfirmed'}). Regular Books of Accounts (ITR-3) required.`);
  }

  // Presumptive profit calculation
  const pDig = biz.profitDigital6 !== undefined && biz.profitDigital6 > 0 
    ? biz.profitDigital6 
    : Math.round(tDig * 0.06);
    
  const pCash = biz.profitCash8 !== undefined && biz.profitCash8 > 0 
    ? biz.profitCash8 
    : Math.round(tCash * 0.08);

  const otherRate = (biz.otherModePercent !== undefined && biz.otherModePercent !== null) 
    ? (Number(biz.otherModePercent) / 100) 
    : 0.08;
    
  const pOther = biz.profitOtherMode !== undefined && biz.profitOtherMode > 0
    ? biz.profitOtherMode
    : Math.round(tOther * otherRate);

  const totalPresumptive = pDig + pCash + pOther;

  return {
    isEligible,
    turnoverLimit: applicableLimit,
    cashPercentage,
    isCashLimitSatisfied,
    presumptiveDigitalProfit: pDig,
    presumptiveCashProfit: pCash,
    presumptiveOtherProfit: pOther,
    totalPresumptiveProfit: totalPresumptive,
    status,
    warnings,
    turnoverRequired,
  };
}

/**
 * Evaluates Section 44ADA for a profession
 */
export function evaluate44ADA(
  biz: Partial<BusinessItem>,
  assessmentYear: string = '2026-27'
): {
  isEligible: boolean;
  receiptLimit: number;
  cashPercentage?: number;
  isCashLimitSatisfied?: boolean;
  presumptiveProfit: number;
  status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  warnings: string[];
  turnoverRequired: boolean;
} {
  const warnings: string[] = [];
  let status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';
  let turnoverRequired = false;

  const code = (biz.businessCode || '').trim();
  const nature = (biz.natureOfBusiness || '').toLowerCase();
  
  // Verify if it is a specified profession
  const isSpecifiedProfessionCode = SPECIFIED_PROFESSION_CODES.some(c => code.startsWith(c));
  const isSpecifiedProfessionText = [
    'doctor', 'medical', 'legal', 'advocate', 'lawyer', 'engineer', 'architect', 
    'accountant', 'chartered accountant', 'ca', 'technical', 'software', 
    'interior', 'film', 'company secretary', 'consultant'
  ].some(k => nature.includes(k));

  if (!code) {
    status = 'Manual Verification Required';
    warnings.push('Business / Profession Code is missing. Required to verify eligibility for Section 44ADA.');
  } else if (!isSpecifiedProfessionCode && !isSpecifiedProfessionText) {
    status = 'Manual Verification Required';
    warnings.push(`Profession Code '${code}' is not a recognized specified profession under Section 44AA(1)/44ADA (e.g. Legal, Medical, Engineering, Architecture, Accountancy, Technical, Interior Decoration).`);
  }

  const grossReceipts = Number(biz.totalTurnover ?? biz.grossReceipts ?? (
    (biz.turnoverDigital6 || 0) + (biz.turnoverCash8 || 0) + (biz.turnoverOtherMode || 0)
  ));

  const declaredProfit = Number(biz.netProfit ?? biz.actualProfit ?? 0);
  if (grossReceipts === 0 && declaredProfit > 0) {
    turnoverRequired = true;
    status = 'Manual Verification Required';
    warnings.push('Gross Receipts Required: Profit is declared (₹' + declaredProfit.toLocaleString('en-IN') + ') but gross receipts are missing.');
  }

  // Cash receipt percentage
  let cashPercentage: number | undefined = undefined;
  let isCashLimitSatisfied: boolean | undefined = undefined;
  const cashReceipts = Math.max(0, biz.turnoverCash8 ?? biz.cashReceipts ?? 0);

  if (grossReceipts > 0) {
    if (biz.turnoverCash8 !== undefined || biz.cashReceipts !== undefined) {
      cashPercentage = (cashReceipts / grossReceipts) * 100;
      isCashLimitSatisfied = cashPercentage <= 5.0001;
    } else {
      status = 'Manual Verification Required';
      warnings.push('Cash receipts breakdown not specified for 44ADA. Verification required for enhanced ₹75 Lakh limit.');
    }
  }

  // Limits: ₹50L standard vs ₹75L enhanced
  const standardLimit = 5000000; // ₹50 Lakh
  const enhancedLimit = 7500000; // ₹75 Lakh
  const applicableLimit = isCashLimitSatisfied ? enhancedLimit : standardLimit;

  let isEligible = true;
  if (grossReceipts > applicableLimit) {
    isEligible = false;
    status = 'Error';
    warnings.push(`Gross professional receipts of ₹${grossReceipts.toLocaleString('en-IN')} exceed statutory limit of ₹${(applicableLimit / 100000).toFixed(0)} Lakhs for Section 44ADA.`);
  }

  // 50% minimum presumptive profit
  const minPresumptive = Math.round(grossReceipts * 0.50);
  const presumptiveProfit = Math.max(minPresumptive, declaredProfit > 0 ? declaredProfit : minPresumptive);

  return {
    isEligible,
    receiptLimit: applicableLimit,
    cashPercentage,
    isCashLimitSatisfied,
    presumptiveProfit,
    status,
    warnings,
    turnoverRequired,
  };
}

/**
 * Evaluates Section 44AE for goods transport business
 */
export function evaluate44AE(
  biz: Partial<BusinessItem>
): {
  isEligible: boolean;
  totalCarriages: number;
  totalPresumptiveIncome: number;
  status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  warnings: string[];
} {
  const warnings: string[] = [];
  let status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';

  const carriages = biz.carriages44AE || [];
  const nature = (biz.natureOfBusiness || '').toLowerCase();
  const isTransportNature = nature.includes('transport') || nature.includes('goods') || nature.includes('carrier') || nature.includes('truck') || nature.includes('lorry');

  if (carriages.length === 0) {
    status = 'Manual Verification Required';
    warnings.push('Section 44AE selected but no Goods Carriages details entered. 44AE is strictly restricted to businesses plying, hiring, or leasing goods carriages.');
  }

  if (carriages.length > 10) {
    status = 'Error';
    warnings.push(`Taxpayer owns/operates ${carriages.length} goods carriages. Section 44AE is not available if taxpayer owns more than 10 goods carriages at any time during previous year.`);
  }

  let totalIncome = 0;
  carriages.forEach((c, idx) => {
    const months = Math.min(12, Math.max(1, c.monthsHeld || 12));
    let rate = 7500;
    if (c.vehicleType === 'Heavy Goods Vehicle') {
      const weightTons = Math.max(12, Number(c.grossVehicleWeightTons || 12));
      rate = weightTons * 1000;
    }
    const vehicleIncome = rate * months;
    totalIncome += vehicleIncome;
  });

  return {
    isEligible: carriages.length > 0 && carriages.length <= 10,
    totalCarriages: carriages.length,
    totalPresumptiveIncome: totalIncome,
    status,
    warnings,
  };
}

/**
 * Evaluates Profit & Loss from Regular Books of Accounts
 */
export function calculateRegularBooksPL(
  pl?: Partial<RegularBooksDetails>
): {
  grossSales: number;
  otherBusinessIncome: number;
  totalRevenue: number;
  openingStock: number;
  purchases: number;
  directLabour: number;
  freightAndCarriage: number;
  closingStock: number;
  costOfGoodsSold: number;
  grossProfit: number;
  indirectExpenses: number;
  depreciation: number;
  netProfitOrLoss: number;
  isLoss: boolean;
  businessLoss: number;
  personalExpenseWarnings: string[];
  status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  warnings: string[];
} {
  const currentPl = pl || {};
  const warnings: string[] = [];
  const personalExpenseWarnings: string[] = [];
  let status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';

  const grossSales = Math.max(0, currentPl.grossSales || (currentPl as any).grossSalesOrReceipts || 0);
  const otherBusinessIncome = Math.max(0, currentPl.otherBusinessIncome || 0);
  const totalRevenue = grossSales + otherBusinessIncome;

  const openingStock = Math.max(0, currentPl.openingStock || 0);
  const purchases = Math.max(0, currentPl.purchases || 0);
  const directLabour = Math.max(0, currentPl.directLabour || 0);
  const freightAndCarriage = Math.max(0, currentPl.freightAndCarriage || 0);
  const closingStock = Math.max(0, currentPl.closingStock || 0);

  const costOfGoodsSold = openingStock + purchases + directLabour + freightAndCarriage - closingStock;
  const grossProfit = totalRevenue - costOfGoodsSold;

  // Process indirect expenses & check for personal expenses
  let indirectExpenses = 0;
  const expensesList: BusinessExpenseItem[] = currentPl.expenses || (currentPl as any).indirectExpensesList || [];

  if (expensesList.length > 0) {
    expensesList.forEach(exp => {
      const amt = Math.max(0, exp.amount || 0);
      const cat = (exp.category || (exp as any).name || '').toLowerCase();
      const desc = (exp.description || '').toLowerCase();

      // Check for personal expenses
      const isPersonal = 
        (exp as any).isPersonalExpense ||
        cat.includes('personal') || 
        cat.includes('household') || 
        cat.includes('drawings') || 
        desc.includes('school fee') || 
        desc.includes('household') || 
        desc.includes('grocery') || 
        desc.includes('family medical') || 
        desc.includes('personal travel') || 
        desc.includes('shopping');

      if (isPersonal) {
        personalExpenseWarnings.push(`Potentially Non-Business Expense: '${exp.category || (exp as any).name}' (₹${amt.toLocaleString('en-IN')}) entered under business expenses. Manual verification required — personal expenses cannot reduce taxable business profit.`);
      }

      indirectExpenses += amt;
    });
  } else if (typeof (currentPl as any).indirectExpenses === 'number') {
    indirectExpenses = Math.max(0, (currentPl as any).indirectExpenses);
  }


  if (personalExpenseWarnings.length > 0) {
    status = 'Manual Verification Required';
    warnings.push(...personalExpenseWarnings);
  }

  // Calculate depreciation from assets schedule
  let totalDepreciation = 0;
  if (currentPl.depreciationAssets && currentPl.depreciationAssets.length > 0) {
    currentPl.depreciationAssets.forEach(asset => {
      const op = Math.max(0, asset.openingWDV || 0);
      const add = Math.max(0, asset.additions || 0);
      const del = Math.max(0, asset.deletions || 0);
      const rate = Math.max(0, asset.rate || 0) / 100;
      const dep = Math.round(Math.max(0, op + add - del) * rate);
      totalDepreciation += dep;
    });
  } else {
    totalDepreciation = Math.max(0, currentPl.totalDepreciation || 0);
  }

  const netProfitOrLoss = grossProfit - indirectExpenses - totalDepreciation;
  const isLoss = netProfitOrLoss < 0;
  const businessLoss = isLoss ? Math.abs(netProfitOrLoss) : 0;

  return {
    grossSales,
    otherBusinessIncome,
    totalRevenue,
    openingStock,
    purchases,
    directLabour,
    freightAndCarriage,
    closingStock,
    costOfGoodsSold,
    grossProfit,
    indirectExpenses,
    depreciation: totalDepreciation,
    netProfitOrLoss,
    isLoss,
    businessLoss,
    personalExpenseWarnings,
    status,
    warnings,
  };
}

/**
 * Calculates Dairy Business profit
 */
export function calculateDairyBusiness(
  dairy?: Partial<DairyBusinessDetails>
): {
  milkSales: number;
  otherReceipts: number;
  totalRevenue: number;
  feedExpense: number;
  labourExpense: number;
  veterinaryExpense: number;
  transportExpense: number;
  otherExpenses: number;
  totalExpenses: number;
  netDairyProfit: number;
} {
  const d = dairy || {};
  const milkSales = Math.max(0, d.milkSales || 0);
  const otherReceipts = Math.max(0, d.otherDairyReceipts || 0);
  const totalRevenue = milkSales + otherReceipts;

  const feed = Math.max(0, d.feedExpense || 0);
  const labour = Math.max(0, d.labourExpense || 0);
  const vet = Math.max(0, d.veterinaryExpense || 0);
  const transport = Math.max(0, d.transportExpense || 0);
  const other = Math.max(0, d.otherExpenses || 0);
  const totalExpenses = feed + labour + vet + transport + other;

  const netDairyProfit = totalRevenue - totalExpenses;

  return {
    milkSales,
    otherReceipts,
    totalRevenue,
    feedExpense: feed,
    labourExpense: labour,
    veterinaryExpense: vet,
    transportExpense: transport,
    otherExpenses: other,
    totalExpenses,
    netDairyProfit,
  };
}

/**
 * Calculates and audits a single business record
 */
export function calculateSingleBusiness(
  biz: BusinessItem,
  assessmentYear: string = '2026-27'
): BusinessCalculationResult {
  const section = biz.presumptiveSection || '44AD (8%/6%)';
  const warnings: string[] = [];
  let status: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';
  let turnoverRequired = false;
  let businessCodeRequired = !biz.businessCode;

  if (businessCodeRequired) {
    status = 'Manual Verification Required';
    warnings.push('Business Code Required: No statutory 5-digit business code specified.');
  }

  let totalTurnover = 0;
  let digitalReceipts = Math.max(0, biz.turnoverDigital6 ?? biz.digitalReceipts ?? 0);
  let cashReceipts = Math.max(0, biz.turnoverCash8 ?? biz.cashReceipts ?? 0);
  let otherReceipts = Math.max(0, biz.turnoverOtherMode ?? biz.otherReceipts ?? 0);
  let cashReceiptPercentage: number | undefined = undefined;
  let isCashConditionSatisfied: boolean | undefined = undefined;

  let presumptiveDigitalProfit = 0;
  let presumptiveCashProfit = 0;
  let presumptiveOtherProfit = 0;
  let totalPresumptiveProfit = 0;
  let actualProfit = 0;
  let businessLoss = 0;
  let isLoss = false;
  let netProfit = 0;

  let grossProfit: number | undefined = undefined;
  let totalIndirectExpenses: number | undefined = undefined;
  let totalDepreciation: number | undefined = undefined;

  // ROUTE ACCORDING TO SELECTED METHODOLOGY
  if (section.includes('44ADA')) {
    const res44ADA = evaluate44ADA(biz, assessmentYear);
    totalTurnover = Number(biz.totalTurnover ?? biz.grossReceipts ?? (digitalReceipts + cashReceipts + otherReceipts));
    cashReceiptPercentage = res44ADA.cashPercentage;
    isCashConditionSatisfied = res44ADA.isCashLimitSatisfied;
    totalPresumptiveProfit = res44ADA.presumptiveProfit;
    netProfit = totalPresumptiveProfit;
    actualProfit = totalPresumptiveProfit;
    if (res44ADA.status !== 'Valid' && status === 'Valid') status = res44ADA.status;
    warnings.push(...res44ADA.warnings);
    turnoverRequired = res44ADA.turnoverRequired;

  } else if (section.includes('44AE')) {
    const res44AE = evaluate44AE(biz);
    totalPresumptiveProfit = res44AE.totalPresumptiveIncome;
    netProfit = totalPresumptiveProfit;
    actualProfit = totalPresumptiveProfit;
    if (res44AE.status !== 'Valid' && status === 'Valid') status = res44AE.status;
    warnings.push(...res44AE.warnings);

  } else if (section.includes('Normal Books') || section.includes('P&L')) {
    const resPL = calculateRegularBooksPL(biz.regularBooks);
    totalTurnover = resPL.totalRevenue;
    grossProfit = resPL.grossProfit;
    totalIndirectExpenses = resPL.indirectExpenses;
    totalDepreciation = resPL.depreciation;
    netProfit = resPL.netProfitOrLoss;
    isLoss = resPL.isLoss;
    businessLoss = resPL.businessLoss;
    actualProfit = netProfit;
    if (resPL.status !== 'Valid' && status === 'Valid') status = resPL.status;
    warnings.push(...resPL.warnings);

  } else if (biz.businessType === 'Dairy' && biz.dairyDetails) {
    const resDairy = calculateDairyBusiness(biz.dairyDetails);
    totalTurnover = resDairy.totalRevenue;
    netProfit = resDairy.netDairyProfit;
    isLoss = netProfit < 0;
    businessLoss = isLoss ? Math.abs(netProfit) : 0;
    actualProfit = netProfit;

  } else {
    // Standard Section 44AD
    const res44AD = evaluate44AD(biz, assessmentYear);
    totalTurnover = (digitalReceipts + cashReceipts + otherReceipts > 0)
      ? (digitalReceipts + cashReceipts + otherReceipts)
      : Number(biz.totalTurnover ?? biz.grossReceipts ?? 0);
    
    cashReceiptPercentage = res44AD.cashPercentage;
    isCashConditionSatisfied = res44AD.isCashLimitSatisfied;
    presumptiveDigitalProfit = res44AD.presumptiveDigitalProfit;
    presumptiveCashProfit = res44AD.presumptiveCashProfit;
    presumptiveOtherProfit = res44AD.presumptiveOtherProfit;
    totalPresumptiveProfit = res44AD.totalPresumptiveProfit;

    const declaredProfit = Number(biz.netProfit ?? biz.actualProfit ?? 0);
    netProfit = (declaredProfit > 0 && declaredProfit >= totalPresumptiveProfit) 
      ? declaredProfit 
      : totalPresumptiveProfit;
    actualProfit = netProfit;

    if (res44AD.status !== 'Valid' && status === 'Valid') status = res44AD.status;
    warnings.push(...res44AD.warnings);
    turnoverRequired = res44AD.turnoverRequired;
  }

  return {
    businessId: biz.id,
    businessName: biz.businessName || biz.tradeName || 'Untitled Business',
    businessCode: biz.businessCode,
    natureOfBusiness: biz.natureOfBusiness,
    businessType: biz.businessType,
    presumptiveSection: section,
    totalTurnover,
    digitalReceipts,
    cashReceipts,
    otherReceipts,
    cashReceiptPercentage,
    isCashConditionSatisfied,
    presumptiveDigitalProfit,
    presumptiveCashProfit,
    presumptiveOtherProfit,
    totalPresumptiveProfit,
    actualProfit,
    businessLoss,
    isLoss,
    netProfit,
    verificationStatus: status,
    verificationWarnings: warnings,
    turnoverRequired,
    businessCodeRequired,
    grossProfit,
    totalIndirectExpenses,
    totalDepreciation,
    closingStock: biz.closingStock,
    debtors: biz.debtors,
    creditors: biz.creditors,
    cashInHand: biz.cashInHand,
    bankBalance: biz.bankBalance,
  };
}

/**
 * Calculates aggregate business profits & loss across multiple businesses
 */
export function calculateAllBusinesses(
  bizDetails: BusinessProfessionDetails,
  assessmentYear: string = '2026-27'
): MultiBusinessSummary {
  const list = bizDetails.businessList || [];
  
  if (list.length === 0) {
    // Single business fallback
    const singleItem: BusinessItem = {
      id: 'default-biz',
      businessName: bizDetails.businessName || bizDetails.tradeName || 'Primary Business',
      tradeName: bizDetails.tradeName,
      natureOfBusiness: bizDetails.natureOfBusiness,
      businessCode: bizDetails.businessCode,
      businessType: bizDetails.businessType,
      businessDescription: bizDetails.businessDescription,
      businessAddress: bizDetails.businessAddress,
      presumptiveSection: bizDetails.presumptiveSection,
      turnoverDigital6: bizDetails.turnoverDigital6 || 0,
      profitDigital6: bizDetails.profitDigital6 || 0,
      turnoverCash8: bizDetails.turnoverCash8 || 0,
      profitCash8: bizDetails.profitCash8 || 0,
      turnoverOtherMode: bizDetails.turnoverOtherMode || 0,
      profitOtherMode: bizDetails.profitOtherMode || 0,
      otherModePercent: bizDetails.otherModePercent,
      otherModeDescription: bizDetails.otherModeDescription,
      totalTurnover: bizDetails.turnoverOrGrossReceipts || 0,
      netProfit: bizDetails.netProfit || 0,
      regularBooks: bizDetails.regularBooks,
      dairyDetails: bizDetails.dairyDetails,
      carriages44AE: bizDetails.carriages44AE,
      gstParticulars: bizDetails.gstParticulars,
    };

    const res = calculateSingleBusiness(singleItem, assessmentYear);
    return {
      grandTotalTurnover: res.totalTurnover,
      grandTotalPresumptiveProfit: res.totalPresumptiveProfit,
      grandTotalActualProfit: res.actualProfit,
      grandTotalBusinessLoss: res.businessLoss,
      netBusinessProfit: res.netProfit,
      businessResults: [res],
      overallVerificationStatus: res.verificationStatus,
      overallWarnings: res.verificationWarnings,
    };
  }

  // Multiple businesses calculation
  let grandTotalTurnover = 0;
  let grandTotalPresumptiveProfit = 0;
  let grandTotalActualProfit = 0;
  let grandTotalBusinessLoss = 0;
  let netBusinessProfit = 0;
  const businessResults: BusinessCalculationResult[] = [];
  const overallWarnings: string[] = [];
  let overallVerificationStatus: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error' = 'Valid';

  list.forEach(item => {
    const res = calculateSingleBusiness(item, assessmentYear);
    businessResults.push(res);

    grandTotalTurnover += res.totalTurnover;
    grandTotalPresumptiveProfit += res.totalPresumptiveProfit;
    if (res.isLoss) {
      grandTotalBusinessLoss += res.businessLoss;
    } else {
      grandTotalActualProfit += res.actualProfit;
    }
    netBusinessProfit += res.netProfit;

    if (res.verificationWarnings.length > 0) {
      overallWarnings.push(`[${res.businessName}]: ${res.verificationWarnings.join('; ')}`);
    }

    if (res.verificationStatus === 'Error') {
      overallVerificationStatus = 'Error';
    } else if (res.verificationStatus === 'Manual Verification Required' && overallVerificationStatus !== 'Error') {
      overallVerificationStatus = 'Manual Verification Required';
    } else if (res.verificationStatus === 'Warning' && overallVerificationStatus === 'Valid') {
      overallVerificationStatus = 'Warning';
    }
  });

  return {
    grandTotalTurnover,
    grandTotalPresumptiveProfit,
    grandTotalActualProfit,
    grandTotalBusinessLoss,
    netBusinessProfit,
    businessResults,
    overallVerificationStatus,
    overallWarnings,
  };
}

/**
 * Calculates Capital Account & Balance Sheet verification
 */
export function calculateCapitalAccount(
  bs: Partial<BalanceSheetDetails>,
  netProfit: number = 0
): {
  openingCapital: number;
  capitalIntroduced: number;
  netProfitAdded: number;
  otherAdditions: number;
  drawings: number;
  taxPaidFromCapital: number;
  closingCapital: number;
  isOpeningCapitalMissing: boolean;
} {
  const isOpeningCapitalMissing = bs.openingCapital === undefined || bs.openingCapital === null;
  const opCap = Math.max(0, bs.openingCapital || 0);
  const intro = Math.max(0, bs.capitalIntroduced || 0);
  const profit = bs.netProfitAdded !== undefined ? Number(bs.netProfitAdded) : netProfit;
  const additions = Math.max(0, bs.otherAdditions || 0);
  const draw = Math.max(0, bs.drawings || 0);
  const taxPaid = Math.max(0, bs.taxPaidFromCapital || 0);

  const closingCapital = (bs.closingCapital !== undefined && bs.closingCapital !== null && bs.closingCapital > 0)
    ? bs.closingCapital
    : Math.max(0, opCap + intro + profit + additions - draw - taxPaid);

  return {
    openingCapital: opCap,
    capitalIntroduced: intro,
    netProfitAdded: profit,
    otherAdditions: additions,
    drawings: draw,
    taxPaidFromCapital: taxPaid,
    closingCapital,
    isOpeningCapitalMissing,
  };
}

/**
 * Full Balance Sheet Audit & Discrepancy Calculator
 */
export function auditBalanceSheet(
  bs?: Partial<BalanceSheetDetails>,
  netProfit: number = 0
): {
  totalLiabilities: number;
  totalAssets: number;
  difference: number;
  isTallied: boolean;
  proposedCapitalAdjustment: number;
  cashInHandProvided: boolean;
  bankBalanceProvided: boolean;
  status: 'Tallied' | 'Discrepancy Detected' | 'Manual Verification Required';
  warnings: string[];
} {
  const current = bs || {};
  const warnings: string[] = [];

  const cap = calculateCapitalAccount(current, netProfit);
  const closingCapital = cap.closingCapital;
  const secLoans = Math.max(0, current.securedLoans || 0);
  const unsecLoans = Math.max(0, current.unsecuredLoans || 0);
  const creditors = Math.max(0, current.sundryCreditors || 0);
  const otherLiab = Math.max(0, current.otherCurrentLiabilities || 0);

  const totalLiabilities = closingCapital + secLoans + unsecLoans + creditors + otherLiab;

  const netFixed = Math.max(0, current.netFixedAssets || (
    Math.max(0, (current.grossFixedAssets || 0) - (current.depreciation || 0))
  ));
  const investments = Math.max(0, current.investments || 0);
  const stock = Math.max(0, current.closingStock || 0);
  const debtors = Math.max(0, current.sundryDebtors || 0);
  const cash = Math.max(0, current.cashInHand || 0);
  const bank = Math.max(0, current.bankBalances || 0);
  const loansAdv = Math.max(0, current.loansAndAdvances || 0);

  const totalAssets = netFixed + investments + stock + debtors + cash + bank + loansAdv;
  const difference = totalLiabilities - totalAssets;
  const isTallied = Math.abs(difference) === 0;

  const cashInHandProvided = current.cashInHand !== undefined && current.cashInHand !== null;
  const bankBalanceProvided = current.bankBalances !== undefined && current.bankBalances !== null;

  if (!cashInHandProvided && !bankBalanceProvided && current.enabled) {
    warnings.push('Cash in hand and Bank Balance not explicitly provided. Zero values should not be assumed without practitioner confirmation.');
  }

  if (cap.isOpeningCapitalMissing && current.enabled) {
    warnings.push('Opening Capital not provided. Verification required.');
  }

  if (!isTallied) {
    warnings.push(`Balance Sheet discrepancy of ₹${Math.abs(difference).toLocaleString('en-IN')}: Total Liabilities (₹${totalLiabilities.toLocaleString('en-IN')}) != Total Assets (₹${totalAssets.toLocaleString('en-IN')}).`);
  }

  return {
    totalLiabilities,
    totalAssets,
    difference,
    isTallied,
    proposedCapitalAdjustment: -difference,
    cashInHandProvided,
    bankBalanceProvided,
    status: isTallied ? 'Tallied' : 'Discrepancy Detected',
    warnings,
  };
}
