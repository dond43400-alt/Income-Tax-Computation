export type Language = 'en' | 'pa' | 'hi';

export type TaxRegime = 'new' | 'old';

export type ITRFormType = 'ITR-1 (Sahaj)' | 'ITR-2' | 'ITR-3' | 'ITR-4 (Sugam)' | 'ITR-5' | 'ITR-6' | 'ITR-7';

export type FilingSection = 
  | '139(1) - On or before due date'
  | '139(4) - Belated return'
  | '139(5) - Revised return'
  | '139(8A) - Updated return (ITR-U)'
  | '142(1) - In response to notice'
  | '148 - Reassessment notice';

export interface FirmDetails {
  firmName: string;
  practitionerName: string;
  designation: string; // e.g. 'Tax Consultant', 'Chartered Accountant', 'Tax Return Preparer (TRP)', 'Advocate'
  registrationNo: string;
  phone: string;
  email: string;
  address: string;
  tagline: string;
}

export interface ClientBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType?: 'Savings' | 'Current' | 'Cash Credit / OD' | 'NRE / NRO' | 'Post Office' | string;
  isRefundNominated?: boolean;
  validationStatus?: string; // e.g. 'VALIDATED & ELECTED' | 'VALIDATED'
}

export interface ClientProfile {
  pan: string;
  name: string;
  tradeName?: string; // e.g. M/s Kaur Traders / Dashmesh Auto Works
  fatherName?: string;
  dob?: string;
  dateOfBirth?: string;
  age?: number;
  ageCategory?: 'Below 60' | 'Senior Citizen' | 'Super Senior Citizen';
  gender?: 'Male' | 'Female' | 'Other' | 'Senior Citizen' | 'Super Senior Citizen';
  aadhaar?: string;
  aadhaarNumber?: string;
  mobile?: string;
  email?: string;
  address?: string;
  pincode?: string;
  state?: string;
  district?: string;
  tehsil?: string;
  status: 'Individual' | 'HUF' | 'Firm' | 'LLP' | 'Company';
  residentialStatus: 'Resident' | 'Non-Resident' | 'Resident but Not Ordinarily Resident';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  bankAccounts?: ClientBankAccount[]; // Multi bank accounts list
  validationStatus?: string; // e.g. 'VALIDATED & ELECTED' | 'VALIDATED'
  placeOfFiling?: string; // e.g. 'LOHIAN KHAS', 'JALANDHAR'
  // Statutory Disclosure Flags for ITR Form Eligibility
  isDirector?: boolean; // Directorship in Indian/foreign company
  directorDetails?: { companyName?: string; din?: string; pan?: string };
  hasUnlistedShares?: boolean; // Held unlisted equity shares at any time during FY
  unlistedSharesDetails?: { companyName?: string; pan?: string; openingShares?: number; closingShares?: number };
  hasForeignAssets?: boolean; // Foreign bank account, shares, property, signing authority, foreign income
  foreignAssetsDetails?: { hasBankAccounts?: boolean; hasShares?: boolean; hasProperty?: boolean; hasIncome?: boolean; foreignIncomeAmount?: number };
  hasBroughtForwardLosses?: boolean; // Brought forward / carried forward losses
  broughtForwardLossDetails?: { hpLoss?: number; businessLoss?: number; stcl?: number; ltcl?: number; otherLoss?: number };
  goodsCarriageCount?: number; // Section 44AE vehicles count (max 10)
  isPartnerInFirm?: boolean;
  userOverrideITR?: boolean;
  userOverrideReason?: string;
}

export type ClientDetails = ClientProfile;

export interface SalaryEntry {
  id: string;
  employerName: string;
  employerTAN?: string;
  employerPAN?: string;
  employerAddress?: string;
  employerType?: 'Central Govt' | 'State Govt' | 'PSU' | 'Private' | 'Pensioners' | 'Other';
  natureOfEmployment?: string;
  
  // Employment Period
  fromDate?: string; // YYYY-MM-DD or DD-MM-YYYY
  toDate?: string;   // YYYY-MM-DD or DD-MM-YYYY
  
  // Components u/s 17
  grossSalary: number;
  basicSalary?: number;
  dearnessAllowance?: number;
  hra?: number;
  otherAllowances?: number;
  bonus?: number;
  commission?: number;
  arrears?: number; // Salary Arrears
  salaryArrears?: number; // Alias for Salary Arrears
  arrearsRelatingFY?: string; // e.g. "2023-24"
  arrearsFinancialYear?: string; // Alias for arrearsRelatingFY
  sec89Eligible?: boolean; // Section 89 relief indicator
  sec89VerificationStatus?: 'Verified' | 'Manual Verification Required';
  
  salarySection17_1?: number; // Salary u/s 17(1)
  perquisites17_2?: number;   // Value of perquisites u/s 17(2)
  perquisiteDetails?: string; // Description e.g. Accommodation / Car
  perquisitesDetails?: string; // Alias description
  profitsInLieu17_3?: number; // Profits in lieu of salary u/s 17(3)
  
  // Exemptions u/s 10 (HRA, LTA, Gratuity, Leave Encashment, etc.)
  allowancesExempt: number;
  exemptionsBreakdown?: Array<{ section: string; description: string; amount: number }>;
  
  // Deductions u/s 16
  entertainmentAllowance?: number; // u/s 16(ii) (Govt employees only)
  professionalTax: number;         // u/s 16(iii)
  
  // Net / Taxable salary for this employer BEFORE taxpayer-level Standard Deduction
  taxableSalaryBeforeStdDed?: number;
  
  // TDS u/s 192 from this employer
  tdsSalary: number;
  
  // Form 16 / Source Tracking
  sourceDocument?: string;
  sourceType?: 'Form 16' | '26AS' | 'AIS' | 'Manual' | 'Payslip';
  confidence?: number;
  verificationStatus?: 'Verified' | 'Manual Verification Required' | 'Warning: Overlap' | 'Duplicate';
  notes?: string;
  isCollapsed?: boolean;
}

export interface SalaryDetails {
  grossSalary: number; // Aggregate Gross Salary
  salarySection17_1?: number; // Aggregate Salary as per section 17(1)
  perquisites17_2?: number;   // Aggregate Value of perquisites u/s 17(2)
  profitsInLieu17_3?: number; // Aggregate Profits in lieu of salary u/s 17(3)
  employerName?: string;
  employerTAN?: string;
  employerType?: string; // Central Govt / State Govt / PSU / Private / Pensioners / Other
  allowancesExempt: number; // Aggregate Allowances Exempt u/s 10
  standardDeduction: number; // Applied ONCE at taxpayer level
  entertainmentAllowance: number;
  professionalTax: number; // Aggregate Professional Tax
  netSalary: number; // Final Chargeable Income under Salaries
  
  // Multiple Employer Support
  salaryList?: SalaryEntry[];
  salaryArrears?: number;
  hasOverlappingPeriods?: boolean;
  overlapWarning?: string;
  pensionDetails?: { isPensioner?: boolean; pensionType?: string; pensionAmount?: number };
}

export interface HousePropertyDetails {
  grossRentReceived: number;
  municipalTaxes: number;
  annualValue: number;
  standardDeduction30: number; // 30% of Net Annual Value
  homeLoanInterest24b: number; // Up to 2,00,000 in Old Regime
  netHousePropertyIncome: number;
}

export interface BusinessExpenseItem {
  id: string;
  category: 
    | 'Rent'
    | 'Electricity'
    | 'Salary/Wages'
    | 'Professional Fees'
    | 'Telephone/Internet'
    | 'Repairs & Maintenance'
    | 'Vehicle Expenses'
    | 'Depreciation'
    | 'Interest'
    | 'Bank Charges'
    | 'Insurance'
    | 'Freight & Transport'
    | 'Printing & Stationery'
    | 'Advertising & Marketing'
    | 'Personal / Household Drawings (Non-Business)'
    | 'Other allowable expenses';
  amount: number;
  description?: string;
  source?: string;
  isPotentiallyPersonal?: boolean;
  verificationStatus?: 'Verified' | 'Manual Verification Required' | 'Warning: Non-Business Expense';
}

export interface DepreciationAssetItem {
  id: string;
  assetName: string;
  purchaseDate?: string;
  openingWDV: number;
  additions: number;
  deletions: number;
  rate: number; // e.g. 15 for Plant & Machinery, 10 for Furniture, 40 for Computers, 30 for Commercial Vehicles
  depreciation: number;
  closingWDV: number;
}

export interface GoodsCarriage44AEItem {
  id: string;
  vehicleNumber?: string;
  vehicleType: 'Heavy Goods Vehicle' | 'Other than Heavy Goods Vehicle';
  grossVehicleWeightTons?: number; // For Heavy Goods Vehicle (> 12 MT)
  vehicleOwnership: 'Owned' | 'Leased' | 'Hired';
  monthsHeld: number; // 1 to 12
  presumptiveRatePerMonth: number; // ₹1,000 per ton/month for HGV; ₹7,500/month for non-HGV
  presumptiveIncome: number;
}

export interface DairyBusinessDetails {
  milkSales: number;
  otherDairyReceipts: number;
  feedExpense: number;
  labourExpense: number;
  veterinaryExpense: number;
  transportExpense: number;
  otherExpenses: number;
  totalExpenses: number;
  netDairyProfit: number;
}

export interface GSTParticulars {
  gstin?: string;
  taxableSales?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGST?: number;
}

export interface RegularBooksDetails {
  grossSales?: number;
  otherBusinessIncome?: number;
  openingStock?: number;
  purchases?: number;
  directLabour?: number;
  freightAndCarriage?: number;
  closingStock?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  expenses?: BusinessExpenseItem[];
  totalIndirectExpenses?: number;
  depreciationAssets?: DepreciationAssetItem[];
  totalDepreciation?: number;
  netProfitOrLoss?: number; // Can be negative for loss
}

export interface BusinessItem {
  id: string;
  businessName: string; // Trade Name e.g. 'M/s Kaur Boutique & Tailoring'
  tradeName?: string;
  natureOfBusiness?: string; // e.g. 'Boutique / Stitching of Clothes & Tailoring'
  businessCode?: string; // e.g. '21008'
  businessType?: 'Trading/Retail' | 'Manufacturing' | 'Profession/Services' | 'Dairy' | 'Transport 44AE' | 'Other';
  businessDescription?: string; // e.g. 'Retail tailoring, cloth stitching and boutique work'
  businessAddress?: string; // Full address of business premises
  presumptiveSection?: '44AD (8%/6%/Other)' | '44AD (8%/6%)' | '44ADA (50%)' | '44AE' | 'Normal Books (P&L)' | string;
  
  // Section 44AD / Turnover Breakdown
  turnoverDigital6: number;
  profitDigital6: number;
  turnoverCash8: number;
  profitCash8: number;
  turnoverOtherMode?: number;
  profitOtherMode?: number;
  otherModePercent?: number;
  otherModeDescription?: string;
  
  // Receipts Breakdown
  grossReceipts?: number;
  cashReceipts?: number;
  digitalReceipts?: number;
  otherReceipts?: number;
  cashReceiptPercentage?: number;

  // Presumptive vs Actual calculations
  totalTurnover: number;
  presumptiveDigitalProfit?: number;
  presumptiveCashProfit?: number;
  presumptiveOtherProfit?: number;
  totalPresumptiveProfit?: number;
  actualProfit?: number;
  businessLoss?: number;
  isLoss?: boolean;
  netProfit: number; // Can be negative in regular books

  // Specialized Modules per business
  regularBooks?: RegularBooksDetails;
  dairyDetails?: DairyBusinessDetails;
  carriages44AE?: GoodsCarriage44AEItem[];
  gstParticulars?: GSTParticulars;

  // Statutory Disclosures / Balance Sheet per business
  closingStock?: number;
  debtors?: number;
  creditors?: number;
  cashInHand?: number;
  bankBalance?: number;
  proprietorCapital?: number;

  // Validation Flags
  verificationStatus?: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  verificationWarnings?: string[];
  turnoverRequired?: boolean;
  businessCodeRequired?: boolean;
}

export interface BusinessProfessionDetails {
  businessName?: string; // e.g. M/s Kaur Traders / Punjab Agro Tech
  tradeName?: string;
  natureOfBusiness: string;
  businessCode?: string; // e.g. '21008 - Boutique / Stitching of Clothes'
  businessType?: 'Trading/Retail' | 'Manufacturing' | 'Profession/Services' | 'Dairy' | 'Transport 44AE' | 'Other';
  businessDescription?: string;
  businessAddress?: string;
  turnoverOrGrossReceipts: number;
  presumptiveSection: '44AD (8%/6%/Other)' | '44AD (8%/6%)' | '44ADA (50%)' | '44AE' | 'Any Other Mode' | 'Normal Books (P&L)' | string;
  
  // Section 44AD Specific 6%, 8% and Any Other Mode columns
  turnoverDigital6?: number;  // Bank / Digital / Online Turnover (eligible for min 6% profit)
  profitDigital6?: number;    // Profit on 6% turnover
  turnoverCash8?: number;      // Cash Turnover (eligible for min 8% profit)
  profitCash8?: number;        // Profit on 8% turnover
  turnoverOtherMode?: number;  // Any Other Mode Turnover (e.g. Clearing, Cheque, Special Rate, Mixed)
  profitOtherMode?: number;    // Profit on Any Other Mode turnover
  otherModePercent?: number;   // Configurable % for Any Other Mode (e.g., 10%, 12%, 15%)
  otherModeDescription?: string; // Description for Any Other Mode (e.g. "Cheque / Special Clearing")
  
  // Receipts & Verification
  cashReceipts?: number;
  digitalReceipts?: number;
  otherReceipts?: number;
  cashReceiptPercentage?: number;

  // Net Profit & Loss
  netProfit: number;
  isLoss?: boolean;
  businessLoss?: number;
  broughtForwardBusinessLoss?: number;
  unabsorbedDepreciation?: number;
  
  // Specialized & Multi-business
  businessList?: BusinessItem[]; // Multiple businesses list
  regularBooks?: RegularBooksDetails;
  dairyDetails?: DairyBusinessDetails;
  carriages44AE?: GoodsCarriage44AEItem[];
  gstParticulars?: GSTParticulars;

  // Disclosures & Validation
  verificationStatus?: 'Valid' | 'Manual Verification Required' | 'Warning' | 'Error';
  verificationWarnings?: string[];
}

export interface CapitalGainsDetails {
  // Short Term Capital Gains
  stcg111A?: number; // Section 111A (STCG on equity shares/equity oriented units subject to STT @ 20% in AY 2026-27 / 15% pre-Budget 2024)
  stcg15?: number;    // Backward compatibility for 111A
  stcgNormal?: number; // Other STCG taxable at applicable slab rates
  stclSetOff?: number; // Short term capital loss set off

  // Long Term Capital Gains
  ltcg112A?: number;  // Section 112A (LTCG on listed equity/MF exceeding ₹1.25L threshold @ 12.5% in AY 2026-27)
  ltcg10?: number;    // Backward compatibility for 112A
  ltcg112?: number;   // Section 112 (LTCG on unlisted shares, immovable property, etc. @ 12.5% without indexation / 20% with indexation)
  ltcg20?: number;    // Backward compatibility for 112
  ltclSetOff?: number; // Long term capital loss set off

  // Loss carried forward & details
  currentYearSTCL?: number; // Current year Short Term Capital Loss
  currentYearLTCL?: number; // Current year Long Term Capital Loss
  broughtForwardSTCL?: number; // Brought forward STCL
  broughtForwardLTCL?: number; // Brought forward LTCL
  carriedForwardSTCL?: number; // Carried forward STCL
  carriedForwardLTCL?: number; // Carried forward LTCL

  netCapitalGains: number; // Net aggregate capital gains after intra-head loss set-off
}

export interface AgriculturalIncomeDetails {
  grossAgriculturalReceipts: number; // Gross J-Form sale / crop receipts / produce (ਕੁੱਲ ਵਿਕਰੀ / ਜੇ-ਫਾਰਮ)
  agriculturalExpenses: number;     // Expenses on seeds, fertilizers, tractor diesel, labour, lease (ਖੇਤੀਬਾੜੀ ਖਰਚੇ)
  netAgriculturalIncome: number;    // Net agricultural income exempt u/s 10(1) (ਸ਼ੁੱਧ ਆਮਦਨ)
}

export interface BankInterestItem {
  id: string;
  bankName: string; // e.g. 'Capital Small Finance Bank - A/c 052200002279', 'HDFC Bank', 'State Bank of India'
  accountNumber?: string;
  interestType: 'Savings' | 'Fixed Deposit (FD)' | 'Recurring Deposit (RD)' | 'Post Office' | 'Other Interest';
  amount: number;
}

export type OtherIncomeCategory = 
  | 'Commission / Agency' 
  | 'Brokerage' 
  | 'Director Sitting Fees / Remuneration' 
  | 'Royalty / Honorarium / Freelance' 
  | 'Plant & Machinery Hire (Sec 56(2)(ii))' 
  | 'Agricultural Land Rent / Lease' 
  | 'Gift exceeding ₹50,000 u/s 56(2)(x)' 
  | 'Examination Remuneration' 
  | 'Any Other Miscellaneous Income';

export interface OtherIncomeItem {
  id: string;
  category: OtherIncomeCategory | string;
  description: string;
  grossAmount: number;
  deductionSec57: number; // Deductions u/s 57 (Expenses wholly & exclusively incurred)
  netAmount: number;
}

export interface OtherSourcesDetails {
  // 1. INTEREST INCOMES (Portal Schedule OS - Row 1a)
  savingsInterest: number; // (i) Interest from Savings Bank Accounts
  savingsBankName?: string;
  fdInterest: number;      // (ii) Interest from Term Deposits / FD
  fdBankName?: string;
  rdInterest?: number;      // (ii) Interest from Recurring Deposits / RD
  rdBankName?: string;
  bankName?: string;
  bankInterestItems?: BankInterestItem[]; // Multiple bank interest entries
  itRefundInterest?: number; // (iii) Interest on Income Tax Refund u/s 244A
  passThroughInterest?: number; // (iv) Pass through interest income (Sec 115UA, 115UB)
  otherInterestIncome?: number; // (v) Any other interest income

  // 2. DIVIDEND INCOME (Portal Schedule OS - Row 1b)
  dividendIncome: number;
  indianCompanyDividend?: number;
  mutualFundDividend?: number;

  // 3. FAMILY PENSION (Portal Schedule OS - Row 1c)
  familyPension: number; // Gross Family Pension
  familyPensionDeduction?: number; // Deduction u/s 57(iia) (1/3rd or max ₹15k / ₹25k)
  netFamilyPension?: number;

  // 4. RENTAL FROM MACHINERY, PLANT, FURNITURE (Portal Schedule OS - Row 1d)
  machineryHireGross?: number;
  machineryHireExpenses?: number; // Depreciation & expenses u/s 57(ii)
  netMachineryHire?: number;

  // 5. SPECIAL RATE WINNINGS & UNEXPLAINED INCOME (Portal Schedule OS - Row 2)
  lotteryWinnings?: number;     // Sec 115BB: Lotteries, crossword puzzles, betting (30%)
  onlineGamesWinnings?: number; // Sec 115BBJ: Net winnings from online games (30%)
  horseRacesWinnings?: number;  // Sec 115BB: Horse races (30%)
  unexplainedIncome115BBE?: number; // Sec 115BBE: Unexplained money / credit u/s 68/69 (60%)
  totalSpecialRateIncome?: number;

  // 6. ANY OTHER INCOMES & DEDUCTIONS U/S 57 (Portal Schedule OS - Row 1e & Row 3)
  otherIncome: number;
  anyOtherIncome?: number;
  anyOtherIncomeDescription?: string;
  anyOtherIncomeExpenses?: number; // u/s 57
  otherIncomeItems?: OtherIncomeItem[]; // Itemized list for portal sync

  // 7. AGRICULTURAL INCOME (Portal Schedule OS / EI - Exempt u/s 10(1))
  agriculturalIncome?: number;
  agriculturalDetails?: AgriculturalIncomeDetails;

  // Net Total Chargeable under Head "Income from Other Sources"
  netOtherSources: number;
}

export interface ChapterVIA_Deductions {
  sec80C: number; // PPF, EPF, ELSS, LIC, Tuition, Principal (Max 1.5L)
  sec80CCC: number;
  sec80CCD1B: number; // NPS additional (Max 50,000)
  sec80CCD2: number; // Employer NPS
  sec80D: number; // Health Insurance (Self & Parents)
  sec80DD: number; // Handicapped Dependent
  sec80DDB: number; // Medical Treatment
  sec80E: number; // Education Loan Interest
  sec80EEA: number; // Affordable Housing Interest
  sec80G: number; // Donations (50%/100%)
  sec80GG: number; // House Rent Paid
  sec80TTA: number; // Savings Interest (Max 10,000)
  sec80TTB: number; // Senior Citizen Interest (Max 50,000)
  sec80U: number; // Person with Disability
  otherDeductions: number;
  totalDeductions: number;
}

export interface BalanceSheetDetails {
  enabled?: boolean; // Whether balance sheet is activated/included
  asOnDate?: string; // e.g. '31-Mar-2025' or '31st March 2025'
  showInPrint?: boolean; // Whether to show/print in computation sheet & PDF
  
  // --- LIABILITIES & CAPITAL (ਸਰੋਤ ਅਤੇ ਪੂੰਜੀ ਦੇਣਦਾਰੀਆਂ) ---
  // 1. Capital Account (ਪੂੰਜੀ ਖਾਤਾ)
  openingCapital?: number;
  capitalIntroduced?: number; // Fresh Capital added during year (ਨਵੀਂ ਪੂੰਜੀ)
  netProfitAdded?: number;    // Business Net Profit added (ਮੁਨਾਫ਼ਾ)
  otherAdditions?: number;    // Remuneration / Interest on Capital
  drawings?: number;          // Personal / Household drawings (ਘਰੇਲੂ ਖਰਚੇ)
  taxPaidFromCapital?: number;// Advance tax / Self assessment tax withdrawn
  closingCapital: number;     // Capital A/c Balance as on 31st March (ਪੂੰਜੀ ਖਾਤਾ)
  capitalAccountDetails?: string; // Optional description/notes for Capital Account

  // 2. Loans & Liabilities
  securedLoans?: number;      // Bank CC Limit, Term Loan, Vehicle Loan (ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ)
  securedLoansDetails?: string;
  unsecuredLoans?: number;    // From Friends, Relatives, Directors, Private (ਗੈਰ-ਸੁਰੱਖਿਅਤ ਕਰਜ਼ਾ)
  unsecuredLoansDetails?: string;
  sundryCreditors: number;    // Trade Creditors for Goods / Materials (ਵਪਾਰਕ ਲੈਣਦਾਰ - ITR-4 Mandatory)
  sundryCreditorsDetails?: string;
  otherCurrentLiabilities?: number; // Expenses payable, GST payable, Advances (ਹੋਰ ਦੇਣਦਾਰੀਆਂ)
  otherLiabilitiesDetails?: string;
  totalLiabilities: number;   // Total Capital + Loans + Creditors + Liabilities

  // --- ASSETS & APPLICATION OF FUNDS (ਸੰਪਤੀਆਂ ਅਤੇ ਨਕਦੀ) ---
  // 1. Fixed Assets (ਸਥਿਰ ਸੰਪਤੀਆਂ)
  grossFixedAssets?: number;
  depreciation?: number;
  netFixedAssets?: number;    // WDV of Plant, Machinery, Shop, Furniture, Vehicles
  fixedAssetsDetails?: string;

  // 2. Investments (ਨਿਵੇਸ਼)
  investments?: number;       // Shares, Mutual Funds, FDR, Gold, Property
  investmentsDetails?: string;

  // 3. Current Assets (ਚੱਲ ਸੰਪਤੀਆਂ)
  closingStock: number;       // Stock-in-trade / Inventories (ਕਲੋਜ਼ਿੰਗ ਸਟਾਕ - ITR-4 Mandatory)
  sundryDebtors: number;      // Trade Debtors / Customer Receivables (ਵਪਾਰਕ ਦੇਣਦਾਰ - ITR-4 Mandatory)
  sundryDebtorsDetails?: string;
  cashInHand: number;         // Cash in hand as on 31st March (ਨਕਦ ਬਕਾਇਆ - ITR-4 Mandatory)
  bankBalances: number;       // Balances with Scheduled Banks (ਬੈਂਕ ਬੈਲੇਂਸ - ITR-4 Mandatory)
  bankBalancesDetails?: string;
  loansAndAdvances?: number;  // Security deposits, advance to suppliers, GST/TDS input
  loansAndAdvancesDetails?: string;
  totalAssets: number;        // Total Net Fixed Assets + Investments + Current Assets

  notes?: string;
}

export interface TaxesPaidDetails {
  tdsSalary: number; // 192
  tdsOther: number; // 194A, 194C, 194J, etc.
  tcs: number; // 206C
  advanceTax: number;
  selfAssessmentTax: number; // 140A
  challanDetails?: Array<{
    bsrCode: string;
    challanNo: string;
    date: string;
    amount: number;
  }>;
  totalTaxesPaid: number;
}

export interface TaxComputation {
  id: string;
  createdAt: string;
  updatedAt: string;
  assessmentYear: string; // e.g. '2025-26', '2024-25'
  financialYear: string; // e.g. '2024-25', '2023-24'
  itrForm: ITRFormType;
  filingSection: FilingSection;
  filingDate?: string;
  acknowledgementNumber?: string;
  regimeOpted: TaxRegime;
  
  // Client info
  client: ClientProfile;
  
  // Income Heads
  salary: SalaryDetails;
  houseProperty: HousePropertyDetails;
  business: BusinessProfessionDetails;
  capitalGains: CapitalGainsDetails;
  otherSources: OtherSourcesDetails;
  
  // Totals & Exempt Income
  agriculturalIncome?: number; // Agricultural income exempt u/s 10(1) (Net)
  agriculturalDetails?: AgriculturalIncomeDetails; // Detailed Gross, Expenses & Net
  grossTotalIncome: number;
  deductions: ChapterVIA_Deductions;
  totalTaxableIncome: number; // Rounded u/s 288A
  
  // Tax Calculations
  taxOnNormalIncome: number;
  taxOnSpecialIncome: number;
  totalTaxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  healthAndEducationCess: number; // 4%
  grossTaxLiability: number;
  slabBreakdown?: Array<{ slab: string; rate: string; taxableInSlab: number; tax: number }>;
  specialRateBreakdown?: Array<{ section: string; description: string; rate: string; income: number; tax: number }>;
  marginalRelief87A?: number;
  marginalReliefSurcharge?: number;
  
  // Relief & Interest
  relief89: number;
  interest234A: number;
  interest234B: number;
  interest234C: number;
  fee234F: number; // Late filing fee
  totalTaxAndInterest: number;
  
  // Taxes Paid
  taxesPaid: TaxesPaidDetails;
  
  // Final Outcome
  netTaxPayable: number;
  refundDue: number;
  
  // Financial Particulars / Schedule Balance Sheet (as on 31st March)
  balanceSheet?: BalanceSheetDetails;

  // Metadata & Remarks
  sourcePdfName?: string;
  sourceTracking?: Record<string, { source: string; document: string; confidence: number; verified?: boolean }>;
  eligibilityResult?: ITREligibilityResult;
  userOverrideITR?: boolean;
  userOverrideReason?: string;
  notes?: string;
  isTableProtected?: boolean;
  verifiedStatus?: boolean;
  verificationPlace?: string;
  status: 'Draft' | 'Filed' | 'Verified' | 'Refund Received' | 'Demand Notice';
}

export type ValidationSeverity = 'GREEN' | 'YELLOW' | 'RED';

export interface ITREligibilityFieldCheck {
  status: 'PASS' | 'WARN' | 'FAIL' | 'INFO_REQUIRED';
  rule: string;
  message: string;
  details?: Record<string, any>;
}

export interface ITREligibilityResult {
  eligible: boolean;
  selectedITR: ITRFormType;
  recommendedITR: ITRFormType;
  status: ValidationSeverity;
  reasons: string[];
  warnings: string[];
  requiredAction: string[];
  rulesEvaluated: string[];
  auditTimestamp: string;
  userOverride?: {
    overridden: boolean;
    reason?: string;
  };
  fieldChecks?: {
    panStatus: ITREligibilityFieldCheck;
    residentialStatus: ITREligibilityFieldCheck;
    incomeLimit: ITREligibilityFieldCheck;
    businessIncome: ITREligibilityFieldCheck;
    turnoverCheck: ITREligibilityFieldCheck;
    capitalGains: ITREligibilityFieldCheck;
    foreignAssets: ITREligibilityFieldCheck;
    agriculturalIncome: ITREligibilityFieldCheck;
    directorshipOrUnlisted: ITREligibilityFieldCheck;
    broughtForwardLosses: ITREligibilityFieldCheck;
    specialRateIncome: ITREligibilityFieldCheck;
  };
}

export type ExtractionSourceType = 
  | 'ITR JSON'
  | 'Form 16'
  | 'Form 16A'
  | 'AIS / TIS'
  | 'Form 26AS'
  | 'Bank Statement'
  | 'Supporting Document'
  | 'OCR'
  | 'Manual Entry';

export type ExtractionCategory = 
  | 'Personal'
  | 'Salary'
  | 'House Property'
  | 'Business'
  | 'Capital Gains'
  | 'Other Sources'
  | 'Agricultural'
  | 'Deductions'
  | 'Taxes Paid'
  | 'Bank Details';

export interface ExtractedFieldItem<T = any> {
  id: string;
  field: string;
  key: string;
  category: ExtractionCategory;
  value: T | null;
  originalRawValue?: string;
  source: ExtractionSourceType | null;
  sourceDocument: string;
  confidence: number; // 0 to 100
  detected: boolean;
  verified: boolean;
  reviewRequired: boolean;
  status: 'Detected' | 'Not Detected' | 'Conflict' | 'Possible Duplicate' | 'Low Confidence' | 'Verified';
  suggestedIncomeHead?: string;
  sectionCode?: string;
  userAction?: 'accept' | 'edit' | 'reject' | 'ignore';
  editedValue?: any;
  conflictWith?: {
    source: ExtractionSourceType;
    sourceDocument: string;
    value: any;
  };
}

export interface ExtractedDocumentConflict {
  field: string;
  sourceA: string;
  docA: string;
  valA: any;
  sourceB: string;
  docB: string;
  valB: any;
  message: string;
}

export interface ExtractedDocumentDuplicate {
  field: string;
  section?: string;
  sources: string[];
  documents: string[];
  amount: number;
  message: string;
}

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Credit' | 'Debit';
  category: 'Income' | 'Transfer' | 'Loan' | 'Capital Introduction' | 'Refund' | 'Reversal' | 'Other' | 'Unknown';
  suggestedHead?: string;
  userClassification?: string;
  confidence: number;
  reviewRequired: boolean;
}

export interface ExtractedPdfResult {
  id?: string;
  fileName: string;
  fileSize: number;
  extractedText: string;
  detectedDocType: 'ITR-V (Acknowledgement)' | 'Form 16' | 'Form 26AS' | 'AIS / TIS' | 'ITR JSON' | 'Bank Statement' | 'Computation Sheet' | 'Generic Tax Document';
  isScannedOrImageOnly?: boolean;
  isPasswordProtected?: boolean;
  isCorruptedOrUnreadable?: boolean;
  errorMessage?: string;
  confidence: number;
  extractedFields: ExtractedFieldItem[];
  parsedComputation: Partial<TaxComputation>;
  rawFields: Record<string, string>;
  conflicts?: ExtractedDocumentConflict[];
  duplicates?: ExtractedDocumentDuplicate[];
  bankTransactions?: BankTransactionItem[];
}
