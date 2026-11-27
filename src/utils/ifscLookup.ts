// IFSC Code Lookup Utility - Instant Offline Bank Detection + Live Razorpay IFSC API
import { PUNJAB_BANKS, BankInfo } from './punjabBanks';

export interface IfscLookupResult {
  ifsc: string;
  bankName: string;
  branchName: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  bankCode?: string;
  isExact: boolean;
}

// Prefix to standard Bank Name mapping for instant offline auto-fill
const IFSC_PREFIX_MAP: Record<string, { bankName: string; code: string }> = {
  'CLBL': { bankName: 'Capital Small Finance Bank Limited', code: 'CSFB' },
  'PUNB0PGB': { bankName: 'Punjab Gramin Bank (PGB)', code: 'PGB' },
  'UTIB0PSCB': { bankName: 'The Punjab State Cooperative Bank (PSCB)', code: 'PSCB' },
  'PUNB': { bankName: 'Punjab National Bank (PNB)', code: 'PNB' },
  'SBIN': { bankName: 'State Bank of India (SBI)', code: 'SBI' },
  'PSIB': { bankName: 'Punjab & Sind Bank (PSB)', code: 'PSB' },
  'HDFC': { bankName: 'HDFC Bank', code: 'HDFC' },
  'ICIC': { bankName: 'ICICI Bank', code: 'ICICI' },
  'UTIB': { bankName: 'Axis Bank', code: 'UTIB' },
  'BARB': { bankName: 'Bank of Baroda (BOB)', code: 'BOB' },
  'CNRB': { bankName: 'Canara Bank', code: 'CNRB' },
  'UBIN': { bankName: 'Union Bank of India (UBI)', code: 'UBI' },
  'CBIN': { bankName: 'Central Bank of India (CBI)', code: 'CBI' },
  'IDIB': { bankName: 'Indian Bank', code: 'IDIB' },
  'BKID': { bankName: 'Bank of India (BOI)', code: 'BOI' },
  'UCBA': { bankName: 'UCO Bank', code: 'UCBA' },
  'IOBA': { bankName: 'Indian Overseas Bank (IOB)', code: 'IOB' },
  'MAHB': { bankName: 'Bank of Maharashtra', code: 'MAHB' },
  'KKBK': { bankName: 'Kotak Mahindra Bank', code: 'KKBK' },
  'INDB': { bankName: 'IndusInd Bank', code: 'INDB' },
  'FDRL': { bankName: 'Federal Bank', code: 'FDRL' },
  'IBKL': { bankName: 'IDBI Bank', code: 'IBKL' },
  'YESB': { bankName: 'YES Bank', code: 'YESB' },
  'IDFB': { bankName: 'IDFC FIRST Bank', code: 'IDFB' },
  'BDBL': { bankName: 'Bandhan Bank', code: 'BDBL' },
  'JAKA': { bankName: 'Jammu & Kashmir Bank (J&K Bank)', code: 'JAKA' },
  'SIBL': { bankName: 'South Indian Bank', code: 'SIBL' },
  'RATN': { bankName: 'RBL Bank', code: 'RATN' },
  'CIUB': { bankName: 'City Union Bank', code: 'CIUB' },
  'KVBL': { bankName: 'Karur Vysya Bank', code: 'KVBL' },
  'DCBL': { bankName: 'DCB Bank', code: 'DCBL' },
  'AUBL': { bankName: 'AU Small Finance Bank', code: 'AUBL' },
  'ESFB': { bankName: 'Equitas Small Finance Bank', code: 'ESFB' },
  'UJVN': { bankName: 'Ujjivan Small Finance Bank', code: 'UJVN' },
  'UTKS': { bankName: 'Utkarsh Small Finance Bank', code: 'UTKS' },
  'JSFB': { bankName: 'Jana Small Finance Bank', code: 'JSFB' },
  'SURY': { bankName: 'Suryoday Small Finance Bank', code: 'SURY' },
  'ESMF': { bankName: 'ESAF Small Finance Bank', code: 'ESAF' },
  'FNCB': { bankName: 'Fincare Small Finance Bank', code: 'FNCB' },
  'UNIB': { bankName: 'Unity Small Finance Bank', code: 'UNTY' },
  'SMCB': { bankName: 'Shivalik Small Finance Bank', code: 'SMCB' },
  'IPOS': { bankName: 'India Post Payments Bank (IPPB)', code: 'IPPB' },
  'AIRP': { bankName: 'Airtel Payments Bank', code: 'AIRP' },
  'PYTM': { bankName: 'Paytm Payments Bank', code: 'PYTM' },
  'FINO': { bankName: 'Fino Payments Bank', code: 'FINO' },
};

// In-memory cache for live Razorpay IFSC lookups
const ifscApiCache = new Map<string, IfscLookupResult>();

/**
 * Instant Synchronous Offline IFSC Detection (works as the user types even 4 letters!)
 */
export function lookupIfscOffline(ifsc: string): IfscLookupResult | null {
  const cleanIfsc = ifsc.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanIfsc || cleanIfsc.length < 4) return null;

  // Check cache first
  if (ifscApiCache.has(cleanIfsc)) {
    return ifscApiCache.get(cleanIfsc)!;
  }

  // Check custom specific prefixes first (e.g. UTIB0PSCB, PUNB0PGB)
  for (const [prefix, data] of Object.entries(IFSC_PREFIX_MAP)) {
    if (cleanIfsc.startsWith(prefix)) {
      return {
        ifsc: cleanIfsc,
        bankName: data.bankName,
        branchName: '',
        bankCode: data.code,
        isExact: cleanIfsc.length === 11,
      };
    }
  }

  // 4-letter prefix check
  const code4 = cleanIfsc.substring(0, 4);
  if (IFSC_PREFIX_MAP[code4]) {
    const data = IFSC_PREFIX_MAP[code4];
    return {
      ifsc: cleanIfsc,
      bankName: data.bankName,
      branchName: '',
      bankCode: data.code,
      isExact: cleanIfsc.length === 11,
    };
  }

  // Check in PUNJAB_BANKS array
  const punjabMatch = PUNJAB_BANKS.find(b => b.ifscPrefix && cleanIfsc.startsWith(b.ifscPrefix));
  if (punjabMatch) {
    return {
      ifsc: cleanIfsc,
      bankName: punjabMatch.name,
      branchName: '',
      bankCode: punjabMatch.code,
      isExact: cleanIfsc.length === 11,
    };
  }

  return null;
}

/**
 * Async IFSC Lookup with Live Razorpay API (Returns Exact Branch, City, District & Bank Name)
 */
export async function lookupIfscAsync(ifsc: string): Promise<IfscLookupResult | null> {
  const cleanIfsc = ifsc.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanIfsc.length !== 11) {
    return lookupIfscOffline(cleanIfsc);
  }

  // Check cache
  if (ifscApiCache.has(cleanIfsc)) {
    return ifscApiCache.get(cleanIfsc)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max

    const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.BANK) {
        // Match or map bank name nicely
        let matchedName = data.BANK;
        
        // Find best match in our Punjabi banks catalog
        const foundPunjab = PUNJAB_BANKS.find(b => 
          b.name.toLowerCase().includes(data.BANK.toLowerCase()) || 
          data.BANK.toLowerCase().includes(b.code.toLowerCase())
        );
        if (foundPunjab) {
          matchedName = foundPunjab.name;
        }

        const result: IfscLookupResult = {
          ifsc: cleanIfsc,
          bankName: matchedName,
          branchName: (data.BRANCH || '').toUpperCase(),
          address: data.ADDRESS,
          city: (data.CITY || '').toUpperCase(),
          district: (data.DISTRICT || '').toUpperCase(),
          state: (data.STATE || '').toUpperCase(),
          bankCode: data.BANKCODE,
          isExact: true,
        };

        ifscApiCache.set(cleanIfsc, result);
        return result;
      }
    }
  } catch {
    // API failed or offline - fall back to offline match
  }

  return lookupIfscOffline(cleanIfsc);
}
