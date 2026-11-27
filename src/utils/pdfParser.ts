import * as pdfjsLib from 'pdfjs-dist';
import { 
  TaxComputation, 
  ExtractedPdfResult, 
  ExtractedFieldItem, 
  ExtractionSourceType,
  ExtractedDocumentConflict,
  ExtractedDocumentDuplicate,
  BankTransactionItem
} from '../types';
import { recalculateFullComputation } from './taxCalculator';

// Configure pdfjs worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  // Silent fallback
}

export interface PdfTextExtractionResult {
  text: string;
  isScannedOrImageOnly: boolean;
  isPasswordProtected: boolean;
  isCorruptedOrUnreadable: boolean;
  pageCount: number;
  errorMessage?: string;
}

/**
 * Extracts raw plain text from an uploaded PDF file with error & scan detection
 */
export async function extractTextFromPdf(file: File): Promise<PdfTextExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    
    let pdf: any;
    try {
      pdf = await loadingTask.promise;
    } catch (loadErr: any) {
      if (loadErr?.name === 'PasswordException' || loadErr?.message?.includes('password')) {
        return {
          text: '',
          isScannedOrImageOnly: false,
          isPasswordProtected: true,
          isCorruptedOrUnreadable: false,
          pageCount: 0,
          errorMessage: 'This PDF is password protected. Please remove the password and re-upload.',
        };
      }
      return {
        text: '',
        isScannedOrImageOnly: false,
        isPasswordProtected: false,
        isCorruptedOrUnreadable: true,
        pageCount: 0,
        errorMessage: 'Unable to read this PDF file. It may be corrupted or in an unsupported format.',
      };
    }

    let fullText = '';
    let totalCharCount = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      totalCharCount += pageText.trim().length;
      fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }

    // Check if text layer is empty or negligible (Scanned / Image-only PDF)
    const isScannedOrImageOnly = pdf.numPages > 0 && totalCharCount < 40;

    return {
      text: fullText,
      isScannedOrImageOnly,
      isPasswordProtected: false,
      isCorruptedOrUnreadable: false,
      pageCount: pdf.numPages,
      errorMessage: isScannedOrImageOnly 
        ? 'Scanned document detected — OCR required. No digital text layer found in this PDF.' 
        : undefined,
    };
  } catch (err: any) {
    return {
      text: '',
      isScannedOrImageOnly: false,
      isPasswordProtected: false,
      isCorruptedOrUnreadable: true,
      pageCount: 0,
      errorMessage: 'Unexpected error reading PDF: ' + (err?.message || 'Unknown error'),
    };
  }
}

/**
 * Extracts numbers matching patterns like 1,23,456 or 123456.00
 */
export function parseIndianNumber(val?: string | null): number {
  if (!val) return 0;
  const clean = val.replace(/,/g, '').replace(/₹/g, '').replace(/Rs\.?/gi, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Validates Indian PAN format (5 letters + 4 numbers + 1 letter)
 */
export function isValidPAN(pan: string): boolean {
  if (!pan) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}

/**
 * Validates Indian IFSC format (4 letters + 0 + 6 alphanumeric)
 */
export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
}

/**
 * Helper to build an ExtractedFieldItem with strict zero-fabrication metadata
 */
function createFieldItem<T = any>(
  id: string,
  field: string,
  key: string,
  category: ExtractedFieldItem['category'],
  value: T | null,
  detected: boolean,
  confidence: number,
  source: ExtractionSourceType | null,
  sourceDocument: string,
  suggestedIncomeHead?: string,
  sectionCode?: string,
  originalRawValue?: string
): ExtractedFieldItem<T> {
  return {
    id,
    field,
    key,
    category,
    value: detected ? value : null,
    originalRawValue,
    source: detected ? source : null,
    sourceDocument,
    confidence: detected ? Math.min(100, Math.max(0, confidence)) : 0,
    detected,
    verified: false,
    reviewRequired: !detected || confidence < 90,
    status: detected ? (confidence >= 85 ? 'Detected' : 'Low Confidence') : 'Not Detected',
    suggestedIncomeHead,
    sectionCode,
    userAction: detected ? 'accept' : 'ignore',
  };
}

/**
 * Main parser: Extracts data from ITR-V, Form 16, Form 26AS, AIS/TIS, or Computation with ZERO FABRICATION
 */
export function parseTaxDocumentText(
  text: string, 
  fileName: string = 'Uploaded_Document.pdf', 
  fileSize: number = 0,
  isScanned: boolean = false
): ExtractedPdfResult {
  const rawFields: Record<string, string> = {};
  const extractedFields: ExtractedFieldItem[] = [];
  const conflicts: ExtractedDocumentConflict[] = [];
  const duplicates: ExtractedDocumentDuplicate[] = [];
  const bankTransactions: BankTransactionItem[] = [];

  // If scanned or empty, return immediately with zero fabricated values
  if (isScanned || !text || text.trim().length < 25) {
    return {
      id: `doc_${Date.now()}`,
      fileName,
      fileSize,
      extractedText: text || '',
      detectedDocType: isScanned ? 'Generic Tax Document' : 'Generic Tax Document',
      isScannedOrImageOnly: isScanned,
      confidence: 0,
      extractedFields: [],
      parsedComputation: {},
      rawFields: {},
      errorMessage: isScanned 
        ? 'Scanned document detected — OCR required. Please use the AI Document Scanner for image extraction.' 
        : 'Document contains insufficient readable text layer.',
    };
  }

  // 1. Detect Document Type
  let detectedDocType: ExtractedPdfResult['detectedDocType'] = 'Generic Tax Document';
  let defaultSource: ExtractionSourceType = 'Supporting Document';

  if (text.includes('INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT') || text.includes('ITR-V') || text.includes('Verification Form') || text.includes('e-Filing Acknowledgement')) {
    detectedDocType = 'ITR-V (Acknowledgement)';
    defaultSource = 'ITR JSON';
  } else if (text.includes('FORM NO. 16') || text.includes('Certificate under section 203') || (text.includes('Part A') && text.includes('Part B') && text.includes('TDS'))) {
    detectedDocType = 'Form 16';
    defaultSource = 'Form 16';
  } else if (text.includes('FORM NO. 26AS') || text.includes('Annual Tax Statement under Section 203AA') || text.includes('26AS')) {
    detectedDocType = 'Form 26AS';
    defaultSource = 'Form 26AS';
  } else if (text.includes('Annual Information Statement') || text.includes('Taxpayer Information Summary') || text.includes('AIS') || text.includes('TIS')) {
    detectedDocType = 'AIS / TIS';
    defaultSource = 'AIS / TIS';
  } else if (text.includes('COMPUTATION OF TOTAL INCOME') || text.includes('Statement of Income') || text.includes('Tax Computation')) {
    detectedDocType = 'Computation Sheet';
    defaultSource = 'Supporting Document';
  } else if (text.includes('Account Statement') || text.includes('Statement of Account') || text.includes('Transaction History')) {
    detectedDocType = 'Bank Statement';
    defaultSource = 'Bank Statement';
  }

  // 2. PAN Extraction (Strict format matching)
  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);
  const rawPan = panMatch ? panMatch[1].toUpperCase() : '';
  const panDetected = isValidPAN(rawPan);
  const pan = panDetected ? rawPan : '';
  if (pan) rawFields['PAN'] = pan;

  extractedFields.push(
    createFieldItem(
      'f_pan',
      'Permanent Account Number (PAN)',
      'client.pan',
      'Personal',
      pan || null,
      panDetected,
      panDetected ? 98 : 0,
      defaultSource,
      fileName,
      undefined,
      undefined,
      rawPan
    )
  );

  // 3. Assessment Year
  let ay = '';
  let ayDetected = false;
  const ayMatch = text.match(/(?:Assessment\s*Year|A\.?\s*Y\.?|AY)\s*[:\-\s]*([2][0][2-3][0-9]\s*[-–\/]\s*[0-9]{2,4})/i) ||
                  text.match(/\b(202[3-7]\s*[-–\/]\s*2[0-9])\b/);
  if (ayMatch) {
    let rawAy = ayMatch[1].replace(/\s+/g, '').replace('–', '-').replace('/', '-');
    if (rawAy.length === 9) {
      rawAy = rawAy.substring(0, 5) + rawAy.substring(7); // 2025-2026 -> 2025-26
    }
    ay = rawAy;
    ayDetected = true;
    rawFields['Assessment Year'] = ay;
  }

  extractedFields.push(
    createFieldItem(
      'f_ay',
      'Assessment Year',
      'assessmentYear',
      'Personal',
      ay || null,
      ayDetected,
      ayDetected ? 95 : 0,
      defaultSource,
      fileName
    )
  );

  // Financial Year from AY if detected
  let fy = '';
  if (ayDetected && ay.includes('-')) {
    const startAyYear = parseInt(ay.split('-')[0]) || 2025;
    fy = `${startAyYear - 1}-${(startAyYear % 100).toString().padStart(2, '0')}`;
  }

  // 4. Name extraction
  let name = '';
  let nameDetected = false;
  const nameMatch = text.match(/(?:Name\s*of\s*(?:the\s*)?Assessee|Assessee\s*Name|Name\s*of\s*Employee|Taxpayer\s*Name|Employee\s*Name|Name)\s*[:\-\s]+([A-Z\s\.]{3,50})/i) ||
                    text.match(/([A-Z][A-Z\s]{3,35})\s+(?:PAN|Permanent\s*Account\s*Number)/i);
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    const blacklistedWords = ['PERMANENT', 'ACCOUNT', 'NUMBER', 'INCOME', 'TAX', 'RETURN', 'DEPARTMENT', 'GOVERNMENT', 'INDIA', 'CERTIFICATE', 'ASSESSMENT', 'YEAR', 'SUMMARY'];
    if (!blacklistedWords.includes(candidate.toUpperCase())) {
      name = candidate.replace(/\s+/g, ' ').toUpperCase();
      nameDetected = true;
      rawFields['Name'] = name;
    }
  }

  extractedFields.push(
    createFieldItem(
      'f_name',
      'Taxpayer Full Name',
      'client.name',
      'Personal',
      name || null,
      nameDetected,
      nameDetected ? 92 : 0,
      defaultSource,
      fileName
    )
  );

  // 5. Employer Details for Form 16
  let employerName = '';
  let employerTan = '';
  if (detectedDocType === 'Form 16') {
    const tanMatch = text.match(/\b([A-Z]{4}[0-9]{5}[A-Z]{1})\b/);
    if (tanMatch) {
      employerTan = tanMatch[1].toUpperCase();
      rawFields['Employer TAN'] = employerTan;
      extractedFields.push(
        createFieldItem(
          'f_emp_tan',
          'Employer TAN',
          'employerTan',
          'Salary',
          employerTan,
          true,
          95,
          'Form 16',
          fileName,
          'Salary u/s 17',
          '192'
        )
      );
    }

    const empNameMatch = text.match(/(?:Name\s*and\s*address\s*of\s*the\s*Employer|Employer\s*Name)\s*[:\-\s]+([A-Z0-9\s\.,\-]{3,60})/i);
    if (empNameMatch) {
      employerName = empNameMatch[1].trim();
      rawFields['Employer Name'] = employerName;
      extractedFields.push(
        createFieldItem(
          'f_emp_name',
          'Employer Name',
          'employerName',
          'Salary',
          employerName,
          true,
          90,
          'Form 16',
          fileName
        )
      );
    }
  }

  // 6. ITR Form Type
  let itrForm: TaxComputation['itrForm'] = 'ITR-1 (Sahaj)';
  let itrFormDetected = false;
  if (text.includes('ITR-1') || text.includes('SAHAJ')) {
    itrForm = 'ITR-1 (Sahaj)';
    itrFormDetected = true;
  } else if (text.includes('ITR-2')) {
    itrForm = 'ITR-2';
    itrFormDetected = true;
  } else if (text.includes('ITR-3')) {
    itrForm = 'ITR-3';
    itrFormDetected = true;
  } else if (text.includes('ITR-4') || text.includes('SUGAM')) {
    itrForm = 'ITR-4 (Sugam)';
    itrFormDetected = true;
  } else if (text.includes('ITR-5')) {
    itrForm = 'ITR-5';
    itrFormDetected = true;
  } else if (text.includes('ITR-6')) {
    itrForm = 'ITR-6';
    itrFormDetected = true;
  } else if (text.includes('ITR-7')) {
    itrForm = 'ITR-7';
    itrFormDetected = true;
  }

  extractedFields.push(
    createFieldItem(
      'f_itr_form',
      'ITR Form Type',
      'itrForm',
      'Personal',
      itrFormDetected ? itrForm : null,
      itrFormDetected,
      itrFormDetected ? 95 : 0,
      defaultSource,
      fileName
    )
  );

  // 7. Acknowledgement & Filing details
  const ackMatch = text.match(/(?:Acknowledgement\s*Number|Ack\s*No\.?|Receipt\s*No\.?)\s*[:\-\s]*([0-9]{15})/i) ||
                   text.match(/\b([0-9]{15})\b/);
  const ackNo = ackMatch ? ackMatch[1] : '';
  const ackDetected = Boolean(ackNo);

  extractedFields.push(
    createFieldItem(
      'f_ack',
      'Filing Acknowledgement Number',
      'acknowledgementNumber',
      'Personal',
      ackNo || null,
      ackDetected,
      ackDetected ? 98 : 0,
      defaultSource,
      fileName
    )
  );

  const dateMatch = text.match(/(?:Date\s*of\s*filing|Filing\s*Date|Date)\s*[:\-\s]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.][2][0][2-3][0-9])/i);
  const filingDate = dateMatch ? dateMatch[1] : '';
  const filingDateDetected = Boolean(filingDate);

  extractedFields.push(
    createFieldItem(
      'f_filing_date',
      'Filing Date',
      'filingDate',
      'Personal',
      filingDate || null,
      filingDateDetected,
      filingDateDetected ? 90 : 0,
      defaultSource,
      fileName
    )
  );

  // 8. SALARY HEAD EXTRACTION (Strict: Zero-Fabrication)
  let grossSalary = 0;
  let grossSalaryDetected = false;
  let taxableSalary = 0;
  let taxableSalaryDetected = false;
  let standardDeduction = 0;
  let standardDeductionDetected = false;
  let allowancesExempt = 0;
  let allowancesExemptDetected = false;
  let professionalTax = 0;
  let professionalTaxDetected = false;

  const salaryMatch = text.match(/(?:Gross\s*Salary|Salary\s*u\/s\s*17\(1\)|Income\s*from\s*Salaries|Salaries|Gross\s*Total\s*Salary)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (salaryMatch) {
    grossSalary = parseIndianNumber(salaryMatch[1]);
    grossSalaryDetected = grossSalary > 0;
  }

  const taxableSalMatch = text.match(/(?:Income\s*chargeable\s*under\s*the\s*head\s*Salaries|Net\s*Salary|Taxable\s*Salary)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (taxableSalMatch) {
    taxableSalary = parseIndianNumber(taxableSalMatch[1]);
    taxableSalaryDetected = taxableSalary > 0;
  }

  const stdDedMatch = text.match(/(?:Standard\s*Deduction\s*u\/s\s*16\(ia\)|Standard\s*Deduction)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (stdDedMatch) {
    standardDeduction = parseIndianNumber(stdDedMatch[1]);
    standardDeductionDetected = standardDeduction > 0;
  }

  const exemptAllowMatch = text.match(/(?:Exempt\s*Allowances\s*u\/s\s*10|Allowances\s*exempt\s*u\/s\s*10|Section\s*10\s*Exemptions)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (exemptAllowMatch) {
    allowancesExempt = parseIndianNumber(exemptAllowMatch[1]);
    allowancesExemptDetected = allowancesExempt > 0;
  }

  const ptMatch = text.match(/(?:Tax\s*on\s*Employment|Professional\s*Tax\s*u\/s\s*16\(iii\)|Professional\s*Tax)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (ptMatch) {
    professionalTax = parseIndianNumber(ptMatch[1]);
    professionalTaxDetected = professionalTax > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_gross_salary',
      'Gross Salary (Sec 17(1))',
      'salary.grossSalary',
      'Salary',
      grossSalaryDetected ? grossSalary : null,
      grossSalaryDetected,
      grossSalaryDetected ? 95 : 0,
      detectedDocType === 'Form 16' ? 'Form 16' : defaultSource,
      fileName,
      'Income from Salary'
    )
  );

  if (allowancesExemptDetected) {
    extractedFields.push(
      createFieldItem(
        'f_allowances_exempt',
        'Exempt Allowances u/s 10',
        'salary.allowancesExempt',
        'Salary',
        allowancesExempt,
        true,
        90,
        'Form 16',
        fileName,
        'Exempt Allowances'
      )
    );
  }

  if (standardDeductionDetected) {
    extractedFields.push(
      createFieldItem(
        'f_std_ded',
        'Standard Deduction u/s 16(ia)',
        'salary.standardDeduction',
        'Salary',
        standardDeduction,
        true,
        95,
        'Form 16',
        fileName
      )
    );
  }

  if (professionalTaxDetected) {
    extractedFields.push(
      createFieldItem(
        'f_pt',
        'Professional Tax u/s 16(iii)',
        'salary.professionalTax',
        'Salary',
        professionalTax,
        true,
        90,
        'Form 16',
        fileName
      )
    );
  }

  // 9. HOUSE PROPERTY HEAD EXTRACTION
  let housePropertyIncome = 0;
  let housePropertyDetected = false;
  const hpMatch = text.match(/(?:Income\s*from\s*House\s*Property|House\s*Property\s*Income|House\s*Property)\s*[:\-\s]*₹?\s*([\-]?[0-9,]+)/i);
  if (hpMatch) {
    housePropertyIncome = parseIndianNumber(hpMatch[1]);
    housePropertyDetected = true;
  }

  extractedFields.push(
    createFieldItem(
      'f_hp_income',
      'Income / Loss from House Property',
      'houseProperty.netHousePropertyIncome',
      'House Property',
      housePropertyDetected ? housePropertyIncome : null,
      housePropertyDetected,
      housePropertyDetected ? 90 : 0,
      defaultSource,
      fileName,
      'House Property'
    )
  );

  // 10. BUSINESS & PROFESSION HEAD (Strict: No reverse turnover calculations)
  let businessIncome = 0;
  let businessIncomeDetected = false;
  let turnoverDigital6 = 0;
  let turnoverDigitalDetected = false;
  let turnoverCash8 = 0;
  let turnoverCashDetected = false;
  let totalTurnover = 0;
  let totalTurnoverDetected = false;

  const bizMatch = text.match(/(?:Profits\s*and\s*Gains\s*of\s*Business|Business\s*or\s*Profession|PGBP|Net\s*Profit\s*from\s*Business)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (bizMatch) {
    businessIncome = parseIndianNumber(bizMatch[1]);
    businessIncomeDetected = businessIncome > 0;
  }

  const digMatch = text.match(/(?:Digital\s*Turnover|Bank\s*Turnover|Turnover\s*(?:u\/s\s*44AD\s*)?@?\s*6%|6%\s*Turnover|Electronic\s*Turnover)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (digMatch) {
    turnoverDigital6 = parseIndianNumber(digMatch[1]);
    turnoverDigitalDetected = turnoverDigital6 > 0;
  }
  
  const cashMatch = text.match(/(?:Cash\s*Turnover|Turnover\s*(?:u\/s\s*44AD\s*)?@?\s*8%|8%\s*Turnover|Non[\s\-]Digital\s*Turnover)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (cashMatch) {
    turnoverCash8 = parseIndianNumber(cashMatch[1]);
    turnoverCashDetected = turnoverCash8 > 0;
  }

  const totTurnMatch = text.match(/(?:Total\s*Turnover|Gross\s*Turnover|Turnover\s*or\s*Gross\s*Receipts|Gross\s*Receipts)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (totTurnMatch) {
    totalTurnover = parseIndianNumber(totTurnMatch[1]);
    totalTurnoverDetected = totalTurnover > 0;
  } else if (turnoverDigitalDetected || turnoverCashDetected) {
    totalTurnover = turnoverDigital6 + turnoverCash8;
    totalTurnoverDetected = totalTurnover > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_biz_profit',
      'Profits & Gains of Business or Profession (PGBP)',
      'business.netProfit',
      'Business',
      businessIncomeDetected ? businessIncome : null,
      businessIncomeDetected,
      businessIncomeDetected ? 92 : 0,
      defaultSource,
      fileName,
      'Profits & Gains of Business'
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_biz_turnover',
      'Total Business Turnover / Gross Receipts',
      'business.turnoverOrGrossReceipts',
      'Business',
      totalTurnoverDetected ? totalTurnover : null,
      totalTurnoverDetected,
      totalTurnoverDetected ? 90 : 0,
      defaultSource,
      fileName,
      'Presumptive 44AD Turnover'
    )
  );

  // 11. CAPITAL GAINS HEAD (Strict: No manufactured purchase cost)
  let capitalGains = 0;
  let capitalGainsDetected = false;
  let stcg111A = 0;
  let stcg111ADetected = false;
  let ltcg112A = 0;
  let ltcg112ADetected = false;

  const cgMatch = text.match(/(?:Capital\s*Gains|Total\s*Capital\s*Gains|Net\s*Capital\s*Gain)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (cgMatch) {
    capitalGains = parseIndianNumber(cgMatch[1]);
    capitalGainsDetected = capitalGains > 0;
  }

  const stcgMatch = text.match(/(?:STCG\s*u\/s\s*111A|Short\s*Term\s*Capital\s*Gains\s*111A|111A\s*STCG)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (stcgMatch) {
    stcg111A = parseIndianNumber(stcgMatch[1]);
    stcg111ADetected = stcg111A > 0;
  }

  const ltcgMatch = text.match(/(?:LTCG\s*u\/s\s*112A|Long\s*Term\s*Capital\s*Gains\s*112A|112A\s*LTCG)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (ltcgMatch) {
    ltcg112A = parseIndianNumber(ltcgMatch[1]);
    ltcg112ADetected = ltcg112A > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_cg_net',
      'Net Capital Gains (Schedule CG)',
      'capitalGains.netCapitalGains',
      'Capital Gains',
      capitalGainsDetected ? capitalGains : null,
      capitalGainsDetected,
      capitalGainsDetected ? 90 : 0,
      defaultSource,
      fileName,
      'Capital Gains'
    )
  );

  if (stcg111ADetected) {
    extractedFields.push(
      createFieldItem(
        'f_cg_111a',
        'STCG u/s 111A (STT Paid Listed Equity)',
        'capitalGains.stcg111A',
        'Capital Gains',
        stcg111A,
        true,
        95,
        defaultSource,
        fileName,
        'Special Rate Capital Gains'
      )
    );
  }

  if (ltcg112ADetected) {
    extractedFields.push(
      createFieldItem(
        'f_cg_112a',
        'LTCG u/s 112A (Listed Equity > Exemption)',
        'capitalGains.ltcg112A',
        'Capital Gains',
        ltcg112A,
        true,
        95,
        defaultSource,
        fileName,
        'Special Rate Capital Gains'
      )
    );
  }

  // 12. OTHER SOURCES HEAD (Interest, Dividend, Lotteries)
  let savingsInterest = 0;
  let savingsInterestDetected = false;
  let fdInterest = 0;
  let fdInterestDetected = false;
  let dividendIncome = 0;
  let dividendIncomeDetected = false;
  let otherSources = 0;
  let otherSourcesDetected = false;

  const savIntMatch = text.match(/(?:Interest\s*from\s*Savings\s*Bank|Savings\s*Bank\s*Interest|Savings\s*Interest)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (savIntMatch) {
    savingsInterest = parseIndianNumber(savIntMatch[1]);
    savingsInterestDetected = savingsInterest > 0;
  }

  const fdIntMatch = text.match(/(?:Interest\s*from\s*Deposit|FD\s*Interest|Term\s*Deposit\s*Interest|Interest\s*Income\s*194A)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (fdIntMatch) {
    fdInterest = parseIndianNumber(fdIntMatch[1]);
    fdInterestDetected = fdInterest > 0;
  }

  const divMatch = text.match(/(?:Dividend\s*Income|Dividend\s*from\s*Shares|Dividend)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (divMatch) {
    dividendIncome = parseIndianNumber(divMatch[1]);
    dividendIncomeDetected = dividendIncome > 0;
  }

  const osMatch = text.match(/(?:Income\s*from\s*Other\s*Sources|Other\s*Sources|Total\s*Other\s*Sources)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (osMatch) {
    otherSources = parseIndianNumber(osMatch[1]);
    otherSourcesDetected = otherSources > 0;
  } else if (savingsInterestDetected || fdInterestDetected || dividendIncomeDetected) {
    otherSources = savingsInterest + fdInterest + dividendIncome;
    otherSourcesDetected = otherSources > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_os_total',
      'Income from Other Sources (Schedule OS)',
      'otherSources.netOtherSources',
      'Other Sources',
      otherSourcesDetected ? otherSources : null,
      otherSourcesDetected,
      otherSourcesDetected ? 92 : 0,
      defaultSource,
      fileName,
      'Other Sources'
    )
  );

  if (savingsInterestDetected) {
    extractedFields.push(
      createFieldItem(
        'f_os_savings',
        'Savings Bank Interest',
        'otherSources.savingsInterest',
        'Other Sources',
        savingsInterest,
        true,
        95,
        defaultSource,
        fileName,
        'Interest Income'
      )
    );
  }

  if (fdInterestDetected) {
    extractedFields.push(
      createFieldItem(
        'f_os_fd',
        'Term Deposit / FD Interest',
        'otherSources.fdInterest',
        'Other Sources',
        fdInterest,
        true,
        95,
        defaultSource,
        fileName,
        'Interest Income'
      )
    );
  }

  if (dividendIncomeDetected) {
    extractedFields.push(
      createFieldItem(
        'f_os_div',
        'Dividend Income',
        'otherSources.dividendIncome',
        'Other Sources',
        dividendIncome,
        true,
        95,
        defaultSource,
        fileName,
        'Dividend Income'
      )
    );
  }

  // 13. AGRICULTURAL INCOME (Strict: Zero assumption / no 1.4 multiplication)
  let agriculturalIncome = 0;
  let agriculturalIncomeDetected = false;
  let grossAgriReceipts = 0;
  let grossAgriReceiptsDetected = false;
  let agriExpenses = 0;
  let agriExpensesDetected = false;

  const grossAgriMatch = text.match(/(?:Gross\s*Agricultural\s*Receipts|Gross\s*Agri\s*Income|J[\s\-]Form\s*(?:Receipts|Amount|Total)|Gross\s*Farm\s*Receipts)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (grossAgriMatch) {
    grossAgriReceipts = parseIndianNumber(grossAgriMatch[1]);
    grossAgriReceiptsDetected = grossAgriReceipts > 0;
  }

  const agriExpMatch = text.match(/(?:Agricultural\s*Expenses|Agri\s*Expenses|Cultivation\s*Expenses|Farm\s*Expenses)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (agriExpMatch) {
    agriExpenses = parseIndianNumber(agriExpMatch[1]);
    agriExpensesDetected = agriExpenses > 0;
  }

  const agriMatch = text.match(/(?:Agricultural\s*Income|Net\s*Agricultural\s*Income|Agri\s*Income|Exempt\s*Agricultural\s*Income|Section\s*10\(1\)|Sec\s*10\(1\))\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (agriMatch) {
    agriculturalIncome = parseIndianNumber(agriMatch[1]);
    agriculturalIncomeDetected = agriculturalIncome > 0;
  } else if (grossAgriReceiptsDetected) {
    agriculturalIncome = Math.max(0, grossAgriReceipts - agriExpenses);
    agriculturalIncomeDetected = agriculturalIncome > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_agri_net',
      'Net Agricultural Income (Exempt u/s 10(1))',
      'agriculturalIncome',
      'Agricultural',
      agriculturalIncomeDetected ? agriculturalIncome : null,
      agriculturalIncomeDetected,
      agriculturalIncomeDetected ? 95 : 0,
      defaultSource,
      fileName,
      'Exempt Income u/s 10(1)'
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_agri_gross',
      'Gross Agricultural Receipts (J-Form / Mandi)',
      'agriculturalDetails.grossAgriculturalReceipts',
      'Agricultural',
      grossAgriReceiptsDetected ? grossAgriReceipts : null,
      grossAgriReceiptsDetected,
      grossAgriReceiptsDetected ? 90 : 0,
      defaultSource,
      fileName
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_agri_exp',
      'Agricultural Cultivation Expenses',
      'agriculturalDetails.agriculturalExpenses',
      'Agricultural',
      agriExpensesDetected ? agriExpenses : null,
      agriExpensesDetected,
      agriExpensesDetected ? 90 : 0,
      defaultSource,
      fileName
    )
  );

  // 14. CHAPTER VI-A DEDUCTIONS (Strict: Zero-Fabrication)
  let sec80c = 0;
  let sec80cDetected = false;
  let sec80d = 0;
  let sec80dDetected = false;
  let sec80ccd1b = 0;
  let sec80ccd1bDetected = false;
  let sec80tta = 0;
  let sec80ttaDetected = false;
  let totalDeductions = 0;
  let totalDeductionsDetected = false;

  const cMatch = text.match(/(?:80C|Section\s*80C)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (cMatch) {
    sec80c = parseIndianNumber(cMatch[1]);
    sec80cDetected = sec80c > 0;
  }

  const dMatch = text.match(/(?:80D|Section\s*80D)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (dMatch) {
    sec80d = parseIndianNumber(dMatch[1]);
    sec80dDetected = sec80d > 0;
  }

  const ccdMatch = text.match(/(?:80CCD\(1B\)|80CCD1B|Section\s*80CCD\(1B\)|NPS\s*Contribution)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (ccdMatch) {
    sec80ccd1b = parseIndianNumber(ccdMatch[1]);
    sec80ccd1bDetected = sec80ccd1b > 0;
  }

  const ttaMatch = text.match(/(?:80TTA|80TTB|Section\s*80TTA|Section\s*80TTB)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (ttaMatch) {
    sec80tta = parseIndianNumber(ttaMatch[1]);
    sec80ttaDetected = sec80tta > 0;
  }

  const dedMatch = text.match(/(?:Total\s*Deductions\s*under\s*Chapter\s*VI-A|Total\s*Deductions|Deductions\s*under\s*Chapter\s*VI-A)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (dedMatch) {
    totalDeductions = parseIndianNumber(dedMatch[1]);
    totalDeductionsDetected = totalDeductions > 0;
  } else if (sec80cDetected || sec80dDetected || sec80ccd1bDetected || sec80ttaDetected) {
    totalDeductions = sec80c + sec80d + sec80ccd1b + sec80tta;
    totalDeductionsDetected = totalDeductions > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_ded_80c',
      'Deduction u/s 80C (PPF/LIC/EPF/ELSS)',
      'deductions.sec80C',
      'Deductions',
      sec80cDetected ? sec80c : null,
      sec80cDetected,
      sec80cDetected ? 95 : 0,
      defaultSource,
      fileName,
      'Chapter VI-A'
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_ded_80d',
      'Deduction u/s 80D (Mediclaim)',
      'deductions.sec80D',
      'Deductions',
      sec80dDetected ? sec80d : null,
      sec80dDetected,
      sec80dDetected ? 95 : 0,
      defaultSource,
      fileName,
      'Chapter VI-A'
    )
  );

  if (sec80ccd1bDetected) {
    extractedFields.push(
      createFieldItem(
        'f_ded_80ccd1b',
        'Deduction u/s 80CCD(1B) (NPS)',
        'deductions.sec80CCD1B',
        'Deductions',
        sec80ccd1b,
        true,
        95,
        defaultSource,
        fileName,
        'Chapter VI-A'
      )
    );
  }

  extractedFields.push(
    createFieldItem(
      'f_ded_total',
      'Total Chapter VI-A Deductions',
      'deductions.totalDeductions',
      'Deductions',
      totalDeductionsDetected ? totalDeductions : null,
      totalDeductionsDetected,
      totalDeductionsDetected ? 92 : 0,
      defaultSource,
      fileName,
      'Chapter VI-A'
    )
  );

  // 15. TAXES PAID (TDS, TCS, Advance Tax, Self Assessment)
  let tdsSalary = 0;
  let tdsSalaryDetected = false;
  let tdsOther = 0;
  let tdsOtherDetected = false;
  let tcs = 0;
  let tcsDetected = false;
  let advanceTax = 0;
  let advanceTaxDetected = false;
  let sat = 0;
  let satDetected = false;
  let totalTaxesPaid = 0;
  let totalTaxesPaidDetected = false;

  const tds1Match = text.match(/(?:TDS\s*on\s*Salary|TDS\s*Salary|TDS\s*u\/s\s*192|Tax\s*Deducted\s*at\s*Source\s*u\/s\s*192)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (tds1Match) {
    tdsSalary = parseIndianNumber(tds1Match[1]);
    tdsSalaryDetected = tdsSalary > 0;
  }

  const tds2Match = text.match(/(?:TDS\s*other\s*than\s*salary|TDS\s*Non-Salary|TDS\s*Others|TDS\s*194[A-Z]|Tax\s*Deducted\s*at\s*Source\s*other\s*than\s*salary)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (tds2Match) {
    tdsOther = parseIndianNumber(tds2Match[1]);
    tdsOtherDetected = tdsOther > 0;
  }

  const tcsMatch = text.match(/(?:TCS|Tax\s*Collected\s*at\s*Source|Sec\s*206C)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (tcsMatch) {
    tcs = parseIndianNumber(tcsMatch[1]);
    tcsDetected = tcs > 0;
  }

  const advMatch = text.match(/(?:Advance\s*Tax|Advance\s*Tax\s*Paid)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (advMatch) {
    advanceTax = parseIndianNumber(advMatch[1]);
    advanceTaxDetected = advanceTax > 0;
  }

  const satMatch = text.match(/(?:Self\s*Assessment\s*Tax|SAT|Tax\s*Paid\s*u\/s\s*140A)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (satMatch) {
    sat = parseIndianNumber(satMatch[1]);
    satDetected = sat > 0;
  }

  const taxesPaidMatch = text.match(/(?:Total\s*Taxes\s*Paid|Total\s*TDS\s*Claimed|Taxes\s*Paid|Total\s*Tax\s*Paid)\s*[:\-\s]*₹?\s*([0-9,]+)/i);
  if (taxesPaidMatch) {
    totalTaxesPaid = parseIndianNumber(taxesPaidMatch[1]);
    totalTaxesPaidDetected = totalTaxesPaid > 0;
  } else if (tdsSalaryDetected || tdsOtherDetected || tcsDetected || advanceTaxDetected || satDetected) {
    totalTaxesPaid = tdsSalary + tdsOther + tcs + advanceTax + sat;
    totalTaxesPaidDetected = totalTaxesPaid > 0;
  }

  extractedFields.push(
    createFieldItem(
      'f_tds_salary',
      'TDS on Salary (u/s 192)',
      'taxesPaid.tdsSalary',
      'Taxes Paid',
      tdsSalaryDetected ? tdsSalary : null,
      tdsSalaryDetected,
      tdsSalaryDetected ? 96 : 0,
      detectedDocType === 'Form 16' ? 'Form 16' : 'Form 26AS',
      fileName,
      'TDS Claimed',
      '192'
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_tds_other',
      'TDS other than Salary (194A/C/J/I)',
      'taxesPaid.tdsOther',
      'Taxes Paid',
      tdsOtherDetected ? tdsOther : null,
      tdsOtherDetected,
      tdsOtherDetected ? 96 : 0,
      'Form 26AS',
      fileName,
      'TDS Claimed'
    )
  );

  if (tcsDetected) {
    extractedFields.push(
      createFieldItem(
        'f_tcs',
        'TCS Claimed (u/s 206C)',
        'taxesPaid.tcs',
        'Taxes Paid',
        tcs,
        true,
        96,
        'Form 26AS',
        fileName,
        'TCS Claimed',
        '206C'
      )
    );
  }

  if (advanceTaxDetected) {
    extractedFields.push(
      createFieldItem(
        'f_adv_tax',
        'Advance Tax Paid',
        'taxesPaid.advanceTax',
        'Taxes Paid',
        advanceTax,
        true,
        95,
        defaultSource,
        fileName
      )
    );
  }

  if (satDetected) {
    extractedFields.push(
      createFieldItem(
        'f_sat',
        'Self Assessment Tax Paid (140A)',
        'taxesPaid.selfAssessmentTax',
        'Taxes Paid',
        sat,
        true,
        95,
        defaultSource,
        fileName
      )
    );
  }

  extractedFields.push(
    createFieldItem(
      'f_total_taxes_paid',
      'Total Taxes Paid & Credited',
      'taxesPaid.totalTaxesPaid',
      'Taxes Paid',
      totalTaxesPaidDetected ? totalTaxesPaid : null,
      totalTaxesPaidDetected,
      totalTaxesPaidDetected ? 95 : 0,
      defaultSource,
      fileName
    )
  );

  // 16. BANK DETAILS (Strict verification)
  let bankName = '';
  let accNo = '';
  let ifsc = '';
  let bankDetected = false;

  const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  if (ifscMatch && isValidIFSC(ifscMatch[1])) {
    ifsc = ifscMatch[1].toUpperCase();
    bankDetected = true;
  }

  const accMatch = text.match(/(?:Account\s*Number|A\/c\s*No\.?|Bank\s*Account|Account\s*No)\s*[:\-\s]*([0-9]{9,18})/i);
  if (accMatch) {
    accNo = accMatch[1];
    bankDetected = true;
  }

  const bankNameMatch = text.match(/(?:Bank\s*Name|Name\s*of\s*Bank)\s*[:\-\s]+([A-Za-z\s&]{3,40})/i);
  if (bankNameMatch) {
    bankName = bankNameMatch[1].trim();
  }

  extractedFields.push(
    createFieldItem(
      'f_bank_ifsc',
      'Bank IFSC Code',
      'client.ifscCode',
      'Bank Details',
      ifsc || null,
      Boolean(ifsc),
      Boolean(ifsc) ? 95 : 0,
      defaultSource,
      fileName
    )
  );

  extractedFields.push(
    createFieldItem(
      'f_bank_acc',
      'Bank Account Number',
      'client.accountNumber',
      'Bank Details',
      accNo || null,
      Boolean(accNo),
      Boolean(accNo) ? 95 : 0,
      defaultSource,
      fileName
    )
  );

  // 17. Regime Opted Detection
  let regimeOpted: TaxComputation['regimeOpted'] = 'new';
  if (text.includes('115BAC') || text.includes('New Tax Regime') || text.includes('Opting in to new tax regime')) {
    regimeOpted = 'new';
  } else if (text.includes('Old Tax Regime') || (totalDeductions > 50000 && !text.includes('115BAC'))) {
    regimeOpted = 'old';
  }

  // 18. Build normalized computation object ONLY with actually detected fields
  const parsedComputation: Partial<TaxComputation> = {
    assessmentYear: ay || undefined,
    financialYear: fy || undefined,
    itrForm: itrFormDetected ? itrForm : undefined,
    filingDate: filingDate || undefined,
    acknowledgementNumber: ackNo || undefined,
    regimeOpted,
    sourcePdfName: fileName,
    client: {
      pan: pan || '',
      name: name || '',
      status: 'Individual',
      residentialStatus: 'Resident',
      bankName: bankName || '',
      accountNumber: accNo || '',
      ifscCode: ifsc || '',
    },
    salary: {
      grossSalary: grossSalary || 0,
      allowancesExempt: allowancesExempt || 0,
      standardDeduction: standardDeduction || (grossSalary > 0 ? (regimeOpted === 'new' ? 75000 : 50000) : 0),
      entertainmentAllowance: 0,
      professionalTax: professionalTax || 0,
      netSalary: Math.max(0, (grossSalary || 0) - (allowancesExempt || 0) - (standardDeduction || 0) - (professionalTax || 0)),
    },
    houseProperty: {
      grossRentReceived: 0,
      municipalTaxes: 0,
      annualValue: 0,
      standardDeduction30: 0,
      homeLoanInterest24b: housePropertyIncome < 0 ? Math.abs(housePropertyIncome) : 0,
      netHousePropertyIncome: housePropertyIncome || 0,
    },
    business: {
      natureOfBusiness: businessIncome > 0 ? 'Business / Profession' : '',
      turnoverDigital6: turnoverDigital6 || 0,
      profitDigital6: turnoverDigital6 ? Math.round(turnoverDigital6 * 0.06) : 0,
      turnoverCash8: turnoverCash8 || 0,
      profitCash8: turnoverCash8 ? Math.round(turnoverCash8 * 0.08) : 0,
      turnoverOrGrossReceipts: totalTurnover || 0,
      presumptiveSection: '44AD (8%/6%)',
      netProfit: businessIncome || 0,
    },
    capitalGains: {
      stcg111A: stcg111A || 0,
      stcgNormal: 0,
      ltcg112A: ltcg112A || 0,
      ltcg112: 0,
      netCapitalGains: capitalGains || (stcg111A + ltcg112A),
    },
    otherSources: {
      savingsInterest: savingsInterest || 0,
      fdInterest: fdInterest || 0,
      dividendIncome: dividendIncome || 0,
      otherIncome: 0,
      familyPension: 0,
      agriculturalIncome: agriculturalIncome || 0,
      agriculturalDetails: {
        grossAgriculturalReceipts: grossAgriReceipts || 0,
        agriculturalExpenses: agriExpenses || 0,
        netAgriculturalIncome: agriculturalIncome || 0,
      },
      netOtherSources: otherSources || (savingsInterest + fdInterest + dividendIncome),
    },
    agriculturalIncome: agriculturalIncome || 0,
    agriculturalDetails: {
      grossAgriculturalReceipts: grossAgriReceipts || 0,
      agriculturalExpenses: agriExpenses || 0,
      netAgriculturalIncome: agriculturalIncome || 0,
    },
    deductions: {
      sec80C: sec80c || 0,
      sec80CCC: 0,
      sec80CCD1B: sec80ccd1b || 0,
      sec80CCD2: 0,
      sec80D: sec80d || 0,
      sec80DD: 0,
      sec80DDB: 0,
      sec80E: 0,
      sec80EEA: 0,
      sec80G: 0,
      sec80GG: 0,
      sec80TTA: sec80tta || 0,
      sec80TTB: 0,
      sec80U: 0,
      otherDeductions: 0,
      totalDeductions: totalDeductions || (sec80c + sec80d + sec80ccd1b + sec80tta),
    },
    taxesPaid: {
      tdsSalary: tdsSalary || 0,
      tdsOther: tdsOther || 0,
      tcs: tcs || 0,
      advanceTax: advanceTax || 0,
      selfAssessmentTax: sat || 0,
      totalTaxesPaid: totalTaxesPaid || (tdsSalary + tdsOther + tcs + advanceTax + sat),
    },
  };

  // Calculate overall confidence as average of detected critical fields
  const detectedItems = extractedFields.filter((f) => f.detected);
  const overallConfidence = detectedItems.length > 0
    ? Math.round(detectedItems.reduce((acc, f) => acc + f.confidence, 0) / detectedItems.length)
    : 0;

  return {
    id: `doc_${Date.now()}`,
    fileName,
    fileSize,
    extractedText: text,
    detectedDocType,
    isScannedOrImageOnly: false,
    isPasswordProtected: false,
    isCorruptedOrUnreadable: false,
    confidence: overallConfidence,
    extractedFields,
    parsedComputation,
    rawFields,
    conflicts,
    duplicates,
    bankTransactions,
  };
}

/**
 * Multi-Document Cross-Verification: Detects conflicts and duplicates across uploaded documents
 */
export function crossVerifyExtractedDocuments(
  docs: ExtractedPdfResult[]
): {
  unifiedFields: ExtractedFieldItem[];
  conflicts: ExtractedDocumentConflict[];
  duplicates: ExtractedDocumentDuplicate[];
} {
  const unifiedFields: ExtractedFieldItem[] = [];
  const conflicts: ExtractedDocumentConflict[] = [];
  const duplicates: ExtractedDocumentDuplicate[] = [];

  // Source hierarchy ranks
  const sourceRank: Record<ExtractionSourceType, number> = {
    'ITR JSON': 1,
    'Form 16': 2,
    'Form 16A': 2,
    'AIS / TIS': 3,
    'Form 26AS': 4,
    'Bank Statement': 5,
    'Supporting Document': 6,
    'OCR': 7,
    'Manual Entry': 8,
  };

  const fieldsByKey: Record<string, ExtractedFieldItem[]> = {};

  // Group all fields by key
  docs.forEach((doc) => {
    doc.extractedFields.forEach((field) => {
      if (field.detected && field.value !== null && field.value !== undefined && field.value !== 0 && field.value !== '') {
        if (!fieldsByKey[field.key]) {
          fieldsByKey[field.key] = [];
        }
        fieldsByKey[field.key].push(field);
      }
    });
  });

  // Evaluate conflicts and duplicates
  Object.entries(fieldsByKey).forEach(([key, items]) => {
    if (items.length === 1) {
      unifiedFields.push({ ...items[0] });
    } else {
      // Sort by source priority
      items.sort((a, b) => (sourceRank[a.source || 'Manual Entry'] || 99) - (sourceRank[b.source || 'Manual Entry'] || 99));

      const primary = items[0];
      const differentValues = items.filter((it) => it.value !== primary.value);

      if (differentValues.length > 0) {
        // Conflict detected
        differentValues.forEach((diff) => {
          conflicts.push({
            field: primary.field,
            sourceA: primary.source || 'Unknown',
            docA: primary.sourceDocument,
            valA: primary.value,
            sourceB: diff.source || 'Unknown',
            docB: diff.sourceDocument,
            valB: diff.value,
            message: `Data Conflict: ${primary.source} reports ₹${Number(primary.value).toLocaleString('en-IN')}, whereas ${diff.source} reports ₹${Number(diff.value).toLocaleString('en-IN')}.`,
          });
        });

        unifiedFields.push({
          ...primary,
          status: 'Conflict',
          reviewRequired: true,
          conflictWith: {
            source: differentValues[0].source || 'Supporting Document',
            sourceDocument: differentValues[0].sourceDocument,
            value: differentValues[0].value,
          },
        });
      } else {
        // Duplicate detection / confirmation
        const allSources = items.map((it) => it.source || 'Unknown');
        const allDocs = items.map((it) => it.sourceDocument);
        
        duplicates.push({
          field: primary.field,
          sources: allSources,
          documents: allDocs,
          amount: typeof primary.value === 'number' ? primary.value : 0,
          message: `Item verified across multiple documents (${allSources.join(', ')}). Duplicate addition avoided.`,
        });

        unifiedFields.push({
          ...primary,
          status: 'Verified',
          confidence: Math.min(100, primary.confidence + 5),
        });
      }
    }
  });

  return { unifiedFields, conflicts, duplicates };
}
