import { Language } from '../types';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    appTitle: 'ITR Tax Computation & PDF Extractor',
    appSubtitle: 'Extract PDF data & generate 1-Page Compact Computation Sheets for Clients & Banks',
    uploadPdf: 'Upload ITR / Tax PDF',
    uploadHint: 'Drag & drop ITR-V, Form 16, AIS/TIS or Tax Computation PDF',
    orPasteText: 'Or Paste Text / JSON',
    loadSample: 'Load Sample ITR Data',
    clientDirectory: 'Client Records',
    firmSettings: 'Firm Letterhead',
    newComputation: 'New Computation',
    exportAllExcel: 'Export All to Excel',
    
    // Computation Sheet terms
    computationSheetTitle: 'INCOME TAX COMPUTATION SHEET',
    compactSummary: 'Compact 1-Page Summary',
    downloadPdf: 'Download 1-Page PDF',
    printSheet: 'Print Computation',
    sendWhatsApp: 'Send on WhatsApp',
    copySummary: 'Copy Text Summary',
    editData: 'Edit Computation',
    compareRegimes: 'Compare Old vs New Regime',
    
    // Status
    refundDue: 'REFUND DUE',
    taxPayable: 'TAX PAYABLE',
    nilReturn: 'NIL TAX RETURN',
    
    // Heads of Income
    salaryHead: 'Income from Salaries',
    housePropertyHead: 'Income from House Property',
    businessHead: 'Profits & Gains of Business / Profession',
    capitalGainsHead: 'Capital Gains',
    otherSourcesHead: 'Income from Other Sources',
    grossTotalIncome: 'Gross Total Income (GTI)',
    chapterVIADeductions: 'Deductions under Chapter VI-A',
    totalTaxableIncome: 'Total Taxable Income',
    
    // Tax Calculation
    taxAtSlabs: 'Tax on Total Income (Slab Rate)',
    rebate87A: 'Less: Rebate u/s 87A',
    taxAfterRebate: 'Tax after Rebate',
    cess4: 'Add: Health & Education Cess (4%)',
    grossTaxLiability: 'Total Tax Liability',
    taxesPaid: 'Total Taxes Paid (TDS/TCS/Advance/SAT)',
    netOutcome: 'Net Outcome',
    
    // Client Info
    assesseeName: 'Client / Assessee Name',
    pan: 'Permanent Account Number (PAN)',
    assessmentYear: 'Assessment Year (AY)',
    financialYear: 'Financial Year (FY)',
    itrForm: 'ITR Form Type',
    filingSection: 'Filing Section',
    filingDate: 'Filing Date',
    ackNumber: 'Ack. / Receipt No.',
    bankAccount: 'Bank A/c & IFSC',
    regime: 'Tax Regime',
  },
  
  pa: {
    appTitle: 'ਆਈਟੀਆਰ ਕੰਪਿਊਟੇਸ਼ਨ ਤੇ ਪੀਡੀਐਫ ਐਕਸਟਰੈਕਟਰ',
    appSubtitle: 'ਪੀਡੀਐਫ ਵਿੱਚੋਂ ਡਾਟਾ ਕੱਢ ਕੇ 1-ਸਫ਼ੇ ਦੀ ਸ਼ਾਰਟ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਤਿਆਰ ਕਰੋ',
    uploadPdf: 'ਆਈਟੀਆਰ ਪੀਡੀਐਫ ਅੱਪਲੋਡ ਕਰੋ',
    uploadHint: 'ITR-V, ਫਾਰਮ 16, AIS/TIS ਜਾਂ ਟੈਕਸ ਪੀਡੀਐਫ ਇੱਥੇ ਪਾਓ',
    orPasteText: 'ਜਾਂ ਟੈਕਸਟ / ਜੇਸਨ ਪੇਸਟ ਕਰੋ',
    loadSample: 'ਸੈਂਪਲ ਆਈਟੀਆਰ ਡਾਟਾ ਲੋਡ ਕਰੋ',
    clientDirectory: 'ਗਾਹਕ ਰਿਕਾਰਡ ਲਿਸਟ',
    firmSettings: 'ਦਫਤਰ / ਲੈਟਰਹੈੱਡ ਸੈਟਿੰਗ',
    newComputation: 'ਨਵੀਂ ਕੰਪਿਊਟੇਸ਼ਨ',
    exportAllExcel: 'ਸਾਰਾ ਡਾਟਾ ਐਕਸਲ ਵਿੱਚ ਡਾਊਨਲੋਡ',
    
    // Computation Sheet terms
    computationSheetTitle: 'ਇਨਕਮ ਟੈਕਸ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ',
    compactSummary: '1-ਸਫ਼ੇ ਦੀ ਸੰਖੇਪ (ਸ਼ਾਰਟ) ਸ਼ੀਟ',
    downloadPdf: '1-ਸਫ਼ਾ ਪੀਡੀਐਫ ਡਾਊਨਲੋਡ ਕਰੋ',
    printSheet: 'ਕੰਪਿਊਟੇਸ਼ਨ ਪ੍ਰਿੰਟ ਕਰੋ',
    sendWhatsApp: 'ਵ੍ਹਟਸਐਪ ਤੇ ਭੇਜੋ',
    copySummary: 'ਸੰਖੇਪ ਕਾਪੀ ਕਰੋ',
    editData: 'ਡਾਟਾ ਸੋਧੋ / ਬਦਲੋ',
    compareRegimes: 'ਨਵੀਂ ਬਨਾਮ ਪੁਰਾਣੀ ਟੈਕਸ ਪ੍ਰਣਾਲੀ',
    
    // Status
    refundDue: 'ਰਿਫੰਡ ਬਣਦਾ ਹੈ (REFUND DUE)',
    taxPayable: 'ਟੈਕਸ ਦੇਣਾ ਬਣਦਾ ਹੈ (TAX PAYABLE)',
    nilReturn: 'ਜ਼ੀਰੋ ਟੈਕਸ (NIL RETURN)',
    
    // Heads of Income
    salaryHead: 'ਤਨਖਾਹ ਤੋਂ ਆਮਦਨ (Salaries)',
    housePropertyHead: 'ਮਕਾਨ / ਪ੍ਰਾਪਰਟੀ ਤੋਂ ਆਮਦਨ (House Property)',
    businessHead: 'ਕਾਰੋਬਾਰ / ਦੁਕਾਨ ਤੋਂ ਆਮਦਨ (Business & Profession)',
    capitalGainsHead: 'ਪੂੰਜੀਗਤ ਲਾਭ (Capital Gains)',
    otherSourcesHead: 'ਹੋਰ ਸਾਧਨਾਂ ਤੋਂ ਆਮਦਨ (ਵਿਆਜ/ਡਿਵੀਡੈਂਡ)',
    grossTotalIncome: 'ਕੁੱਲ ਕੁੱਲ ਆਮਦਨ (Gross Total Income)',
    chapterVIADeductions: 'ਕਟੌਤੀਆਂ (80C, 80D, ਆਦਿ)',
    totalTaxableIncome: 'ਕੁੱਲ ਟੈਕਸਯੋਗ ਆਮਦਨ (Total Taxable Income)',
    
    // Tax Calculation
    taxAtSlabs: 'ਟੈਕਸ ਸਲੈਬ ਰੇਟ ਮੁਤਾਬਕ',
    rebate87A: 'ਛੋਟ ਸੈਕਸ਼ਨ 87A (Rebate)',
    taxAfterRebate: 'ਛੋਟ ਤੋਂ ਬਾਅਦ ਟੈਕਸ',
    cess4: 'ਸਿਹਤ ਤੇ ਸਿੱਖਿਆ ਸੈੱਸ 4%',
    grossTaxLiability: 'ਕੁੱਲ ਟੈਕਸ ਦੇਣਦਾਰੀ',
    taxesPaid: 'ਜਮ੍ਹਾਂ ਕਰਵਾਇਆ ਟੈਕਸ (TDS / ਐਡਵਾਂਸ ਟੈਕਸ)',
    netOutcome: 'ਅੰਤਿਮ ਨਤੀਜਾ (ਰਿਫੰਡ ਜਾਂ ਦੇਣਦਾਰੀ)',
    
    // Client Info
    assesseeName: 'ਕਲਾਇੰਟ / ਕਰਦਾਤਾ ਦਾ ਨਾਮ',
    pan: 'ਪੈਨ ਕਾਰਡ ਨੰਬਰ (PAN)',
    assessmentYear: 'ਮੁਲਾਂਕਣ ਸਾਲ (AY)',
    financialYear: 'ਵਿੱਤੀ ਸਾਲ (FY)',
    itrForm: 'ਆਈਟੀਆਰ ਫਾਰਮ',
    filingSection: 'ਫਾਈਲਿੰਗ ਸੈਕਸ਼ਨ',
    filingDate: 'ਫਾਈਲ ਕਰਨ ਦੀ ਤਾਰੀਖ',
    ackNumber: 'ਰਸੀਦ ਨੰਬਰ (Ack No.)',
    bankAccount: 'ਬੈਂਕ ਖਾਤਾ ਤੇ IFSC',
    regime: 'ਟੈਕਸ ਪ੍ਰਣਾਲੀ (Regime)',
  },

  hi: {
    appTitle: 'ITR टैक्स कम्प्यूटेशन एवं PDF एक्सट्रैक्टर',
    appSubtitle: 'PDF से डेटा निकालकर 1-पेज की कॉम्पैक्ट कम्प्यूटेशन शीट बनाएं',
    uploadPdf: 'ITR / टैक्स PDF अपलोड करें',
    uploadHint: 'ITR-V, Form 16, AIS/TIS या टैक्स PDF यहाँ डालें',
    orPasteText: 'या टेक्स्ट / JSON पेस्ट करें',
    loadSample: 'सैंपल ITR डेटा लोड करें',
    clientDirectory: 'क्लाइंट रिकॉर्ड्स',
    firmSettings: 'लेटरहेड सेटिंग्स',
    newComputation: 'नई कम्प्यूटेशन',
    exportAllExcel: 'एक्सेल में एक्सपोर्ट करें',
    
    // Computation Sheet terms
    computationSheetTitle: 'इनकम टैक्स कम्प्यूटेशन शीट',
    compactSummary: '1-पेज संक्षिप्त कम्प्यूटेशन',
    downloadPdf: '1-पेज PDF डाउनलोड करें',
    printSheet: 'कम्प्यूटेशन प्रिंट करें',
    sendWhatsApp: 'व्हाट्सएप पर भेजें',
    copySummary: 'संक्षिप्त कॉपी करें',
    editData: 'डेटा एडिट करें',
    compareRegimes: 'पुरानी बनाम नई टैक्स व्यवस्था',
    
    // Status
    refundDue: 'रिफंड देय (REFUND DUE)',
    taxPayable: 'टैक्स देय (TAX PAYABLE)',
    nilReturn: 'शून्य टैक्स (NIL RETURN)',
    
    // Heads of Income
    salaryHead: 'वेतन से आय (Salaries)',
    housePropertyHead: 'मकान संपत्ति से आय (House Property)',
    businessHead: 'व्यापार अथवा पेशे से आय (Business)',
    capitalGainsHead: 'पूंजीगत लाभ (Capital Gains)',
    otherSourcesHead: 'अन्य स्रोतों से आय (व्याज/डिविडेंड)',
    grossTotalIncome: 'सकल कुल आय (Gross Total Income)',
    chapterVIADeductions: 'कटौतियां (80C, 80D, 80TTA आदि)',
    totalTaxableIncome: 'कुल कर योग्य आय (Total Taxable Income)',
    
    // Tax Calculation
    taxAtSlabs: 'स्लैब दरों पर टैक्स',
    rebate87A: 'छूट धारा 87A (Rebate)',
    taxAfterRebate: 'छूट के बाद टैक्स',
    cess4: 'स्वास्थ्य एवं शिक्षा उपकर (4%)',
    grossTaxLiability: 'कुल टैक्स देनदारी',
    taxesPaid: 'जमा किया गया टैक्स (TDS/अग्रिम कर)',
    netOutcome: 'अंतिम स्थिति (रिफंड या देनदारी)',
    
    // Client Info
    assesseeName: 'करदाता का नाम',
    pan: 'पैन नंबर (PAN)',
    assessmentYear: 'निर्धारण वर्ष (AY)',
    financialYear: 'वित्तीय वर्ष (FY)',
    itrForm: 'ITR फॉर्म प्रकार',
    filingSection: 'फाइलिंग धारा',
    filingDate: 'फाइलिंग की तिथि',
    ackNumber: 'रसीद संख्या (Ack No.)',
    bankAccount: 'बैंक खाता व IFSC',
    regime: 'टैक्स व्यवस्था',
  },
};
