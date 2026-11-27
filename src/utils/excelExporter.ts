import * as XLSX from 'xlsx';
import { TaxComputation } from '../types';

export function exportSingleComputationToExcel(comp: TaxComputation): void {
  const wb = XLSX.utils.book_new();

  // 1. Client & Summary Sheet
  const summaryData = [
    ['INCOME TAX COMPUTATION SHEET'],
    ['Assessment Year', comp.assessmentYear, 'Financial Year', comp.financialYear],
    ['Client Name', comp.client.name, 'PAN', comp.client.pan],
    ['Address', comp.client.address || 'N/A'],
    ['Status', comp.client.status, 'Residential Status', comp.client.residentialStatus],
    ['ITR Form', comp.itrForm, 'Regime Opted', comp.regimeOpted === 'new' ? 'New (115BAC)' : 'Old'],
    ['Filing Date', comp.filingDate || 'N/A', 'Ack Number', comp.acknowledgementNumber || 'N/A'],
    ['Bank Name', comp.client.bankName || 'N/A', 'A/c No', comp.client.accountNumber || 'N/A'],
    ['IFSC Code', comp.client.ifscCode || 'N/A', 'Mobile', comp.client.mobile || 'N/A'],
    ['Date of Birth', comp.client.dob || 'N/A', 'Email', comp.client.email || 'N/A'],
    [],
    ['PARTICULARS OF INCOME & DEDUCTIONS', 'AMOUNT (INR)'],
    ...(comp.salary.salaryList && comp.salary.salaryList.length > 1
      ? [
          [`1. Income from Salaries (${comp.salary.salaryList.length} Employers)`, comp.salary.netSalary],
          ...comp.salary.salaryList.flatMap((e, i) => [
            [`   [Employer ${i + 1}] ${e.employerName || 'Employer'}${e.employerTAN ? ` (TAN: ${e.employerTAN})` : ''}`, ''],
            [`       Gross Salary u/s 17(1)`, e.grossSalary],
            ...(e.allowancesExempt ? [[`       Less: Exemptions u/s 10`, e.allowancesExempt]] : []),
            ...(e.professionalTax ? [[`       Less: Professional Tax`, e.professionalTax]] : []),
            ...(e.tdsSalary ? [[`       TDS Deducted u/s 192`, e.tdsSalary]] : []),
          ]),
          ['   --- Aggregated Salary ---', ''],
          ['   Total Gross Salary', comp.salary.grossSalary],
          ['   Less: Total Exemptions u/s 10', comp.salary.allowancesExempt || 0],
          ['   Less: Standard Deduction u/s 16(ia) [Applied ONCE]', comp.salary.standardDeduction],
          ['   Less: Total Professional Tax', comp.salary.professionalTax || 0],
          ['   Net Chargeable Salary', comp.salary.netSalary],
        ]
      : [
          ['1. Gross Salary', comp.salary.grossSalary],
          ['   Less: Standard Deduction u/s 16(ia)', comp.salary.standardDeduction],
          ['   Less: Professional Tax', comp.salary.professionalTax || 0],
          ['   Net Salary Income', comp.salary.netSalary],
        ]
    ),
    ['2. Income / (Loss) from House Property', comp.houseProperty.netHousePropertyIncome],
    ['3. Profits from Business/Profession', comp.business.netProfit],
    ['   - Trade / Business Name', comp.business.businessName || comp.business.tradeName || 'N/A'],
    ['   - Business Code', comp.business.businessCode || 'N/A'],
    ['   - Nature of Business & Activity', comp.business.natureOfBusiness || comp.business.businessDescription || 'N/A'],
    ['   - Business Address', comp.business.businessAddress || 'N/A'],
    ['   - Section Scheme', comp.business.presumptiveSection || '44AD'],
    ['   - Electronic/Digital Turnover (6%)', comp.business.turnoverDigital6 || 0],
    ['   - Profit from 6% Turnover', comp.business.profitDigital6 || 0],
    ['   - Cash Turnover (8%)', comp.business.turnoverCash8 || 0],
    ['   - Profit from 8% Turnover', comp.business.profitCash8 || 0],
    ['   - Any Other Mode Turnover', comp.business.turnoverOtherMode || 0],
    ['   - Profit from Other Mode', comp.business.profitOtherMode || 0],
    ['   - Total Business Turnover (Electronic+Cash+Other)', (comp.business.turnoverDigital6 || 0) + (comp.business.turnoverCash8 || 0) + (comp.business.turnoverOtherMode || 0) || comp.business.turnoverOrGrossReceipts || 0],
    ['4. Capital Gains', comp.capitalGains.netCapitalGains],
    ['5. Income from Other Sources', comp.otherSources.netOtherSources],
    ['6. Agricultural Income (Exempt u/s 10(1))', comp.agriculturalIncome || comp.agriculturalDetails?.netAgriculturalIncome || comp.otherSources?.agriculturalIncome || 0],
    ['   - Gross Agri Receipts (J-Form Sale)', comp.agriculturalDetails?.grossAgriculturalReceipts || 0],
    ['   - Agri Expenses (Cultivation Costs)', comp.agriculturalDetails?.agriculturalExpenses || 0],
    ['   - Net Agri Income', comp.agriculturalIncome || comp.agriculturalDetails?.netAgriculturalIncome || 0],
    ['GROSS TOTAL INCOME (GTI)', comp.grossTotalIncome],
    ['Less: Chapter VI-A Deductions', comp.deductions.totalDeductions],
    ['   - Section 80C', comp.deductions.sec80C],
    ['   - Section 80CCD(1B)', comp.deductions.sec80CCD1B],
    ['   - Section 80D', comp.deductions.sec80D],
    ['   - Section 80TTA / 80TTB', comp.deductions.sec80TTA || comp.deductions.sec80TTB],
    ['TOTAL TAXABLE INCOME (Rounded u/s 288A)', comp.totalTaxableIncome],
    [],
    ['TAX COMPUTATION', 'AMOUNT (INR)'],
    ['Tax on Total Income', comp.taxOnNormalIncome],
    ['Less: Rebate u/s 87A', comp.rebate87A],
    ['Tax after Rebate', comp.taxAfterRebate],
    ['Add: 4% Health & Education Cess', comp.healthAndEducationCess],
    ['Gross Tax Liability', comp.grossTaxLiability],
    ['Add: Interest u/s 234A/B/C/F', (comp.interest234A || 0) + (comp.interest234B || 0) + (comp.interest234C || 0) + (comp.fee234F || 0)],
    ['TOTAL TAX & INTEREST', comp.totalTaxAndInterest],
    [],
    ['TAXES PAID (PREPAID CREDITS)', 'AMOUNT (INR)'],
    ['TDS on Salary', comp.taxesPaid.tdsSalary],
    ['TDS Other than Salary', comp.taxesPaid.tdsOther],
    ['TCS', comp.taxesPaid.tcs],
    ['Advance Tax Paid', comp.taxesPaid.advanceTax],
    ['Self Assessment Tax Paid', comp.taxesPaid.selfAssessmentTax],
    ['TOTAL TAXES PAID', comp.taxesPaid.totalTaxesPaid],
    [],
    ['FINAL STATUS', comp.refundDue > 0 ? 'REFUND DUE' : comp.netTaxPayable > 0 ? 'TAX PAYABLE' : 'NIL'],
    ['REFUND AMOUNT', comp.refundDue],
    ['NET TAX PAYABLE', comp.netTaxPayable],
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, 'Computation');

  // 2. Balance Sheet Sheet (if enabled)
  if (comp.balanceSheet && comp.balanceSheet.enabled !== false) {
    const bs = comp.balanceSheet;
    const bsData = [
      ['STATEMENT OF FINANCIAL PARTICULARS (BALANCE SHEET)'],
      ['Assessee Name', comp.client.name, 'PAN', comp.client.pan],
      ['Assessment Year', comp.assessmentYear, 'As on Date', bs.asOnDate || '31st March 2026'],
      [],
      ['CAPITAL & LIABILITIES', 'AMOUNT (INR)', 'PROPERTY & ASSETS', 'AMOUNT (INR)'],
      ['CAPITAL A/C (Proprietor Capital)', bs.closingCapital, 'Gross Fixed Assets', bs.grossFixedAssets || 0],
      ['Secured Loans', bs.securedLoans || 0, 'Less: Depreciation for the Year', bs.depreciation || 0],
      ['Unsecured Loans', bs.unsecuredLoans || 0, 'Net Fixed Assets (WDV)', bs.netFixedAssets || 0],
      ['Sundry Creditors (Trade Payables)', bs.sundryCreditors || 0, 'Investments', bs.investments || 0],
      ['Other Current Liabilities', bs.otherCurrentLiabilities || 0, 'Closing Stock / Inventories', bs.closingStock || 0],
      ['', '', 'Sundry Debtors (Receivables)', bs.sundryDebtors || 0],
      ['', '', 'Cash in Hand (as on 31st March)', bs.cashInHand || 0],
      ['', '', 'Bank Balances (Savings/Current/FD)', bs.bankBalances || 0],
      ['', '', 'Loans, Advances & Deposits', bs.loansAndAdvances || 0],
      [],
      ['TOTAL LIABILITIES & CAPITAL', bs.totalLiabilities, 'TOTAL PROPERTY & ASSETS', bs.totalAssets],
      ['Balance Status', (bs.totalLiabilities - bs.totalAssets === 0) ? 'PERFECTLY BALANCED (TALLIED)' : `DIFFERENCE: INR ${bs.totalLiabilities - bs.totalAssets}`]
    ];
    const wsBs = XLSX.utils.aoa_to_sheet(bsData);
    XLSX.utils.book_append_sheet(wb, wsBs, 'Balance_Sheet');
  }

  const safeName = comp.client.name.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(wb, `Computation_${comp.client.pan}_${comp.assessmentYear}_${safeName}.xlsx`);
}

export function exportClientListToExcel(computations: TaxComputation[]): void {
  const rows = computations.map((c, i) => ({
    'Sr No': i + 1,
    'Client Name': c.client.name,
    'PAN': c.client.pan,
    'A.Y.': c.assessmentYear,
    'F.Y.': c.financialYear,
    'ITR Form': c.itrForm,
    'Regime': c.regimeOpted === 'new' ? 'New (115BAC)' : 'Old',
    'Gross Total Income': c.grossTotalIncome,
    'Business Digital Turnover (6%)': c.business.turnoverDigital6 || 0,
    'Business Cash Turnover (8%)': c.business.turnoverCash8 || 0,
    'Total Business Profit': c.business.netProfit || 0,
    'Gross Agri Receipts (J-Form)': c.agriculturalDetails?.grossAgriculturalReceipts || 0,
    'Agri Expenses': c.agriculturalDetails?.agriculturalExpenses || 0,
    'Net Agricultural Income (Exempt)': c.agriculturalIncome || c.agriculturalDetails?.netAgriculturalIncome || c.otherSources?.agriculturalIncome || 0,
    'Total Deductions': c.deductions.totalDeductions,
    'Taxable Income': c.totalTaxableIncome,
    'Gross Tax Liability': c.grossTaxLiability,
    'Total Taxes Paid (TDS/Adv/SAT)': c.taxesPaid.totalTaxesPaid,
    'Refund Due': c.refundDue,
    'Net Tax Payable': c.netTaxPayable,
    'Status': c.status,
    'Ack Number': c.acknowledgementNumber || '',
    'Filing Date': c.filingDate || '',
    'Mobile': c.client.mobile || '',
    'Bank A/c': c.client.accountNumber || '',
    'IFSC': c.client.ifscCode || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Client ITR Register');
  XLSX.writeFile(wb, `ITR_Clients_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
}
