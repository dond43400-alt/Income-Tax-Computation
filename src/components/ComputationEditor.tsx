import React, { useState } from 'react';
import { 
  X, Save, Plus, Trash2, Landmark, Briefcase, Calculator, Building2, 
  Check, User, BadgeCheck, MapPin, CheckCircle2, Coins, Receipt, 
  FileText, Sparkles, Percent, HelpCircle, Layers, ShieldCheck,
  AlertTriangle, Truck, BookOpen, Milk
} from 'lucide-react';
import { 
  TaxComputation, ITRFormType, TaxRegime, BankInterestItem, 
  BusinessItem, ClientBankAccount, OtherIncomeItem, OtherIncomeCategory, 
  OtherSourcesDetails, BalanceSheetDetails 
} from '../types';
import { recalculateFullComputation, calculateNetOtherSources, calculateNetSalary } from '../utils/taxCalculator';
import { PUNJAB_BANKS } from '../utils/punjabBanks';
import { ITR_BUSINESS_CODES } from '../utils/businessCodes';
import { lookupPincodeOffline, lookupPincodeAsync } from '../utils/pincodeLookup';
import { lookupIfscOffline, lookupIfscAsync } from '../utils/ifscLookup';
import { checkITREligibility } from '../utils/itrEligibilityEngine';
import { ITREligibilityBanner } from './ITREligibilityBanner';
import { BalanceSheetEditor } from './BalanceSheetEditor';
import { SalaryListEditor } from './SalaryListEditor';
import { calculateSingleBusiness } from '../utils/businessCalculationEngine';

interface ComputationEditorProps {
  computation: TaxComputation;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: TaxComputation) => void;
}

export const ComputationEditor: React.FC<ComputationEditorProps> = ({
  computation,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  // Initialize form state with fallback arrays if not already present
  const [formData, setFormData] = useState<TaxComputation>(() => {
    const data = { ...computation };

    // Initialize bankAccounts if empty
    if (!data.client.bankAccounts || data.client.bankAccounts.length === 0) {
      data.client.bankAccounts = [
        {
          id: 'bank_1',
          bankName: data.client.bankName || 'Capital Small Finance Bank (Jalandhar / Punjab)',
          accountNumber: data.client.accountNumber || '052200002279',
          ifscCode: data.client.ifscCode || 'CLBL0000052',
          branchName: data.client.branchName || data.client.placeOfFiling || 'LOHIAN KHAS',
          accountType: 'Savings',
          isRefundNominated: true,
          validationStatus: data.client.validationStatus || 'VALIDATED & ELECTED',
        }
      ];
    }

    // Initialize bankInterestItems if empty
    if (!data.otherSources.bankInterestItems || data.otherSources.bankInterestItems.length === 0) {
      const initialInterest: BankInterestItem[] = [];
      if (data.otherSources.savingsInterest > 0) {
        initialInterest.push({
          id: 'int_sav_1',
          bankName: data.otherSources.savingsBankName || `${data.client.bankName || 'Capital Small Finance Bank'} - A/c ${data.client.accountNumber || '052200002279'}`,
          accountNumber: data.client.accountNumber || '052200002279',
          interestType: 'Savings',
          amount: data.otherSources.savingsInterest,
        });
      }
      if (data.otherSources.fdInterest > 0) {
        initialInterest.push({
          id: 'int_fd_1',
          bankName: data.otherSources.fdBankName || 'State Bank of India',
          accountNumber: '',
          interestType: 'Fixed Deposit (FD)',
          amount: data.otherSources.fdInterest,
        });
      }
      if (data.otherSources.rdInterest && data.otherSources.rdInterest > 0) {
        initialInterest.push({
          id: 'int_rd_1',
          bankName: data.otherSources.rdBankName || 'Punjab National Bank',
          accountNumber: '',
          interestType: 'Recurring Deposit (RD)',
          amount: data.otherSources.rdInterest,
        });
      }
      if (initialInterest.length === 0) {
        initialInterest.push({
          id: 'int_default_1',
          bankName: `${data.client.bankName || 'Capital Small Finance Bank Limited'} - A/c ${data.client.accountNumber || '052200002279'}`,
          accountNumber: data.client.accountNumber || '052200002279',
          interestType: 'Savings',
          amount: 228,
        });
      }
      data.otherSources.bankInterestItems = initialInterest;
    }

    // Initialize businessList if empty
    if (!data.business.businessList || data.business.businessList.length === 0) {
      const bizName = data.business.businessName || data.business.natureOfBusiness || 'Boutique / Stitching of Clothes (21008)';
      const tDig = data.business.turnoverDigital6 || 0;
      const pDig = data.business.profitDigital6 || (tDig > 0 ? Math.round(tDig * 0.06) : 0);
      const tCash = data.business.turnoverCash8 || (data.business.turnoverOrGrossReceipts ? (data.business.turnoverOrGrossReceipts - tDig) : 0);
      const pCash = data.business.profitCash8 || (tCash > 0 ? Math.round(tCash * 0.08) : 0);
      const tOth = data.business.turnoverOtherMode || 0;
      const pOth = data.business.profitOtherMode || 0;

      data.business.businessList = [
        {
          id: 'biz_1',
          businessName: bizName,
          natureOfBusiness: data.business.natureOfBusiness || 'Boutique / Stitching of Clothes',
          businessCode: data.business.businessCode || '21008',
          presumptiveSection: data.business.presumptiveSection || '44AD (8%/6%/Other)',
          turnoverDigital6: tDig,
          profitDigital6: pDig,
          turnoverCash8: tCash,
          profitCash8: pCash,
          turnoverOtherMode: tOth,
          profitOtherMode: pOth,
          otherModePercent: data.business.otherModePercent || 8,
          otherModeDescription: data.business.otherModeDescription || '',
          totalTurnover: (tDig + tCash + tOth) || data.business.turnoverOrGrossReceipts || 0,
          netProfit: data.business.netProfit || (pDig + pCash + pOth),
        }
      ];
    }

    return data;
  });

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeDetectedInfo, setPincodeDetectedInfo] = useState<string>('');
  const [ifscFeedbackMap, setIfscFeedbackMap] = useState<Record<string, { text: string; isExact: boolean }>>({});

  // --- PINCODE AUTO-LOOKUP HANDLER ---
  const handlePincodeChange = async (val: string) => {
    const cleanPin = val.replace(/[^0-9]/g, '').slice(0, 6);
    
    setFormData(prev => ({
      ...prev,
      client: {
        ...prev.client,
        pincode: cleanPin,
      }
    }));

    if (cleanPin.length === 0) {
      setPincodeDetectedInfo('');
      return;
    }

    // 1. Instant Synchronous Offline Lookup
    if (cleanPin.length >= 3) {
      const offline = lookupPincodeOffline(cleanPin);
      if (offline) {
        setFormData(prev => ({
          ...prev,
          client: {
            ...prev.client,
            pincode: cleanPin,
            state: offline.state || prev.client.state,
            district: offline.district || prev.client.district,
            tehsil: offline.tehsil || prev.client.tehsil,
            placeOfFiling: (offline.placeOfFiling && (!prev.client.placeOfFiling || prev.client.placeOfFiling === 'LOHIAN KHAS' || prev.client.placeOfFiling === '')) ? offline.placeOfFiling : prev.client.placeOfFiling,
          }
        }));
        setPincodeDetectedInfo(`${offline.villageOrCity ? offline.villageOrCity + ', ' : ''}${offline.tehsil ? 'ਤਹਿਸੀਲ ' + offline.tehsil + ', ' : ''}${offline.district ? 'ਜ਼ਿਲ੍ਹਾ ' + offline.district + ', ' : ''}${offline.state}`);
      }
    }

    // 2. Full 6-digit Async Postal API Enrichment
    if (cleanPin.length === 6) {
      setPincodeLoading(true);
      try {
        const result = await lookupPincodeAsync(cleanPin);
        if (result) {
          setFormData(prev => {
            const updatedClient = {
              ...prev.client,
              pincode: cleanPin,
              state: result.state || prev.client.state,
              district: result.district || prev.client.district,
              tehsil: result.tehsil || prev.client.tehsil,
              placeOfFiling: result.placeOfFiling || prev.client.placeOfFiling,
            };
            if (!updatedClient.address) {
              const v = result.villageOrCity ? `VPO ${result.villageOrCity}, ` : '';
              const t = result.tehsil ? `TEHSIL ${result.tehsil}, ` : '';
              const d = result.district ? `DISTT ${result.district}, ` : '';
              updatedClient.address = `${v}${t}${d}${result.state} - ${cleanPin}`;
            }
            return {
              ...prev,
              client: updatedClient,
            };
          });
          setPincodeDetectedInfo(`${result.villageOrCity ? result.villageOrCity + ', ' : ''}${result.tehsil ? 'ਤਹਿਸੀਲ ' + result.tehsil + ', ' : ''}${result.district ? 'ਜ਼ਿਲ੍ਹਾ ' + result.district + ', ' : ''}${result.state}`);
        }
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleComposeAddress = () => {
    const c = formData.client;
    const v = c.placeOfFiling ? `VPO ${c.placeOfFiling}, ` : '';
    const t = c.tehsil ? `TEHSIL ${c.tehsil}, ` : '';
    const d = c.district ? `DISTT ${c.district}, ` : '';
    const st = c.state || 'PUNJAB';
    const pin = c.pincode ? ` - ${c.pincode}` : '';
    setFormData({
      ...formData,
      client: {
        ...c,
        address: `${v}${t}${d}${st}${pin}`
      }
    });
  };

  const handleUpdateClientBankAccount = async (id: string, field: keyof ClientBankAccount, val: any) => {
    const existing = formData.client.bankAccounts || [];
    const updated = existing.map(b => {
      if (b.id !== id) return b;
      const modified = { ...b, [field]: val };
      
      // Auto-detect bank and branch from IFSC Code instantly offline
      if (field === 'ifscCode') {
        const cleanIfsc = (val as string).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
        modified.ifscCode = cleanIfsc;

        if (cleanIfsc.length >= 4) {
          const detected = lookupIfscOffline(cleanIfsc);
          if (detected && detected.bankName) {
            modified.bankName = detected.bankName;
            setIfscFeedbackMap(prevMap => ({
              ...prevMap,
              [id]: {
                text: `${detected.bankName}${detected.branchName ? ` (${detected.branchName})` : ''}`,
                isExact: detected.isExact
              }
            }));
          }
        } else {
          setIfscFeedbackMap(prevMap => {
            const copy = { ...prevMap };
            delete copy[id];
            return copy;
          });
        }
      }

      if (field === 'bankName') {
        const found = PUNJAB_BANKS.find(bank => bank.name === val);
        if (found && found.ifscPrefix && (!modified.ifscCode || modified.ifscCode.length < 5)) {
          modified.ifscCode = found.ifscPrefix;
        }
      }
      return modified;
    });

    const primary = updated.find(b => b.isRefundNominated) || updated[0];
    setFormData({
      ...formData,
      client: {
        ...formData.client,
        bankAccounts: updated,
        bankName: primary.bankName,
        accountNumber: primary.accountNumber,
        ifscCode: primary.ifscCode,
        branchName: primary.branchName,
      }
    });

    // If 11-digit IFSC, fetch live branch and exact bank details
    if (field === 'ifscCode') {
      const cleanIfsc = (val as string).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
      if (cleanIfsc.length === 11) {
        const live = await lookupIfscAsync(cleanIfsc);
        if (live) {
          setFormData(prev => {
            const reUpdated = (prev.client.bankAccounts || []).map(b => {
              if (b.id !== id) return b;
              return {
                ...b,
                bankName: live.bankName || b.bankName,
                branchName: live.branchName || b.branchName || prev.client.placeOfFiling,
              };
            });
            const newPrimary = reUpdated.find(b => b.isRefundNominated) || reUpdated[0];
            return {
              ...prev,
              client: {
                ...prev.client,
                bankAccounts: reUpdated,
                bankName: newPrimary.bankName,
                accountNumber: newPrimary.accountNumber,
                ifscCode: newPrimary.ifscCode,
                branchName: newPrimary.branchName,
              }
            };
          });
          setIfscFeedbackMap(prevMap => ({
            ...prevMap,
            [id]: {
              text: `${live.bankName}${live.branchName ? ` - ${live.branchName} Branch` : ''}${live.city ? `, ${live.city}` : ''}`,
              isExact: true
            }
          }));
        }
      }
    }
  };

  // --- AGRICULTURAL INCOME HANDLER ---
  const handleUpdateAgri = (field: 'grossAgriculturalReceipts' | 'agriculturalExpenses' | 'netAgriculturalIncome', val: number) => {
    const curr = formData.agriculturalDetails || {
      grossAgriculturalReceipts: 0,
      agriculturalExpenses: 0,
      netAgriculturalIncome: formData.agriculturalIncome || 0,
    };
    const updated = {
      ...curr,
      [field]: val,
    };
    if (field === 'grossAgriculturalReceipts' || field === 'agriculturalExpenses') {
      const g = Math.max(0, updated.grossAgriculturalReceipts || 0);
      const e = Math.max(0, updated.agriculturalExpenses || 0);
      updated.netAgriculturalIncome = Math.max(0, g - e);
    }
    setFormData(prev => ({
      ...prev,
      agriculturalIncome: updated.netAgriculturalIncome,
      agriculturalDetails: updated,
      otherSources: {
        ...prev.otherSources,
        agriculturalIncome: updated.netAgriculturalIncome,
        agriculturalDetails: updated,
      }
    }));
  };

  // --- CLIENT BANK ACCOUNTS HANDLERS ---
  const handleAddClientBankAccount = () => {
    const defaultBank = PUNJAB_BANKS[0];
    const newAcc: ClientBankAccount = {
      id: `bank_${Date.now()}`,
      bankName: defaultBank.name,
      accountNumber: '',
      ifscCode: defaultBank.ifscPrefix || 'PUNB0000000',
      branchName: formData.client.placeOfFiling || 'LOHIAN KHAS',
      accountType: 'Savings',
      isRefundNominated: false,
      validationStatus: 'VALIDATED',
    };
    const updated = [...(formData.client.bankAccounts || []), newAcc];
    setFormData({
      ...formData,
      client: {
        ...formData.client,
        bankAccounts: updated,
      }
    });
  };

  const handleRemoveClientBankAccount = (id: string) => {
    const existing = formData.client.bankAccounts || [];
    if (existing.length <= 1) {
      alert('ਘੱਟੋ-ਘੱਟ ਇੱਕ ਬੈਂਕ ਖਾਤਾ ਹੋਣਾ ਜ਼ਰੂਰੀ ਹੈ (At least one bank account is required).');
      return;
    }
    const updated = existing.filter(b => b.id !== id);
    const hasRefund = updated.some(b => b.isRefundNominated);
    if (!hasRefund && updated.length > 0) {
      updated[0].isRefundNominated = true;
      updated[0].validationStatus = 'VALIDATED & ELECTED';
    }
    const primary = updated.find(b => b.isRefundNominated) || updated[0];
    setFormData({
      ...formData,
      client: {
        ...formData.client,
        bankAccounts: updated,
        bankName: primary.bankName,
        accountNumber: primary.accountNumber,
        ifscCode: primary.ifscCode,
        branchName: primary.branchName,
      }
    });
  };

  const handleSetPrimaryRefundBank = (id: string) => {
    const existing = formData.client.bankAccounts || [];
    const updated = existing.map(b => ({
      ...b,
      isRefundNominated: b.id === id,
      validationStatus: b.id === id ? 'VALIDATED & ELECTED' : 'VALIDATED',
    }));
    const primary = updated.find(b => b.id === id);
    setFormData({
      ...formData,
      client: {
        ...formData.client,
        bankAccounts: updated,
        bankName: primary?.bankName || formData.client.bankName,
        accountNumber: primary?.accountNumber || formData.client.accountNumber,
        ifscCode: primary?.ifscCode || formData.client.ifscCode,
        branchName: primary?.branchName || formData.client.branchName,
      }
    });
  };

  const handleSelectClientBankAccountForInterest = (itemId: string, bankAccountId: string) => {
    const target = formData.client.bankAccounts?.find(b => b.id === bankAccountId);
    if (target) {
      const bFormatted = `${target.bankName}${target.accountNumber ? ` - A/c ${target.accountNumber}` : ''}`;
      const updatedItems = (formData.otherSources.bankInterestItems || []).map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            bankName: bFormatted,
            accountNumber: target.accountNumber || item.accountNumber,
          };
        }
        return item;
      });
      updateBankInterestState(updatedItems);
    }
  };

  const handleAddSavingsInterest = () => {
    const firstBank = formData.client.bankAccounts?.[0];
    const newItem: BankInterestItem = {
      id: `sav_${Date.now()}`,
      bankName: firstBank ? `${firstBank.bankName}${firstBank.accountNumber ? ` - A/c ${firstBank.accountNumber}` : ''}` : '',
      accountNumber: firstBank?.accountNumber || '',
      interestType: 'Savings',
      amount: 0,
    };
    const updatedItems = [...(formData.otherSources.bankInterestItems || []), newItem];
    updateBankInterestState(updatedItems);
  };

  const handleAddFdInterest = () => {
    const firstBank = formData.client.bankAccounts?.[0];
    const newItem: BankInterestItem = {
      id: `fd_${Date.now()}`,
      bankName: firstBank ? `${firstBank.bankName}` : '',
      accountNumber: '',
      interestType: 'Fixed Deposit (FD)',
      amount: 0,
    };
    const updatedItems = [...(formData.otherSources.bankInterestItems || []), newItem];
    updateBankInterestState(updatedItems);
  };

  const handleAddRdInterest = () => {
    const firstBank = formData.client.bankAccounts?.[0];
    const newItem: BankInterestItem = {
      id: `rd_${Date.now()}`,
      bankName: firstBank ? `${firstBank.bankName}` : '',
      accountNumber: '',
      interestType: 'Recurring Deposit (RD)',
      amount: 0,
    };
    const updatedItems = [...(formData.otherSources.bankInterestItems || []), newItem];
    updateBankInterestState(updatedItems);
  };

  const handleAddBankInterest = () => {
    handleAddSavingsInterest();
  };

  const handleRemoveBankInterest = (id: string) => {
    const updatedItems = (formData.otherSources.bankInterestItems || []).filter(item => item.id !== id);
    updateBankInterestState(updatedItems);
  };

  const handleUpdateBankInterest = (id: string, field: keyof BankInterestItem, val: any) => {
    const updatedItems = (formData.otherSources.bankInterestItems || []).map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    updateBankInterestState(updatedItems);
  };

  const updateBankInterestState = (items: BankInterestItem[]) => {
    let totSavings = 0;
    let totFd = 0;
    let totRd = 0;
    let totOther = 0;

    items.forEach(it => {
      const amt = Number(it.amount) || 0;
      if (it.interestType === 'Savings' || it.interestType === 'Post Office') {
        totSavings += amt;
      } else if (it.interestType === 'Fixed Deposit (FD)') {
        totFd += amt;
      } else if (it.interestType === 'Recurring Deposit (RD)') {
        totRd += amt;
      } else {
        totOther += amt;
      }
    });

    const updatedOS: OtherSourcesDetails = {
      ...formData.otherSources,
      bankInterestItems: items,
      savingsInterest: totSavings,
      fdInterest: totFd,
      rdInterest: totRd,
      otherInterestIncome: totOther > 0 ? totOther : formData.otherSources.otherInterestIncome,
    };

    const netTotal = calculateNetOtherSources(updatedOS, formData.regimeOpted);
    updatedOS.netOtherSources = netTotal;

    setFormData({
      ...formData,
      otherSources: updatedOS,
    });
  };

  // --- SCHEDULE OS: ITEMIZED OTHER INCOME HANDLERS ---
  const handleAddOtherIncomeItem = (category: OtherIncomeCategory = 'Commission / Agency') => {
    const newItem: OtherIncomeItem = {
      id: `oth_${Date.now()}`,
      category,
      description: '',
      grossAmount: 0,
      deductionSec57: 0,
      netAmount: 0,
    };
    const updated = [...(formData.otherSources.otherIncomeItems || []), newItem];
    updateOtherIncomeItemsState(updated);
  };

  const handleRemoveOtherIncomeItem = (id: string) => {
    const updated = (formData.otherSources.otherIncomeItems || []).filter(item => item.id !== id);
    updateOtherIncomeItemsState(updated);
  };

  const handleUpdateOtherIncomeItem = (id: string, field: keyof OtherIncomeItem, val: any) => {
    const updated = (formData.otherSources.otherIncomeItems || []).map(item => {
      if (item.id !== id) return item;
      const mod = { ...item, [field]: val };
      if (field === 'grossAmount' || field === 'deductionSec57') {
        const g = Math.max(0, Number(mod.grossAmount) || 0);
        const d = Math.max(0, Number(mod.deductionSec57) || 0);
        mod.netAmount = Math.max(0, g - d);
      }
      return mod;
    });
    updateOtherIncomeItemsState(updated);
  };

  const updateOtherIncomeItemsState = (items: OtherIncomeItem[]) => {
    const sumOther = items.reduce((acc, it) => acc + (Number(it.netAmount) || 0), 0);
    const updatedOS: OtherSourcesDetails = {
      ...formData.otherSources,
      otherIncomeItems: items,
      otherIncome: sumOther,
    };
    const netTotal = calculateNetOtherSources(updatedOS, formData.regimeOpted);
    updatedOS.netOtherSources = netTotal;

    setFormData({
      ...formData,
      otherSources: updatedOS,
    });
  };

  // --- SCHEDULE OS: FAMILY PENSION WITH DEDUCTION U/S 57(iia) ---
  const handleUpdateFamilyPension = (grossAmt: number) => {
    const maxLimit = formData.regimeOpted === 'new' ? 25000 : 15000;
    const ded = grossAmt > 0 ? Math.min(grossAmt, Math.min(maxLimit, Math.round(grossAmt / 3))) : 0;
    const net = Math.max(0, grossAmt - ded);
    const updatedOS: OtherSourcesDetails = {
      ...formData.otherSources,
      familyPension: grossAmt,
      familyPensionDeduction: ded,
      netFamilyPension: net,
    };
    const netTotal = calculateNetOtherSources(updatedOS, formData.regimeOpted);
    updatedOS.netOtherSources = netTotal;

    setFormData({
      ...formData,
      otherSources: updatedOS,
    });
  };

  // --- SCHEDULE OS: MACHINERY / PLANT HIRE WITH EXPENSES U/S 57(ii) ---
  const handleUpdateMachineryHire = (field: 'machineryHireGross' | 'machineryHireExpenses', val: number) => {
    const currGross = field === 'machineryHireGross' ? val : (formData.otherSources.machineryHireGross || 0);
    const currExp = field === 'machineryHireExpenses' ? val : (formData.otherSources.machineryHireExpenses || 0);
    const net = Math.max(0, currGross - currExp);
    const updatedOS: OtherSourcesDetails = {
      ...formData.otherSources,
      machineryHireGross: currGross,
      machineryHireExpenses: currExp,
      netMachineryHire: net,
    };
    const netTotal = calculateNetOtherSources(updatedOS, formData.regimeOpted);
    updatedOS.netOtherSources = netTotal;

    setFormData({
      ...formData,
      otherSources: updatedOS,
    });
  };

  // --- SCHEDULE OS: GENERIC FIELD UPDATE (DIVIDENDS, SPECIAL RATES, IT REFUND) ---
  const handleUpdateOtherSourcesField = (field: keyof OtherSourcesDetails, val: any) => {
    let updatedOS: OtherSourcesDetails = {
      ...formData.otherSources,
      [field]: val,
    };

    // If updating dividend components, sync dividendIncome
    if (field === 'indianCompanyDividend' || field === 'mutualFundDividend') {
      const ind = field === 'indianCompanyDividend' ? (Number(val) || 0) : (formData.otherSources.indianCompanyDividend || 0);
      const mf = field === 'mutualFundDividend' ? (Number(val) || 0) : (formData.otherSources.mutualFundDividend || 0);
      updatedOS.dividendIncome = ind + mf;
    }

    // If updating direct dividendIncome, clear split or retain
    if (field === 'dividendIncome') {
      updatedOS.dividendIncome = Number(val) || 0;
    }

    // If updating special rate winnings, sum totalSpecialRateIncome
    if (['lotteryWinnings', 'onlineGamesWinnings', 'horseRacesWinnings', 'unexplainedIncome115BBE'].includes(field)) {
      const lot = field === 'lotteryWinnings' ? (Number(val) || 0) : (formData.otherSources.lotteryWinnings || 0);
      const og = field === 'onlineGamesWinnings' ? (Number(val) || 0) : (formData.otherSources.onlineGamesWinnings || 0);
      const hr = field === 'horseRacesWinnings' ? (Number(val) || 0) : (formData.otherSources.horseRacesWinnings || 0);
      const un = field === 'unexplainedIncome115BBE' ? (Number(val) || 0) : (formData.otherSources.unexplainedIncome115BBE || 0);
      updatedOS.totalSpecialRateIncome = lot + og + hr + un;
    }

    const netTotal = calculateNetOtherSources(updatedOS, formData.regimeOpted);
    updatedOS.netOtherSources = netTotal;

    setFormData({
      ...formData,
      otherSources: updatedOS,
    });
  };

  // --- BUSINESS HANDLERS ---
  const handleAddBusiness = () => {
    const newBiz: BusinessItem = {
      id: `biz_${Date.now()}`,
      businessName: `Business #${(formData.business.businessList?.length || 0) + 1}`,
      natureOfBusiness: '',
      businessCode: '',
      presumptiveSection: '44AD (8%/6%/Other)',
      turnoverDigital6: 0,
      profitDigital6: 0,
      turnoverCash8: 0,
      profitCash8: 0,
      turnoverOtherMode: 0,
      profitOtherMode: 0,
      otherModePercent: 0,
      otherModeDescription: '',
      totalTurnover: 0,
      netProfit: 0,
    };
    const updatedList = [...(formData.business.businessList || []), newBiz];
    updateBusinessListState(updatedList);
  };

  const handleRemoveBusiness = (id: string) => {
    const updatedList = (formData.business.businessList || []).filter(b => b.id !== id);
    updateBusinessListState(updatedList);
  };

  const handleUpdateBusiness = (id: string, fieldOrUpdates: keyof BusinessItem | Partial<BusinessItem>, val?: any) => {
    const updatedList = (formData.business.businessList || []).map(b => {
      if (b.id === id) {
        let updated: BusinessItem;
        if (typeof fieldOrUpdates === 'object') {
          updated = { ...b, ...fieldOrUpdates };
        } else {
          updated = { ...b, [fieldOrUpdates]: val };
        }

        // Run through business calculation engine
        const calc = calculateSingleBusiness(updated, formData.assessmentYear || '2026-27');
        updated.totalTurnover = calc.totalTurnover;
        updated.netProfit = calc.netProfit;
        updated.verificationStatus = calc.verificationStatus;
        updated.verificationWarnings = calc.verificationWarnings;

        return updated;
      }
      return b;
    });
    updateBusinessListState(updatedList);
  };

  const updateBusinessListState = (list: BusinessItem[]) => {
    let totDigTurn = 0;
    let totDigProf = 0;
    let totCashTurn = 0;
    let totCashProf = 0;
    let totOthTurn = 0;
    let totOthProf = 0;
    let totTurn = 0;
    let totProf = 0;

    const auditedList = list.map(b => {
      const calc = calculateSingleBusiness(b, formData.assessmentYear || '2026-27');
      const updated = {
        ...b,
        totalTurnover: calc.totalTurnover,
        netProfit: calc.netProfit,
        verificationStatus: calc.verificationStatus,
        verificationWarnings: calc.verificationWarnings,
      };

      const tDig = Number(updated.turnoverDigital6) || 0;
      const pDig = (updated.profitDigital6 !== undefined && Number(updated.profitDigital6) > 0)
        ? Number(updated.profitDigital6)
        : Math.round(tDig * 0.06);

      const tCash = Number(updated.turnoverCash8) || 0;
      const pCash = (updated.profitCash8 !== undefined && Number(updated.profitCash8) > 0)
        ? Number(updated.profitCash8)
        : Math.round(tCash * 0.08);

      const tOth = Number(updated.turnoverOtherMode) || 0;
      const oRate = (updated.otherModePercent !== undefined && updated.otherModePercent !== null) ? (Number(updated.otherModePercent) / 100) : 0;
      const pOth = (updated.profitOtherMode !== undefined && !isNaN(Number(updated.profitOtherMode)))
        ? Number(updated.profitOtherMode)
        : Math.round(tOth * oRate);

      totDigTurn += tDig;
      totDigProf += pDig;
      totCashTurn += tCash;
      totCashProf += pCash;
      totOthTurn += tOth;
      totOthProf += pOth;
      totTurn += calc.totalTurnover;
      totProf += calc.netProfit;

      return updated;
    });

    setFormData({
      ...formData,
      business: {
        ...formData.business,
        businessList: auditedList,
        turnoverDigital6: totDigTurn,
        profitDigital6: totDigProf,
        turnoverCash8: totCashTurn,
        profitCash8: totCashProf,
        turnoverOtherMode: totOthTurn,
        profitOtherMode: totOthProf,
        turnoverOrGrossReceipts: totTurn,
        netProfit: totProf,
      }
    });
  };

  const handleSave = () => {
    const recalculated = recalculateFullComputation(formData);
    onSave(recalculated);
    onClose();
  };

  // Grand totals for display inside modal
  const grandTotalBankInterest = (formData.otherSources.bankInterestItems || []).reduce(
    (acc, it) => acc + (Number(it.amount) || 0), 0
  );

  const grandTotalBusinessTurnover = (formData.business.businessList || []).reduce(
    (acc, b) => acc + (Number(b.totalTurnover) || 0), 0
  );

  const grandTotalBusinessProfit = (formData.business.businessList || []).reduce(
    (acc, b) => acc + (Number(b.netProfit) || 0), 0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#10366b] text-white px-5 py-3.5 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-blue-300" />
            <div>
              <h3 className="font-bold text-base">Edit Assessee Profile & Tax Computation (ਕਲਾਇੰਟ ਜਾਣਕਾਰੀ ਸੋਧੋ)</h3>
              <p className="text-[11px] text-blue-200">
                Update Client Personal Details, Multi-Bank Accounts, Business 44AD, Income & Taxes
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          
          {/* Live ITR Eligibility & Statutory Compliance Banner */}
          <div>
            <ITREligibilityBanner
              computation={formData}
              onUpdateComputation={(updated) => setFormData(updated)}
            />
          </div>

          {/* Section 1: Client Master Info */}
          <div>
            <h4 className="font-bold text-[#10366b] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10366b]"></span>
              1. Assessee & Filing Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Assessee Name</label>
                <input
                  type="text"
                  value={formData.client.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, name: e.target.value }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Father's Name</label>
                <input
                  type="text"
                  value={formData.client.fatherName || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, fatherName: e.target.value }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">PAN Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={formData.client.pan}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, pan: e.target.value.toUpperCase() }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono uppercase font-black tracking-wider"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Date of Birth (ਜਨਮ ਮਿਤੀ)</label>
                <input
                  type="text"
                  placeholder="e.g. 15/04/1981"
                  value={formData.client.dob || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, dob: e.target.value }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium"
                />
              </div>

              {/* Gender Selection Tick Buttons */}
              <div className="sm:col-span-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-pink-50/50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5 text-xs text-[#10366b] uppercase tracking-wider">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Gender / ਲਿੰਗ (Tick Button - Male / Female)
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    Status: <strong className="text-[#10366b]">{formData.client.status || 'Individual'}</strong> / <strong className="text-blue-700">{formData.client.gender || 'Female'}</strong>
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Male Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      client: { ...formData.client, gender: 'Male', status: 'Individual' }
                    })}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl border-2 transition-all text-xs cursor-pointer ${
                      formData.client.gender === 'Male'
                        ? 'border-blue-600 bg-blue-100/70 text-blue-900 shadow-sm font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        formData.client.gender === 'Male' ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Male (ਪੁਰਸ਼)</div>
                        <div className="text-[10px] opacity-75 font-normal">Individual Male</div>
                      </div>
                    </div>
                    {formData.client.gender === 'Male' && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>

                  {/* Female Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      client: { ...formData.client, gender: 'Female', status: 'Individual' }
                    })}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl border-2 transition-all text-xs cursor-pointer ${
                      (formData.client.gender === 'Female' || (!formData.client.gender && computation.client.gender === 'Female'))
                        ? 'border-pink-600 bg-pink-100/70 text-pink-900 shadow-sm font-bold ring-2 ring-pink-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:bg-pink-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        (formData.client.gender === 'Female' || (!formData.client.gender && computation.client.gender === 'Female'))
                          ? 'bg-pink-600 text-white'
                          : 'border border-slate-300 bg-slate-50 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Female (ਔਰਤ)</div>
                        <div className="text-[10px] opacity-75 font-normal">Individual Female</div>
                      </div>
                    </div>
                    {(formData.client.gender === 'Female' || (!formData.client.gender && computation.client.gender === 'Female')) && (
                      <Check className="w-4 h-4 text-pink-600 shrink-0" />
                    )}
                  </button>

                  {/* Senior Citizen Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      client: { ...formData.client, gender: 'Senior Citizen', status: 'Individual' }
                    })}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl border-2 transition-all text-xs cursor-pointer ${
                      formData.client.gender === 'Senior Citizen'
                        ? 'border-emerald-600 bg-emerald-100/70 text-emerald-900 shadow-sm font-bold ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        formData.client.gender === 'Senior Citizen' ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Senior Citizen</div>
                        <div className="text-[10px] opacity-75 font-normal">Age 60+ Years</div>
                      </div>
                    </div>
                    {formData.client.gender === 'Senior Citizen' && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>

                  {/* Super Senior Citizen Button */}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      client: { ...formData.client, gender: 'Super Senior Citizen', status: 'Individual' }
                    })}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl border-2 transition-all text-xs cursor-pointer ${
                      formData.client.gender === 'Super Senior Citizen'
                        ? 'border-purple-600 bg-purple-100/70 text-purple-900 shadow-sm font-bold ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        formData.client.gender === 'Super Senior Citizen' ? 'bg-purple-600 text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Super Senior</div>
                        <div className="text-[10px] opacity-75 font-normal">Age 80+ Years</div>
                      </div>
                    </div>
                    {formData.client.gender === 'Super Senior Citizen' && (
                      <Check className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Mobile Number (ਮੋਬਾਈਲ ਨੰਬਰ)</label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 8146463219"
                  value={formData.client.mobile || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, mobile: e.target.value }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Email Address (ਈਮੇਲ)</label>
                <input
                  type="email"
                  placeholder="e.g. poonianranjeet@gmail.com"
                  value={formData.client.email || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, email: e.target.value.toLowerCase() }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium lowercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Assessment Year (AY)</label>
                <select
                  value={formData.assessmentYear}
                  onChange={(e) => {
                    const ay = e.target.value;
                    let fy = '2025-26';
                    if (ay === '2025-26') fy = '2024-25';
                    if (ay === '2024-25') fy = '2023-24';
                    setFormData({ ...formData, assessmentYear: ay, financialYear: fy });
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium bg-white"
                >
                  <option value="2026-27">2026-27 (Budget 2025: ₹4L Exemption Limit, FY 2025-26)</option>
                  <option value="2025-26">2025-26 (Budget 2024: ₹3L Exemption Limit, FY 2024-25)</option>
                  <option value="2024-25">2024-25 (FY 2023-24)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Tax Regime</label>
                <select
                  value={formData.regimeOpted}
                  onChange={(e) => setFormData({ ...formData, regimeOpted: e.target.value as TaxRegime })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white font-semibold"
                >
                  <option value="new">New Tax Regime u/s 115BAC</option>
                  <option value="old">Old Tax Regime</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">ITR Form Type</label>
                <select
                  value={formData.itrForm}
                  onChange={(e) => setFormData({ ...formData, itrForm: e.target.value as ITRFormType })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                >
                  <option value="ITR-4 (Sugam)">ITR-4 (SUGAM)</option>
                  <option value="ITR-1 (Sahaj)">ITR-1 (Sahaj)</option>
                  <option value="ITR-2">ITR-2</option>
                  <option value="ITR-3">ITR-3</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Ack. Number</label>
                <input
                  type="text"
                  value={formData.acknowledgementNumber || ''}
                  onChange={(e) => setFormData({ ...formData, acknowledgementNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Date of Filing</label>
                <input
                  type="text"
                  placeholder="31-Jul-2026 / 08/08/2026"
                  value={formData.filingDate || ''}
                  onChange={(e) => setFormData({ ...formData, filingDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Residential Status (ਰਿਹਾਇਸ਼ੀ ਦਰਜਾ) *</label>
                <select
                  value={formData.client.residentialStatus || 'Resident'}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, residentialStatus: e.target.value as any }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white font-medium"
                >
                  <option value="Resident">Resident & Ordinarily Resident (ROR)</option>
                  <option value="Non-Resident">Non-Resident (NRI)</option>
                  <option value="Resident but Not Ordinarily Resident">Resident but Not Ordinarily Resident (RNOR)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Filing Section u/s</label>
                <select
                  value={formData.filingSection || '139(1) - On or before due date'}
                  onChange={(e) => setFormData({ ...formData, filingSection: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                >
                  <option value="139(1) - On or before due date">139(1) - On or before due date</option>
                  <option value="139(4) - Belated Return">139(4) - Belated Return</option>
                  <option value="139(5) - Revised Return">139(5) - Revised Return</option>
                  <option value="139(8A) - Updated Return (ITR-U)">139(8A) - Updated Return (ITR-U)</option>
                  <option value="119(2)(b) - Condonation of Delay">119(2)(b) - Condonation of Delay</option>
                </select>
              </div>

              {/* STATUTORY DISCLOSURES FOR ITR ELIGIBILITY */}
              <div className="sm:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                    ਵਿਸ਼ੇਸ਼ ਕਨੂੰਨੀ ਖੁਲਾਸੇ (Statutory ITR Eligibility Disclosures)
                  </h5>
                </div>
                <p className="text-[11px] text-slate-500">
                  ITR-1 / ITR-4 ਦੀ ਯੋਗਤਾ ਨਿਰਧਾਰਿਤ ਕਰਨ ਲਈ ਹੇਠਾਂ ਦਿੱਤੀਆਂ ਸ਼ਰਤਾਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/40 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.client.isDirector)}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, isDirector: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">Director in Indian / Foreign Company (ਡਾਇਰੈਕਟਰਸ਼ਿਪ)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/40 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.client.hasUnlistedShares)}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, hasUnlistedShares: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">Held Unlisted Equity Shares during FY (ਅਣਸੂਚੀਬੱਧ ਸ਼ੇਅਰ)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/40 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.client.hasForeignAssets)}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, hasForeignAssets: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">Foreign Assets / Foreign Income (ਵਿਦੇਸ਼ੀ ਸੰਪਤੀ / ਆਮਦਨ)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/40 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.client.hasBroughtForwardLosses)}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, hasBroughtForwardLosses: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">Brought Forward Losses / Depreciation (ਪੁਰਾਣਾ ਘਾਟਾ/ਨੁਕਸਾਨ)</span>
                  </label>
                </div>
              </div>

              {/* Pincode & Address Auto-Detection */}
              <div className="sm:col-span-3 bg-blue-50/40 border border-blue-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <h5 className="font-bold text-blue-900 text-xs uppercase tracking-wide">
                      ਕਲਾਇੰਟ ਪਤਾ ਅਤੇ ਇਲਾਕਾ ਵੇਰਵਾ (Assessee Address & Location)
                    </h5>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    ⚡ ਪਿੰਨਕੋਡ ਨਾਲ ਆਟੋ-ਡਿਟੈਕਟ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Pincode */}
                  <div>
                    <label className="block text-[11px] text-slate-700 font-bold mb-1">
                      ਪਿੰਨਕੋਡ (Pincode) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={formData.client.pincode || ''}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="144702"
                        className="w-full p-2 border border-blue-300 rounded-lg outline-none focus:border-blue-600 font-mono font-bold bg-white text-blue-950 text-sm tracking-widest"
                      />
                      {pincodeLoading && (
                        <span className="absolute right-2.5 top-2.5 text-[10px] text-blue-600 font-bold animate-pulse">
                          ਖੋਜ ਰਿਹਾ ਹੈ...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-[11px] text-slate-700 font-bold mb-1">
                      ਰਾਜ / ਸੂਬਾ (State)
                    </label>
                    <input
                      type="text"
                      value={formData.client.state || 'PUNJAB'}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, state: e.target.value.toUpperCase() }
                      })}
                      placeholder="PUNJAB"
                      className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-bold text-slate-800 bg-white text-xs"
                    />
                  </div>

                  {/* District */}
                  <div>
                    <label className="block text-[11px] text-slate-700 font-bold mb-1">
                      ਜ਼ਿਲ੍ਹਾ (District)
                    </label>
                    <input
                      type="text"
                      value={formData.client.district || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, district: e.target.value.toUpperCase() }
                      })}
                      placeholder="JALANDHAR"
                      className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-bold text-slate-800 bg-white text-xs"
                    />
                  </div>

                  {/* Tehsil */}
                  <div>
                    <label className="block text-[11px] text-slate-700 font-bold mb-1">
                      ਤਹਿਸੀਲ (Tehsil)
                    </label>
                    <input
                      type="text"
                      value={formData.client.tehsil || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        client: { ...formData.client, tehsil: e.target.value.toUpperCase() }
                      })}
                      placeholder="SHAHKOT / NAKODAR"
                      className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-bold text-slate-800 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* Live Detected Info */}
                {pincodeDetectedInfo && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong className="font-bold">⚡ ਆਟੋ-ਡਿਟੈਕਟ ਹੋਇਆ ਇਲਾਕਾ:</strong> {pincodeDetectedInfo}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleComposeAddress}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs shrink-0 transition"
                      title="ਕੰਪਲੀਟ ਪਤਾ ਆਟੋ-ਫਾਰਮੈਟ ਕਰੋ"
                    >
                      ✨ ਪਤਾ ਆਟੋ-ਭਰੋ (Auto-fill Address)
                    </button>
                  </div>
                )}

                {/* Assessee Full Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold text-xs">
                      ਰਿਹਾਇਸ਼ੀ ਪਤਾ (Assessee Full Address - House/Shop No., Street, VPO, Tehsil, Distt, State, PIN)
                    </label>
                    <button
                      type="button"
                      onClick={handleComposeAddress}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <span>🔄 ਫਾਰਮੈਟ ਅਨੁਸਾਰ ਪਤਾ ਬਣਾਓ</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="e.g. VPO LOHIAN KHAS, WARD NO 4, TEHSIL SHAHKOT, DISTT JALANDHAR, PUNJAB - 144702"
                    value={formData.client.address || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      client: { ...formData.client, address: e.target.value.toUpperCase() }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-medium text-xs leading-relaxed bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Place of Filing</label>
                <input
                  type="text"
                  placeholder="e.g. LOHIAN KHAS"
                  value={formData.client.placeOfFiling || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    client: { ...formData.client, placeOfFiling: e.target.value.toUpperCase() }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 uppercase font-medium"
                />
              </div>

              {/* Multi-Bank Accounts Section in Client Profile */}
              <div className="sm:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      ਬੈਂਕ ਖਾਤੇ (Assessee Bank Accounts - Multi Bank Support)
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddClientBankAccount}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-md border border-blue-300 shadow-2xs hover:bg-blue-50 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ ਹੋਰ ਬੈਂਕ ਖਾਤਾ ਜੋੜੋ (Add Bank)</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  ITR ਲਈ ਕਲਾਇੰਟ ਦੇ ਸਾਰੇ ਬੈਂਕ ਖਾਤੇ ਦਰਜ ਕਰੋ। IFSC ਕੋਡ ਪਾਉਣ ਤੇ ਬੈਂਕ ਅਤੇ ਬ੍ਰਾਂਚ ਦਾ ਨਾਮ ਆਟੋਮੈਟਿਕ ਚੁੱਕ ਲਿਆ ਜਾਵੇਗਾ।
                </p>

                <div className="space-y-3">
                  {(formData.client.bankAccounts || []).map((bank, bIdx) => (
                    <div key={bank.id} className="bg-white p-3 rounded-lg border border-slate-300 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                            #{bIdx + 1}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {bank.bankName || 'Bank Account'}
                          </span>
                          {bank.isRefundNominated && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full flex items-center gap-1 border border-emerald-300">
                              <BadgeCheck className="w-3 h-3" />
                              ਰਿਫੰਡ ਖਾਤਾ (Primary Refund)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!bank.isRefundNominated && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryRefundBank(bank.id)}
                              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                            >
                              Set as Refund A/c
                            </button>
                          )}
                          {(formData.client.bankAccounts || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveClientBankAccount(bank.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete Bank Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="block text-[10px] text-slate-700 font-bold">
                              IFSC Code *
                            </label>
                            <span className="text-[9px] text-blue-600 font-bold">ਆਟੋ ਬੈਂਕ ਡਿਟੈਕਟ</span>
                          </div>
                          <input
                            type="text"
                            maxLength={11}
                            placeholder="e.g. PUNB0084200"
                            value={bank.ifscCode || ''}
                            onChange={(e) => handleUpdateClientBankAccount(bank.id, 'ifscCode', e.target.value.toUpperCase())}
                            className="w-full p-1.5 text-xs border border-blue-300 rounded font-mono font-black uppercase text-blue-900 bg-blue-50/30 focus:border-blue-600 focus:bg-white outline-none tracking-wider text-sm"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                            Bank Name (ਬੈਂਕ ਦਾ ਨਾਮ)
                          </label>
                          <select
                            value={PUNJAB_BANKS.some(b => b.name === bank.bankName) ? bank.bankName : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleUpdateClientBankAccount(bank.id, 'bankName', e.target.value);
                              }
                            }}
                            className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium bg-slate-50 text-slate-900 focus:border-blue-600 outline-none mb-1"
                          >
                            <option value="">-- Choose Bank from List --</option>
                            <optgroup label="🌾 Punjab Regional & Cooperative Banks">
                              {PUNJAB_BANKS.filter(b => b.category === 'Punjab Cooperative & RRB').map(b => (
                                <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                              ))}
                            </optgroup>
                            <optgroup label="🏦 Public Sector Banks (SBI / PNB / PSB etc.)">
                              {PUNJAB_BANKS.filter(b => b.category === 'Public Sector').map(b => (
                                <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                              ))}
                            </optgroup>
                            <optgroup label="🏛️ Private Sector Banks (HDFC / ICICI / Axis)">
                              {PUNJAB_BANKS.filter(b => b.category === 'Private Sector').map(b => (
                                <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                              ))}
                            </optgroup>
                            <optgroup label="📮 Post Office & Small Finance Banks">
                              {PUNJAB_BANKS.filter(b => b.category === 'Small Finance & Payments' || b.category === 'Post Office').map(b => (
                                <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                              ))}
                            </optgroup>
                          </select>
                          <input
                            type="text"
                            list="punjab-banks-datalist"
                            placeholder="Or type custom bank name..."
                            value={bank.bankName}
                            onChange={(e) => handleUpdateClientBankAccount(bank.id, 'bankName', e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium focus:border-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                            Bank Account No. (ਖਾਤਾ ਨੰ.)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 052200002279"
                            value={bank.accountNumber || ''}
                            onChange={(e) => handleUpdateClientBankAccount(bank.id, 'accountNumber', e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-bold focus:border-blue-600 outline-none"
                          />
                        </div>

                        {/* Live IFSC auto-detection badge */}
                        {ifscFeedbackMap[bank.id] && (
                          <div className="sm:col-span-4 p-2 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-950 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong className="text-blue-900">⚡ ਆਟੋ-ਡਿਟੈਕਟ ਹੋਇਆ ਬੈਂਕ:</strong> {ifscFeedbackMap[bank.id].text}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Datalist for Punjab / National Banks */}
          <datalist id="punjab-banks-datalist">
            {PUNJAB_BANKS.map((b) => (
              <option key={b.code} value={b.name}>
                {b.punjabiName ? `${b.punjabiName} - ${b.category}` : b.category}
              </option>
            ))}
          </datalist>

          {/* Datalist for ITR Business Codes */}
          <datalist id="itr-business-codes-datalist">
            {ITR_BUSINESS_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name} ({c.category})
              </option>
            ))}
          </datalist>

          {/* ========================================================================= */}
          {/* SECTION 2: MULTIPLE BUSINESSES / 44AD / 44ADA MODULE */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 rounded-xl border border-blue-200">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#10366b]" />
                <span className="font-bold text-[#10366b] text-xs sm:text-sm uppercase tracking-wide">
                  PART B: PRESUMPTIVE BUSINESS INCOME (U/S 44AD / 44ADA)
                </span>
                <span className="text-[10px] bg-blue-100 text-[#10366b] font-bold px-2 py-0.5 rounded-full">
                  {(formData.business.businessList?.length || 1)} Businesses Added
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddBusiness}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#10366b] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Business</span>
              </button>
            </div>

            {/* List of Businesses */}
            <div className="space-y-4">
              {(formData.business.businessList || []).map((bizItem, index) => (
                <div 
                  key={bizItem.id}
                  className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs space-y-3 relative"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-full bg-[#10366b] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <label className="block text-[9px] text-slate-500 font-bold uppercase">Trade / Firm Name (ਵਪਾਰ / ਫਰਮ ਦਾ ਨਾਂ)</label>
                        <input
                          type="text"
                          placeholder="e.g. M/s Kaur Boutique / Dashmesh Enterprises / Poonian Cloth House"
                          value={bizItem.businessName || bizItem.tradeName || ''}
                          onChange={(e) => handleUpdateBusiness(bizItem.id, {
                            businessName: e.target.value,
                            tradeName: e.target.value,
                          })}
                          className="w-full p-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Section Selector */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-slate-600 font-bold uppercase">Section / Mode:</label>
                      <select
                        value={bizItem.presumptiveSection || '44AD (8%/6%/Other)'}
                        onChange={(e) => handleUpdateBusiness(bizItem.id, 'presumptiveSection', e.target.value)}
                        className="p-1.5 text-xs border border-blue-300 rounded-lg font-bold text-blue-900 bg-blue-50/50 focus:border-blue-600 outline-none"
                      >
                        <option value="44AD (8%/6%/Other)">Section 44AD (Trading / Small Business - 8%/6%)</option>
                        <option value="44ADA (50%)">Section 44ADA (Specified Profession - 50%)</option>
                        <option value="44AE">Section 44AE (Goods Carriage / Transport)</option>
                        <option value="Normal Books (P&L)">Regular Books of Accounts (Schedule P&L)</option>
                        <option value="Dairy">Dairy Business (Milk Sales & Farm Expenses)</option>
                      </select>
                    </div>

                    {(formData.business.businessList?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBusiness(bizItem.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                        title="Delete this business"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Verification Status & Warnings Badge */}
                  {bizItem.verificationStatus && bizItem.verificationStatus !== 'Valid' && (
                    <div className={`p-2 rounded-lg text-xs border flex items-start gap-2 ${
                      bizItem.verificationStatus === 'Error'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[11px] uppercase tracking-wider">
                          {bizItem.verificationStatus === 'Error' ? '⚠️ Statutory Error' : '⚠️ Manual Verification Required / Audit Warning'}
                        </div>
                        {(bizItem.verificationWarnings || []).map((warn, wIdx) => (
                          <div key={wIdx} className="text-[11px] font-medium">• {warn}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Business Code, Nature & Description Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-blue-900 font-bold uppercase mb-0.5">
                        Business Code (ਕੋਡ)
                      </label>
                      <input
                        type="text"
                        list="itr-business-codes-datalist"
                        placeholder="e.g. 21008 / 09028 / 14002"
                        value={bizItem.businessCode || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const match = ITR_BUSINESS_CODES.find(c => c.code === val || val.startsWith(c.code));
                          if (match) {
                            handleUpdateBusiness(bizItem.id, {
                              businessCode: match.code,
                              natureOfBusiness: match.name,
                              businessDescription: match.description,
                            });
                          } else {
                            handleUpdateBusiness(bizItem.id, 'businessCode', e.target.value);
                          }
                        }}
                        className="w-full p-1.5 text-xs font-bold font-mono border border-blue-300 rounded-md bg-white text-blue-950 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-slate-700 font-bold uppercase mb-0.5">
                        Nature of Business (ਬਿਜ਼ਨਸ ਦੀ ਕਿਸਮ)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Boutique / Stitching / Medical Clinic"
                        value={bizItem.natureOfBusiness || ''}
                        onChange={(e) => handleUpdateBusiness(bizItem.id, 'natureOfBusiness', e.target.value)}
                        className="w-full p-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-slate-700 font-bold uppercase mb-0.5">
                        Description / Work Details (ਕੰਮ ਦਾ ਵੇਰਵਾ)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Custom tailoring, ladies suits, stitching & embroidery"
                        value={bizItem.businessDescription || ''}
                        onChange={(e) => handleUpdateBusiness(bizItem.id, 'businessDescription', e.target.value)}
                        className="w-full p-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Business Full Address */}
                    <div className="sm:col-span-12 mt-1">
                      <label className="block text-[10px] text-slate-700 font-bold uppercase mb-0.5">
                        Business / Shop Premises Full Address (ਦੁਕਾਨ / ਵਪਾਰ ਦਾ ਪੂਰਾ ਪਤਾ)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Shop No. 12, Main Market, Near Bus Stand, Lohian Khas, Distt. Jalandhar - 144629"
                        value={bizItem.businessAddress || ''}
                        onChange={(e) => handleUpdateBusiness(bizItem.id, 'businessAddress', e.target.value.toUpperCase())}
                        className="w-full p-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 outline-none focus:border-blue-600 uppercase"
                      />
                    </div>
                  </div>

                  {/* CONDITIONAL RENDERING BASED ON BUSINESS SECTION */}
                  {(!bizItem.presumptiveSection || bizItem.presumptiveSection.includes('44AD')) && (
                    /* 3 Columns: 6% Digital, 8% Cash, Other Mode */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* 6% Electronic */}
                      <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-blue-900 text-[11px]">Electronic Modes (6%)</span>
                          <span className="text-[9px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.2 rounded">Min 6%</span>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <label className="block text-[10px] text-blue-950 font-semibold mb-0.5">Turnover (₹)</label>
                            <input
                              type="number"
                              placeholder="e.g. 206500"
                              value={bizItem.turnoverDigital6 || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                handleUpdateBusiness(bizItem.id, 'turnoverDigital6', val);
                              }}
                              className="w-full p-1.5 text-xs border border-blue-300 rounded font-mono font-bold bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] text-blue-950 font-semibold">Net Profit (₹)</label>
                              <span className="text-[9px] text-blue-700 italic">Optional (Min 6%)</span>
                            </div>
                            <input
                              type="number"
                              placeholder={bizItem.turnoverDigital6 ? `Auto (6%): ₹${Math.round(bizItem.turnoverDigital6 * 0.06).toLocaleString('en-IN')}` : 'Optional (Auto: 6%)'}
                              value={bizItem.profitDigital6 || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                handleUpdateBusiness(bizItem.id, 'profitDigital6', val);
                              }}
                              className="w-full p-1.5 text-xs border border-blue-300 rounded font-mono font-bold bg-white text-blue-950"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 8% Cash */}
                      <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-amber-900 text-[11px]">Cash Modes (8%)</span>
                          <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded">Min 8%</span>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <label className="block text-[10px] text-amber-950 font-semibold mb-0.5">Turnover (₹)</label>
                            <input
                              type="number"
                              placeholder="e.g. 1248600"
                              value={bizItem.turnoverCash8 || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                handleUpdateBusiness(bizItem.id, 'turnoverCash8', val);
                              }}
                              className="w-full p-1.5 text-xs border border-amber-300 rounded font-mono font-bold bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] text-amber-950 font-semibold">Net Profit (₹)</label>
                              <span className="text-[9px] text-amber-700 italic">Optional (Min 8%)</span>
                            </div>
                            <input
                              type="number"
                              placeholder={bizItem.turnoverCash8 ? `Auto (8%): ₹${Math.round(bizItem.turnoverCash8 * 0.08).toLocaleString('en-IN')}` : 'Optional (Auto: 8%)'}
                              value={bizItem.profitCash8 || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                handleUpdateBusiness(bizItem.id, 'profitCash8', val);
                              }}
                              className="w-full p-1.5 text-xs border border-amber-300 rounded font-mono font-bold bg-white text-amber-950"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Any Other Mode */}
                      <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-purple-900 text-[11px]">Any Other Mode</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              title="Custom Profit %"
                              placeholder="0"
                              value={bizItem.otherModePercent ?? 0}
                              onChange={(e) => {
                                const rate = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                const tOth = Number(bizItem.turnoverOtherMode) || 0;
                                handleUpdateBusiness(bizItem.id, {
                                  otherModePercent: rate,
                                  profitOtherMode: Math.round(tOth * (rate / 100)),
                                });
                              }}
                              className="w-10 px-1 py-0.5 text-[10px] text-center border border-purple-300 rounded font-bold bg-white text-purple-900"
                            />
                            <span className="text-[10px] text-purple-800 font-bold">%</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <label className="block text-[10px] text-purple-950 font-semibold mb-0.5">Turnover (₹)</label>
                            <input
                              type="number"
                              placeholder="Optional Turnover"
                              value={bizItem.turnoverOtherMode || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                const rate = (bizItem.otherModePercent !== undefined ? Number(bizItem.otherModePercent) : 0) / 100;
                                handleUpdateBusiness(bizItem.id, {
                                  turnoverOtherMode: val,
                                  profitOtherMode: Math.round(val * rate),
                                });
                              }}
                              className="w-full p-1.5 text-xs border border-purple-300 rounded font-mono font-bold bg-white text-slate-900"
                            />
                          </div>
                          <div className="bg-purple-100/70 px-2 py-1.5 rounded border border-purple-200/80 text-[10px] flex items-center justify-between">
                            <span className="text-purple-900 font-semibold">Auto Profit ({bizItem.otherModePercent ?? 0}%):</span>
                            <span className="font-mono font-bold text-purple-950 text-xs">
                              ₹{Math.round((bizItem.turnoverOtherMode || 0) * (((bizItem.otherModePercent !== undefined ? Number(bizItem.otherModePercent) : 0)) / 100)).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 44ADA (SPECIFIED PROFESSION - 50%) */}
                  {bizItem.presumptiveSection?.includes('44ADA') && (
                    <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-emerald-700" />
                          <span>Section 44ADA Presumptive Income for Specified Professions (Min 50%)</span>
                        </span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">
                          Standard Limit: ₹50L | Enhanced Limit: ₹75L (if cash ≤ 5%)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Gross Professional Receipts (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 4500000"
                            value={bizItem.totalTurnover || (Number(bizItem.turnoverDigital6 || 0) + Number(bizItem.turnoverCash8 || 0)) || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                totalTurnover: val,
                                turnoverDigital6: val,
                                turnoverCash8: 0,
                                netProfit: Math.round(val * 0.50),
                              });
                            }}
                            className="w-full p-1.5 text-xs border border-emerald-300 rounded font-mono font-bold bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Cash Receipts (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 0"
                            value={bizItem.turnoverCash8 || ''}
                            onChange={(e) => {
                              const cash = parseFloat(e.target.value) || 0;
                              const tot = Number(bizItem.totalTurnover || 0);
                              const dig = Math.max(0, tot - cash);
                              handleUpdateBusiness(bizItem.id, {
                                turnoverCash8: cash,
                                turnoverDigital6: dig,
                              });
                            }}
                            className="w-full p-1.5 text-xs border border-emerald-300 rounded font-mono font-bold bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Net Presumptive Income (Min 50%) (₹)</label>
                          <input
                            type="number"
                            placeholder={`Auto (50%): ₹${Math.round((bizItem.totalTurnover || 0) * 0.50).toLocaleString('en-IN')}`}
                            value={bizItem.netProfit || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, 'netProfit', val);
                            }}
                            className="w-full p-1.5 text-xs border border-emerald-300 rounded font-mono font-bold bg-white text-emerald-950"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 44AE (GOODS CARRIAGES) */}
                  {bizItem.presumptiveSection === '44AE' && (
                    <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-amber-700" />
                          <span>Section 44AE Presumptive Income for Plying/Leasing Goods Carriages (Max 10 Vehicles)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newCarriage = {
                              id: `c_${Date.now()}`,
                              registrationNumber: '',
                              vehicleType: 'Other than Heavy Goods Vehicle' as const,
                              grossVehicleWeightTons: 0,
                              monthsHeld: 12,
                              vehicleOwnership: 'Owned' as const,
                              presumptiveRatePerMonth: 7500,
                              presumptiveIncome: 90000,
                            };
                            const list = [...(bizItem.carriages44AE || []), newCarriage];
                            handleUpdateBusiness(bizItem.id, 'carriages44AE', list);
                          }}
                          className="px-2 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          + Add Goods Carriage
                        </button>
                      </div>

                      {(bizItem.carriages44AE || []).length === 0 ? (
                        <div className="p-2 bg-white/70 rounded border border-amber-200 text-amber-800 text-[11px] text-center">
                          No carriages added yet. Click "+ Add Goods Carriage" to enter vehicle details.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(bizItem.carriages44AE || []).map((c, cIdx) => (
                            <div key={c.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 bg-white p-2 rounded border border-amber-200 items-center">
                              <div>
                                <label className="block text-[9px] text-slate-500 font-bold">Reg. No.</label>
                                <input
                                  type="text"
                                  placeholder="PB08XX1234"
                                  value={c.registrationNumber || ''}
                                  onChange={(e) => {
                                    const updated = (bizItem.carriages44AE || []).map((item, idx) => idx === cIdx ? { ...item, registrationNumber: e.target.value.toUpperCase() } : item);
                                    handleUpdateBusiness(bizItem.id, 'carriages44AE', updated);
                                  }}
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 font-bold">Type</label>
                                <select
                                  value={c.vehicleType}
                                  onChange={(e) => {
                                    const vType = e.target.value as any;
                                    const rate = vType === 'Heavy Goods Vehicle' ? (Math.max(12, c.grossVehicleWeightTons || 12) * 1000) : 7500;
                                    const updated = (bizItem.carriages44AE || []).map((item, idx) => idx === cIdx ? { ...item, vehicleType: vType, presumptiveRatePerMonth: rate, presumptiveIncome: rate * (item.monthsHeld || 12) } : item);
                                    handleUpdateBusiness(bizItem.id, 'carriages44AE', updated);
                                  }}
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded font-medium"
                                >
                                  <option value="Other than Heavy Goods Vehicle">Non-Heavy (Up to 12 MT) - ₹7,500/mo</option>
                                  <option value="Heavy Goods Vehicle">Heavy (Above 12 MT) - ₹1,000/ton/mo</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 font-bold">Weight (Tons)</label>
                                <input
                                  type="number"
                                  disabled={c.vehicleType !== 'Heavy Goods Vehicle'}
                                  placeholder="16"
                                  value={c.grossVehicleWeightTons || ''}
                                  onChange={(e) => {
                                    const w = parseFloat(e.target.value) || 0;
                                    const rate = w * 1000;
                                    const updated = (bizItem.carriages44AE || []).map((item, idx) => idx === cIdx ? { ...item, grossVehicleWeightTons: w, presumptiveRatePerMonth: rate, presumptiveIncome: rate * (item.monthsHeld || 12) } : item);
                                    handleUpdateBusiness(bizItem.id, 'carriages44AE', updated);
                                  }}
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded font-mono font-bold disabled:bg-slate-100"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 font-bold">Months Held</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={12}
                                  value={c.monthsHeld || 12}
                                  onChange={(e) => {
                                    const m = Math.min(12, Math.max(1, parseInt(e.target.value) || 12));
                                    const updated = (bizItem.carriages44AE || []).map((item, idx) => idx === cIdx ? { ...item, monthsHeld: m, presumptiveIncome: (item.presumptiveRatePerMonth || 7500) * m } : item);
                                    handleUpdateBusiness(bizItem.id, 'carriages44AE', updated);
                                  }}
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 font-bold">Income (₹)</label>
                                <span className="block p-1 text-[11px] font-mono font-black text-amber-950">
                                  ₹{((c.presumptiveRatePerMonth || 7500) * (c.monthsHeld || 12)).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (bizItem.carriages44AE || []).filter((_, idx) => idx !== cIdx);
                                    handleUpdateBusiness(bizItem.id, 'carriages44AE', updated);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NORMAL BOOKS (SCHEDULE P&L) */}
                  {bizItem.presumptiveSection === 'Normal Books (P&L)' && (
                    <div className="bg-slate-100/80 p-3 rounded-lg border border-slate-300 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-blue-700" />
                          <span>Regular Books of Accounts (Schedule P&L / Loss Allowed)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 italic">
                          Section 71(2A): Business Loss cannot set off against Salary income
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Gross Sales / Revenue (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.grossSales || ''}
                            onChange={(e) => {
                              const s = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), grossSales: s },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Opening Stock (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.openingStock || ''}
                            onChange={(e) => {
                              const op = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), openingStock: op },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Purchases (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.purchases || ''}
                            onChange={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), purchases: p },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Closing Stock (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.closingStock || ''}
                            onChange={(e) => {
                              const cl = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), closingStock: cl },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Indirect Business Expenses (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.indirectExpenses || ''}
                            onChange={(e) => {
                              const exp = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), indirectExpenses: exp },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Depreciation (₹)</label>
                          <input
                            type="number"
                            value={bizItem.regularBooks?.totalDepreciation || ''}
                            onChange={(e) => {
                              const dep = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                regularBooks: { ...(bizItem.regularBooks || {}), totalDepreciation: dep },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DAIRY BUSINESS */}
                  {bizItem.presumptiveSection === 'Dairy' && (
                    <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950 flex items-center gap-1.5">
                          <Milk className="w-4 h-4 text-blue-700" />
                          <span>Dairy Business (Milk Sales & Cattle Feed - Taxable as Business Income)</span>
                        </span>
                        <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded">
                          Taxable Head: PGBP
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-blue-200">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Milk Sales Revenue (₹)</label>
                          <input
                            type="number"
                            value={bizItem.dairyDetails?.milkSales || ''}
                            onChange={(e) => {
                              const s = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                dairyDetails: { ...(bizItem.dairyDetails || {}), milkSales: s },
                              });
                            }}
                            className="w-full p-1 text-xs border border-blue-300 rounded font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Cattle Feed / Fodder Expenses (₹)</label>
                          <input
                            type="number"
                            value={bizItem.dairyDetails?.feedExpense || ''}
                            onChange={(e) => {
                              const f = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                dairyDetails: { ...(bizItem.dairyDetails || {}), feedExpense: f },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Labour & Vet Expenses (₹)</label>
                          <input
                            type="number"
                            value={(Number(bizItem.dairyDetails?.labourExpense || 0) + Number(bizItem.dairyDetails?.veterinaryExpense || 0)) || ''}
                            onChange={(e) => {
                              const l = parseFloat(e.target.value) || 0;
                              handleUpdateBusiness(bizItem.id, {
                                dairyDetails: { ...(bizItem.dairyDetails || {}), labourExpense: l, veterinaryExpense: 0 },
                              });
                            }}
                            className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Business Subtotal Bar */}
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs border border-slate-200">
                    <span className="font-bold text-slate-700">Subtotal for this Business:</span>
                    <div className="flex items-center gap-4">
                      <span>Turnover / Receipts: <strong className="font-mono text-slate-900">₹{(bizItem.totalTurnover || 0).toLocaleString('en-IN')}</strong></span>
                      <span>Net Income: <strong className={`font-mono ${(bizItem.netProfit || 0) < 0 ? 'text-red-600' : 'text-[#10366b]'}`}>
                        {(bizItem.netProfit || 0) < 0 ? `-₹${Math.abs(bizItem.netProfit || 0).toLocaleString('en-IN')} (Loss)` : `₹${(bizItem.netProfit || 0).toLocaleString('en-IN')}`}
                      </strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* GRAND TOTAL BUSINESS INCOME BAR */}
            <div className="mt-3 p-3 bg-[#10366b] text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
              <div className="font-bold uppercase tracking-wider text-blue-200">
                TOTAL PRESUMPTIVE BUSINESS INCOME (u/s 44AD) GRAND TOTAL:
              </div>
              <div className="flex items-center gap-6 font-mono">
                <div>
                  <span className="text-[11px] text-blue-200">Total Turnover: </span>
                  <span className="font-black text-sm text-white">₹{grandTotalBusinessTurnover.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[11px] text-emerald-300">Total Business Income: </span>
                  <span className="font-black text-sm text-emerald-300">₹{grandTotalBusinessProfit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SCHEDULE BALANCE SHEET (FINANCIAL PARTICULARS AS ON 31ST MARCH) */}
          {/* ========================================================================= */}
          <BalanceSheetEditor
            balanceSheet={formData.balanceSheet}
            onChange={(updatedBs) => setFormData({
              ...formData,
              balanceSheet: updatedBs,
            })}
            businessProfit={grandTotalBusinessProfit || formData.business.netProfit || 0}
            businessTurnover={grandTotalBusinessTurnover || formData.business.turnoverOrGrossReceipts || 0}
            clientBankName={formData.client.bankName || (formData.client.bankAccounts?.[0]?.bankName)}
            clientAccountNumber={formData.client.accountNumber || (formData.client.bankAccounts?.[0]?.accountNumber)}
            financialYear={formData.financialYear}
          />

          {/* ========================================================================= */}
          {/* SECTION 3: INCOME FROM OTHER SOURCES (SCHEDULE OS - INCOME TAX PORTAL) */}
          {/* ========================================================================= */}
          {(() => {
            const allBankItems = formData.otherSources.bankInterestItems || [];
            const savingsList = allBankItems.filter(it => it.interestType === 'Savings' || it.interestType === 'Post Office');
            const fdList = allBankItems.filter(it => it.interestType === 'Fixed Deposit (FD)');
            const rdList = allBankItems.filter(it => it.interestType === 'Recurring Deposit (RD)' || it.interestType === 'Other Interest');

            const savingsSum = savingsList.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
            const fdSum = fdList.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
            const rdSum = rdList.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
            const bankSum = savingsSum + fdSum + rdSum;

            const itRefundInt = Number(formData.otherSources.itRefundInterest) || 0;
            const passThroughInt = Number(formData.otherSources.passThroughInterest) || 0;
            const otherIntDirect = Number(formData.otherSources.otherInterestIncome) || 0;
            const totalAllInterest = bankSum + itRefundInt + passThroughInt + (otherIntDirect > 0 && !rdList.some(r => r.interestType === 'Other Interest') ? otherIntDirect : 0);

            const divInd = Number(formData.otherSources.indianCompanyDividend) || 0;
            const divMf = Number(formData.otherSources.mutualFundDividend) || 0;
            const divTotal = (divInd + divMf > 0) ? (divInd + divMf) : (Number(formData.otherSources.dividendIncome) || 0);

            const famPensionGross = Number(formData.otherSources.familyPension) || 0;
            const famPensionDed = Number(formData.otherSources.familyPensionDeduction) || (famPensionGross > 0 ? Math.min(famPensionGross, Math.min(formData.regimeOpted === 'new' ? 25000 : 15000, Math.round(famPensionGross / 3))) : 0);
            const famPensionNet = Math.max(0, famPensionGross - famPensionDed);

            const machGross = Number(formData.otherSources.machineryHireGross) || 0;
            const machExp = Number(formData.otherSources.machineryHireExpenses) || 0;
            const machNet = Math.max(0, machGross - machExp);

            const lottery = Number(formData.otherSources.lotteryWinnings) || 0;
            const onlineGames = Number(formData.otherSources.onlineGamesWinnings) || 0;
            const horseRaces = Number(formData.otherSources.horseRacesWinnings) || 0;
            const unexplained = Number(formData.otherSources.unexplainedIncome115BBE) || 0;
            const specialRateTotal = lottery + onlineGames + horseRaces + unexplained;

            const otherItems = formData.otherSources.otherIncomeItems || [];
            const otherItemsNet = otherItems.reduce((acc, it) => acc + (Number(it.netAmount) || 0), 0);
            const rawOtherFallback = (Number(formData.otherSources.otherIncome) || 0) + (Number(formData.otherSources.anyOtherIncome) || 0);
            const otherIncomeFinal = (otherItems.length > 0) ? otherItemsNet : rawOtherFallback;

            const grandTotalScheduleOS = totalAllInterest + divTotal + famPensionNet + machNet + specialRateTotal + otherIncomeFinal;

            return (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-5">
                {/* Main Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-300">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-[#10366b]" />
                    <div>
                      <h4 className="font-black text-[#10366b] text-sm uppercase tracking-wide flex items-center gap-2">
                        2. Income from Other Sources (Schedule OS - ਆਮਦਨ ਕਰ ਪੋਰਟਲ ਫਾਰਮੈਟ)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Detailed breakdown matching Official Income Tax e-Filing Portal / ITR Form
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs font-mono">
                      Net OS: <strong className="text-[#10366b] font-black">₹{grandTotalScheduleOS.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                </div>

                {/* ==================================================================== */}
                {/* 1(a). INTEREST INCOMES (3 COLUMNS: SAVINGS, FD, RD + IT REFUND & OTHER) */}
                {/* ==================================================================== */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <h5 className="font-bold text-[#10366b] text-xs uppercase tracking-wide">
                        1(a). Interest Incomes (ਵਿਆਜ ਆਮਦਨ - Savings, FD, RD, IT Refund & Other)
                      </h5>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAddSavingsInterest}
                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-bold shadow-2xs transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Savings</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddFdInterest}
                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-[11px] font-bold shadow-2xs transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ FD</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddRdInterest}
                        className="flex items-center gap-1 px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold shadow-2xs transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ RD</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Columns: Savings, FD, RD */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                    
                    {/* COLUMN 1: SAVINGS BANK INTEREST */}
                    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            <h6 className="font-bold text-blue-950 text-xs uppercase tracking-wide">
                              Savings Bank Interest
                            </h6>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSavingsInterest}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-300 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Bank</span>
                          </button>
                        </div>

                        <p className="text-[10px] text-blue-800 font-medium">
                          ਬਚਤ ਖਾਤਾ ਵਿਆਜ (Eligible for u/s 80TTA / 80TTB)
                        </p>

                        {/* Savings Accounts List */}
                        {savingsList.length === 0 ? (
                          <div className="bg-white/80 p-3 rounded-lg border border-dashed border-blue-300 text-center text-slate-500 text-[11px]">
                            No Savings Bank added. Click <strong>+ Add Bank</strong> to add.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {savingsList.map((item, idx) => (
                              <div key={item.id} className="bg-white p-2.5 rounded-lg border border-blue-200 shadow-2xs space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-blue-900 text-[11px]">Bank #{idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBankInterest(item.id)}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="Remove Bank"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Bank Selection Dropdown */}
                                <div>
                                  {formData.client.bankAccounts && formData.client.bankAccounts.length > 0 && (
                                    <div className="mb-1.5 p-1.5 bg-blue-100/60 border border-blue-200 rounded">
                                      <label className="block text-[9.5px] text-blue-950 font-bold mb-0.5">
                                        ⚡ ਕਲਾਇੰਟ ਬੈਂਕ ਖਾਤੇ 'ਚੋਂ ਚੁਣੋ (Pick from Added Client Accounts):
                                      </label>
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleSelectClientBankAccountForInterest(item.id, e.target.value);
                                          }
                                        }}
                                        className="w-full p-1 text-[11px] font-bold border border-blue-300 rounded bg-white text-blue-950 focus:border-blue-600 outline-none"
                                        defaultValue=""
                                      >
                                        <option value="">-- ਚੁਣੋ ਕਲਾਇੰਟ ਖਾਤਾ (Select Account) --</option>
                                        {formData.client.bankAccounts.map((acc, aIdx) => (
                                          <option key={acc.id} value={acc.id}>
                                            #{aIdx + 1}: {acc.bankName} {acc.accountNumber ? `(A/c: ${acc.accountNumber})` : ''} {acc.isRefundNominated ? '★ Refund' : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                    Or Select from All Banks (ਸਾਰੀ ਬੈਂਕ ਲਿਸਟ):
                                  </label>
                                  <select
                                    value={PUNJAB_BANKS.some(b => b.name === item.bankName) ? item.bankName : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleUpdateBankInterest(item.id, 'bankName', e.target.value);
                                      }
                                    }}
                                    className="w-full p-1.5 text-xs border border-blue-300 rounded bg-blue-50/50 font-semibold text-blue-950 focus:border-blue-600 outline-none mb-1"
                                  >
                                    <option value="">-- Choose from Bank List --</option>
                                    <optgroup label="🌾 Punjab Regional & Cooperative Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Punjab Cooperative & RRB').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🏦 Public Sector Nationalised Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Public Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🏛️ Private Sector Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Private Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="📮 Post Office & Small Finance Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Small Finance & Payments' || b.category === 'Post Office').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                  </select>

                                  {/* Custom input / Branch */}
                                  <input
                                    type="text"
                                    list="punjab-banks-datalist"
                                    placeholder="Or type custom bank / branch..."
                                    value={item.bankName}
                                    onChange={(e) => handleUpdateBankInterest(item.id, 'bankName', e.target.value)}
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium focus:border-blue-600 outline-none"
                                  />
                                </div>

                                {/* Quick Bank Chips */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[9px] text-slate-400 font-semibold">Quick:</span>
                                  {['SBI', 'PNB', 'Punjab Gramin Bank (PGB)', 'Capital Small Finance Bank (Jalandhar)', 'Post Office Savings Bank (POSB)', 'HDFC Bank'].map((quickName) => (
                                    <button
                                      key={quickName}
                                      type="button"
                                      onClick={() => handleUpdateBankInterest(item.id, 'bankName', quickName)}
                                      className="text-[9px] px-1.5 py-0.5 bg-blue-100/70 hover:bg-blue-200 text-blue-900 rounded font-medium transition"
                                    >
                                      {quickName.split(' ')[0]}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      Account No.
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="A/c No."
                                      value={item.accountNumber || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'accountNumber', e.target.value)}
                                      className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono text-slate-800 focus:border-blue-600 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      Amount (₹)
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Amount (₹)"
                                      value={item.amount || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                      className="w-full p-1.5 text-xs border border-blue-400 rounded font-mono font-bold text-blue-950 focus:border-blue-600 outline-none text-right bg-blue-50/40"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Column 1 Subtotal */}
                      <div className="bg-blue-100/90 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-blue-950 border border-blue-200">
                        <span>Savings Subtotal:</span>
                        <span className="font-mono text-sm font-black">₹{savingsSum.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* COLUMN 2: FIXED DEPOSIT (FD) INTEREST */}
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                            <h6 className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                              Fixed Deposit (FD) Interest
                            </h6>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddFdInterest}
                            className="flex items-center gap-1 text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add FD</span>
                          </button>
                        </div>

                        <p className="text-[10px] text-amber-800 font-medium">
                          ਮਿਆਦੀ ਜਮ੍ਹਾਂ ਵਿਆਜ (Taxable at regular slab rate)
                        </p>

                        {/* FD Accounts List */}
                        {fdList.length === 0 ? (
                          <div className="bg-white/80 p-3 rounded-lg border border-dashed border-amber-300 text-center text-slate-500 text-[11px]">
                            No Fixed Deposit added. Click <strong>+ Add FD</strong> to add.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {fdList.map((item, idx) => (
                              <div key={item.id} className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-900 text-[11px]">FD #{idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBankInterest(item.id)}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="Remove FD"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Bank Selection Dropdown for FD */}
                                <div>
                                  {formData.client.bankAccounts && formData.client.bankAccounts.length > 0 && (
                                    <div className="mb-1.5 p-1.5 bg-amber-100/70 border border-amber-300 rounded">
                                      <label className="block text-[9.5px] text-amber-950 font-bold mb-0.5">
                                        ⚡ ਕਲਾਇੰਟ ਬੈਂਕ ਖਾਤੇ 'ਚੋਂ ਚੁਣੋ (Pick from Added Client Accounts):
                                      </label>
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleSelectClientBankAccountForInterest(item.id, e.target.value);
                                          }
                                        }}
                                        className="w-full p-1 text-[11px] font-bold border border-amber-300 rounded bg-white text-amber-950 focus:border-amber-600 outline-none"
                                        defaultValue=""
                                      >
                                        <option value="">-- ਚੁਣੋ ਕਲਾਇੰਟ ਖਾਤਾ (Select Account) --</option>
                                        {formData.client.bankAccounts.map((acc, aIdx) => (
                                          <option key={acc.id} value={acc.id}>
                                            #{aIdx + 1}: {acc.bankName} {acc.accountNumber ? `(A/c: ${acc.accountNumber})` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                    Or Select from All Banks (ਸਾਰੀ ਬੈਂਕ ਲਿਸਟ):
                                  </label>
                                  <select
                                    value={PUNJAB_BANKS.some(b => b.name === item.bankName) ? item.bankName : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleUpdateBankInterest(item.id, 'bankName', e.target.value);
                                      }
                                    }}
                                    className="w-full p-1.5 text-xs border border-amber-300 rounded bg-amber-50/50 font-semibold text-amber-950 focus:border-amber-600 outline-none mb-1"
                                  >
                                    <option value="">-- Choose FD Bank from List --</option>
                                    <optgroup label="🏦 Public Sector Banks (SBI / PNB / BOB etc.)">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Public Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🌾 Punjab Regional & Cooperative Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Punjab Cooperative & RRB').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🏛️ Private Sector Banks (HDFC / ICICI / Axis)">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Private Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="📮 Post Office (TD / NSC) & Small Finance Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Small Finance & Payments' || b.category === 'Post Office').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                  </select>

                                  {/* Custom input / Branch */}
                                  <input
                                    type="text"
                                    list="punjab-banks-datalist"
                                    placeholder="Or type custom bank / FDR info..."
                                    value={item.bankName}
                                    onChange={(e) => handleUpdateBankInterest(item.id, 'bankName', e.target.value)}
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium focus:border-amber-600 outline-none"
                                  />
                                </div>

                                {/* Quick Bank Chips for FD */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[9px] text-slate-400 font-semibold">Quick:</span>
                                  {['State Bank of India (SBI)', 'Punjab National Bank (PNB)', 'HDFC Bank', 'ICICI Bank', 'Punjab Gramin Bank (PGB)', 'Capital Small Finance Bank (Jalandhar)', 'Post Office Savings Bank (POSB)'].map((quickName) => (
                                    <button
                                      key={quickName}
                                      type="button"
                                      onClick={() => handleUpdateBankInterest(item.id, 'bankName', quickName)}
                                      className="text-[9px] px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium transition"
                                    >
                                      {quickName.split(' ')[0]}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      FDR / A/c No.
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="FDR / A/c No."
                                      value={item.accountNumber || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'accountNumber', e.target.value)}
                                      className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono text-slate-800 focus:border-amber-600 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      Interest Amount (₹)
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Amount (₹)"
                                      value={item.amount || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                      className="w-full p-1.5 text-xs border border-amber-400 rounded font-mono font-bold text-amber-950 focus:border-amber-600 outline-none text-right bg-amber-50/40"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Column 2 Subtotal */}
                      <div className="bg-amber-100/90 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-amber-950 border border-amber-200">
                        <span>FD Subtotal:</span>
                        <span className="font-mono text-sm font-black">₹{fdSum.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* COLUMN 3: RECURRING DEPOSIT (RD) INTEREST */}
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <h6 className="font-bold text-emerald-950 text-xs uppercase tracking-wide">
                              Recurring Deposit (RD) Interest
                            </h6>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddRdInterest}
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-300 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add RD</span>
                          </button>
                        </div>

                        <p className="text-[10px] text-emerald-800 font-medium">
                          ਆਵਰਤੀ ਜਮ੍ਹਾਂ ਵਿਆਜ (Taxable at slab rate)
                        </p>

                        {/* RD Accounts List */}
                        {rdList.length === 0 ? (
                          <div className="bg-white/80 p-3 rounded-lg border border-dashed border-emerald-300 text-center text-slate-500 text-[11px]">
                            No Recurring Deposit added. Click <strong>+ Add RD</strong> to add.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {rdList.map((item, idx) => (
                              <div key={item.id} className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-900 text-[11px]">RD #{idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBankInterest(item.id)}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="Remove RD"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Bank Selection Dropdown for RD */}
                                <div>
                                  {formData.client.bankAccounts && formData.client.bankAccounts.length > 0 && (
                                    <div className="mb-1.5 p-1.5 bg-emerald-100/70 border border-emerald-300 rounded">
                                      <label className="block text-[9.5px] text-emerald-950 font-bold mb-0.5">
                                        ⚡ ਕਲਾਇੰਟ ਬੈਂਕ ਖਾਤੇ 'ਚੋਂ ਚੁਣੋ (Pick from Added Client Accounts):
                                      </label>
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleSelectClientBankAccountForInterest(item.id, e.target.value);
                                          }
                                        }}
                                        className="w-full p-1 text-[11px] font-bold border border-emerald-300 rounded bg-white text-emerald-950 focus:border-emerald-600 outline-none"
                                        defaultValue=""
                                      >
                                        <option value="">-- ਚੁਣੋ ਕਲਾਇੰਟ ਖਾਤਾ (Select Account) --</option>
                                        {formData.client.bankAccounts.map((acc, aIdx) => (
                                          <option key={acc.id} value={acc.id}>
                                            #{aIdx + 1}: {acc.bankName} {acc.accountNumber ? `(A/c: ${acc.accountNumber})` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                    Or Select from All Banks (ਸਾਰੀ ਬੈਂਕ ਲਿਸਟ):
                                  </label>
                                  <select
                                    value={PUNJAB_BANKS.some(b => b.name === item.bankName) ? item.bankName : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleUpdateBankInterest(item.id, 'bankName', e.target.value);
                                      }
                                    }}
                                    className="w-full p-1.5 text-xs border border-emerald-300 rounded bg-emerald-50/50 font-semibold text-emerald-950 focus:border-emerald-600 outline-none mb-1"
                                  >
                                    <option value="">-- Choose RD Bank from List --</option>
                                    <optgroup label="📮 Post Office (Most Common for RD)">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Post Office').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🏦 Public Sector Banks (SBI / PNB / PSB etc.)">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Public Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🌾 Punjab Regional & Cooperative Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Punjab Cooperative & RRB').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🏛️ Private Sector Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Private Sector').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="💳 Small Finance Banks">
                                      {PUNJAB_BANKS.filter(b => b.category === 'Small Finance & Payments').map(b => (
                                        <option key={b.code} value={b.name}>{b.name} ({b.punjabiName})</option>
                                      ))}
                                    </optgroup>
                                  </select>

                                  {/* Custom input / Branch */}
                                  <input
                                    type="text"
                                    list="punjab-banks-datalist"
                                    placeholder="Or type custom bank / branch..."
                                    value={item.bankName}
                                    onChange={(e) => handleUpdateBankInterest(item.id, 'bankName', e.target.value)}
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium focus:border-emerald-600 outline-none"
                                  />
                                </div>

                                {/* Quick Bank Chips for RD */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[9px] text-slate-400 font-semibold">Quick:</span>
                                  {['Post Office Savings Bank (POSB)', 'Punjab National Bank (PNB)', 'State Bank of India (SBI)', 'Punjab Gramin Bank (PGB)', 'Capital Small Finance Bank (Jalandhar)', 'HDFC Bank'].map((quickName) => (
                                    <button
                                      key={quickName}
                                      type="button"
                                      onClick={() => handleUpdateBankInterest(item.id, 'bankName', quickName)}
                                      className="text-[9px] px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-medium transition"
                                    >
                                      {quickName.split(' ')[0]}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      RD A/c No.
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="RD A/c No."
                                      value={item.accountNumber || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'accountNumber', e.target.value)}
                                      className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono text-slate-800 focus:border-emerald-600 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                                      Interest Amount (₹)
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="Amount (₹)"
                                      value={item.amount || ''}
                                      onChange={(e) => handleUpdateBankInterest(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                      className="w-full p-1.5 text-xs border border-emerald-400 rounded font-mono font-bold text-emerald-950 focus:border-emerald-600 outline-none text-right bg-emerald-50/40"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Column 3 Subtotal */}
                      <div className="bg-emerald-100/90 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-emerald-950 border border-emerald-200">
                        <span>RD Subtotal:</span>
                        <span className="font-mono text-sm font-black">₹{rdSum.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                  </div>

                  {/* Additional Interest Fields: IT Refund Interest & Pass-through */}
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-2.5 rounded-lg">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Interest on Income Tax Refund u/s 244A (ਆਮਦਨ ਕਰ ਰਿਫੰਡ ਵਿਆਜ)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.itRefundInterest || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('itRefundInterest', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-800 focus:border-blue-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Pass-through Interest Income (Sec 115UA / 115UB)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.passThroughInterest || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('passThroughInterest', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-800 focus:border-blue-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Any Other Direct Interest Income (ਹੋਰ ਵਿਆਜ)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.otherInterestIncome || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('otherInterestIncome', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-800 focus:border-blue-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Subtotal Total Interest */}
                  <div className="bg-blue-900 text-white p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-blue-200">
                      Total Interest Income (ਕੁੱਲ ਵਿਆਜ ਆਮਦਨ 1a):
                    </span>
                    <span className="font-mono text-sm font-black text-emerald-300">
                      ₹{totalAllInterest.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* ==================================================================== */}
                {/* 1(b). DIVIDEND INCOME BREAKDOWN (SCHEDULE OS ROW 1b) */}
                {/* ==================================================================== */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
                    <h5 className="font-bold text-[#10366b] text-xs uppercase tracking-wide">
                      1(b). Dividend Income (ਡਿਵੀਡੈਂਡ ਆਮਦਨ - Companies & Mutual Funds)
                    </h5>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-violet-50/50 p-2.5 rounded-lg border border-violet-200">
                      <label className="block text-violet-950 font-bold mb-1">
                        Dividend from Indian Companies (ਭਾਰਤੀ ਕੰਪਨੀਆਂ)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.indianCompanyDividend || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('indianCompanyDividend', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-violet-300 rounded font-mono font-bold text-violet-950 focus:border-violet-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>

                    <div className="bg-violet-50/50 p-2.5 rounded-lg border border-violet-200">
                      <label className="block text-violet-950 font-bold mb-1">
                        Dividend from Mutual Funds / InvITs (ਮਿਊਚਲ ਫੰਡ)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.mutualFundDividend || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('mutualFundDividend', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-violet-300 rounded font-mono font-bold text-violet-950 focus:border-violet-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>

                    <div className="bg-violet-100/70 p-2.5 rounded-lg border border-violet-300 flex flex-col justify-between">
                      <span className="text-[11px] text-violet-950 font-bold">Total Dividend (ਕੁੱਲ ਡਿਵੀਡੈਂਡ):</span>
                      <div className="font-mono text-base font-black text-violet-950 text-right">
                        ₹{divTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ==================================================================== */}
                {/* 1(c) & 1(d). FAMILY PENSION & MACHINERY/PLANT HIRE */}
                {/* ==================================================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* 1(c) FAMILY PENSION (WITH SECTION 57(iia) DEDUCTION) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                          <h5 className="font-bold text-teal-950 text-xs uppercase tracking-wide">
                            1(c). Family Pension (ਪਰਿਵਾਰਕ ਪੈਨਸ਼ਨ)
                          </h5>
                        </div>
                        <span className="text-[10px] bg-teal-100 text-teal-900 font-bold px-2 py-0.5 rounded border border-teal-300">
                          Sec 57(iia) Allowed
                        </span>
                      </div>

                      <p className="text-[10.5px] text-slate-500 mb-2">
                        Standard Deduction u/s 57(iia): <strong>1/3rd or ₹{formData.regimeOpted === 'new' ? '25,000 (New Regime)' : '15,000 (Old Regime)'}</strong> (whichever is lower)
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Gross Family Pension (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={formData.otherSources.familyPension || ''}
                            onChange={(e) => handleUpdateFamilyPension(parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border border-teal-300 rounded font-mono font-bold text-teal-950 focus:border-teal-600 outline-none text-right bg-teal-50/30"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Less: Deduction u/s 57(iia) (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={famPensionDed || ''}
                            readOnly
                            className="w-full p-1.5 border border-slate-200 rounded font-mono font-bold text-slate-600 bg-slate-100 text-right cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-teal-50 p-2 rounded-lg border border-teal-200 flex items-center justify-between text-xs font-bold text-teal-950 mt-2">
                      <span>Net Taxable Family Pension:</span>
                      <span className="font-mono text-sm font-black text-teal-900">₹{famPensionNet.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* 1(d) RENTAL INCOME FROM MACHINERY, PLANT, FURNITURE */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
                          <h5 className="font-bold text-orange-950 text-xs uppercase tracking-wide">
                            1(d). Machinery / Plant / Furniture Hire
                          </h5>
                        </div>
                        <span className="text-[10px] bg-orange-100 text-orange-900 font-bold px-2 py-0.5 rounded border border-orange-300">
                          Sec 57(ii) Expenses
                        </span>
                      </div>

                      <p className="text-[10.5px] text-slate-500 mb-2">
                        ਮਸ਼ੀਨਰੀ / ਪਲਾਂਟ ਕਿਰਾਇਆ ਆਮਦਨ (Less allowable depreciation & maintenance expenses u/s 57)
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Gross Rental / Hire Charges (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={formData.otherSources.machineryHireGross || ''}
                            onChange={(e) => handleUpdateMachineryHire('machineryHireGross', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border border-orange-300 rounded font-mono font-bold text-orange-950 focus:border-orange-600 outline-none text-right bg-orange-50/30"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Less: Allowable Expenses u/s 57 (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={formData.otherSources.machineryHireExpenses || ''}
                            onChange={(e) => handleUpdateMachineryHire('machineryHireExpenses', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border border-orange-300 rounded font-mono font-bold text-orange-950 focus:border-orange-600 outline-none text-right bg-orange-50/30"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 p-2 rounded-lg border border-orange-200 flex items-center justify-between text-xs font-bold text-orange-950 mt-2">
                      <span>Net Rental from Machinery:</span>
                      <span className="font-mono text-sm font-black text-orange-900">₹{machNet.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                </div>

                {/* ==================================================================== */}
                {/* 2. SPECIAL RATE INCOMES (SCHEDULE OS ROW 2 - LOTTERY, BETTING, ONLINE GAMES) */}
                {/* ==================================================================== */}
                <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                      <h5 className="font-bold text-rose-950 text-xs uppercase tracking-wide">
                        2. Special Rate Incomes (ਲਾਟਰੀ, ਘੋੜ ਦੌੜ, ਆਨਲਾਈਨ ਗੇਮਿੰਗ & ਅਣ-ਐਲਾਨੀ ਆਮਦਨ)
                      </h5>
                    </div>
                    <span className="text-[10px] bg-rose-100 text-rose-900 font-bold px-2 py-0.5 rounded border border-rose-300">
                      Taxed at Special Rates (30% / 60%)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <label className="block text-rose-950 font-bold mb-1">
                        Lottery / Crossword / Betting (115BB @ 30%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.lotteryWinnings || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('lotteryWinnings', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-rose-300 rounded font-mono font-bold text-rose-950 focus:border-rose-600 outline-none text-right"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <label className="block text-rose-950 font-bold mb-1">
                        Online Gaming Winnings (115BBJ @ 30%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.onlineGamesWinnings || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('onlineGamesWinnings', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-rose-300 rounded font-mono font-bold text-rose-950 focus:border-rose-600 outline-none text-right"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <label className="block text-rose-950 font-bold mb-1">
                        Winnings from Horse Races (@ 30%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.horseRacesWinnings || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('horseRacesWinnings', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-rose-300 rounded font-mono font-bold text-rose-950 focus:border-rose-600 outline-none text-right"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <label className="block text-rose-950 font-bold mb-1">
                        Unexplained Money / Cash (115BBE @ 60%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.unexplainedIncome115BBE || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('unexplainedIncome115BBE', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 border border-rose-300 rounded font-mono font-bold text-rose-950 focus:border-rose-600 outline-none text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {specialRateTotal > 0 && (
                    <div className="bg-rose-100 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-rose-950 border border-rose-300">
                      <span>Total Special Rate Winnings / Income:</span>
                      <span className="font-mono text-sm font-black text-rose-900">₹{specialRateTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                {/* ==================================================================== */}
                {/* 1(e) & 3. ANY OTHER INCOMES & DEDUCTIONS U/S 57 (ITEMIZED LIST) */}
                {/* ==================================================================== */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      <div>
                        <h5 className="font-bold text-[#10366b] text-xs uppercase tracking-wide">
                          1(e) & 3. Other Incomes & Allowable Deductions (ਹੋਰ ਆਮਦਨਾਂ ਅਤੇ ਕਟੌਤੀਆਂ)
                        </h5>
                        <p className="text-[10px] text-slate-500">
                          Commission, Brokerage, Royalty, Director Fees, Agri Lease Rent, Gifts u/s 56(2)(x), Freelance etc.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddOtherIncomeItem('Commission / Agency')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold shadow-2xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Other Income</span>
                      </button>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  {otherItems.length === 0 ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                      <p className="text-slate-500 text-xs">
                        No itemized other income added. (ਜੇ ਕਮਿਸ਼ਨ, ਦਲਾਲੀ ਜਾਂ ਕੋਈ ਹੋਰ ਆਮਦਨ ਹੈ ਤਾਂ ਇੱਥੇ ਐਡ ਕਰੋ)
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {[
                          'Commission / Agency',
                          'Brokerage',
                          'Director Sitting Fees',
                          'Royalty / Honorarium',
                          'Agricultural Land Lease',
                          'Gift u/s 56(2)(x) > 50k',
                          'Miscellaneous Income'
                        ].map((catName) => (
                          <button
                            key={catName}
                            type="button"
                            onClick={() => handleAddOtherIncomeItem(catName as OtherIncomeCategory)}
                            className="text-[11px] px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded font-semibold transition"
                          >
                            + {catName}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {otherItems.map((item, idx) => (
                        <div key={item.id} className="bg-slate-50/80 p-3 rounded-xl border border-slate-300 space-y-2.5 text-xs shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <span className="font-bold text-indigo-950 text-[11px] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                              Item #{idx + 1}: {item.category}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOtherIncomeItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-0.5 flex items-center gap-1 text-[11px] font-semibold"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                                Nature / Category (ਸ਼੍ਰੇਣੀ)
                              </label>
                              <select
                                value={item.category}
                                onChange={(e) => handleUpdateOtherIncomeItem(item.id, 'category', e.target.value as OtherIncomeCategory)}
                                className="w-full p-1.5 text-xs border border-slate-300 rounded font-semibold bg-white text-slate-800 focus:border-indigo-600 outline-none"
                              >
                                <option value="Commission / Agency">Commission / Agency (ਕਮਿਸ਼ਨ)</option>
                                <option value="Brokerage">Brokerage (ਦਲਾਲੀ)</option>
                                <option value="Director Sitting Fees">Director Sitting Fees</option>
                                <option value="Royalty / Honorarium">Royalty / Honorarium</option>
                                <option value="Agricultural Land Lease">Agricultural Land Lease (ਠੇਕਾ/ਲੀਜ਼)</option>
                                <option value="Gift u/s 56(2)(x) > 50k">Gift u/s 56(2)(x) &gt; ₹50,000</option>
                                <option value="Examination Remuneration">Examination Remuneration</option>
                                <option value="Any Other Miscellaneous">Any Other Miscellaneous</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                                Description / Source (ਵੇਰਵਾ)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Life Insurance Agency Commission"
                                value={item.description || ''}
                                onChange={(e) => handleUpdateOtherIncomeItem(item.id, 'description', e.target.value)}
                                className="w-full p-1.5 text-xs border border-slate-300 rounded font-medium bg-white text-slate-800 focus:border-indigo-600 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                                Gross Amount (₹)
                              </label>
                              <input
                                type="number"
                                placeholder="0"
                                value={item.grossAmount || ''}
                                onChange={(e) => handleUpdateOtherIncomeItem(item.id, 'grossAmount', parseFloat(e.target.value) || 0)}
                                className="w-full p-1.5 text-xs border border-indigo-300 rounded font-mono font-bold text-indigo-950 focus:border-indigo-600 outline-none text-right bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-600 font-bold mb-0.5">
                                Less: Exp. u/s 57 (₹)
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={item.deductionSec57 || ''}
                                  onChange={(e) => handleUpdateOtherIncomeItem(item.id, 'deductionSec57', parseFloat(e.target.value) || 0)}
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded font-mono font-bold text-slate-700 focus:border-indigo-600 outline-none text-right bg-white"
                                />
                                <div className="text-right min-w-[70px]">
                                  <span className="text-[9.5px] text-slate-500 font-bold block">Net</span>
                                  <span className="font-mono text-xs font-black text-indigo-950">₹{(item.netAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fallback Single Other Income Field if no items */}
                  {otherItems.length === 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/60 p-2 rounded-lg">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Direct Any Other Income (ਹੋਰ ਫੁਟਕਲ ਆਮਦਨ ₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.otherIncome || formData.otherSources.anyOtherIncome || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('otherIncome', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-800 focus:border-indigo-600 outline-none bg-white text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Less: Allowable Expenses u/s 57 (ਖਰਚੇ ₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={formData.otherSources.anyOtherIncomeExpenses || ''}
                          onChange={(e) => handleUpdateOtherSourcesField('anyOtherIncomeExpenses', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded font-mono font-semibold text-slate-800 focus:border-indigo-600 outline-none bg-white text-right"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-indigo-50 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-indigo-950 border border-indigo-200">
                    <span>Total Other Income Net (ਕੁੱਲ ਹੋਰ ਆਮਦਨ):</span>
                    <span className="font-mono text-sm font-black text-indigo-900">₹{otherIncomeFinal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* ==================================================================== */}
                {/* SCHEDULE OS: GRAND TOTAL SUMMARY BAR */}
                {/* ==================================================================== */}
                <div className="p-3.5 bg-[#10366b] text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-black uppercase tracking-wider text-blue-100 text-xs sm:text-sm">
                      TOTAL CHARGEABLE UNDER "INCOME FROM OTHER SOURCES" (ਕੁੱਲ ਹੋਰ ਵਸੀਲਿਆਂ ਤੋਂ ਆਮਦਨ):
                    </span>
                    <span className="font-black text-base sm:text-lg text-emerald-300 font-mono">
                      ₹{grandTotalScheduleOS.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                    <span className="text-blue-200">Interest: <strong className="text-white">₹{totalAllInterest.toLocaleString('en-IN')}</strong></span>
                    <span className="text-violet-200">Dividend: <strong className="text-white">₹{divTotal.toLocaleString('en-IN')}</strong></span>
                    <span className="text-teal-200">Pension: <strong className="text-white">₹{famPensionNet.toLocaleString('en-IN')}</strong></span>
                    <span className="text-orange-200">Machinery: <strong className="text-white">₹{machNet.toLocaleString('en-IN')}</strong></span>
                    {specialRateTotal > 0 && <span className="text-rose-200">Winnings: <strong className="text-white">₹{specialRateTotal.toLocaleString('en-IN')}</strong></span>}
                    <span className="text-indigo-200">Other: <strong className="text-white">₹{otherIncomeFinal.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* Section 4: Other Heads of Income (Salary / House Property / Capital Gains) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-[#10366b] text-xs uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10366b]"></span>
                4. Income from Salaries (Schedule Salary / Sec 15-17) & Other Heads
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300">
                Std Ded: {formData.regimeOpted === 'new' ? (formData.assessmentYear?.includes('2024-25') ? '₹50,000 (New)' : '₹75,000 (New AY 25-26/26-27)') : '₹50,000 (Old)'}
              </span>
            </h4>

            {/* Salary Breakdown with Multiple Employer Support */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <SalaryListEditor
                salary={formData.salary}
                regime={formData.regimeOpted}
                assessmentYear={formData.assessmentYear || '2026-27'}
                onChange={(updatedSalary, totalTds) => {
                  setFormData(prev => {
                    const updated = {
                      ...prev,
                      salary: updatedSalary,
                    };
                    if (totalTds !== undefined && totalTds > 0) {
                      updated.taxesPaid = {
                        ...prev.taxesPaid,
                        tdsSalary: totalTds,
                      };
                    }
                    return updated;
                  });
                }}
              />
            </div>

            {/* House Property & Comprehensive Capital Gains Buckets */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold text-xs">House Property / Home Loan Int. u/s 24(b) (₹)</label>
                <input
                  type="number"
                  value={formData.houseProperty.homeLoanInterest24b || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    houseProperty: { ...formData.houseProperty, homeLoanInterest24b: parseFloat(e.target.value) || 0 }
                  })}
                  placeholder="Interest amount (e.g. 150000)"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono text-xs"
                />
              </div>

              {/* Comprehensive Capital Gains Buckets */}
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <h5 className="font-bold text-[#10366b] text-xs uppercase tracking-wide">
                      Schedule CG: Capital Gains & Special-Rate Buckets (ਕੈਪੀਟਲ ਗੇਨ)
                    </h5>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded border border-indigo-300">
                    Separate Tax Buckets Engine
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200">
                    <label className="block text-indigo-950 font-bold mb-1">
                      111A STCG (Equity/MF @ {formData.assessmentYear?.includes('2026-27') ? '20%' : '15%'})
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.stcg111A || formData.capitalGains.stcg15 || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, stcg111A: val, stcg15: val }
                        });
                      }}
                      className="w-full p-1.5 border border-indigo-300 rounded font-mono font-bold text-indigo-950 bg-white text-right focus:border-indigo-600 outline-none"
                    />
                    <span className="text-[9px] text-slate-500 mt-0.5 block">STT paid listed shares/MF</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                    <label className="block text-slate-900 font-bold mb-1">
                      Other STCG (Normal Slab Rates)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.stcgNormal || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, stcgNormal: val }
                        });
                      }}
                      className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white text-right focus:border-blue-600 outline-none"
                    />
                    <span className="text-[9px] text-slate-500 mt-0.5 block">Unlisted shares/other assets</span>
                  </div>

                  <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                    <label className="block text-emerald-950 font-bold mb-1">
                      112A LTCG (Equity &gt; {formData.assessmentYear?.includes('2026-27') ? '₹1.25L' : '₹1L'} @ {formData.assessmentYear?.includes('2026-27') ? '12.5%' : '10%'})
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.ltcg112A || formData.capitalGains.ltcg10 || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, ltcg112A: val, ltcg10: val }
                        });
                      }}
                      className="w-full p-1.5 border border-emerald-300 rounded font-mono font-bold text-emerald-950 bg-white text-right focus:border-emerald-600 outline-none"
                    />
                    <span className="text-[9px] text-emerald-700 mt-0.5 block">Listed equity / equity MFs</span>
                  </div>

                  <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                    <label className="block text-amber-950 font-bold mb-1">
                      112 LTCG (Property/Unlisted @ {formData.assessmentYear?.includes('2026-27') ? '12.5%' : '20%'})
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.ltcg112 || formData.capitalGains.ltcg20 || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, ltcg112: val, ltcg20: val }
                        });
                      }}
                      className="w-full p-1.5 border border-amber-300 rounded font-mono font-bold text-amber-950 bg-white text-right focus:border-amber-600 outline-none"
                    />
                    <span className="text-[9px] text-amber-800 mt-0.5 block">Immovable property / unlisted</span>
                  </div>
                </div>

                {/* Capital Losses Set-off Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                  <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-200">
                    <label className="block text-rose-950 font-semibold mb-0.5">
                      Short Term Capital Loss (STCL to set-off) (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.shortTermLoss || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, shortTermLoss: val }
                        });
                      }}
                      className="w-full p-1.5 border border-rose-300 rounded font-mono font-bold text-rose-900 bg-white text-right focus:border-rose-600 outline-none"
                    />
                    <span className="text-[8.5px] text-slate-500">Can set off against both STCG & LTCG</span>
                  </div>

                  <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-200">
                    <label className="block text-rose-950 font-semibold mb-0.5">
                      Long Term Capital Loss (LTCL to set-off) (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.capitalGains.longTermLoss || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          capitalGains: { ...formData.capitalGains, longTermLoss: val }
                        });
                      }}
                      className="w-full p-1.5 border border-rose-300 rounded font-mono font-bold text-rose-900 bg-white text-right focus:border-rose-600 outline-none"
                    />
                    <span className="text-[8.5px] text-slate-500">Can ONLY set off against LTCG (112/112A)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Agricultural Income (Exempt u/s 10(1)) */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🌾</span>
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                    5. Agricultural Income (ਖੇਤੀਬਾੜੀ ਆਮਦਨ - Exempt u/s 10(1))
                  </h4>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    J-Form Produce Receipts, Cultivation Costs & Net Exempt Income
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                100% Tax Exempt u/s 10(1)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-emerald-950 mb-1 font-bold">
                  Gross Agri Receipts (ਕੁੱਲ ਜੇ-ਫਾਰਮ ਵਿਕਰੀ ₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 550000"
                  value={formData.agriculturalDetails?.grossAgriculturalReceipts || ''}
                  onChange={(e) => handleUpdateAgri('grossAgriculturalReceipts', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-emerald-300 rounded-lg outline-none focus:border-emerald-600 font-mono font-semibold bg-white text-emerald-950"
                />
                <span className="text-[9.5px] text-emerald-700 mt-0.5 block">
                  Crop sale / Mandi J-Forms total
                </span>
              </div>

              <div>
                <label className="block text-emerald-950 mb-1 font-bold">
                  Agri Expenses (ਖੇਤੀਬਾੜੀ ਖਰਚੇ ₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 200000"
                  value={formData.agriculturalDetails?.agriculturalExpenses || ''}
                  onChange={(e) => handleUpdateAgri('agriculturalExpenses', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-emerald-300 rounded-lg outline-none focus:border-emerald-600 font-mono bg-white text-emerald-950"
                />
                <span className="text-[9.5px] text-emerald-700 mt-0.5 block">
                  Seeds, fertilizer, diesel, labour & lease
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-emerald-950 font-bold">
                    Net Agri Income (ਸ਼ੁੱਧ ਆਮਦਨ ₹)
                  </label>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                    Gross - Exp
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 350000"
                  value={formData.agriculturalDetails?.netAgriculturalIncome || formData.agriculturalIncome || ''}
                  onChange={(e) => handleUpdateAgri('netAgriculturalIncome', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-emerald-400 rounded-lg outline-none focus:border-emerald-600 font-mono font-black text-emerald-950 bg-emerald-100/50"
                />
                <span className="text-[9.5px] text-emerald-800 font-semibold mt-0.5 block">
                  Exempt Net: ₹{(Number(formData.agriculturalDetails?.netAgriculturalIncome || formData.agriculturalIncome || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Section 6: Deductions (Chapter VI-A) */}
          <div>
            <h4 className="font-bold text-[#10366b] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10366b]"></span>
              6. Deductions (Chapter VI-A)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Section 80C (Max 1.5L)</label>
                <input
                  type="number"
                  value={formData.deductions.sec80C || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    deductions: { ...formData.deductions, sec80C: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Section 80D (Health)</label>
                <input
                  type="number"
                  value={formData.deductions.sec80D || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    deductions: { ...formData.deductions, sec80D: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">80CCD(1B) NPS Extra</label>
                <input
                  type="number"
                  value={formData.deductions.sec80CCD1B || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    deductions: { ...formData.deductions, sec80CCD1B: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">80CCD(2) Employer NPS</label>
                <input
                  type="number"
                  value={formData.deductions.sec80CCD2 || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    deductions: { ...formData.deductions, sec80CCD2: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 7: Taxes Paid (TDS / TCS / Advance / SAT) & Interest / Late Fee */}
          <div>
            <h4 className="font-bold text-[#10366b] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10366b]"></span>
              7. Taxes Paid, Credits &amp; Interest / Sec 234F Fee
            </h4>
            {(formData.taxesPaid.challans && formData.taxesPaid.challans.length > 0) && (
              <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                Note: This computation has <strong>{formData.taxesPaid.challans.length} itemized challan(s)</strong>. Category totals with active challans are automatically summed from those challan records on save to prevent double counting.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">TDS on Salary (Form 16)</label>
                <input
                  type="number"
                  value={formData.taxesPaid.tdsSalary || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, tdsSalary: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">TDS Non-Salary (194A/C/J)</label>
                <input
                  type="number"
                  value={formData.taxesPaid.tdsOther || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, tdsOther: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">TCS u/s 206C</label>
                <input
                  type="number"
                  value={formData.taxesPaid.tcs || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, tcs: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Advance Tax (u/s 208-211)</label>
                <input
                  type="number"
                  value={formData.taxesPaid.advanceTax || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, advanceTax: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Self Assessment Tax (u/s 140A)</label>
                <input
                  type="number"
                  value={formData.taxesPaid.selfAssessmentTax || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, selfAssessmentTax: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Regular Assessment Tax (u/s 156)</label>
                <input
                  type="number"
                  value={formData.taxesPaid.regularAssessmentTax || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    taxesPaid: { ...formData.taxesPaid, regularAssessmentTax: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Interest u/s 234A</label>
                <input
                  type="number"
                  value={formData.interest234A || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    interest234A: parseFloat(e.target.value) || 0
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Interest u/s 234B</label>
                <input
                  type="number"
                  value={formData.interest234B || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    interest234B: parseFloat(e.target.value) || 0
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Interest u/s 234C</label>
                <input
                  type="number"
                  value={formData.interest234C || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    interest234C: parseFloat(e.target.value) || 0
                  })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-mono"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-3 z-20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Cancel (ਰੱਦ ਕਰੋ)
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-[#10366b] hover:bg-blue-900 text-white shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-blue-200" />
            <span>Save Changes (ਸੋਧੇ ਹੋਏ ਕਲਾਇੰਟ ਡਾਟਾ ਨੂੰ ਸੇਵ ਕਰੋ)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
