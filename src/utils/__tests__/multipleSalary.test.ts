import { 
  calculateAllSalaries, 
  checkEmploymentPeriodOverlap, 
  detectDuplicateSalaryEntries,
  recalculateFullComputation,
  createEmptyComputation
} from '../taxCalculator';
import { SalaryEntry } from '../../types';

export interface TestCaseResult {
  testNumber: number;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  notes?: string;
}

export function runAllMultipleSalaryTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
} {
  const results: TestCaseResult[] = [];

  // TEST 1: Two employers, non-overlapping periods (New Regime AY 26-27)
  {
    const entries: SalaryEntry[] = [
      {
        id: 'emp_1',
        employerName: 'Alpha Tech Ltd',
        employerType: 'Private',
        employerTAN: 'PNEP12345A',
        fromDate: '2025-04-01',
        toDate: '2025-09-30',
        grossSalary: 400000,
        salarySection17_1: 400000,
        allowancesExempt: 0,
        professionalTax: 1200,
        tdsSalary: 5000,
        taxableSalaryBeforeStdDed: 400000,
      },
      {
        id: 'emp_2',
        employerName: 'Beta Solutions Inc',
        employerType: 'Private',
        employerTAN: 'MUMB67890B',
        fromDate: '2025-10-01',
        toDate: '2026-03-31',
        grossSalary: 600000,
        salarySection17_1: 600000,
        allowancesExempt: 0,
        professionalTax: 1200,
        tdsSalary: 15000,
        taxableSalaryBeforeStdDed: 600000,
      }
    ];

    const agg = calculateAllSalaries(entries, 'new', '2026-27');
    const overlap = checkEmploymentPeriodOverlap(entries);
    const passed = agg.grossSalary === 1000000 && 
                   agg.standardDeduction === 75000 && 
                   agg.professionalTax === 2400 && 
                   agg.totalTDSSalary === 20000 && 
                   agg.netSalary === 925000 &&
                   !overlap.hasOverlap;

    results.push({
      testNumber: 1,
      title: 'Two employers, non-overlapping periods (Gross ₹10L, Std Ded ₹75k, PT ₹2400, TDS ₹20k, Net ₹9.25L)',
      passed,
      expected: 'Gross: ₹10,00,000, Std Ded: ₹75,000, PT: ₹2,400, TDS: ₹20,000, Net: ₹9,25,000, Overlap: false',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Std Ded: ₹${agg.standardDeduction.toLocaleString('en-IN')}, PT: ₹${agg.professionalTax.toLocaleString('en-IN')}, TDS: ₹${agg.totalTDSSalary.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}, Overlap: ${overlap.hasOverlap}`,
    });
  }

  // TEST 2: Two employers, overlapping periods
  {
    const entries: SalaryEntry[] = [
      {
        id: 'emp_1',
        employerName: 'Company A',
        employerType: 'Private',
        fromDate: '2025-04-01',
        toDate: '2025-12-31',
        grossSalary: 500000,
        allowancesExempt: 0,
        professionalTax: 0,
        tdsSalary: 10000,
        taxableSalaryBeforeStdDed: 500000,
      },
      {
        id: 'emp_2',
        employerName: 'Company B',
        employerType: 'Private',
        fromDate: '2025-08-01',
        toDate: '2026-03-31',
        grossSalary: 500000,
        allowancesExempt: 0,
        professionalTax: 0,
        tdsSalary: 10000,
        taxableSalaryBeforeStdDed: 500000,
      }
    ];

    const agg = calculateAllSalaries(entries, 'new', '2026-27');
    const overlap = checkEmploymentPeriodOverlap(entries);
    const passed = agg.grossSalary === 1000000 && overlap.hasOverlap && overlap.overlappingPairs.length > 0;

    results.push({
      testNumber: 2,
      title: 'Two employers, overlapping periods (Gross ₹10L, Overlap detected correctly)',
      passed,
      expected: 'Gross: ₹10,00,000, Overlap: true',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Overlap: ${overlap.hasOverlap}`,
    });
  }

  // TEST 3: Three employers (₹3L + ₹4L + ₹5L = ₹12L)
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Org 1', grossSalary: 300000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 300000 },
      { id: '2', employerName: 'Org 2', grossSalary: 400000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 400000 },
      { id: '3', employerName: 'Org 3', grossSalary: 500000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 500000 },
    ];

    const agg = calculateAllSalaries(entries, 'new', '2026-27');
    const passed = agg.grossSalary === 1200000 && agg.standardDeduction === 75000 && agg.netSalary === 1125000;

    results.push({
      testNumber: 3,
      title: 'Three employers aggregation (₹3L + ₹4L + ₹5L = ₹12L Gross -> Net ₹11.25L)',
      passed,
      expected: 'Gross: ₹12,00,000, Std Ded: ₹75,000, Net: ₹11,25,000',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Std Ded: ₹${agg.standardDeduction.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 4: Single Employer (Old Regime with exemptions & PT)
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Single Org', grossSalary: 850000, allowancesExempt: 50000, professionalTax: 2400, tdsSalary: 25000, taxableSalaryBeforeStdDed: 797600 }
    ];

    const agg = calculateAllSalaries(entries, 'old', '2026-27');
    const expectedNet = 850000 - 50000 - 50000 - 2400; // 7,47,600
    const passed = agg.grossSalary === 850000 && agg.allowancesExempt === 50000 && agg.netSalary === expectedNet;

    results.push({
      testNumber: 4,
      title: 'Single employer backward compatibility under Old Regime (Gross ₹8.5L, Exempt ₹50k, Std Ded ₹50k, PT ₹2400 -> Net ₹7,47,600)',
      passed,
      expected: `Gross: ₹8,50,000, Net: ₹${expectedNet.toLocaleString('en-IN')}`,
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 5: Full computation integration with multiple salary entries
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
      salaryList: [
        { id: 'e1', employerName: 'Corp A', grossSalary: 600000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 12000, taxableSalaryBeforeStdDed: 600000 },
        { id: 'e2', employerName: 'Corp B', grossSalary: 600000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 18000, taxableSalaryBeforeStdDed: 600000 },
      ]
    };

    const recomputed = recalculateFullComputation(comp);
    const passed = recomputed.salary.grossSalary === 1200000 && 
                   recomputed.salary.netSalary === 1125000 && 
                   recomputed.taxesPaid.tdsSalary === 30000;

    results.push({
      testNumber: 5,
      title: 'Full computation integration (Gross ₹12L, Net ₹11.25L, TDS ₹30k synced to taxesPaid)',
      passed,
      expected: 'Gross: ₹12,00,000, Net: ₹11,25,000, TDS: ₹30,000',
      actual: `Gross: ₹${recomputed.salary.grossSalary.toLocaleString('en-IN')}, Net: ₹${recomputed.salary.netSalary.toLocaleString('en-IN')}, TDS: ₹${recomputed.taxesPaid.tdsSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 6: Delete an employer dynamically
  {
    const initialList: SalaryEntry[] = [
      { id: '1', employerName: 'Keep Me', grossSalary: 700000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 15000, taxableSalaryBeforeStdDed: 700000 },
      { id: '2', employerName: 'Delete Me', grossSalary: 300000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 5000, taxableSalaryBeforeStdDed: 300000 },
    ];
    const afterDelete = initialList.filter(e => e.id !== '2');
    const agg = calculateAllSalaries(afterDelete, 'new', '2026-27');
    const passed = agg.grossSalary === 700000 && agg.totalTDSSalary === 15000 && agg.netSalary === 625000;

    results.push({
      testNumber: 6,
      title: 'Dynamic employer deletion updates aggregation cleanly',
      passed,
      expected: 'Gross: ₹7,00,000, TDS: ₹15,000, Net: ₹6,25,000',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, TDS: ₹${agg.totalTDSSalary.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 7: Duplicate employer entry detection
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'TCS', employerTAN: 'MUMT12345A', fromDate: '2025-04-01', toDate: '2026-03-31', grossSalary: 600000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 600000 },
      { id: '2', employerName: 'TCS', employerTAN: 'MUMT12345A', fromDate: '2025-04-01', toDate: '2026-03-31', grossSalary: 600000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 600000 },
    ];
    const duplicates = detectDuplicateSalaryEntries(entries);
    const passed = duplicates.length > 0;

    results.push({
      testNumber: 7,
      title: 'Duplicate employer detection by TAN/Dates/Amount',
      passed,
      expected: 'Duplicates flagged: true',
      actual: `Duplicates flagged: ${duplicates.length > 0} (${duplicates[0] || ''})`,
    });
  }

  // TEST 8: Old Regime Standard Deduction cap (₹50,000 max across all employers)
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Firm 1', grossSalary: 400000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 400000 },
      { id: '2', employerName: 'Firm 2', grossSalary: 400000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 400000 },
    ];
    const agg = calculateAllSalaries(entries, 'old', '2026-27');
    const passed = agg.grossSalary === 800000 && agg.standardDeduction === 50000 && agg.netSalary === 750000;

    results.push({
      testNumber: 8,
      title: 'Old Regime Standard Deduction cap strictly ₹50,000 once',
      passed,
      expected: 'Gross: ₹8,00,000, Std Ded: ₹50,000, Net: ₹7,50,000',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Std Ded: ₹${agg.standardDeduction.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 9: Salary Arrears reporting
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Regular Job', grossSalary: 800000, salarySection17_1: 800000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 800000 },
      { id: '2', employerName: 'Previous Employer', grossSalary: 150000, salaryArrears: 150000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 10000, taxableSalaryBeforeStdDed: 150000 },
    ];
    const agg = calculateAllSalaries(entries, 'new', '2026-27');
    const passed = agg.grossSalary === 950000 && agg.salaryArrears === 150000 && agg.netSalary === (950000 - 75000);

    results.push({
      testNumber: 9,
      title: 'Salary Arrears aggregation without polluting other income heads',
      passed,
      expected: 'Gross: ₹9,50,000, Arrears: ₹1,50,000, Net: ₹8,75,000',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Arrears: ₹${agg.salaryArrears.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 10: Differing Employer Categories under Old Regime (State Govt + Private with PT deduction)
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Govt School', employerType: 'State Govt', grossSalary: 500000, allowancesExempt: 0, professionalTax: 2400, tdsSalary: 0, taxableSalaryBeforeStdDed: 497600 },
      { id: '2', employerName: 'Private Tuition Center', employerType: 'Private', grossSalary: 300000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 300000 },
    ];
    const agg = calculateAllSalaries(entries, 'old', '2026-27');
    const passed = agg.grossSalary === 800000 && agg.professionalTax === 2400 && agg.netSalary === (800000 - 50000 - 2400);

    results.push({
      testNumber: 10,
      title: 'Multiple employer types (State Govt + Private) aggregated properly with PT under Old Regime',
      passed,
      expected: 'Gross: ₹8,00,000, PT: ₹2,400, Net: ₹7,47,600',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, PT: ₹${agg.professionalTax.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 11: Low salary below standard deduction
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Part Time A', grossSalary: 25000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 25000 },
      { id: '2', employerName: 'Part Time B', grossSalary: 30000, allowancesExempt: 0, professionalTax: 0, tdsSalary: 0, taxableSalaryBeforeStdDed: 30000 },
    ];
    const agg = calculateAllSalaries(entries, 'new', '2026-27');
    // Total gross = 55,000. Std ded cannot exceed gross (capped at 55,000), net salary = 0.
    const passed = agg.grossSalary === 55000 && agg.standardDeduction === 55000 && agg.netSalary === 0;

    results.push({
      testNumber: 11,
      title: 'Standard Deduction cannot exceed Gross Salary (Capped at Gross)',
      passed,
      expected: 'Gross: ₹55,000, Std Ded: ₹55,000, Net: ₹0',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, Std Ded: ₹${agg.standardDeduction.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  // TEST 12: Professional Tax multiple employers deduction under Old Regime
  {
    const entries: SalaryEntry[] = [
      { id: '1', employerName: 'Job A', grossSalary: 500000, allowancesExempt: 0, professionalTax: 1200, tdsSalary: 0, taxableSalaryBeforeStdDed: 498800 },
      { id: '2', employerName: 'Job B', grossSalary: 500000, allowancesExempt: 0, professionalTax: 1300, tdsSalary: 0, taxableSalaryBeforeStdDed: 498700 },
    ];
    const agg = calculateAllSalaries(entries, 'old', '2026-27');
    const passed = agg.professionalTax === 2500 && agg.netSalary === (1000000 - 50000 - 2500);

    results.push({
      testNumber: 12,
      title: 'Professional Tax accumulated accurately across employers under Old Regime',
      passed,
      expected: 'Gross: ₹10,00,000, PT: ₹2,500, Net: ₹9,47,500',
      actual: `Gross: ₹${agg.grossSalary.toLocaleString('en-IN')}, PT: ₹${agg.professionalTax.toLocaleString('en-IN')}, Net: ₹${agg.netSalary.toLocaleString('en-IN')}`,
    });
  }

  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  };
}
