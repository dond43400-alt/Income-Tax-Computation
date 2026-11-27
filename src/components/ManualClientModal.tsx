import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  X, 
  Check, 
  Building2, 
  CreditCard, 
  Landmark, 
  Calculator, 
  Sparkles, 
  AlertCircle,
  FileText,
  Briefcase,
  Sprout,
  UserCheck,
  TrendingUp,
  IndianRupee,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  ChevronDown,
  Percent,
  BadgeCheck,
  Info
} from 'lucide-react';
import { 
  TaxComputation, 
  ClientProfile, 
  ClientBankAccount,
  Language, 
  TaxRegime, 
  ITRFormType, 
  FilingSection,
  BankInterestItem
} from '../types';
import { recalculateFullComputation } from '../utils/taxCalculator';
import { formatINR } from '../utils/pdfGenerator';
import { PUNJAB_BANKS, BankInfo } from '../utils/punjabBanks';
import { lookupPincodeOffline, lookupPincodeAsync } from '../utils/pincodeLookup';
import { lookupIfscOffline, lookupIfscAsync } from '../utils/ifscLookup';

interface ManualClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: (computation: TaxComputation) => void;
  lang: Language;
}

type IncomeCategory = 'business' | 'salary' | 'agriculture' | 'other';

interface InterestEntryState {
  id: string;
  bankAccountId: string; // Links to ClientBankAccount.id or 'other'
  customBankName?: string;
  customAccountNo?: string;
  interestType: 'Savings' | 'Fixed Deposit (FD)' | 'Recurring Deposit (RD)' | 'Post Office' | 'Other Interest';
  amount: number;
}

export const ManualClientModal: React.FC<ManualClientModalProps> = ({
  isOpen,
  onClose,
  onClientAdded,
  lang,
}) => {
  // Active step / tab in form
  const [activeSection, setActiveSection] = useState<'profile' | 'filing' | 'bank' | 'income'>('profile');

  // Client profile fields
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Senior Citizen'>('Male');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [tehsil, setTehsil] = useState('');
  const [placeOfFiling, setPlaceOfFiling] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeDetectedInfo, setPincodeDetectedInfo] = useState<string>('');
  const [ifscFeedbackMap, setIfscFeedbackMap] = useState<Record<string, { text: string; isExact: boolean }>>({});

  // Filing info
  const [assessmentYear, setAssessmentYear] = useState('2026-27');
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [itrForm, setItrForm] = useState<ITRFormType>('ITR-4 (Sugam)');
  const [filingSection, setFilingSection] = useState<FilingSection>('139(1) - On or before due date');
  const [regimeOpted, setRegimeOpted] = useState<TaxRegime>('new');
  const [acknowledgementNumber, setAcknowledgementNumber] = useState('');
  const [filingDate, setFilingDate] = useState(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }));

  // MULTIPLE Bank Accounts (Clean empty initialization)
  const [bankAccounts, setBankAccounts] = useState<ClientBankAccount[]>([
    {
      id: 'bank_1',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
      accountType: 'Savings',
      isRefundNominated: true,
      validationStatus: 'VALIDATED & ELECTED',
    }
  ]);

  // Bank search/filter state for bank selector helper
  const [bankCategoryFilter, setBankCategoryFilter] = useState<string>('All');
  const [bankSearchQuery, setBankSearchQuery] = useState<string>('');

  // Income details
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('business');
  
  // Salary
  const [grossSalary, setGrossSalary] = useState<number>(0);
  
  // Business 44AD
  const [businessName, setBusinessName] = useState('');
  const [businessNature, setBusinessNature] = useState('');
  const [businessCode, setBusinessCode] = useState('');
  const [turnoverDigital, setTurnoverDigital] = useState<number>(0);
  const [profitDigital, setProfitDigital] = useState<number>(0);
  const [turnoverCash, setTurnoverCash] = useState<number>(0);
  const [profitCash, setProfitCash] = useState<number>(0);
  
  // Agriculture
  const [grossAgri, setGrossAgri] = useState<number>(0);
  const [agriExpenses, setAgriExpenses] = useState<number>(0);

  // Dynamic Bank Interest entries linked to added bank accounts
  const [interestEntries, setInterestEntries] = useState<InterestEntryState[]>([
    {
      id: 'int_1',
      bankAccountId: 'bank_1',
      interestType: 'Savings',
      amount: 0,
    }
  ]);

  // Taxes paid
  const [tdsSalary, setTdsSalary] = useState<number>(0);
  const [tdsOther, setTdsOther] = useState<number>(0);
  const [advanceTax, setAdvanceTax] = useState<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Function to completely reset the form
  const resetAllFields = () => {
    setActiveSection('profile');
    setName('');
    setTradeName('');
    setPan('');
    setAadhaar('');
    setFatherName('');
    setDob('');
    setGender('Male');
    setMobile('');
    setEmail('');
    setAddress('');
    setPincode('');
    setState('');
    setDistrict('');
    setTehsil('');
    setPlaceOfFiling('');
    setPincodeLoading(false);
    setPincodeDetectedInfo('');
    setIfscFeedbackMap({});

    setAssessmentYear('2026-27');
    setFinancialYear('2025-26');
    setItrForm('ITR-4 (Sugam)');
    setFilingSection('139(1) - On or before due date');
    setRegimeOpted('new');
    setAcknowledgementNumber('');
    setFilingDate(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }));

    setBankAccounts([
      {
        id: 'bank_1',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
        accountType: 'Savings',
        isRefundNominated: true,
        validationStatus: 'VALIDATED & ELECTED',
      }
    ]);
    setBankCategoryFilter('All');
    setBankSearchQuery('');

    setIncomeCategory('business');
    setGrossSalary(0);
    setBusinessName('');
    setBusinessNature('');
    setBusinessCode('');
    setTurnoverDigital(0);
    setProfitDigital(0);
    setTurnoverCash(0);
    setProfitCash(0);
    setGrossAgri(0);
    setAgriExpenses(0);

    setInterestEntries([
      {
        id: 'int_1',
        bankAccountId: 'bank_1',
        interestType: 'Savings',
        amount: 0,
      }
    ]);

    setTdsSalary(0);
    setTdsOther(0);
    setAdvanceTax(0);
    setErrorMessage(null);
  };

  // Reset form whenever modal opens so it is always 100% clean
  useEffect(() => {
    if (isOpen) {
      resetAllFields();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Assessment Year change
  const handleAyChange = (ay: string) => {
    setAssessmentYear(ay);
    if (ay === '2026-27') setFinancialYear('2025-26');
    else if (ay === '2025-26') setFinancialYear('2024-25');
    else if (ay === '2024-25') setFinancialYear('2023-24');
  };

  // --- BANK ACCOUNT MANAGEMENT ---
  const handleAddBankAccount = () => {
    const newId = `bank_${Date.now()}`;
    const newAccount: ClientBankAccount = {
      id: newId,
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: placeOfFiling || '',
      accountType: 'Savings',
      isRefundNominated: bankAccounts.length === 0,
      validationStatus: bankAccounts.length === 0 ? 'VALIDATED & ELECTED' : 'VALIDATED',
    };
    setBankAccounts([...bankAccounts, newAccount]);
  };

  const handleRemoveBankAccount = (id: string) => {
    if (bankAccounts.length <= 1) {
      alert('ਘੱਟੋ-ਘੱਟ ਇੱਕ ਬੈਂਕ ਖਾਤਾ ਹੋਣਾ ਜ਼ਰੂਰੀ ਹੈ (At least 1 bank account required for refund).');
      return;
    }
    const remaining = bankAccounts.filter((b) => b.id !== id);
    // If we removed the refund nominated account, nominate the first remaining one
    const hasNominated = remaining.some((b) => b.isRefundNominated);
    if (!hasNominated && remaining.length > 0) {
      remaining[0].isRefundNominated = true;
      remaining[0].validationStatus = 'VALIDATED & ELECTED';
    }
    setBankAccounts(remaining);

    // Update interest entries that referenced the removed bank
    setInterestEntries(prev => prev.map(entry => {
      if (entry.bankAccountId === id) {
        return { ...entry, bankAccountId: remaining[0]?.id || 'other' };
      }
      return entry;
    }));
  };

  // --- PINCODE AUTO-LOOKUP HANDLER ---
  const handlePincodeChange = async (val: string) => {
    const cleanPin = val.replace(/[^0-9]/g, '').slice(0, 6);
    setPincode(cleanPin);

    if (cleanPin.length === 0) {
      setPincodeDetectedInfo('');
      return;
    }

    // 1. Instant Synchronous Offline Lookup (Instant as you type 3+ digits)
    if (cleanPin.length >= 3) {
      const offline = lookupPincodeOffline(cleanPin);
      if (offline) {
        if (offline.state) setState(offline.state);
        if (offline.district) setDistrict(offline.district);
        if (offline.tehsil) setTehsil(offline.tehsil);
        if (offline.placeOfFiling && (!placeOfFiling || placeOfFiling === 'LOHIAN KHAS' || placeOfFiling === '')) {
          setPlaceOfFiling(offline.placeOfFiling);
        }
        const text = `${offline.villageOrCity ? offline.villageOrCity + ', ' : ''}${offline.tehsil ? 'ਤਹਿਸੀਲ ' + offline.tehsil + ', ' : ''}${offline.district ? 'ਜ਼ਿਲ੍ਹਾ ' + offline.district + ', ' : ''}${offline.state}`;
        setPincodeDetectedInfo(text);
      }
    }

    // 2. Full 6-digit Async Postal API Enrichment
    if (cleanPin.length === 6) {
      setPincodeLoading(true);
      try {
        const result = await lookupPincodeAsync(cleanPin);
        if (result) {
          if (result.state) setState(result.state);
          if (result.district) setDistrict(result.district);
          if (result.tehsil) setTehsil(result.tehsil);
          if (result.placeOfFiling) setPlaceOfFiling(result.placeOfFiling);
          
          const text = `${result.villageOrCity ? result.villageOrCity + ', ' : ''}${result.tehsil ? 'ਤਹਿਸੀਲ ' + result.tehsil + ', ' : ''}${result.district ? 'ਜ਼ਿਲ੍ਹਾ ' + result.district + ', ' : ''}${result.state}`;
          setPincodeDetectedInfo(text);

          // If address is blank, auto-compose cleanly
          if (!address.trim()) {
            const v = result.villageOrCity ? `VPO ${result.villageOrCity}, ` : '';
            const t = result.tehsil ? `TEHSIL ${result.tehsil}, ` : '';
            const d = result.district ? `DISTT ${result.district}, ` : '';
            setAddress(`${v}${t}${d}${result.state} - ${cleanPin}`);
          }
        }
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleComposeAddress = () => {
    const v = placeOfFiling ? `VPO ${placeOfFiling}, ` : '';
    const t = tehsil ? `TEHSIL ${tehsil}, ` : '';
    const d = district ? `DISTT ${district}, ` : '';
    const st = state || 'PUNJAB';
    const pin = pincode ? ` - ${pincode}` : '';
    setAddress(`${v}${t}${d}${st}${pin}`);
  };

  const handleUpdateBankAccount = async (id: string, field: keyof ClientBankAccount, value: any) => {
    setBankAccounts(prev => prev.map(b => {
      if (b.id !== id) return b;
      
      const updated = { ...b, [field]: value };
      
      // Auto-detect bank and branch from IFSC Code instantly offline
      if (field === 'ifscCode') {
        const cleanIfsc = (value as string).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
        updated.ifscCode = cleanIfsc;

        if (cleanIfsc.length >= 4) {
          const detected = lookupIfscOffline(cleanIfsc);
          if (detected && detected.bankName) {
            updated.bankName = detected.bankName;
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

      // Auto-suggest IFSC prefix when bank name changes
      if (field === 'bankName') {
        const found = PUNJAB_BANKS.find(bank => bank.name === value);
        if (found && found.ifscPrefix) {
          if (!updated.ifscCode || updated.ifscCode === 'CLBL0000052' || updated.ifscCode.length < 5) {
            updated.ifscCode = found.ifscPrefix;
          }
        }
      }
      return updated;
    }));

    // If 11-digit IFSC, fetch live branch details
    if (field === 'ifscCode') {
      const cleanIfsc = (value as string).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
      if (cleanIfsc.length === 11) {
        const live = await lookupIfscAsync(cleanIfsc);
        if (live) {
          setBankAccounts(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
              ...b,
              bankName: live.bankName || b.bankName,
              branchName: live.branchName || b.branchName || placeOfFiling,
            };
          }));
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

  const handleSetPrimaryRefund = (id: string) => {
    setBankAccounts(prev => prev.map(b => ({
      ...b,
      isRefundNominated: b.id === id,
      validationStatus: b.id === id ? 'VALIDATED & ELECTED' : 'VALIDATED'
    })));
  };

  // --- BANK INTEREST MANAGEMENT ---
  const handleAddInterestEntry = (defaultType: 'Savings' | 'Fixed Deposit (FD)' | 'Recurring Deposit (RD)' = 'Savings') => {
    const newEntry: InterestEntryState = {
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      bankAccountId: bankAccounts[0]?.id || 'other',
      interestType: defaultType,
      amount: 0,
    };
    setInterestEntries([...interestEntries, newEntry]);
  };

  const handleRemoveInterestEntry = (id: string) => {
    setInterestEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateInterestEntry = (id: string, field: keyof InterestEntryState, value: any) => {
    setInterestEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      return { ...e, [field]: value };
    }));
  };

  // Aggregate totals from Interest Entries
  const interestTotals = useMemo(() => {
    let totalSavings = 0;
    let totalFd = 0;
    let totalRd = 0;
    let totalOther = 0;

    interestEntries.forEach(entry => {
      const amt = Math.max(0, Number(entry.amount) || 0);
      if (entry.interestType === 'Savings' || entry.interestType === 'Post Office') {
        totalSavings += amt;
      } else if (entry.interestType === 'Fixed Deposit (FD)') {
        totalFd += amt;
      } else if (entry.interestType === 'Recurring Deposit (RD)') {
        totalRd += amt;
      } else {
        totalOther += amt;
      }
    });

    return {
      savings: totalSavings,
      fd: totalFd,
      rd: totalRd,
      other: totalOther,
      grandTotal: totalSavings + totalFd + totalRd + totalOther,
    };
  }, [interestEntries]);

  // Filtered banks for selector
  const filteredBanks = useMemo(() => {
    return PUNJAB_BANKS.filter(b => {
      const matchesCat = bankCategoryFilter === 'All' || b.category === bankCategoryFilter;
      const matchesSearch = bankSearchQuery.trim() === '' || 
        b.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
        (b.punjabiName && b.punjabiName.toLowerCase().includes(bankSearchQuery.toLowerCase())) ||
        b.code.toLowerCase().includes(bankSearchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [bankCategoryFilter, bankSearchQuery]);

  // Preset Template loader
  const applyPreset = (type: 'trader' | 'farmer' | 'salaried') => {
    if (type === 'trader') {
      setName('JASWINDER SINGH');
      setTradeName('M/s Dashmesh Cloth House & Tailors');
      setPan('BGXPS7821K');
      setAadhaar('6521 8901 3412');
      setFatherName('GURDEV SINGH');
      setDob('12/08/1984');
      setGender('Male');
      setMobile('9876543210');
      setEmail('dashmeshcloth@gmail.com');
      setAddress('MAIN BAZAAR, NEAR GURDWARA SAHIB, LOHIAN KHAS, JALANDHAR');
      setPincode('144702');
      setState('PUNJAB');
      setPlaceOfFiling('LOHIAN KHAS');
      setItrForm('ITR-4 (Sugam)');
      setIncomeCategory('business');
      setBusinessName('M/s Dashmesh Cloth House');
      setBusinessNature('Retail Sale of Clothes and Readymade Garments');
      setBusinessCode('09028');
      setTurnoverDigital(450000);
      setProfitDigital(27000);
      setTurnoverCash(1150000);
      setProfitCash(92000);
      setGrossAgri(250000);
      setAgriExpenses(90000);
      setTdsOther(8500);
      
      const pnbBank: ClientBankAccount = {
        id: 'bank_pnb_1',
        bankName: 'Punjab National Bank (PNB)',
        accountNumber: '0842000100234589',
        ifscCode: 'PUNB0084200',
        branchName: 'LOHIAN KHAS',
        accountType: 'Current',
        isRefundNominated: true,
        validationStatus: 'VALIDATED & ELECTED',
      };
      const csfbBank: ClientBankAccount = {
        id: 'bank_csfb_2',
        bankName: 'Capital Small Finance Bank (Jalandhar / Punjab)',
        accountNumber: '052200004512',
        ifscCode: 'CLBL0000052',
        branchName: 'LOHIAN KHAS',
        accountType: 'Savings',
        isRefundNominated: false,
        validationStatus: 'VALIDATED',
      };
      setBankAccounts([pnbBank, csfbBank]);

      setInterestEntries([
        {
          id: 'int_trader_1',
          bankAccountId: 'bank_csfb_2',
          interestType: 'Savings',
          amount: 1450,
        },
        {
          id: 'int_trader_2',
          bankAccountId: 'bank_pnb_1',
          interestType: 'Fixed Deposit (FD)',
          amount: 12000,
        }
      ]);

    } else if (type === 'farmer') {
      setName('KULWINDER SINGH GILL');
      setTradeName('');
      setPan('CKLPS4512M');
      setAadhaar('4512 8923 1109');
      setFatherName('HARBANS SINGH');
      setDob('25/03/1976');
      setGender('Male');
      setMobile('9417234567');
      setEmail('kulwindergill@gmail.com');
      setAddress('VPO KANG KHURD, TEHSIL SHAHKOT, DISTT JALANDHAR');
      setPincode('144702');
      setState('PUNJAB');
      setPlaceOfFiling('SHAHKOT');
      setItrForm('ITR-1 (Sahaj)');
      setIncomeCategory('agriculture');
      setGrossSalary(0);
      setTurnoverDigital(0);
      setTurnoverCash(0);
      setGrossAgri(850000);
      setAgriExpenses(320000);
      setTdsOther(1500);

      const pgbBank: ClientBankAccount = {
        id: 'bank_pgb_1',
        bankName: 'Punjab Gramin Bank (PGB)',
        accountNumber: '84120100045612',
        ifscCode: 'PUNB0PGB001',
        branchName: 'SHAHKOT',
        accountType: 'Savings',
        isRefundNominated: true,
        validationStatus: 'VALIDATED & ELECTED',
      };
      const coopBank: ClientBankAccount = {
        id: 'bank_coop_2',
        bankName: 'The Punjab State Cooperative Bank (PSCB)',
        accountNumber: '102340098124',
        ifscCode: 'UTIB0PSCB01',
        branchName: 'SHAHKOT CCB',
        accountType: 'Savings',
        isRefundNominated: false,
        validationStatus: 'VALIDATED',
      };
      setBankAccounts([pgbBank, coopBank]);

      setInterestEntries([
        {
          id: 'int_farmer_1',
          bankAccountId: 'bank_pgb_1',
          interestType: 'Savings',
          amount: 2400,
        },
        {
          id: 'int_farmer_2',
          bankAccountId: 'bank_coop_2',
          interestType: 'Fixed Deposit (FD)',
          amount: 15000,
        }
      ]);

    } else if (type === 'salaried') {
      setName('HARPREET KAUR');
      setTradeName('');
      setPan('BRKPK6721L');
      setAadhaar('7812 3456 9012');
      setFatherName('SURJIT SINGH');
      setDob('14/11/1992');
      setGender('Female');
      setMobile('8146123456');
      setEmail('harpreetkaur.edu@gmail.com');
      setAddress('STREET NO 3, ADARSH NAGAR, NAKODAR, JALANDHAR');
      setPincode('144040');
      setState('PUNJAB');
      setPlaceOfFiling('NAKODAR');
      setItrForm('ITR-1 (Sahaj)');
      setIncomeCategory('salary');
      setGrossSalary(780000);
      setTdsSalary(42000);
      setTdsOther(2800);

      const sbiBank: ClientBankAccount = {
        id: 'bank_sbi_1',
        bankName: 'State Bank of India (SBI)',
        accountNumber: '30981245678',
        ifscCode: 'SBIN0000691',
        branchName: 'NAKODAR',
        accountType: 'Savings',
        isRefundNominated: true,
        validationStatus: 'VALIDATED & ELECTED',
      };
      const hdfcBank: ClientBankAccount = {
        id: 'bank_hdfc_2',
        bankName: 'HDFC Bank',
        accountNumber: '50100234512984',
        ifscCode: 'HDFC0000452',
        branchName: 'NAKODAR',
        accountType: 'Savings',
        isRefundNominated: false,
        validationStatus: 'VALIDATED',
      };
      setBankAccounts([sbiBank, hdfcBank]);

      setInterestEntries([
        {
          id: 'int_sal_1',
          bankAccountId: 'bank_sbi_1',
          interestType: 'Savings',
          amount: 3800,
        },
        {
          id: 'int_sal_2',
          bankAccountId: 'bank_hdfc_2',
          interestType: 'Fixed Deposit (FD)',
          amount: 28000,
        }
      ]);
    }
  };

  // Convert state into TaxComputation object
  const buildCandidateComputation = (): TaxComputation => {
    const netAgri = Math.max(0, grossAgri - agriExpenses);
    const cleanPan = pan.trim().toUpperCase() || 'ABCDE1234F';
    const cleanName = name.trim().toUpperCase() || 'NEW CLIENT';

    // Primary refund bank
    const primaryBank = bankAccounts.find(b => b.isRefundNominated) || bankAccounts[0] || {
      id: 'default_bank',
      bankName: 'Capital Small Finance Bank (Jalandhar / Punjab)',
      accountNumber: '052200002279',
      ifscCode: 'CLBL0000052',
      branchName: 'LOHIAN KHAS',
      accountType: 'Savings',
      isRefundNominated: true,
    };

    const baseBizProfit = (profitDigital || Math.round(turnoverDigital * 0.06)) + 
                          (profitCash || Math.round(turnoverCash * 0.08));

    // Convert interest entries into BankInterestItem array
    const compiledInterestItems: BankInterestItem[] = interestEntries.map(entry => {
      let bName = 'Other Bank';
      let aNo = '';
      if (entry.bankAccountId === 'other') {
        bName = entry.customBankName || 'Other Bank';
        aNo = entry.customAccountNo || '';
      } else {
        const found = bankAccounts.find(b => b.id === entry.bankAccountId);
        if (found) {
          bName = `${found.bankName}${found.accountNumber ? ` - A/c ${found.accountNumber}` : ''}`;
          aNo = found.accountNumber;
        }
      }

      return {
        id: entry.id,
        bankName: bName,
        accountNumber: aNo,
        interestType: entry.interestType,
        amount: Math.max(0, Number(entry.amount) || 0),
      };
    });

    const newComp: TaxComputation = {
      id: 'comp_' + (cleanPan.toLowerCase()) + '_' + Date.now().toString().slice(-4),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assessmentYear,
      financialYear,
      itrForm,
      filingSection,
      filingDate: filingDate || '31/07/2026',
      acknowledgementNumber: acknowledgementNumber || `${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
      regimeOpted,
      client: {
        pan: cleanPan,
        name: cleanName,
        tradeName: tradeName.trim() || undefined,
        fatherName: fatherName.trim().toUpperCase() || undefined,
        dob: dob || undefined,
        gender,
        status: 'Individual',
        residentialStatus: 'Resident',
        aadhaar: aadhaar.trim() || undefined,
        aadhaarNumber: aadhaar.trim() || undefined,
        mobile: mobile.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        state: state.trim() || 'PUNJAB',
        district: district.trim() || undefined,
        tehsil: tehsil.trim() || undefined,
        bankName: primaryBank.bankName,
        accountNumber: primaryBank.accountNumber,
        ifscCode: primaryBank.ifscCode,
        branchName: primaryBank.branchName,
        bankAccounts: bankAccounts, // Full multi bank accounts array
        validationStatus: primaryBank.validationStatus || 'VALIDATED & ELECTED',
        placeOfFiling: placeOfFiling.trim() || 'LOHIAN KHAS',
      },
      salary: {
        grossSalary: incomeCategory === 'salary' ? grossSalary : 0,
        allowancesExempt: 0,
        standardDeduction: incomeCategory === 'salary' ? (regimeOpted === 'new' ? 75000 : 50000) : 0,
        entertainmentAllowance: 0,
        professionalTax: 0,
        netSalary: 0,
        salaryList: incomeCategory === 'salary' && grossSalary > 0 ? [
          {
            id: 'sal_1',
            employerName: '',
            employerType: 'Private',
            grossSalary,
            salarySection17_1: grossSalary,
            allowancesExempt: 0,
            professionalTax: 0,
            tdsSalary: 0,
            taxableSalaryBeforeStdDed: grossSalary,
            isCollapsed: false,
          }
        ] : [],
      },
      houseProperty: {
        grossRentReceived: 0,
        municipalTaxes: 0,
        annualValue: 0,
        standardDeduction30: 0,
        homeLoanInterest24b: 0,
        netHousePropertyIncome: 0,
      },
      business: {
        businessName: businessName || tradeName || cleanName,
        tradeName: tradeName || businessName || undefined,
        natureOfBusiness: businessNature || 'Retail Trading / Business',
        businessCode: businessCode || '21008',
        businessDescription: businessNature || undefined,
        businessAddress: address || undefined,
        turnoverOrGrossReceipts: incomeCategory === 'business' ? (turnoverDigital + turnoverCash) : 0,
        presumptiveSection: '44AD (8%/6%/Other)',
        turnoverDigital6: incomeCategory === 'business' ? turnoverDigital : 0,
        profitDigital6: incomeCategory === 'business' ? profitDigital : 0,
        turnoverCash8: incomeCategory === 'business' ? turnoverCash : 0,
        profitCash8: incomeCategory === 'business' ? profitCash : 0,
        turnoverOtherMode: 0,
        profitOtherMode: 0,
        otherModePercent: 0,
        netProfit: incomeCategory === 'business' ? baseBizProfit : 0,
        businessList: incomeCategory === 'business' && (turnoverDigital + turnoverCash > 0) ? [
          {
            id: 'biz_1',
            businessName: businessName || tradeName || cleanName,
            tradeName: tradeName || businessName || undefined,
            natureOfBusiness: businessNature || 'Retail Trading / Business',
            businessCode: businessCode || '21008',
            businessDescription: businessNature || undefined,
            businessAddress: address || undefined,
            presumptiveSection: '44AD (8%/6%/Other)',
            turnoverDigital6: turnoverDigital,
            profitDigital6: profitDigital,
            turnoverCash8: turnoverCash,
            profitCash8: profitCash,
            turnoverOtherMode: 0,
            profitOtherMode: 0,
            otherModePercent: 0,
            otherModeDescription: '',
            totalTurnover: turnoverDigital + turnoverCash,
            netProfit: baseBizProfit,
          }
        ] : undefined,
      },
      capitalGains: {
        stcg15: 0,
        stcgNormal: 0,
        ltcg10: 0,
        ltcg20: 0,
        netCapitalGains: 0,
      },
      otherSources: {
        savingsInterest: interestTotals.savings,
        savingsBankName: primaryBank.bankName,
        fdInterest: interestTotals.fd,
        rdInterest: interestTotals.rd,
        bankInterestItems: compiledInterestItems, // Multi bank interest entries
        dividendIncome: 0,
        otherIncome: interestTotals.other,
        familyPension: 0,
        agriculturalIncome: netAgri,
        agriculturalDetails: netAgri > 0 ? {
          grossAgriculturalReceipts: grossAgri,
          agriculturalExpenses: agriExpenses,
          netAgriculturalIncome: netAgri,
        } : undefined,
        netOtherSources: 0,
      },
      agriculturalIncome: netAgri,
      agriculturalDetails: netAgri > 0 ? {
        grossAgriculturalReceipts: grossAgri,
        agriculturalExpenses: agriExpenses,
        netAgriculturalIncome: netAgri,
      } : undefined,
      grossTotalIncome: 0,
      deductions: {
        sec80C: 0,
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
      },
      totalTaxableIncome: 0,
      taxOnNormalIncome: 0,
      taxOnSpecialIncome: 0,
      totalTaxBeforeRebate: 0,
      rebate87A: 0,
      taxAfterRebate: 0,
      surcharge: 0,
      healthAndEducationCess: 0,
      grossTaxLiability: 0,
      interest234A: 0,
      interest234B: 0,
      interest234C: 0,
      fee234F: 0,
      totalTaxAndInterest: 0,
      taxesPaid: {
        tdsSalary: tdsSalary || 0,
        tdsOther: tdsOther || 0,
        tcs: 0,
        advanceTax: advanceTax || 0,
        selfAssessmentTax: 0,
        totalTaxesPaid: (tdsSalary || 0) + (tdsOther || 0) + (advanceTax || 0),
      },
      netTaxPayable: 0,
      refundDue: 0,
      relief89: 0,
      status: 'Draft',
      notes: `Manually created client on ${new Date().toLocaleDateString()}`,
    };

    return recalculateFullComputation(newComp);
  };

  const previewComp = buildCandidateComputation();

  // Save and submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('ਕਿਰਪਾ ਕਰਕੇ ਕਲਾਇੰਟ ਦਾ ਨਾਮ (Full Name) ਦਾਖਲ ਕਰੋ।');
      setActiveSection('profile');
      return;
    }

    if (!pan.trim()) {
      setErrorMessage('ਕਿਰਪਾ ਕਰਕੇ 10-ਅੱਖਰਾਂ ਦਾ PAN ਨੰਬਰ ਦਾਖਲ ਕਰੋ।');
      setActiveSection('profile');
      return;
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.trim().toUpperCase())) {
      setErrorMessage('ਗਲਤ PAN ਫਾਰਮੈਟ! ਕਿਰਪਾ ਕਰਕੇ ਸਹੀ 10-ਅੰਕਾਂ ਵਾਲਾ PAN ਨੰਬਰ (ਜਿਵੇਂ ਕਿ HSIPK5617N) ਦਾਖਲ ਕਰੋ।');
      setActiveSection('profile');
      return;
    }

    // Verify bank accounts
    if (bankAccounts.length === 0) {
      setErrorMessage('ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਬੈਂਕ ਖਾਤਾ ਸ਼ਾਮਲ ਕਰੋ।');
      setActiveSection('bank');
      return;
    }

    const finalComputation = buildCandidateComputation();
    onClientAdded(finalComputation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#10366b] via-[#1a4a8d] to-[#10366b] text-white px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <UserPlus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  ਨਵਾਂ ਕਲਾਇੰਟ ਸ਼ਾਮਲ ਕਰੋ (Add Manual Client)
                </h2>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-400/30 uppercase tracking-wider">
                  Direct Entry
                </span>
              </div>
              <p className="text-xs text-blue-100/90 font-medium">
                ਮੈਨੂਅਲ ਕਲਾਇੰਟ ਪ੍ਰੋਫਾਈਲ, ਮਲਟੀਪਲ ਬੈਂਕ ਖਾਤੇ, 44AD ਕਾਰੋਬਾਰ ਅਤੇ ਵਿਆਜ ਆਮਦਨ ਦਰਜ ਕਰੋ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="bg-slate-100/90 px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>ਤੁਰੰਤ ਸੈਂਪਲ ਟੈਂਪਲੇਟ (Quick 1-Click Templates):</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => applyPreset('trader')}
              className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 rounded-lg shadow-2xs transition"
            >
              🏪 ਦੁਕਾਨਦਾਰ / ਵਪਾਰੀ (44AD)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('farmer')}
              className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-300 rounded-lg shadow-2xs transition"
            >
              🌾 ਕਿਸਾਨ / ਖੇਤੀਬਾੜੀ (Agri J-Form)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('salaried')}
              className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 rounded-lg shadow-2xs transition"
            >
              💼 ਤਨਖਾਹਦਾਰ ਮੁਲਾਜ਼ਮ (Salaried)
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeSection === 'profile'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>1. ਕਲਾਇੰਟ ਜਾਣਕਾਰੀ (Profile)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('filing')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeSection === 'filing'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. ਰਿਟਰਨ ਵੇਰਵੇ (ITR & AY)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('bank')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeSection === 'bank'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>3. ਬੈਂਕ ਖਾਤੇ (Bank Accounts ({bankAccounts.length}))</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('income')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeSection === 'income'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>4. ਆਮਦਨ ਤੇ ਵਿਆਜ (Income & Bank Interest)</span>
          </button>
        </div>

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SECTION 1: Profile */}
          {activeSection === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                
                {/* Full Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800">
                    ਕਲਾਇੰਟ ਦਾ ਪੂਰਾ ਨਾਮ (Client / Assessee Full Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    placeholder="e.g. SARABJIT KAUR / GURPREET SINGH"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase"
                  />
                </div>

                {/* PAN Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    PAN ਨੰਬਰ (10-Digit PAN) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="HSIPK5617N"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-blue-700 focus:border-blue-500 outline-none uppercase tracking-wider"
                  />
                </div>

                {/* Trade Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800">
                    ਫਰਮ ਜਾਂ ਦੁਕਾਨ ਦਾ ਨਾਮ (Trade / Shop Name - Optional)
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="e.g. M/s Kaur Boutique & Tailoring"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Aadhaar Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਆਧਾਰ ਨੰਬਰ (12-Digit Aadhaar)
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    placeholder="7845 9012 3456"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Father's Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਪਿਤਾ ਦਾ ਨਾਮ (Father's Name)
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value.toUpperCase())}
                    placeholder="MUKHTIAR SINGH"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none uppercase"
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਜਨਮ ਮਿਤੀ (Date of Birth - DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    placeholder="15/04/1981"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਲਿੰਗ (Gender)
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium bg-white text-slate-900 focus:border-blue-500 outline-none"
                  >
                    <option value="Male">Male (ਪੁਰਸ਼)</option>
                    <option value="Female">Female (ਇਸਤਰੀ)</option>
                    <option value="Senior Citizen">Senior Citizen (60+ ਸਾਲ)</option>
                  </select>
                </div>

                {/* Mobile */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਮੋਬਾਈਲ ਨੰਬਰ (Mobile Number)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਈਮੇਲ (Email ID)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Pincode with Live Auto-Detection */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>ਪਿੰਨਕੋਡ (Pincode) *</span>
                    </label>
                    <span className="text-[10px] text-blue-600 font-semibold">ਆਟੋ ਸਟੇਟ / ਜ਼ਿਲ੍ਹਾ / ਤਹਿਸੀਲ</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      placeholder="144702"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-blue-300 font-mono font-bold text-blue-900 bg-blue-50/40 focus:border-blue-600 focus:bg-white outline-none tracking-widest text-sm"
                    />
                    {pincodeLoading && (
                      <span className="absolute right-3 top-2.5 text-[10px] text-blue-600 font-medium animate-pulse">
                        ਖੋਜ ਰਿਹਾ ਹੈ...
                      </span>
                    )}
                  </div>
                </div>

                {/* State (ਰਾਜ) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਰਾਜ / ਸੂਬਾ (State)
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="PUNJAB"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase bg-slate-50/50"
                  />
                </div>

                {/* District (ਜ਼ਿਲ੍ਹਾ) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਜ਼ਿਲ੍ਹਾ (District)
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value.toUpperCase())}
                    placeholder="JALANDHAR"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase bg-slate-50/50"
                  />
                </div>

                {/* Tehsil / Sub-Division (ਤਹਿਸੀਲ) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਤਹਿਸੀਲ / ਸਬ-ਡਵੀਜ਼ਨ (Tehsil)
                  </label>
                  <input
                    type="text"
                    value={tehsil}
                    onChange={(e) => setTehsil(e.target.value.toUpperCase())}
                    placeholder="SHAHKOT / NAKODAR"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase bg-slate-50/50"
                  />
                </div>

                {/* Place of Filing */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਸਾਈਨ ਕਰਨ ਦਾ ਸਥਾਨ (Place of Filing)
                  </label>
                  <input
                    type="text"
                    value={placeOfFiling}
                    onChange={(e) => setPlaceOfFiling(e.target.value.toUpperCase())}
                    placeholder="LOHIAN KHAS / JALANDHAR"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase"
                  />
                </div>

                {/* Live Pincode auto-detection info badge */}
                {pincodeDetectedInfo && (
                  <div className="sm:col-span-3 -mt-1 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2">
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

                {/* Residential Address */}
                <div className="space-y-1 sm:col-span-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      ਰਿਹਾਇਸ਼ੀ ਪਤਾ (Residential Address - House/Shop No., Street, Village/Town, Tehsil, Distt)
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
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VPO LOHIAN KHAS, WARD NO 4, TEHSIL SHAHKOT, DISTT JALANDHAR, PUNJAB - 144702"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none leading-relaxed uppercase"
                  />
                </div>

              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveSection('filing')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  ਅੱਗੇ: ਰਿਟਰਨ ਵੇਰਵੇ (Next: Filing Details) &rarr;
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: Filing Details */}
          {activeSection === 'filing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                
                {/* Assessment Year */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਅਸੈਸਮੈਂਟ ਸਾਲ (Assessment Year)
                  </label>
                  <select
                    value={assessmentYear}
                    onChange={(e) => handleAyChange(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold bg-white text-blue-700 focus:border-blue-500 outline-none"
                  >
                    <option value="2026-27">AY 2026-27 (FY 2025-26 - Newest)</option>
                    <option value="2025-26">AY 2025-26 (FY 2024-25)</option>
                    <option value="2024-25">AY 2024-25 (FY 2023-24)</option>
                  </select>
                </div>

                {/* ITR Form Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਆਈਟੀਆਰ ਫਾਰਮ (ITR Form Type)
                  </label>
                  <select
                    value={itrForm}
                    onChange={(e) => setItrForm(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-bold bg-white text-slate-900 focus:border-blue-500 outline-none"
                  >
                    <option value="ITR-4 (Sugam)">ITR-4 (Sugam - 44AD / Business / Agri)</option>
                    <option value="ITR-1 (Sahaj)">ITR-1 (Sahaj - Salary / Pension / Interest)</option>
                    <option value="ITR-2">ITR-2 (Capital Gains / Rental / Foreign)</option>
                    <option value="ITR-3">ITR-3 (Full Business Books / Audit)</option>
                  </select>
                </div>

                {/* Tax Regime */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਟੈਕਸ ਪ੍ਰਣਾਲੀ (Tax Regime)
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setRegimeOpted('new')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        regimeOpted === 'new'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ਨਵੀਂ (New 115BAC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegimeOpted('old')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        regimeOpted === 'old'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ਪੁਰਾਣੀ (Old Slabs)
                    </button>
                  </div>
                </div>

                {/* Filing Section */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800">
                    ਫਾਈਲਿੰਗ ਸੈਕਸ਼ਨ (Filing Section)
                  </label>
                  <select
                    value={filingSection}
                    onChange={(e) => setFilingSection(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium bg-white text-slate-900 focus:border-blue-500 outline-none"
                  >
                    <option value="139(1) - On or before due date">139(1) - On or before due date (ਸਮੇਂ ਸਿਰ ਫਾਈਲ ਕੀਤੀ)</option>
                    <option value="139(4) - Belated return">139(4) - Belated return (ਲੇਟ ਰਿਟਰਨ)</option>
                    <option value="139(5) - Revised return">139(5) - Revised return (ਸੋਧੀ ਹੋਈ ਰਿਟਰਨ)</option>
                    <option value="139(8A) - Updated return (ITR-U)">139(8A) - Updated return (ITR-U)</option>
                  </select>
                </div>

                {/* Filing Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    ਫਾਈਲ ਕਰਨ ਦੀ ਮਿਤੀ (Filing Date)
                  </label>
                  <input
                    type="text"
                    value={filingDate}
                    onChange={(e) => setFilingDate(e.target.value)}
                    placeholder="31/07/2026"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Ack Number */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800">
                    ਈ-ਫਾਈਲਿੰਗ ਰਸੀਦ / Ack ਨੰਬਰ (15-Digit Acknowledgement No - Optional)
                  </label>
                  <input
                    type="text"
                    value={acknowledgementNumber}
                    onChange={(e) => setAcknowledgementNumber(e.target.value)}
                    placeholder="e.g. 923925200310726"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-500 outline-none tracking-wider"
                  />
                </div>

              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setActiveSection('profile')}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  &larr; ਪਿੱਛੇ (Back)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('bank')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  ਅੱਗੇ: ਬੈਂਕ ਖਾਤੇ (Next: Bank Accounts) &rarr;
                </button>
              </div>
            </div>
          )}

          {/* SECTION 3: Multiple Bank Accounts & Bank Directory */}
          {activeSection === 'bank' && (
            <div className="space-y-5">
              
              {/* Top Bank Info Bar */}
              <div className="flex items-center justify-between bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-bold">
                  <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    ਕਲਾਇੰਟ ਦੇ ਸਾਰੇ ਬੈਂਕ ਖਾਤੇ ਦਰਜ ਕਰੋ (Add All Client Bank Accounts)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ ਹੋਰ ਬੈਂਕ ਖਾਤਾ ਜੋੜੋ (Add Account)</span>
                </button>
              </div>

              {/* Bank Accounts Cards */}
              <div className="space-y-4">
                {bankAccounts.map((account, index) => (
                  <div 
                    key={account.id} 
                    className={`p-4 rounded-2xl border-2 transition ${
                      account.isRefundNominated 
                        ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-100' 
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-extrabold text-xs text-slate-900">
                          {account.bankName || `Bank Account #${index + 1}`}
                        </span>
                        {account.isRefundNominated && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full flex items-center gap-1 border border-emerald-300">
                            <BadgeCheck className="w-3 h-3 text-emerald-600" />
                            <span>ਰਿਫੰਡ ਲਈ ਚੁਣਿਆ ਖਾਤਾ (Primary Refund Account)</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!account.isRefundNominated && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryRefund(account.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-300 rounded-lg transition"
                          >
                            ਇਸਨੂੰ ਰਿਫੰਡ ਖਾਤਾ ਬਣਾਓ (Make Refund Primary)
                          </button>
                        )}
                        {bankAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBankAccount(account.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition"
                            title="Remove this bank account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      
                      {/* Bank Selector */}
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>ਬੈਂਕ ਦਾ ਨਾਮ (Bank Name) *</span>
                          <span className="text-[10px] text-blue-600 font-semibold">ਸਾਰੇ ਪੰਜਾਬ ਤੇ ਇੰਡੀਅਨ ਬੈਂਕ</span>
                        </label>
                        <select
                          value={account.bankName}
                          onChange={(e) => handleUpdateBankAccount(account.id, 'bankName', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold bg-white text-slate-900 focus:border-blue-500 outline-none"
                        >
                          <optgroup label="🏦 ਪੰਜਾਬ ਗ੍ਰਾਮੀਣ ਤੇ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ (Punjab Cooperative & RRBs)">
                            {PUNJAB_BANKS.filter(b => b.category === 'Punjab Cooperative & RRB').map(b => (
                              <option key={b.code + b.name} value={b.name}>
                                {b.name} {b.punjabiName ? `• ${b.punjabiName}` : ''}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🏛️ ਸਰਕਾਰੀ ਬੈਂਕ (Public Sector Banks)">
                            {PUNJAB_BANKS.filter(b => b.category === 'Public Sector').map(b => (
                              <option key={b.code + b.name} value={b.name}>
                                {b.name} {b.punjabiName ? `• ${b.punjabiName}` : ''}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🏢 ਪ੍ਰਮੁੱਖ ਪ੍ਰਾਈਵੇਟ ਬੈਂਕ (Private Sector Banks)">
                            {PUNJAB_BANKS.filter(b => b.category === 'Private Sector').map(b => (
                              <option key={b.code + b.name} value={b.name}>
                                {b.name} {b.punjabiName ? `• ${b.punjabiName}` : ''}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="💳 ਸਮਾਲ ਫਾਇਨਾਂਸ ਤੇ ਡਾਕਖਾਨਾ ਬੈਂਕ (SFB & Post Office)">
                            {PUNJAB_BANKS.filter(b => b.category === 'Small Finance & Payments' || b.category === 'Post Office').map(b => (
                              <option key={b.code + b.name} value={b.name}>
                                {b.name} {b.punjabiName ? `• ${b.punjabiName}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Account Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          ਖਾਤਾ ਨੰਬਰ (Account Number) *
                        </label>
                        <input
                          type="text"
                          value={account.accountNumber}
                          onChange={(e) => handleUpdateBankAccount(account.id, 'accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 052200002279"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-blue-500 outline-none"
                        />
                      </div>

                      {/* Account Type */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          ਖਾਤੇ ਦੀ ਕਿਸਮ (Account Type)
                        </label>
                        <select
                          value={account.accountType || 'Savings'}
                          onChange={(e) => handleUpdateBankAccount(account.id, 'accountType', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium bg-white text-slate-900 focus:border-blue-500 outline-none"
                        >
                          <option value="Savings">Savings (ਬਚਤ ਖਾਤਾ)</option>
                          <option value="Current">Current (ਚਾਲੂ ਖਾਤਾ)</option>
                          <option value="Cash Credit / OD">Cash Credit / CC / OD</option>
                          <option value="NRE / NRO">NRE / NRO Account</option>
                          <option value="Post Office">Post Office Savings</option>
                        </select>
                      </div>

                      {/* IFSC Code with Live Auto-Detection */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">
                            IFSC ਕੋਡ (IFSC Code) *
                          </label>
                          <span className="text-[9px] text-blue-600 font-bold">ਆਟੋ ਬੈਂਕ ਡਿਟੈਕਸ਼ਨ</span>
                        </div>
                        <input
                          type="text"
                          maxLength={11}
                          value={account.ifscCode}
                          onChange={(e) => handleUpdateBankAccount(account.id, 'ifscCode', e.target.value.toUpperCase())}
                          placeholder="PUNB0084200"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-blue-300 bg-blue-50/30 font-mono font-black text-blue-900 focus:border-blue-600 focus:bg-white outline-none uppercase tracking-wider text-sm"
                        />
                      </div>

                      {/* Branch Name */}
                      <div className="space-y-1 sm:col-span-3">
                        <label className="text-[11px] font-bold text-slate-700">
                          ਬ੍ਰਾਂਚ ਦਾ ਨਾਮ (Branch Name)
                        </label>
                        <input
                          type="text"
                          value={account.branchName}
                          onChange={(e) => handleUpdateBankAccount(account.id, 'branchName', e.target.value.toUpperCase())}
                          placeholder="LOHIAN KHAS / MAIN BAZAAR"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-500 outline-none uppercase bg-slate-50/50"
                        />
                      </div>

                      {/* Live IFSC auto-detection badge */}
                      {ifscFeedbackMap[account.id] && (
                        <div className="sm:col-span-4 p-2 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-950 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong className="text-blue-900">⚡ ਆਟੋ-ਡਿਟੈਕਟ ਹੋਇਆ ਬੈਂਕ:</strong> {ifscFeedbackMap[account.id].text}
                          </span>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setActiveSection('filing')}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  &larr; ਪਿੱਛੇ (Back)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('income')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  ਅੱਗੇ: ਆਮਦਨ ਤੇ ਵਿਆਜ (Next: Income & Interest) &rarr;
                </button>
              </div>
            </div>
          )}

          {/* SECTION 4: Income & Dynamic Bank Interest */}
          {activeSection === 'income' && (
            <div className="space-y-5">
              
              {/* Category Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  ਮੁੱਖ ਆਮਦਨ ਕੈਟੇਗਰੀ (Primary Income Category)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setIncomeCategory('business')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      incomeCategory === 'business'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span className="text-xs">ਦੁਕਾਨ / ਵਪਾਰ (44AD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncomeCategory('agriculture')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      incomeCategory === 'agriculture'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Sprout className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs">ਖੇਤੀਬਾੜੀ / ਜੇ-ਫਾਰਮ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncomeCategory('salary')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      incomeCategory === 'salary'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs">ਤਨਖਾਹ (Salary)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncomeCategory('other')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                      incomeCategory === 'other'
                        ? 'border-amber-600 bg-amber-50/80 text-amber-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark className="w-4 h-4 text-amber-600" />
                    <span className="text-xs">ਵਿਆਜ / ਹੋਰ ਸਾਧਨ</span>
                  </button>
                </div>
              </div>

              {/* 44AD Business Fields */}
              {incomeCategory === 'business' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>ਕਾਰੋਬਾਰੀ ਵੇਰਵੇ u/s 44AD (Presumptive Business Details)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਕੰਮ ਦਾ ਵੇਰਵਾ (Nature of Business)</label>
                      <input
                        type="text"
                        value={businessNature}
                        onChange={(e) => setBusinessNature(e.target.value)}
                        placeholder="Retail cloth / grocery / trading"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਕਾਰੋਬਾਰ ਕੋਡ (Business Code)</label>
                      <input
                        type="text"
                        value={businessCode}
                        onChange={(e) => setBusinessCode(e.target.value)}
                        placeholder="21008"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਡਿਜੀਟਲ ਟਰਨਓਵਰ ₹ (Bank / UPI 6%)</label>
                      <input
                        type="number"
                        min={0}
                        value={turnoverDigital}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setTurnoverDigital(val);
                          setProfitDigital(Math.round(val * 0.06));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਡਿਜੀਟਲ ਮੁਨਾਫਾ ₹ (Min 6%)</label>
                      <input
                        type="number"
                        min={0}
                        value={profitDigital}
                        onChange={(e) => setProfitDigital(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-blue-700 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਕੈਸ਼ ਟਰਨਓਵਰ ₹ (Cash Sales 8%)</label>
                      <input
                        type="number"
                        min={0}
                        value={turnoverCash}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setTurnoverCash(val);
                          setProfitCash(Math.round(val * 0.08));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਕੈਸ਼ ਮੁਨਾਫਾ ₹ (Min 8%)</label>
                      <input
                        type="number"
                        min={0}
                        value={profitCash}
                        onChange={(e) => setProfitCash(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-blue-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Salary Fields */}
              {incomeCategory === 'salary' && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>ਤਨਖਾਹ ਆਮਦਨ ਵੇਰਵੇ (Salary Income Details)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਸਾਲਾਨਾ ਕੁੱਲ ਤਨਖਾਹ ₹ (Gross Salary u/s 17(1))</label>
                      <input
                        type="number"
                        min={0}
                        value={grossSalary}
                        onChange={(e) => setGrossSalary(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">ਸਟੈਂਡਰਡ ਡਿਡਕਸ਼ਨ u/s 16(ia)</label>
                      <div className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-300 rounded-lg">
                        ₹ {regimeOpted === 'new' ? '75,000 (New Regime)' : '50,000 (Old Regime)'} ਆਟੋ-ਲਾਗੂ
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Agriculture Fields */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sprout className="w-4 h-4 text-emerald-600" />
                    <span>ਖੇਤੀਬਾੜੀ / ਜੇ-ਫਾਰਮ ਆਮਦਨ u/s 10(1) (Exempt Agricultural Income)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700">ਮੁਆਫ਼ ਆਮਦਨ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">ਕੁੱਲ ਫਸਲ ਵਿਕਰੀ / ਜੇ-ਫਾਰਮ ₹</label>
                    <input
                      type="number"
                      min={0}
                      value={grossAgri}
                      onChange={(e) => setGrossAgri(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">ਖੇਤੀਬਾੜੀ ਖਰਚੇ (ਡੀਜ਼ਲ/ਖਾਦ/ਲੇਬਰ) ₹</label>
                    <input
                      type="number"
                      min={0}
                      value={agriExpenses}
                      onChange={(e) => setAgriExpenses(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-900 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">ਸ਼ੁੱਧ ਮੁਆਫ਼ ਆਮਦਨ (Net Agri)</label>
                    <div className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-lg">
                      {formatINR(Math.max(0, grossAgri - agriExpenses))}
                    </div>
                  </div>
                </div>
              </div>

              {/* DYNAMIC BANK INTEREST LINKED TO ADDED BANK ACCOUNTS */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-amber-600" />
                    <span>ਬੈਂਕ ਖਾਤਿਆਂ ਦਾ ਵਿਆਜ (Bank Interest - Savings, FD, RD)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddInterestEntry('Savings')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition"
                    >
                      + ਬਚਤ ਵਿਆਜ (Savings)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddInterestEntry('Fixed Deposit (FD)')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition"
                    >
                      + FD ਵਿਆਜ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddInterestEntry('Recurring Deposit (RD)')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition"
                    >
                      + RD ਵਿਆਜ
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-amber-800">
                  ਪਿਛਲੇ ਸਟੈੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਕੀਤੇ ਬੈਂਕ ਖਾਤੇ ਚੁਣ ਕੇ ਸੇਵਿੰਗ, ਐਫ.ਡੀ. ਜਾਂ ਆਰ.ਡੀ. ਵਿਆਜ ਦਰਜ ਕਰੋ:
                </p>

                {/* Interest Entries List */}
                <div className="space-y-2.5">
                  {interestEntries.map((entry, idx) => (
                    <div 
                      key={entry.id}
                      className="p-3 bg-white border border-amber-200/80 rounded-xl shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                    >
                      {/* Bank Account Selector (From Added Accounts) */}
                      <div className="sm:col-span-5 space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-600">
                          ਚੁਣੋ ਬੈਂਕ ਖਾਤਾ (Select Account)
                        </label>
                        <select
                          value={entry.bankAccountId}
                          onChange={(e) => handleUpdateInterestEntry(entry.id, 'bankAccountId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                        >
                          {bankAccounts.map((acc, aIdx) => (
                            <option key={acc.id} value={acc.id}>
                              #{aIdx + 1}: {acc.bankName} {acc.accountNumber ? `(${acc.accountNumber})` : ''} {acc.isRefundNominated ? '★' : ''}
                            </option>
                          ))}
                          <option value="other">+ ਕੋਈ ਹੋਰ ਬੈਂਕ / Post Office (Other Bank)</option>
                        </select>
                      </div>

                      {/* Custom Bank Name if "Other" is chosen */}
                      {entry.bankAccountId === 'other' && (
                        <div className="sm:col-span-3 space-y-0.5">
                          <label className="text-[10px] font-bold text-slate-600">ਬੈਂਕ ਦਾ ਨਾਮ (Bank Name)</label>
                          <input
                            type="text"
                            value={entry.customBankName || ''}
                            onChange={(e) => handleUpdateInterestEntry(entry.id, 'customBankName', e.target.value)}
                            placeholder="e.g. Post Office / Bank"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white outline-none"
                          />
                        </div>
                      )}

                      {/* Interest Type */}
                      <div className={`${entry.bankAccountId === 'other' ? 'sm:col-span-2' : 'sm:col-span-3'} space-y-0.5`}>
                        <label className="text-[10px] font-bold text-slate-600">ਵਿਆਜ ਦੀ ਕਿਸਮ (Type)</label>
                        <select
                          value={entry.interestType}
                          onChange={(e) => handleUpdateInterestEntry(entry.id, 'interestType', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 outline-none"
                        >
                          <option value="Savings">Savings (ਬਚਤ ਵਿਆਜ)</option>
                          <option value="Fixed Deposit (FD)">Fixed Deposit (FD)</option>
                          <option value="Recurring Deposit (RD)">Recurring Deposit (RD)</option>
                          <option value="Post Office">Post Office Savings</option>
                          <option value="Other Interest">Other Interest</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div className={`${entry.bankAccountId === 'other' ? 'sm:col-span-2' : 'sm:col-span-3'} space-y-0.5`}>
                        <label className="text-[10px] font-bold text-slate-600">ਰਕਮ ₹ (Amount)</label>
                        <input
                          type="number"
                          min={0}
                          value={entry.amount}
                          onChange={(e) => handleUpdateInterestEntry(entry.id, 'amount', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none"
                        />
                      </div>

                      {/* Delete */}
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveInterestEntry(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove interest item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interest Summary Pills */}
                <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <div className="flex items-center gap-3 text-amber-900">
                    <span>ਬਚਤ ਵਿਆਜ (Savings): <strong>{formatINR(interestTotals.savings)}</strong></span>
                    <span>•</span>
                    <span>FD ਵਿਆਜ: <strong>{formatINR(interestTotals.fd)}</strong></span>
                    <span>•</span>
                    <span>RD ਵਿਆਜ: <strong>{formatINR(interestTotals.rd)}</strong></span>
                  </div>
                  <div className="text-amber-950 bg-amber-200/70 px-2.5 py-1 rounded-lg">
                    ਕੁੱਲ ਵਿਆਜ: <strong>{formatINR(interestTotals.grandTotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Taxes Paid (TDS / Advance Tax) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  ਕੱਟਿਆ ਟੈਕਸ / TDS Paid (Taxes Paid Details)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">TDS ਤਨਖਾਹ u/s 192 ₹</label>
                    <input
                      type="number"
                      min={0}
                      value={tdsSalary}
                      onChange={(e) => setTdsSalary(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">TDS 194A (Interest) / 194C ₹</label>
                    <input
                      type="number"
                      min={0}
                      value={tdsOther}
                      onChange={(e) => setTdsOther(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Advance Tax / 140A ₹</label>
                    <input
                      type="number"
                      min={0}
                      value={advanceTax}
                      onChange={(e) => setAdvanceTax(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* LIVE COMPUTATION PREVIEW BOX */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 text-blue-300">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    ਲਾਈਵ ਟੈਕਸ ਕੰਪਿਊਟੇਸ਼ਨ ਨਤੀਜਾ (Live Tax Preview)
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {pan || 'PAN REQUIRED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">ਕੁੱਲ ਕੁੱਲ ਆਮਦਨ (GTI)</span>
                    <span className="text-sm font-bold text-slate-100">{formatINR(previewComp.grossTotalIncome)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ਟੈਕਸਯੋਗ ਆਮਦਨ (Taxable)</span>
                    <span className="text-sm font-bold text-slate-100">{formatINR(previewComp.totalTaxableIncome)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ਕੁੱਲ ਟੈਕਸ (Tax Liability)</span>
                    <span className="text-sm font-bold text-slate-100">{formatINR(previewComp.grossTaxLiability)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ਨਤੀਜਾ (Final Result)</span>
                    {previewComp.refundDue > 0 ? (
                      <span className="text-sm font-black text-emerald-400">
                        ਰਿਫੰਡ {formatINR(previewComp.refundDue)}
                      </span>
                    ) : previewComp.netTaxPayable > 0 ? (
                      <span className="text-sm font-black text-red-400">
                        ਦੇਣਦਾਰੀ {formatINR(previewComp.netTaxPayable)}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-300">
                        ਜ਼ੀਰੋ ਟੈਕਸ (NIL)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('bank')}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  &larr; ਪਿੱਛੇ (Back)
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ਕਲਾਇੰਟ ਸ਼ਾਮਲ ਕਰੋ ਅਤੇ ਸ਼ੀਟ ਖੋਲ੍ਹੋ (Save & Open Sheet)</span>
                </button>
              </div>

            </div>
          )}

        </form>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium hidden sm:block">
            * ਤੁਸੀਂ ਕੰਪਿਊਟੇਸ਼ਨ ਸ਼ੀਟ ਖੋਲ੍ਹ ਕੇ ਕਿਸੇ ਵੀ ਸਮੇਂ ਸਾਰੇ ਬੈਂਕ ਖਾਤੇ ਅਤੇ ਵਿਆਜ ਮੁੜ ਸੋਧ ਸਕਦੇ ਹੋ।
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
            >
              ਰੱਦ ਕਰੋ (Cancel)
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ਕਲਾਇੰਟ ਸੇਵ ਕਰੋ (Save Client)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
