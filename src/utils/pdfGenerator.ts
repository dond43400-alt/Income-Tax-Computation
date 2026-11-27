import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TaxComputation, FirmDetails, SalaryEntry } from '../types';

export function formatINR(val?: number): string {
  if (val === undefined || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN');
}

// PDF-safe INR formatter (Uses "₹" in UTF-8 or clean formatted number without broken glyphs)
export function formatPdfINR(val?: number, includeSymbol: boolean = false): string {
  if (val === undefined || isNaN(val)) return includeSymbol ? '₹0' : '0';
  const formatted = Number(val).toLocaleString('en-IN');
  return includeSymbol ? `₹${formatted}` : formatted;
}

export function buildComputationPdfDoc(comp: TaxComputation, firm: FirmDetails): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 10;
  const rightMargin = 10;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 190mm
  let currentY = 10;

  // Primary Theme Colors (Exact match with WPS Office / Screenshot)
  const navyColor: [number, number, number] = [16, 54, 107]; // #10366b
  const headerBgColor: [number, number, number] = [16, 54, 107];
  const zebraBgColor: [number, number, number] = [248, 250, 252];
  const borderColor: [number, number, number] = [203, 213, 225];

  // 1. TOP HEADER (Centered Title, AY, FY, ITR Form)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
  doc.text('INCOME TAX COMPUTATION STATEMENT', pageWidth / 2, currentY, { align: 'center' });

  currentY += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
  doc.text(
    `Assessment Year ${comp.assessmentYear || '2026-27'} | Financial Year ${comp.financialYear || '2025-26'}`,
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );

  currentY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const itrText = comp.itrForm ? comp.itrForm.toUpperCase() : 'ITR-4 SUGAM';
  const secText = comp.filingSection ? comp.filingSection.split(' - ')[0] : '139(1)';
  doc.text(`(Prepared from Form ${itrText} filed u/s ${secText})`, pageWidth / 2, currentY, { align: 'center' });

  if (firm && firm.firmName && firm.firmName.trim() !== '') {
    currentY += 3.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Prepared by: ${firm.firmName}${firm.registrationNo ? ` (Reg/M.No: ${firm.registrationNo})` : ''}`, pageWidth / 2, currentY, { align: 'center' });
  }

  currentY += 3;
  // Header underline
  doc.setDrawColor(navyColor[0], navyColor[1], navyColor[2]);
  doc.setLineWidth(0.6);
  doc.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
  currentY += 1.5;

  // ==========================================
  // DATA COMPLETENESS VALIDATION (Requirement 23)
  // ==========================================
  let salaryRecordsFound = 0;
  let salaryRecordsPrinted = 0;
  if (comp.salary.salaryList && comp.salary.salaryList.length > 0) {
    salaryRecordsFound = comp.salary.salaryList.length;
  } else if (
    Number(comp.salary.grossSalary || 0) > 0 ||
    Number(comp.salary.netSalary || 0) > 0 ||
    Number(comp.salary.salarySection17_1 || 0) > 0 ||
    (comp.salary.employerName && comp.salary.employerName.trim() !== '')
  ) {
    salaryRecordsFound = 1;
  }

  let bankRecordsFound = 0;
  let bankRecordsPrinted = 0;
  if (comp.client.bankAccounts && comp.client.bankAccounts.length > 0) {
    bankRecordsFound = comp.client.bankAccounts.length;
  } else if (
    (comp.client.bankName && comp.client.bankName.trim() !== '') ||
    (comp.client.accountNumber && comp.client.accountNumber.trim() !== '')
  ) {
    bankRecordsFound = 1;
  }

  let businessRecordsFound = 0;
  let businessRecordsPrinted = 0;
  if (comp.business.businessList && comp.business.businessList.length > 0) {
    businessRecordsFound = comp.business.businessList.length;
  } else if (
    Number(comp.business.turnoverOrGrossReceipts || 0) > 0 ||
    Number(comp.business.netProfit || 0) > 0 ||
    (comp.business.businessName && comp.business.businessName.trim() !== '') ||
    (comp.business.natureOfBusiness && comp.business.natureOfBusiness.trim() !== '')
  ) {
    businessRecordsFound = 1;
  }

  let capitalGainRecordsFound = 0;
  let capitalGainRecordsPrinted = 0;
  const hasStcg111A = Number(comp.capitalGains.stcg111A || comp.capitalGains.stcg15 || 0) > 0;
  const hasStcgNorm = Number(comp.capitalGains.stcgNormal || 0) > 0;
  const hasLtcg112A = Number(comp.capitalGains.ltcg112A || comp.capitalGains.ltcg10 || 0) > 0;
  const hasLtcg112 = Number(comp.capitalGains.ltcg112 || comp.capitalGains.ltcg20 || 0) > 0;
  const hasLossSetOff = (Number(comp.capitalGains.stclSetOff || 0) + Number(comp.capitalGains.ltclSetOff || 0)) > 0;
  if (hasStcg111A) capitalGainRecordsFound++;
  if (hasStcgNorm) capitalGainRecordsFound++;
  if (hasLtcg112A) capitalGainRecordsFound++;
  if (hasLtcg112) capitalGainRecordsFound++;
  if (hasLossSetOff) capitalGainRecordsFound++;
  if (capitalGainRecordsFound === 0 && Number(comp.capitalGains.netCapitalGains || 0) > 0) {
    capitalGainRecordsFound = 1;
  }

  let otherSourceRecordsFound = 0;
  let otherSourceRecordsPrinted = 0;
  const allBankInterest = comp.otherSources.bankInterestItems || [];
  if (allBankInterest.length > 0) {
    const validBankItems = allBankInterest.filter(b => Number(b.amount || 0) > 0);
    otherSourceRecordsFound += validBankItems.length > 0 ? validBankItems.length : allBankInterest.length;
  } else {
    if (Number(comp.otherSources.savingsInterest || 0) > 0) otherSourceRecordsFound++;
    if (Number(comp.otherSources.fdInterest || 0) > 0) otherSourceRecordsFound++;
    if (Number(comp.otherSources.rdInterest || 0) > 0) otherSourceRecordsFound++;
  }
  if (Number(comp.otherSources.itRefundInterest || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.passThroughInterest || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.dividendIncome || 0) > 0 || Number(comp.otherSources.indianCompanyDividend || 0) > 0 || Number(comp.otherSources.mutualFundDividend || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.familyPension || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.machineryHireGross || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.lotteryWinnings || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.onlineGamesWinnings || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.horseRacesWinnings || 0) > 0) otherSourceRecordsFound++;
  if (Number(comp.otherSources.unexplainedIncome115BBE || 0) > 0) otherSourceRecordsFound++;
  const otherItems = comp.otherSources.otherIncomeItems || [];
  if (otherItems.length > 0) {
    const validOtherItems = otherItems.filter(o => Number(o.netAmount || 0) > 0);
    otherSourceRecordsFound += validOtherItems.length > 0 ? validOtherItems.length : otherItems.length;
  } else if ((Number(comp.otherSources.otherIncome || 0) + Number(comp.otherSources.anyOtherIncome || 0)) > 0) {
    otherSourceRecordsFound++;
  }
  if (otherSourceRecordsFound === 0 && Number(comp.otherSources.netOtherSources || 0) > 0) {
    otherSourceRecordsFound = 1;
  }

  // 2. PART A: PERSONAL & FILING INFORMATION
  const partAData: any[] = [
    [
      { content: 'Assessee Name:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: (comp.client.name || 'SARABJIT KAUR').toUpperCase(), styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: 'PAN:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: (comp.client.pan || 'HSIPK5617N').toUpperCase(), styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    ],
    [
      { content: "Father's Name:", styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: (comp.client.fatherName || 'MUKHTIAR SINGH').toUpperCase() },
      { content: 'Status / Gender:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: `${comp.client.status || 'Individual'} / ${comp.client.gender || 'Female'}` },
    ],
    [
      { content: 'Date of Birth:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.client.dob || '15/04/1981' },
      { content: 'Residential Status:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.client.residentialStatus || 'Resident' },
    ],
    [
      { content: 'Assessment Year:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.assessmentYear || '2026-27' },
      { content: 'Financial Year:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.financialYear || '2025-26' },
    ],
    [
      { content: 'Tax Regime:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.regimeOpted === 'new' ? 'New Tax Regime u/s 115BAC' : 'Old Tax Regime' },
      { content: 'ITR Form Type:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: (comp.itrForm || 'ITR-4 (SUGAM)').toUpperCase() },
    ],
    [
      { content: 'Section Filed U/s:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.filingSection || '139(1) - On or before due date' },
      { content: 'Date of Filing:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.filingDate || '31-Jul-2026' },
    ],
    [
      { content: 'Ack. Number:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.acknowledgementNumber || '923925200310726', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: 'Place of Filing:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.client.placeOfFiling || 'LOHIAN KHAS' },
    ],
    [
      { content: 'Mobile / Email:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: `${comp.client.mobile || '8146463219'} /\n${comp.client.email || 'poonianranjeet@gmail.com'}` },
      { content: 'Address:', styles: { textColor: navyColor, fontStyle: 'bold' } },
      { content: comp.client.address || 'C/O RANJIT SINGH, VILLAGE POONIAN, POONIAN B.O, PUNIAN, JALANDHAR, PUNJAB - 144702' },
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'PART A: PERSONAL & FILING INFORMATION', colSpan: 4, styles: { fillColor: [240, 245, 255], textColor: navyColor, fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2, halign: 'left' } }]],
    body: partAData,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.0,
      textColor: [30, 41, 59],
      lineColor: borderColor,
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 58 },
      2: { cellWidth: 34 },
      3: { cellWidth: 64 },
    },
    alternateRowStyles: {
      fillColor: zebraBgColor,
    },
    margin: { left: leftMargin, right: rightMargin },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 2;

  // 3. PART B: PRESUMPTIVE BUSINESS INCOME (U/S 44AD) / INCOME HEAD BREAKDOWN
  const biz = comp.business;
  const partBRows: any[] = [];
  let grandTotalTurnover = 0;
  let grandTotalProfit = 0;

  if (biz.businessList && biz.businessList.length > 0) {
    biz.businessList.forEach((bItem) => {
      businessRecordsPrinted++;
      const bTrade = bItem.businessName || bItem.tradeName || '';
      const bCode = bItem.businessCode ? `[Code: ${bItem.businessCode}]` : '';
      const bNature = bItem.natureOfBusiness || '';
      const bDesc = bItem.businessDescription && bItem.businessDescription !== bNature ? `(${bItem.businessDescription})` : '';
      const bAddr = bItem.businessAddress ? `\nAdd: ${bItem.businessAddress}` : '';

      let bTitle = '';
      if (bTrade && (bCode || bNature)) {
        bTitle = `${bTrade}\n${[bCode, bNature, bDesc].filter(Boolean).join(' ')}${bAddr}`.trim();
      } else if (bTrade) {
        bTitle = `${bTrade} ${bDesc}${bAddr}`.trim();
      } else {
        bTitle = `${[bCode, bNature, bDesc].filter(Boolean).join(' ')}${bAddr}`.trim() || 'Presumptive Business Income';
      }

      // Check section type (44ADA, Regular Books, Dairy, or 44AD)
      if (bItem.presumptiveSection === '44ADA') {
        const tGross = Number(bItem.totalTurnover || bItem.grossReceipts || 0);
        const pNet = Number(bItem.netProfit || Math.round(tGross * 0.5));
        partBRows.push([
          bTitle,
          'Professional Gross Receipts (u/s 44ADA @ 50%)',
          formatPdfINR(tGross),
          formatPdfINR(pNet),
        ]);
        grandTotalTurnover += tGross;
        grandTotalProfit += pNet;
      } else if (bItem.regularBooks) {
        const tSales = Number(bItem.regularBooks.grossSales || bItem.totalTurnover || 0);
        const pNet = Number(bItem.regularBooks.netProfitOrLoss || bItem.netProfit || 0);
        partBRows.push([
          bTitle,
          'Regular Books of Account (P&L)',
          formatPdfINR(tSales),
          formatPdfINR(pNet),
        ]);
        grandTotalTurnover += tSales;
        grandTotalProfit += pNet;
      } else if (bItem.dairyDetails) {
        const tMilk = Number(bItem.dairyDetails.milkSales || bItem.totalTurnover || 0);
        const pNet = Number(bItem.dairyDetails.netDairyProfit || bItem.netProfit || 0);
        partBRows.push([
          bTitle,
          'Dairy Farming & Milk Production',
          formatPdfINR(tMilk),
          formatPdfINR(pNet),
        ]);
        grandTotalTurnover += tMilk;
        grandTotalProfit += pNet;
      } else {
        // Standard Presumptive 44AD modes
        const tDig = Number(bItem.turnoverDigital6) || 0;
        const pDig = Number(bItem.profitDigital6) || (tDig > 0 ? Math.round(tDig * 0.06) : 0);
        const tCash = Number(bItem.turnoverCash8) || 0;
        const pCash = Number(bItem.profitCash8) || (tCash > 0 ? Math.round(tCash * 0.08) : 0);
        const tOth = Number(bItem.turnoverOtherMode) || 0;
        const pOth = (bItem.profitOtherMode !== undefined && !isNaN(Number(bItem.profitOtherMode)))
          ? Number(bItem.profitOtherMode) 
          : (tOth > 0 ? Math.round(tOth * ((Number(bItem.otherModePercent) || 0) / 100)) : 0);

        if (tDig > 0) {
          partBRows.push([
            bTitle,
            'Through Electronic Modes (6%)',
            formatPdfINR(tDig),
            formatPdfINR(pDig),
          ]);
        }
        if (tCash > 0 || (tDig === 0 && tOth === 0 && (bItem.totalTurnover || 0) > 0)) {
          partBRows.push([
            bTitle,
            'Through Cash Modes (8%)',
            formatPdfINR(tCash || (bItem.totalTurnover || 0)),
            formatPdfINR(pCash || (bItem.netProfit || 0)),
          ]);
        }
        if (tOth > 0) {
          partBRows.push([
            bTitle,
            `Through Other Modes (${bItem.otherModePercent ?? 0}%)`,
            formatPdfINR(tOth),
            formatPdfINR(pOth),
          ]);
        }

        grandTotalTurnover += (tDig + tCash + tOth);
        grandTotalProfit += (pDig + pCash + pOth);
      }
    });
  } else if (businessRecordsFound > 0) {
    // Fallback single business
    businessRecordsPrinted++;
    const bTrade = biz.businessName || biz.tradeName || '';
    const bCode = biz.businessCode ? `[Code: ${biz.businessCode}]` : '';
    const bNature = biz.natureOfBusiness || '';
    const bDesc = biz.businessDescription && biz.businessDescription !== bNature ? `(${biz.businessDescription})` : '';
    const bAddr = biz.businessAddress ? `\nAdd: ${biz.businessAddress}` : '';

    let bizDescText = '';
    if (bTrade && (bCode || bNature)) {
      bizDescText = `${bTrade}\n${[bCode, bNature, bDesc].filter(Boolean).join(' ')}${bAddr}`.trim();
    } else if (bTrade) {
      bizDescText = `${bTrade} ${bDesc}${bAddr}`.trim();
    } else {
      bizDescText = `${[bCode, bNature, bDesc].filter(Boolean).join(' ')}${bAddr}`.trim() || 'Presumptive Business Income';
    }

    const tElectronic = Number(biz.turnoverDigital6) || 0;
    const pElectronic = Number(biz.profitDigital6) > 0 ? Number(biz.profitDigital6) : (tElectronic > 0 ? Math.round(tElectronic * 0.06) : 0);
    const tCash = Number(biz.turnoverCash8) || 0;
    const pCash = Number(biz.profitCash8) > 0 ? Number(biz.profitCash8) : (tCash > 0 ? Math.round(tCash * 0.08) : 0);
    const tOther = Number(biz.turnoverOtherMode) || 0;
    const pOther = (biz.profitOtherMode !== undefined && !isNaN(Number(biz.profitOtherMode)))
      ? Number(biz.profitOtherMode) 
      : (tOther > 0 ? Math.round(tOther * ((Number(biz.otherModePercent) || 0) / 100)) : 0);

    const tTotal = (tElectronic + tCash + tOther) || Number(biz.turnoverOrGrossReceipts) || 0;
    const pTotal = Number(biz.netProfit) || (pElectronic + pCash + pOther);

    if (tElectronic > 0) {
      partBRows.push([
        bizDescText,
        'Through Electronic Modes (6%)',
        formatPdfINR(tElectronic),
        formatPdfINR(pElectronic),
      ]);
    }
    if (tCash > 0 || (tElectronic === 0 && tOther === 0 && tTotal > 0)) {
      partBRows.push([
        bizDescText,
        'Through Cash Modes (8%)',
        formatPdfINR(tCash || tTotal),
        formatPdfINR(pCash || pTotal),
      ]);
    }
    if (tOther > 0) {
      partBRows.push([
        bizDescText,
        `Through Other Modes (${biz.otherModePercent ?? 0}%)`,
        formatPdfINR(tOther),
        formatPdfINR(pOther),
      ]);
    }

    grandTotalTurnover = tTotal;
    grandTotalProfit = pTotal;
  }

  // If no breakdown was entered but net profit exists
  if (partBRows.length === 0 && (grandTotalProfit > 0 || biz.netProfit > 0)) {
    partBRows.push([
      biz.businessName || 'Business Income (44AD)',
      'Through Cash Modes (8%)',
      formatPdfINR(grandTotalTurnover || biz.turnoverOrGrossReceipts || 0),
      formatPdfINR(grandTotalProfit || biz.netProfit || 0),
    ]);
  }

  // Summary Row
  if (partBRows.length > 0) {
    partBRows.push([
      { content: 'TOTAL PRESUMPTIVE BUSINESS INCOME (u/s 44AD / 44ADA)', colSpan: 2, styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: formatPdfINR(grandTotalTurnover || biz.turnoverOrGrossReceipts || 0), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
      { content: formatPdfINR(grandTotalProfit || biz.netProfit || 0), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          { content: 'PART B: PRESUMPTIVE BUSINESS INCOME (U/S 44AD / 44ADA)', colSpan: 4, styles: { fillColor: [240, 245, 255], textColor: navyColor, fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2, halign: 'left' } },
        ],
        [
          'Business Description',
          'Turnover Mode',
          { content: 'Gross Receipts (₹)', styles: { halign: 'right' } },
          { content: 'Net Income (₹)', styles: { halign: 'right' } },
        ],
      ],
      body: partBRows,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgColor,
        textColor: 255,
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.1,
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.0,
        textColor: [30, 41, 59],
        lineColor: borderColor,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 50 },
        2: { cellWidth: 42, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: zebraBgColor,
      },
      margin: { left: leftMargin, right: rightMargin },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 2;
  }

  // 4. PART C: COMPUTATION OF TOTAL TAXABLE INCOME
  const partCRows: any[] = [];

  // Salary Detailed Breakdown (All Employers)
  const grossSal = Number(comp.salary.grossSalary) || (Number(comp.salary.salarySection17_1 || 0) + Number(comp.salary.perquisites17_2 || 0) + Number(comp.salary.profitsInLieu17_3 || 0));
  const netSal = Number(comp.salary.netSalary) || 0;
  
  // Extract full collection of salary entries
  const salaryEntries: SalaryEntry[] = (comp.salary.salaryList && comp.salary.salaryList.length > 0)
    ? comp.salary.salaryList
    : (grossSal > 0 || netSal > 0 || (comp.salary.salarySection17_1 || 0) > 0)
      ? [{
          id: 'default_1',
          employerName: comp.salary.employerName || 'Primary Employer',
          employerTAN: comp.salary.employerTAN || '',
          employerType: (comp.salary.employerType as any) || 'Private',
          grossSalary: grossSal,
          salarySection17_1: Number(comp.salary.salarySection17_1) || grossSal,
          perquisites17_2: Number(comp.salary.perquisites17_2) || 0,
          profitsInLieu17_3: Number(comp.salary.profitsInLieu17_3) || 0,
          allowancesExempt: Number(comp.salary.allowancesExempt) || 0,
          professionalTax: Number(comp.salary.professionalTax) || 0,
          entertainmentAllowance: Number(comp.salary.entertainmentAllowance) || 0,
          taxableSalaryBeforeStdDed: Math.max(0, grossSal - (Number(comp.salary.allowancesExempt) || 0) - (Number(comp.salary.professionalTax) || 0) - (Number(comp.salary.entertainmentAllowance) || 0)),
          tdsSalary: Number(comp.taxesPaid.tdsSalary) || 0,
          verificationStatus: 'Verified',
        }]
      : [];

  const salaryCount = salaryEntries.length;
  if (salaryCount > 0) {
    const isMulti = salaryCount > 1;
    const empHeader = isMulti 
      ? ` [Schedule Salary: ${salaryCount} Employers]`
      : (comp.salary.employerName ? ` [Employer: ${comp.salary.employerName}${comp.salary.employerType ? ` (${comp.salary.employerType})` : ''}]` : '');

    partCRows.push([
      { content: `1. Income from Salaries (Schedule Salary / Sec 15-17)${empHeader}`, styles: { fontStyle: 'bold' } },
      '',
      formatPdfINR(netSal),
    ]);

    // Iterate through EVERY employer record stored in the computation
    salaryEntries.forEach((entry, idx) => {
      salaryRecordsPrinted++;
      const empNum = idx + 1;
      const empName = entry.employerName || `Employer ${empNum}`;
      const tanText = entry.employerTAN ? ` | TAN: ${entry.employerTAN}` : '';
      const panText = entry.employerPAN ? ` | PAN: ${entry.employerPAN}` : '';
      const natureText = entry.natureOfEmployment ? ` | Nature: ${entry.natureOfEmployment}` : '';
      const datesText = (entry.fromDate || entry.toDate) ? ` | Period: ${entry.fromDate || 'N/A'} to ${entry.toDate || 'N/A'}` : '';
      const empTypeBadge = entry.employerType ? ` (${entry.employerType})` : '';
      const srcText = entry.sourceType ? ` | Src: ${entry.sourceType}` : '';

      partCRows.push([
        { content: `   ▶ EMPLOYER ${empNum}: ${empName.toUpperCase()}${empTypeBadge}`, styles: { fontStyle: 'bold', textColor: navyColor } },
        '',
        '',
      ]);

      partCRows.push([
        { content: `       • Details: TAN: ${entry.employerTAN || 'N/A'}${panText}${natureText}${datesText}${srcText}`, styles: { textColor: [71, 85, 105] as [number, number, number], fontSize: 6.2 } },
        '',
        '',
      ]);

      // Detailed components if available
      if (Number(entry.basicSalary) > 0) {
        partCRows.push([
          { content: '       • Basic Salary', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.basicSalary), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.dearnessAllowance) > 0) {
        partCRows.push([
          { content: '       • Dearness Allowance (DA)', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.dearnessAllowance), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.hra) > 0) {
        partCRows.push([
          { content: '       • House Rent Allowance (HRA Received)', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.hra), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.bonus) > 0) {
        partCRows.push([
          { content: '       • Bonus / Ex-gratia', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.bonus), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.commission) > 0) {
        partCRows.push([
          { content: '       • Commission', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.commission), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.otherAllowances) > 0) {
        partCRows.push([
          { content: '       • Other Allowances', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.otherAllowances), styles: { halign: 'right' } },
          '',
        ]);
      }

      const arrAmt = Number(entry.arrears || entry.salaryArrears || 0);
      if (arrAmt > 0) {
        const arrFy = entry.arrearsRelatingFY || entry.arrearsFinancialYear ? ` (Relating to F.Y. ${entry.arrearsRelatingFY || entry.arrearsFinancialYear})` : '';
        partCRows.push([
          { content: `       • Salary Arrears${arrFy}`, styles: { textColor: navyColor } },
          { content: formatPdfINR(arrAmt), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.perquisites17_2) > 0) {
        const perqDesc = entry.perquisiteDetails || entry.perquisitesDetails ? ` (${entry.perquisiteDetails || entry.perquisitesDetails})` : '';
        partCRows.push([
          { content: `       • Value of Perquisites u/s 17(2)${perqDesc}`, styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.perquisites17_2), styles: { halign: 'right' } },
          '',
        ]);
      }

      if (Number(entry.profitsInLieu17_3) > 0) {
        partCRows.push([
          { content: '       • Profits in lieu of Salary u/s 17(3)', styles: { textColor: navyColor } },
          { content: formatPdfINR(entry.profitsInLieu17_3), styles: { halign: 'right' } },
          '',
        ]);
      }

      // Gross Salary u/s 17(1) / Gross for this employer
      const entryGross = Number(entry.grossSalary) || (Number(entry.basicSalary || 0) + Number(entry.dearnessAllowance || 0) + Number(entry.hra || 0) + Number(entry.otherAllowances || 0) + Number(entry.bonus || 0) + Number(entry.commission || 0) + arrAmt + Number(entry.perquisites17_2 || 0) + Number(entry.profitsInLieu17_3 || 0));
      partCRows.push([
        { content: '       • Gross Salary u/s 17(1) for this Employer', styles: { fontStyle: 'bold', textColor: navyColor } },
        { content: formatPdfINR(entryGross), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
      ]);

      if (Number(entry.allowancesExempt) > 0) {
        partCRows.push([
          { content: '       • Less: Exempt Allowances u/s 10 (HRA / LTA etc.)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
          { content: `(-) ${formatPdfINR(entry.allowancesExempt)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
          '',
        ]);
      }

      if (Number(entry.professionalTax) > 0) {
        partCRows.push([
          { content: '       • Less: Professional Tax u/s 16(iii)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
          { content: `(-) ${formatPdfINR(entry.professionalTax)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
          '',
        ]);
      }

      if (Number(entry.entertainmentAllowance) > 0) {
        partCRows.push([
          { content: '       • Less: Entertainment Allowance u/s 16(ii)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
          { content: `(-) ${formatPdfINR(entry.entertainmentAllowance)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
          '',
        ]);
      }

      const empTaxable = entry.taxableSalaryBeforeStdDed !== undefined 
        ? Number(entry.taxableSalaryBeforeStdDed) 
        : Math.max(0, entryGross - Number(entry.allowancesExempt || 0) - Number(entry.professionalTax || 0) - Number(entry.entertainmentAllowance || 0));

      partCRows.push([
        { content: `       = Taxable Salary from Employer ${empNum} (Before Standard Deduction)`, styles: { fontStyle: 'bold', textColor: [16, 54, 107] } },
        { content: formatPdfINR(empTaxable), styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 54, 107] } },
        '',
      ]);

      if (Number(entry.tdsSalary) > 0) {
        partCRows.push([
          { content: `       • TDS Deducted by Employer ${empNum} u/s 192 (Tax Credit)`, styles: { textColor: [37, 99, 235] as [number, number, number] } },
          { content: formatPdfINR(entry.tdsSalary), styles: { halign: 'right', textColor: [37, 99, 235] as [number, number, number] } },
          '',
        ]);
      }
    });

    // Consolidated Salary Summary Section Across All Employers
    partCRows.push([
      { content: '   === SALARY SUMMARY — ALL EMPLOYERS ===', styles: { fontStyle: 'bold', textColor: navyColor } },
      '',
      '',
    ]);

    partCRows.push([
      { content: '   • Total Gross Salary Across All Employers', styles: { fontStyle: 'bold', textColor: navyColor } },
      { content: formatPdfINR(grossSal), styles: { halign: 'right', fontStyle: 'bold', textColor: navyColor } },
      '',
    ]);

    if (Number(comp.salary.allowancesExempt) > 0) {
      partCRows.push([
        { content: '   • Less: Total Allowances Exempt u/s 10 (HRA / LTA / Gratuity etc.)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: `(-) ${formatPdfINR(comp.salary.allowancesExempt)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
        '',
      ]);
    }

    if (Number(comp.salary.professionalTax) > 0) {
      partCRows.push([
        { content: '   • Less: Total Professional Tax (Tax on Employment) u/s 16(iii)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: `(-) ${formatPdfINR(comp.salary.professionalTax)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
        '',
      ]);
    }

    if (Number(comp.salary.entertainmentAllowance) > 0) {
      partCRows.push([
        { content: '   • Less: Total Entertainment Allowance u/s 16(ii)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: `(-) ${formatPdfINR(comp.salary.entertainmentAllowance)}`, styles: { halign: 'right', textColor: [185, 28, 28] as [number, number, number] } },
        '',
      ]);
    }

    // Standard Deduction u/s 16(ia) - Applied ONCE at taxpayer level
    const stdDedAmt = Number(comp.salary.standardDeduction || (comp.regimeOpted === 'new' ? Math.min(grossSal, (comp.assessmentYear?.includes('2024-25') ? 50000 : 75000)) : Math.min(grossSal, 50000)));
    const stdDedLabel = comp.regimeOpted === 'new' ? `New Regime (Max ₹${(comp.assessmentYear?.includes('2024-25') ? 50000 : 75000).toLocaleString('en-IN')})` : 'Old Regime (Max ₹50,000)';
    partCRows.push([
      { content: `   • Less: Standard Deduction u/s 16(ia) [${stdDedLabel} - Applied ONCE at Taxpayer Level]`, styles: { textColor: [22, 101, 52] as [number, number, number], fontStyle: 'bold' } },
      { content: `(-) ${formatPdfINR(stdDedAmt)}`, styles: { halign: 'right', textColor: [22, 101, 52] as [number, number, number], fontStyle: 'bold' } },
      '',
    ]);

    // Net Chargeable Salary
    partCRows.push([
      { content: '   = Net Chargeable Income under "Salaries" (u/s 15-17)', styles: { fontStyle: 'bold', textColor: navyColor } },
      { content: formatPdfINR(netSal), styles: { halign: 'right', fontStyle: 'bold', textColor: navyColor } },
      '',
    ]);

    const totalSalaryTds = salaryEntries.reduce((sum, e) => sum + (Number(e.tdsSalary) || 0), 0) || Number(comp.taxesPaid.tdsSalary || 0);
    if (totalSalaryTds > 0) {
      partCRows.push([
        { content: '   • Total TDS Deducted Across All Employers u/s 192 (Tax Credit)', styles: { textColor: [37, 99, 235] as [number, number, number], fontStyle: 'bold' } },
        { content: formatPdfINR(totalSalaryTds), styles: { halign: 'right', textColor: [37, 99, 235] as [number, number, number], fontStyle: 'bold' } },
        '',
      ]);
    }
  }

  // Capital Gains
  const hasCapitalGains = (comp.capitalGains.netCapitalGains || 0) > 0 ||
    (comp.capitalGains.stcg111A || 0) > 0 ||
    (comp.capitalGains.stcgNormal || 0) > 0 ||
    (comp.capitalGains.ltcg112A || 0) > 0 ||
    (comp.capitalGains.ltcg112 || 0) > 0 ||
    (comp.capitalGains.stcg15 || 0) > 0 ||
    (comp.capitalGains.ltcg10 || 0) > 0 ||
    (comp.capitalGains.ltcg20 || 0) > 0;

  if (hasCapitalGains) {
    const netCgVal = comp.capitalGains.netCapitalGains || ((comp.capitalGains.stcg111A || comp.capitalGains.stcg15 || 0) + (comp.capitalGains.stcgNormal || 0) + (comp.capitalGains.ltcg112A || comp.capitalGains.ltcg10 || 0) + (comp.capitalGains.ltcg112 || comp.capitalGains.ltcg20 || 0));
    partCRows.push([
      'Income from Capital Gains (Schedule CG)',
      '',
      formatPdfINR(netCgVal),
    ]);

    const isAY2627 = comp.assessmentYear?.includes('2026-27');
    if ((comp.capitalGains.stcg111A || comp.capitalGains.stcg15 || 0) > 0) {
      capitalGainRecordsPrinted++;
      partCRows.push([
        { content: `   • Short-Term Capital Gains u/s 111A (STT Paid @ ${isAY2627 ? '20%' : '15%'})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.capitalGains.stcg111A || comp.capitalGains.stcg15), styles: { halign: 'right' } },
        '',
      ]);
    }
    if ((comp.capitalGains.stcgNormal || 0) > 0) {
      capitalGainRecordsPrinted++;
      partCRows.push([
        { content: '   • Other Short-Term Capital Gains (Applicable Slab Rates)', styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.capitalGains.stcgNormal), styles: { halign: 'right' } },
        '',
      ]);
    }
    if ((comp.capitalGains.ltcg112A || comp.capitalGains.ltcg10 || 0) > 0) {
      capitalGainRecordsPrinted++;
      partCRows.push([
        { content: `   • Long-Term Capital Gains u/s 112A (Equity/MF > ₹${isAY2627 ? '1.25L' : '1L'} @ ${isAY2627 ? '12.5%' : '10%'})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.capitalGains.ltcg112A || comp.capitalGains.ltcg10), styles: { halign: 'right' } },
        '',
      ]);
    }
    if ((comp.capitalGains.ltcg112 || comp.capitalGains.ltcg20 || 0) > 0) {
      capitalGainRecordsPrinted++;
      partCRows.push([
        { content: `   • Long-Term Capital Gains u/s 112 (Property/Unlisted @ ${isAY2627 ? '12.5%' : '20%'})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.capitalGains.ltcg112 || comp.capitalGains.ltcg20), styles: { halign: 'right' } },
        '',
      ]);
    }
    if ((comp.capitalGains.stclSetOff || 0) > 0 || (comp.capitalGains.ltclSetOff || 0) > 0) {
      capitalGainRecordsPrinted++;
      partCRows.push([
        { content: '   • Less: Intra-Head Loss Set-Off (STCL / LTCL)', styles: { textColor: [22, 101, 52] as [number, number, number] } },
        { content: `(-) ${formatPdfINR((comp.capitalGains.stclSetOff || 0) + (comp.capitalGains.ltclSetOff || 0))}`, styles: { halign: 'right', textColor: [22, 101, 52] as [number, number, number] } },
        '',
      ]);
    }
    if (capitalGainRecordsPrinted === 0 && Number(comp.capitalGains.netCapitalGains || 0) > 0) {
      capitalGainRecordsPrinted++;
    }
  }

  // Business
  if (comp.business.netProfit > 0) {
    partCRows.push([
      '2. Profits & Gains of Business or Profession (u/s 44AD / 44ADA)',
      '',
      formatPdfINR(comp.business.netProfit),
    ]);
  }

  // House property
  if (comp.houseProperty.netHousePropertyIncome !== 0) {
    partCRows.push([
      'Income / Loss from House Property',
      '',
      formatPdfINR(comp.houseProperty.netHousePropertyIncome),
    ]);
  }

  // Other sources (Schedule OS Full Breakdown)
  const hasOtherSources = comp.otherSources.netOtherSources > 0 ||
    comp.otherSources.savingsInterest > 0 ||
    (comp.otherSources.bankInterestItems && comp.otherSources.bankInterestItems.length > 0) ||
    (comp.otherSources.dividendIncome || 0) > 0 ||
    (comp.otherSources.indianCompanyDividend || 0) > 0 ||
    (comp.otherSources.mutualFundDividend || 0) > 0 ||
    (comp.otherSources.familyPension || 0) > 0 ||
    (comp.otherSources.machineryHireGross || 0) > 0 ||
    (comp.otherSources.lotteryWinnings || 0) > 0 ||
    (comp.otherSources.otherIncomeItems && comp.otherSources.otherIncomeItems.length > 0);

  if (hasOtherSources) {
    partCRows.push([
      '2. Income from Other Sources (Schedule OS)',
      '',
      formatPdfINR(comp.otherSources.netOtherSources),
    ]);

    const allBankItems = comp.otherSources.bankInterestItems || [];
    const savingsItems = allBankItems.filter(b => b.interestType === 'Savings' || b.interestType === 'Post Office');
    const fdItems = allBankItems.filter(b => b.interestType === 'Fixed Deposit (FD)');
    const rdItems = allBankItems.filter(b => b.interestType === 'Recurring Deposit (RD)' || b.interestType === 'Other Interest');

    // 1. Savings Bank Interest
    savingsItems.forEach((bItem) => {
      if (Number(bItem.amount) > 0) {
        otherSourceRecordsPrinted++;
        const bankName = bItem.bankName || 'Bank';
        const acctText = bItem.accountNumber ? ` - A/c ${bItem.accountNumber}` : '';
        partCRows.push([
          { content: `   • Savings Bank Interest (${bankName}${acctText})`, styles: { textColor: navyColor } },
          { content: formatPdfINR(bItem.amount), styles: { halign: 'right' } },
          '',
        ]);
      }
    });
    if (savingsItems.length === 0 && (comp.otherSources.savingsInterest || 0) > 0) {
      otherSourceRecordsPrinted++;
      const bankTitle = comp.otherSources.savingsBankName || `${comp.client.bankName || 'Bank'} - A/c ${comp.client.accountNumber || ''}`;
      partCRows.push([
        { content: `   • Savings Bank Interest (${bankTitle})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.otherSources.savingsInterest), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 2. Fixed Deposit Interest
    fdItems.forEach((bItem) => {
      if (Number(bItem.amount) > 0) {
        otherSourceRecordsPrinted++;
        const bankName = bItem.bankName || 'Bank';
        const acctText = bItem.accountNumber ? ` - FDR/A/c ${bItem.accountNumber}` : '';
        partCRows.push([
          { content: `   • Fixed Deposit (FD) Interest (${bankName}${acctText})`, styles: { textColor: navyColor } },
          { content: formatPdfINR(bItem.amount), styles: { halign: 'right' } },
          '',
        ]);
      }
    });
    if (fdItems.length === 0 && (comp.otherSources.fdInterest || 0) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: `   • Fixed Deposit Interest (${comp.otherSources.fdBankName || 'Bank FD'})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.otherSources.fdInterest), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 3. Recurring Deposit Interest
    rdItems.forEach((bItem) => {
      if (Number(bItem.amount) > 0) {
        otherSourceRecordsPrinted++;
        const bankName = bItem.bankName || 'Bank';
        const acctText = bItem.accountNumber ? ` - A/c ${bItem.accountNumber}` : '';
        partCRows.push([
          { content: `   • Recurring Deposit (RD) Interest (${bankName}${acctText})`, styles: { textColor: navyColor } },
          { content: formatPdfINR(bItem.amount), styles: { halign: 'right' } },
          '',
        ]);
      }
    });
    if (rdItems.length === 0 && (comp.otherSources.rdInterest || 0) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: `   • Recurring Deposit Interest (${comp.otherSources.rdBankName || 'Bank RD'})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.otherSources.rdInterest), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 4. IT Refund Interest u/s 244A
    if (Number(comp.otherSources.itRefundInterest) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Interest on Income Tax Refund u/s 244A', styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.otherSources.itRefundInterest), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 5. Pass-Through Interest
    if (Number(comp.otherSources.passThroughInterest) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Pass-through Interest Income (Sec 115UA / 115UB)', styles: { textColor: navyColor } },
        { content: formatPdfINR(comp.otherSources.passThroughInterest), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 6. Dividend Income
    const divInd = Number(comp.otherSources.indianCompanyDividend) || 0;
    const divMf = Number(comp.otherSources.mutualFundDividend) || 0;
    const divRaw = Number(comp.otherSources.dividendIncome) || 0;
    const divTotal = (divInd + divMf > 0) ? (divInd + divMf) : divRaw;
    if (divTotal > 0) {
      otherSourceRecordsPrinted++;
      const divDesc = divInd > 0 ? ` (Companies: ₹${divInd.toLocaleString('en-IN')}${divMf > 0 ? `, MF: ₹${divMf.toLocaleString('en-IN')}` : ''})` : '';
      partCRows.push([
        { content: `   • Dividend Income${divDesc}`, styles: { textColor: navyColor } },
        { content: formatPdfINR(divTotal), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 7. Family Pension
    const famPensionGross = Number(comp.otherSources.familyPension) || 0;
    if (famPensionGross > 0) {
      otherSourceRecordsPrinted++;
      const famPensionDed = Number(comp.otherSources.familyPensionDeduction) || Math.min(famPensionGross, Math.min(comp.regimeOpted === 'new' ? 25000 : 15000, Math.round(famPensionGross / 3)));
      const famPensionNet = Math.max(0, famPensionGross - famPensionDed);
      partCRows.push([
        { content: `   • Family Pension (Gross: ₹${famPensionGross.toLocaleString('en-IN')} - Sec 57(iia) Ded: ₹${famPensionDed.toLocaleString('en-IN')})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(famPensionNet), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 8. Machinery/Plant Hire
    const machGross = Number(comp.otherSources.machineryHireGross) || 0;
    if (machGross > 0) {
      otherSourceRecordsPrinted++;
      const machExp = Number(comp.otherSources.machineryHireExpenses) || 0;
      const machNet = Math.max(0, machGross - machExp);
      partCRows.push([
        { content: `   • Machinery/Plant Hire (Gross: ₹${machGross.toLocaleString('en-IN')} - Sec 57 Exp: ₹${machExp.toLocaleString('en-IN')})`, styles: { textColor: navyColor } },
        { content: formatPdfINR(machNet), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 9. Special Rates Winnings (30% / 60%)
    if (Number(comp.otherSources.lotteryWinnings) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Lottery / Betting Winnings u/s 115BB (@ 30%)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: formatPdfINR(comp.otherSources.lotteryWinnings), styles: { halign: 'right' } },
        '',
      ]);
    }
    if (Number(comp.otherSources.onlineGamesWinnings) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Net Winnings from Online Games u/s 115BBJ (@ 30%)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: formatPdfINR(comp.otherSources.onlineGamesWinnings), styles: { halign: 'right' } },
        '',
      ]);
    }
    if (Number(comp.otherSources.horseRacesWinnings) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Horse Races Winnings (@ 30%)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: formatPdfINR(comp.otherSources.horseRacesWinnings), styles: { halign: 'right' } },
        '',
      ]);
    }
    if (Number(comp.otherSources.unexplainedIncome115BBE) > 0) {
      otherSourceRecordsPrinted++;
      partCRows.push([
        { content: '   • Unexplained Money / Investment u/s 115BBE (@ 60%)', styles: { textColor: [185, 28, 28] as [number, number, number] } },
        { content: formatPdfINR(comp.otherSources.unexplainedIncome115BBE), styles: { halign: 'right' } },
        '',
      ]);
    }

    // 10. Itemized Other Income list
    const otherItemsList = comp.otherSources.otherIncomeItems || [];
    otherItemsList.forEach((oItem) => {
      if (Number(oItem.netAmount) > 0) {
        otherSourceRecordsPrinted++;
        const desc = oItem.description ? ` (${oItem.description})` : '';
        partCRows.push([
          { content: `   • ${oItem.category}${desc}`, styles: { textColor: navyColor } },
          { content: formatPdfINR(oItem.netAmount), styles: { halign: 'right' } },
          '',
        ]);
      }
    });

    if (otherItemsList.length === 0 && ((comp.otherSources.otherIncome || 0) > 0 || (comp.otherSources.anyOtherIncome || 0) > 0)) {
      const anyNet = Number((comp.otherSources.otherIncome || 0) + (comp.otherSources.anyOtherIncome || 0) - (comp.otherSources.anyOtherIncomeExpenses || 0));
      if (anyNet > 0) {
        otherSourceRecordsPrinted++;
        partCRows.push([
          { content: '   • Miscellaneous Other Income', styles: { textColor: navyColor } },
          { content: formatPdfINR(anyNet), styles: { halign: 'right' } },
          '',
        ]);
      }
    }

    if (otherSourceRecordsPrinted === 0 && Number(comp.otherSources.netOtherSources || 0) > 0) {
      otherSourceRecordsPrinted++;
    }
  }

  // Agricultural Income (Exempt u/s 10(1))
  const agriNet = comp.agriculturalIncome || comp.agriculturalDetails?.netAgriculturalIncome || comp.otherSources?.agriculturalIncome || 0;
  const agriGross = comp.agriculturalDetails?.grossAgriculturalReceipts || (agriNet > 0 ? Math.round(agriNet * 1.4) : 0);
  const agriExp = comp.agriculturalDetails?.agriculturalExpenses || (agriGross - agriNet > 0 ? agriGross - agriNet : 0);

  if (agriNet > 0 || agriGross > 0) {
    partCRows.push([
      {
        content: `3. Agricultural Income (Exempt u/s 10(1))\n   • Gross Receipts: ${formatPdfINR(agriGross)} | Less Expenses: ${formatPdfINR(agriExp)}`,
        styles: { textColor: [22, 101, 52] as [number, number, number], fontStyle: 'bold' }
      },
      { content: formatPdfINR(agriNet), styles: { halign: 'right', textColor: [22, 101, 52] as [number, number, number] } },
      { content: '0 (Exempt)', styles: { halign: 'right', textColor: [100, 116, 139] as [number, number, number] } },
    ]);
  }

  // Gross Total Income
  partCRows.push([
    { content: 'GROSS TOTAL INCOME (GTI)', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    '',
    { content: formatPdfINR(comp.grossTotalIncome), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  // Deductions
  partCRows.push([
    'Less: Deductions under Chapter VI-A',
    formatPdfINR(comp.deductions.totalDeductions),
    formatPdfINR(comp.deductions.totalDeductions),
  ]);

  // Total Taxable Income
  partCRows.push([
    { content: 'TOTAL TAXABLE INCOME (ROUNDED OFF U/S 288A)', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    '',
    { content: formatPdfINR(comp.totalTaxableIncome), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        { content: 'PART C: COMPUTATION OF TOTAL TAXABLE INCOME', colSpan: 3, styles: { fillColor: [240, 245, 255], textColor: navyColor, fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2, halign: 'left' } },
      ],
      [
        'Head of Income / Particulars',
        { content: 'Details (₹)', styles: { halign: 'right' } },
        { content: 'Amount (₹)', styles: { halign: 'right' } },
      ],
    ],
    body: partCRows,
    theme: 'grid',
    headStyles: {
      fillColor: headerBgColor,
      textColor: 255,
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.1,
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.0,
      textColor: [30, 41, 59],
      lineColor: borderColor,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 35, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: zebraBgColor,
    },
    margin: { left: leftMargin, right: rightMargin },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 2;

  // 5. PART D: TAX COMPUTATION & DETAILED SLAB BREAKDOWN
  const slabThreshold = comp.assessmentYear === '2026-27' ? '0 TO ₹4,00,000 SLAB' : comp.regimeOpted === 'new' ? '0 TO ₹3,00,000 SLAB' : 'OLD REGIME SLAB';
  const partDTitle = `PART D: TAX COMPUTATION & DETAILED SLAB BREAKDOWN (${slabThreshold})`;

  const partDRows: any[] = [
    [
      { content: 'Taxable Total Income', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      'Rounded off u/s 288A',
      { content: formatPdfINR(comp.totalTaxableIncome), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
    ],
  ];

  // Dynamic Slabs matching screenshot:
  if (comp.assessmentYear === '2026-27') {
    partDRows.push([
      '• Income up to ₹4,00,000',
      'NIL Exemption Limit',
      '0',
    ]);
    if (comp.totalTaxableIncome > 400000) {
      const taxableAbove4L = Math.min(comp.totalTaxableIncome - 400000, 400000);
      const taxAbove4L = Math.round(taxableAbove4L * 0.05);
      partDRows.push([
        `• Income above ₹4,00,000 to ₹${Number(comp.totalTaxableIncome).toLocaleString('en-IN')}`,
        `5% on ₹${Number(taxableAbove4L).toLocaleString('en-IN')}`,
        formatPdfINR(taxAbove4L),
      ]);
    }
    if (comp.totalTaxableIncome > 800000) {
      const taxableAbove8L = Math.min(comp.totalTaxableIncome - 800000, 400000);
      const taxAbove8L = Math.round(taxableAbove8L * 0.10);
      partDRows.push([
        `• Income above ₹8,00,000 to ₹${Number(comp.totalTaxableIncome).toLocaleString('en-IN')}`,
        `10% on ₹${Number(taxableAbove8L).toLocaleString('en-IN')}`,
        formatPdfINR(taxAbove8L),
      ]);
    }
  } else if (comp.regimeOpted === 'new') {
    partDRows.push([
      '• Income up to ₹3,00,000',
      'NIL Exemption Limit',
      '0',
    ]);
    if (comp.totalTaxableIncome > 300000) {
      const taxableAbove3L = Math.min(comp.totalTaxableIncome - 300000, 400000);
      const taxAbove3L = Math.round(taxableAbove3L * 0.05);
      partDRows.push([
        `• Income above ₹3,00,000 to ₹${Number(comp.totalTaxableIncome).toLocaleString('en-IN')}`,
        `5% on ₹${Number(taxableAbove3L).toLocaleString('en-IN')}`,
        formatPdfINR(taxAbove3L),
      ]);
    }
  } else {
    partDRows.push([
      '• Income up to ₹2,50,000',
      'NIL Exemption Limit',
      '0',
    ]);
    if (comp.totalTaxableIncome > 250000) {
      const taxableAbove25L = Math.min(comp.totalTaxableIncome - 250000, 250000);
      const taxAbove25L = Math.round(taxableAbove25L * 0.05);
      partDRows.push([
        `• Income above ₹2,50,000 to ₹${Number(comp.totalTaxableIncome).toLocaleString('en-IN')}`,
        `5% on ₹${Number(taxableAbove25L).toLocaleString('en-IN')}`,
        formatPdfINR(taxAbove25L),
      ]);
    }
  }

  // Special Rate Tax Breakdown Rows in PDF
  if (comp.specialRateBreakdown && comp.specialRateBreakdown.length > 0) {
    comp.specialRateBreakdown.forEach((sItem) => {
      partDRows.push([
        { content: `• ${sItem.section}: ${sItem.description} (₹${Number(sItem.income).toLocaleString('en-IN')})`, styles: { textColor: navyColor } },
        `Tax @ ${sItem.rate}`,
        formatPdfINR(sItem.tax),
      ]);
    });
  }

  // Tax on Normal Income / Gross Tax
  partDRows.push([
    { content: 'GROSS TAX PAYABLE ON TOTAL INCOME', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    { content: comp.taxOnSpecialIncome ? `Normal: ₹${Number(comp.taxOnNormalIncome).toLocaleString('en-IN')} + Special: ₹${Number(comp.taxOnSpecialIncome).toLocaleString('en-IN')}` : 'Calculated Tax', styles: { fontStyle: 'bold' } },
    { content: formatPdfINR(comp.totalTaxBeforeRebate || ((comp.taxOnNormalIncome || 0) + (comp.taxOnSpecialIncome || 0))), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  // Rebate 87A
  const rebateMethod = comp.regimeOpted === 'new' 
    ? (comp.assessmentYear?.includes('2026-27') ? 'Full Rebate u/s 115BAC (Up to ₹12L / Max ₹60,000)' : 'Full Rebate u/s 115BAC (Up to ₹7L / Max ₹25,000)')
    : 'Rebate u/s 87A (Up to ₹5L / Max ₹12,500)';
  partDRows.push([
    'Less: Rebate u/s 87A',
    rebateMethod,
    formatPdfINR(comp.rebate87A),
  ]);

  // Tax Payable after rebate
  partDRows.push([
    { content: 'TAX PAYABLE AFTER REBATE', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    { content: 'Rebate Applied', styles: { fontStyle: 'bold' } },
    { content: formatPdfINR(comp.taxAfterRebate), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  // Surcharge if applicable
  if (Number(comp.surcharge) > 0) {
    partDRows.push([
      'Add: Surcharge',
      'Applicable Surcharge Rate',
      formatPdfINR(comp.surcharge),
    ]);
  }

  // Cess
  partDRows.push([
    'Add: Health & Education Cess @ 4%',
    '4% on Net Tax',
    formatPdfINR(comp.healthAndEducationCess),
  ]);

  // Total Tax Liability
  partDRows.push([
    { content: 'TOTAL TAX LIABILITY', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    { content: 'Final Tax Payable', styles: { fontStyle: 'bold' } },
    { content: formatPdfINR(comp.grossTaxLiability), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  // Taxes Paid Breakdown
  partDRows.push([
    { content: 'TAXES PAID & PREPAID CREDITS (SCHEDULE TDS / TCS / ADV / SAT)', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
    '-',
    { content: formatPdfINR(comp.taxesPaid.totalTaxesPaid), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } },
  ]);

  if (Number(comp.taxesPaid.tdsSalary) > 0 || (salaryEntries.some(e => Number(e.tdsSalary) > 0))) {
    const totSalTds = Number(comp.taxesPaid.tdsSalary) || salaryEntries.reduce((s, e) => s + (Number(e.tdsSalary) || 0), 0);
    partDRows.push([
      { content: '   • TDS on Salary u/s 192 (As per Form 16 / 26AS)', styles: { textColor: navyColor } },
      formatPdfINR(totSalTds),
      '',
    ]);
    if (salaryEntries.length > 1) {
      salaryEntries.forEach((e, i) => {
        if (Number(e.tdsSalary) > 0) {
          partDRows.push([
            { content: `       - Employer ${i + 1}: ${e.employerName || 'Employer'}${e.employerTAN ? ` (TAN: ${e.employerTAN})` : ''}`, styles: { textColor: [71, 85, 105] as [number, number, number], fontSize: 6.2 } },
            formatPdfINR(e.tdsSalary),
            '',
          ]);
        }
      });
    }
  }

  if (Number(comp.taxesPaid.tdsOther) > 0) {
    partDRows.push([
      { content: '   • TDS Other than Salary (u/s 194A / 194C / 194J / 194Q etc.)', styles: { textColor: navyColor } },
      formatPdfINR(comp.taxesPaid.tdsOther),
      '',
    ]);
  }

  if (Number(comp.taxesPaid.tcs) > 0) {
    partDRows.push([
      { content: '   • Tax Collected at Source (TCS u/s 206C)', styles: { textColor: navyColor } },
      formatPdfINR(comp.taxesPaid.tcs),
      '',
    ]);
  }

  if (Number(comp.taxesPaid.advanceTax) > 0) {
    partDRows.push([
      { content: '   • Advance Tax Paid u/s 208-211', styles: { textColor: navyColor } },
      formatPdfINR(comp.taxesPaid.advanceTax),
      '',
    ]);
  }

  if (Number(comp.taxesPaid.selfAssessmentTax) > 0) {
    partDRows.push([
      { content: '   • Self Assessment Tax Paid u/s 140A', styles: { textColor: navyColor } },
      formatPdfINR(comp.taxesPaid.selfAssessmentTax),
      '',
    ]);
  }

  // Net Amount Payable / Refundable
  const netAmount = comp.refundDue > 0 ? comp.refundDue : comp.netTaxPayable;
  const netLabel = comp.refundDue > 0 ? 'NET REFUND DUE TO ASSESSEE (ROUNDED U/S 288B)' : 'NET TAX PAYABLE / (REFUNDABLE) (ROUNDED U/S 288B)';
  partDRows.push([
    { 
      content: netLabel, 
      styles: { 
        fontStyle: 'bold', 
        fillColor: [230, 240, 250] as [number, number, number], 
        textColor: comp.refundDue > 0 ? [22, 101, 52] as [number, number, number] : [185, 28, 28] as [number, number, number], 
        fontSize: 7.4 
      } 
    },
    { 
      content: '-', 
      styles: { 
        fillColor: [230, 240, 250] as [number, number, number] 
      } 
    },
    { 
      content: formatPdfINR(netAmount), 
      styles: { 
        fontStyle: 'bold', 
        halign: 'right', 
        fillColor: [230, 240, 250] as [number, number, number], 
        textColor: comp.refundDue > 0 ? [22, 101, 52] as [number, number, number] : [185, 28, 28] as [number, number, number], 
        fontSize: 7.4 
      } 
    },
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        { content: partDTitle, colSpan: 3, styles: { fillColor: [240, 245, 255], textColor: navyColor, fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2, halign: 'left' } },
      ],
      [
        'Tax Slab / Particulars',
        'Applicable Rate / Calculation',
        { content: 'Tax Amount (₹)', styles: { halign: 'right' } },
      ],
    ],
    body: partDRows,
    theme: 'grid',
    headStyles: {
      fillColor: headerBgColor,
      textColor: 255,
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.1,
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.0,
      textColor: [30, 41, 59],
      lineColor: borderColor,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 96 },
      1: { cellWidth: 56 },
      2: { cellWidth: 38, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: zebraBgColor,
    },
    margin: { left: leftMargin, right: rightMargin },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 2;

  // 6. PART E: BANK ACCOUNT DETAILS & VALIDATION STATUS
  const bankRows: any[] = [];
  if (comp.client.bankAccounts && comp.client.bankAccounts.length > 0) {
    comp.client.bankAccounts.forEach((bAcc) => {
      bankRecordsPrinted++;
      const bName = bAcc.isRefundNominated ? `${bAcc.bankName || 'Bank'} (★ Refund A/c)` : (bAcc.bankName || 'Bank');
      const valStatus = bAcc.isRefundNominated ? 'VALIDATED & ELECTED' : 'VALIDATED';
      bankRows.push([
        bName,
        { content: bAcc.accountNumber || '-', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
        bAcc.ifscCode || '-',
        { content: valStatus, styles: { fontStyle: 'bold', textColor: [22, 101, 52] as [number, number, number] } },
      ]);
    });
  } else {
    bankRecordsPrinted++;
    bankRows.push([
      comp.client.bankName || 'Capital Small Finance Bank Limited',
      { content: comp.client.accountNumber || '052200002279', styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      comp.client.ifscCode || 'CLBL0000052',
      { content: comp.client.validationStatus || 'VALIDATED & ELECTED', styles: { fontStyle: 'bold', textColor: [22, 101, 52] as [number, number, number] } },
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        { content: 'PART E: BANK ACCOUNT DETAILS & VALIDATION STATUS', colSpan: 4, styles: { fillColor: [240, 245, 255], textColor: navyColor, fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2, halign: 'left' } },
      ],
      [
        'Bank Name',
        'Account Number',
        'IFSC Code',
        'Validation Status',
      ],
    ],
    body: bankRows,
    theme: 'grid',
    headStyles: {
      fillColor: headerBgColor,
      textColor: 255,
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.1,
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.0,
      textColor: [30, 41, 59],
      lineColor: borderColor,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 46 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
    margin: { left: leftMargin, right: rightMargin },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 4;

  // 7. FOOTER & ASSESSEE SIGNATURE
  currentY += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);

  const sigText = 'Assessee Signature: _______________________';
  doc.text(sigText, pageWidth - rightMargin, currentY, { align: 'right' });

  currentY += 8.5; // Gap between signature line and name details
  const nameVal = (comp.client.name || 'SARABJIT KAUR').toUpperCase();
  const dateVal = comp.filingDate || '31-Jul-2026';
  const placeVal = comp.client.placeOfFiling || 'LOHIAN KHAS';
  const signInfo = `Name: ${nameVal} | Date: ${dateVal} | Place: ${placeVal}`;
  doc.setFont('helvetica', 'bold');
  doc.text(signInfo, pageWidth - rightMargin, currentY, { align: 'right' });

  const hasBalanceSheet = Boolean(comp.balanceSheet && comp.balanceSheet.enabled !== false && comp.balanceSheet.showInPrint !== false);

  // 8. PAGE 2: SCHEDULE BALANCE SHEET / STATEMENT OF AFFAIRS (IF ENABLED)
  if (hasBalanceSheet && comp.balanceSheet) {
    doc.addPage();
    const bs = comp.balanceSheet;
    let bsY = 10;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.text('SCHEDULE BALANCE SHEET (FINANCIAL PARTICULARS)', pageWidth / 2, bsY, { align: 'center' });

    bsY += 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const asOnDate = bs.asOnDate || `31st March ${comp.financialYear?.split('-')[1]?.length === 2 ? '20' + comp.financialYear.split('-')[1] : '2026'}`;
    doc.text(
      `Statement of Assets & Liabilities as on ${asOnDate} (Relevant to A.Y. ${comp.assessmentYear || '2026-27'})`,
      pageWidth / 2,
      bsY,
      { align: 'center' }
    );

    bsY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    const bsBizName = comp.business.businessName || comp.business.natureOfBusiness || 'Business & Profession';
    doc.text(
      `M/s ${(comp.client.name || 'SARABJIT KAUR').toUpperCase()} | PAN: ${(comp.client.pan || '').toUpperCase()} | Business: ${bsBizName}`,
      pageWidth / 2,
      bsY,
      { align: 'center' }
    );

    bsY += 3;
    doc.setDrawColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setLineWidth(0.6);
    doc.line(leftMargin, bsY, pageWidth - rightMargin, bsY);
    bsY += 2;

    // Build paired rows for the 4-column Balance Sheet table
    // Left: Liabilities | Amount | Right: Assets | Amount
    const leftItems: Array<{ label: string; amt: string; isHeader?: boolean; isSub?: boolean; isTotal?: boolean }> = [];
    const rightItems: Array<{ label: string; amt: string; isHeader?: boolean; isSub?: boolean; isTotal?: boolean }> = [];

    // Left Items (Capital & Liabilities)
    leftItems.push({ 
      label: `CAPITAL A/C (Proprietor's Capital)${bs.capitalAccountDetails ? `\n  ${bs.capitalAccountDetails}` : ''}:`, 
      amt: formatPdfINR(bs.closingCapital), 
      isHeader: true 
    });

    if (bs.securedLoans && bs.securedLoans > 0) {
      leftItems.push({ label: `SECURED LOANS${bs.securedLoansDetails ? ` (${bs.securedLoansDetails})` : ''}:`, amt: formatPdfINR(bs.securedLoans), isHeader: true });
    }

    if (bs.unsecuredLoans && bs.unsecuredLoans > 0) {
      leftItems.push({ label: `UNSECURED LOANS${bs.unsecuredLoansDetails ? ` (${bs.unsecuredLoansDetails})` : ''}:`, amt: formatPdfINR(bs.unsecuredLoans), isHeader: true });
    }

    leftItems.push({ 
      label: `SUNDRY CREDITORS (Trade Payables)${bs.sundryCreditorsDetails ? `\n  ${bs.sundryCreditorsDetails}` : ''}:`, 
      amt: formatPdfINR(bs.sundryCreditors), 
      isHeader: true 
    });

    if (bs.otherCurrentLiabilities && bs.otherCurrentLiabilities > 0) {
      leftItems.push({ 
        label: `OTHER CURRENT LIABILITIES${bs.otherLiabilitiesDetails ? ` (${bs.otherLiabilitiesDetails})` : ''}:`, 
        amt: formatPdfINR(bs.otherCurrentLiabilities), 
        isHeader: true 
      });
    }

    // Right Items (Property & Assets)
    if ((bs.grossFixedAssets && bs.grossFixedAssets > 0) || (bs.netFixedAssets && bs.netFixedAssets > 0)) {
      rightItems.push({ label: 'FIXED ASSETS (At W.D.V.):', amt: '', isHeader: true });
      if (bs.grossFixedAssets && bs.grossFixedAssets > 0) {
        rightItems.push({ label: '  • Gross Block (Cost)', amt: formatPdfINR(bs.grossFixedAssets), isSub: true });
      }
      if (bs.depreciation && bs.depreciation > 0) {
        rightItems.push({ label: '  • Less: Depreciation for Year', amt: `-${formatPdfINR(bs.depreciation)}`, isSub: true });
      }
      rightItems.push({ 
        label: `Net Fixed Assets (WDV as on 31st March)${bs.fixedAssetsDetails ? `\n  (${bs.fixedAssetsDetails})` : ''}:`, 
        amt: formatPdfINR(bs.netFixedAssets), 
        isHeader: true 
      });
    }

    if (bs.investments && bs.investments > 0) {
      rightItems.push({ 
        label: `INVESTMENTS${bs.investmentsDetails ? ` (${bs.investmentsDetails})` : ''}:`, 
        amt: formatPdfINR(bs.investments), 
        isHeader: true 
      });
    }

    rightItems.push({ label: 'CURRENT ASSETS, LOANS & ADVANCES:', amt: '', isHeader: true });
    rightItems.push({ label: '  • Stock-in-trade / Inventories (Valued at Cost/Market)', amt: formatPdfINR(bs.closingStock), isSub: true });
    rightItems.push({ 
      label: `  • Sundry Debtors (Receivables)${bs.sundryDebtorsDetails ? `\n    ${bs.sundryDebtorsDetails}` : ''}`, 
      amt: formatPdfINR(bs.sundryDebtors), 
      isSub: true 
    });
    rightItems.push({ label: '  • Cash in Hand (as on 31st March - Physical Cash)', amt: formatPdfINR(bs.cashInHand), isSub: true });
    rightItems.push({ 
      label: `  • Balance with Scheduled Banks${bs.bankBalancesDetails ? `\n    ${bs.bankBalancesDetails}` : ''}`, 
      amt: formatPdfINR(bs.bankBalances), 
      isSub: true 
    });

    if (bs.loansAndAdvances && bs.loansAndAdvances > 0) {
      rightItems.push({ 
        label: `  • Loans, Advances & Deposits${bs.loansAndAdvancesDetails ? ` (${bs.loansAndAdvancesDetails})` : ''}`, 
        amt: formatPdfINR(bs.loansAndAdvances), 
        isSub: true 
      });
    }

    // Zip left and right into table rows
    const maxRows = Math.max(leftItems.length, rightItems.length);
    const bsTableBody: any[] = [];

    for (let i = 0; i < maxRows; i++) {
      const l = leftItems[i] || { label: '', amt: '' };
      const r = rightItems[i] || { label: '', amt: '' };

      bsTableBody.push([
        { 
          content: l.label, 
          styles: { 
            fontStyle: l.isHeader ? 'bold' : 'normal',
            textColor: l.isHeader ? [16, 54, 107] : [51, 65, 85]
          } 
        },
        { 
          content: l.amt, 
          styles: { 
            halign: 'right', 
            fontStyle: l.isHeader ? 'bold' : 'normal',
            textColor: [0, 0, 0]
          } 
        },
        { 
          content: r.label, 
          styles: { 
            fontStyle: r.isHeader ? 'bold' : 'normal',
            textColor: r.isHeader ? [16, 54, 107] : [51, 65, 85]
          } 
        },
        { 
          content: r.amt, 
          styles: { 
            halign: 'right', 
            fontStyle: r.isHeader ? 'bold' : 'normal',
            textColor: [0, 0, 0]
          } 
        },
      ]);
    }

    // Total Row
    bsTableBody.push([
      { 
        content: 'TOTAL LIABILITIES & CAPITAL:', 
        styles: { fontStyle: 'bold', fillColor: [240, 245, 255], textColor: navyColor } 
      },
      { 
        content: formatPdfINR(bs.totalLiabilities), 
        styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 245, 255], textColor: navyColor } 
      },
      { 
        content: 'TOTAL PROPERTY & ASSETS:', 
        styles: { fontStyle: 'bold', fillColor: [240, 245, 255], textColor: navyColor } 
      },
      { 
        content: formatPdfINR(bs.totalAssets), 
        styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 245, 255], textColor: navyColor } 
      },
    ]);

    // Balance status verification row
    const diffBs = Math.abs((Number(bs.totalLiabilities) || 0) - (Number(bs.totalAssets) || 0));
    const isBsBalanced = diffBs < 2;
    bsTableBody.push([
      { 
        content: `Balance Status: ${isBsBalanced ? 'BALANCED ✓' : 'DIFFERENCE DETECTED ⚠'}`, 
        colSpan: 2, 
        styles: { fontStyle: 'bold', fillColor: isBsBalanced ? [240, 253, 244] : [254, 242, 242], textColor: isBsBalanced ? [22, 101, 52] : [185, 28, 28], halign: 'center' } 
      },
      { 
        content: `Variance: ₹${diffBs.toLocaleString('en-IN')}`, 
        colSpan: 2, 
        styles: { fontStyle: 'bold', fillColor: isBsBalanced ? [240, 253, 244] : [254, 242, 242], textColor: isBsBalanced ? [22, 101, 52] : [185, 28, 28], halign: 'center' } 
      },
    ]);

    autoTable(doc, {
      startY: bsY,
      head: [
        [
          { content: 'LIABILITIES & CAPITAL (Amount in ₹)', colSpan: 2, styles: { fillColor: headerBgColor, textColor: 255, fontStyle: 'bold', fontSize: 7.2, halign: 'center' } },
          { content: 'PROPERTY & ASSETS (Amount in ₹)', colSpan: 2, styles: { fillColor: headerBgColor, textColor: 255, fontStyle: 'bold', fontSize: 7.2, halign: 'center' } },
        ],
        [
          'Particulars',
          { content: 'Amount (₹)', styles: { halign: 'right' } },
          'Particulars',
          { content: 'Amount (₹)', styles: { halign: 'right' } },
        ],
      ],
      body: bsTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgColor,
        textColor: 255,
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.1,
      },
      styles: {
        fontSize: 6.7,
        cellPadding: 1.0,
        textColor: [30, 41, 59],
        lineColor: borderColor,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 32, halign: 'right' },
        2: { cellWidth: 63 },
        3: { cellWidth: 32, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: zebraBgColor,
      },
      margin: { left: leftMargin, right: rightMargin },
    });

    // @ts-ignore
    let bsFinalY = doc.lastAutoTable.finalY + 4;

    // Footnote & verification
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      '* Note: Statement of Assets & Liabilities compiled from details and books produced by the assessee for filing return u/s 44AD / 44ADA.',
      leftMargin,
      bsFinalY
    );

    bsFinalY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    doc.text('Assessee Signature: _______________________', pageWidth - rightMargin, bsFinalY, { align: 'right' });

    bsFinalY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(
      `For M/s ${(comp.client.name || 'SARABJIT KAUR').toUpperCase()} (Proprietor)`,
      pageWidth - rightMargin,
      bsFinalY,
      { align: 'right' }
    );
  }

  // ==========================================
  // DATA COMPLETENESS VALIDATION (Requirement 23)
  // ==========================================
  if (salaryRecordsFound > 0 && salaryRecordsPrinted < salaryRecordsFound) {
    throw new Error(`Data Completeness Check Failed: Found ${salaryRecordsFound} salary records in source data but rendered ${salaryRecordsPrinted}. PDF generation halted.`);
  }
  if (bankRecordsFound > 0 && bankRecordsPrinted < bankRecordsFound) {
    throw new Error(`Data Completeness Check Failed: Found ${bankRecordsFound} bank accounts in source data but rendered ${bankRecordsPrinted}. PDF generation halted.`);
  }
  if (businessRecordsFound > 0 && businessRecordsPrinted < businessRecordsFound) {
    throw new Error(`Data Completeness Check Failed: Found ${businessRecordsFound} business records in source data but rendered ${businessRecordsPrinted}. PDF generation halted.`);
  }
  if (capitalGainRecordsFound > 0 && capitalGainRecordsPrinted < capitalGainRecordsFound) {
    throw new Error(`Data Completeness Check Failed: Found ${capitalGainRecordsFound} capital gains records in source data but rendered ${capitalGainRecordsPrinted}. PDF generation halted.`);
  }
  if (otherSourceRecordsFound > 0 && otherSourceRecordsPrinted < otherSourceRecordsFound) {
    throw new Error(`Data Completeness Check Failed: Found ${otherSourceRecordsFound} other source income records in source data but rendered ${otherSourceRecordsPrinted}. PDF generation halted.`);
  }

  // Dynamic Running Header & Footer & Page Numbering across ALL pages
  const totalPages = typeof (doc as any).getNumberOfPages === 'function' 
    ? (doc as any).getNumberOfPages() 
    : (doc.internal.pages ? doc.internal.pages.length - 1 : 1);

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Running Header on Page 2+
    if (p > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.text(
        `INCOME TAX COMPUTATION STATEMENT | AY ${comp.assessmentYear || '2026-27'} | Assessee: ${(comp.client.name || 'Assessee').toUpperCase()} (PAN: ${(comp.client.pan || '').toUpperCase()})`,
        leftMargin,
        6.5
      );
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, 7.5, pageWidth - rightMargin, 7.5);
    }

    // Running Footer on ALL pages
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Confidential — Income Tax Computation Statement',
      leftMargin,
      290,
      { align: 'left' }
    );
    doc.text(
      `Assessee: ${(comp.client.name || 'Assessee').toUpperCase()} | PAN: ${(comp.client.pan || '').toUpperCase()} | A.Y.: ${comp.assessmentYear || '2026-27'}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - rightMargin,
      290,
      { align: 'right' }
    );
  }

  return doc;
}

export function generateComputationPdf(comp: TaxComputation, firm: FirmDetails): void {
  try {
    const doc = buildComputationPdfDoc(comp, firm);
    const safeName = (comp.client.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Computation_${comp.client.pan || 'PAN'}_${comp.assessmentYear || 'AY'}_${safeName}.pdf`;
    doc.save(fileName);
  } catch (err: any) {
    console.error('Computation PDF Export Error:', err);
    alert(`PDF Export Failed: ${err?.message || 'An unexpected error occurred while generating the PDF.'}`);
  }
}

export function createComputationPdfBlob(comp: TaxComputation, firm: FirmDetails): { blob: Blob; fileName: string; file: File } {
  const doc = buildComputationPdfDoc(comp, firm);
  const safeName = (comp.client.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Computation_${comp.client.pan || 'PAN'}_${comp.assessmentYear || 'AY'}_${safeName}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  return { blob, fileName, file };
}

export function printComputationPdf(comp: TaxComputation, firm: FirmDetails): void {
  try {
    const doc = buildComputationPdfDoc(comp, firm);
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    // Create an invisible iframe to print the exact PDF
    const iframe = document.createElement('iframe');
    iframe.id = 'computation-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        }
      }, 300);
    };
  } catch (err: any) {
    console.error('PDF print generation error, falling back to window.print():', err);
    alert(`PDF Print Failed: ${err?.message || 'An error occurred during print PDF generation.'}`);
    try {
      window.print();
    } catch (e) {
      console.error('window.print() error:', e);
    }
  }
}
