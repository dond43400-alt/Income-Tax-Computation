export interface BankInfo {
  name: string;
  code: string;
  category: 'Punjab Cooperative & RRB' | 'Public Sector' | 'Private Sector' | 'Small Finance & Payments' | 'Post Office';
  punjabiName?: string;
  ifscPrefix?: string;
}

export const PUNJAB_BANKS: BankInfo[] = [
  // 1. Punjab Regional Rural, State & District Cooperative Banks
  { name: 'Punjab Gramin Bank (PGB)', code: 'PGB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਪੰਜਾਬ ਗ੍ਰਾਮੀਣ ਬੈਂਕ', ifscPrefix: 'PUNB0PGB' },
  { name: 'The Punjab State Cooperative Bank (PSCB)', code: 'PSCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਦ ਪੰਜਾਬ ਸਟੇਟ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'UTIB0PSCB' },
  { name: 'Capital Small Finance Bank (Jalandhar / Punjab)', code: 'CSFB', category: 'Small Finance & Payments', punjabiName: 'ਕੈਪੀਟਲ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'CLBL0000' },
  { name: 'Central Cooperative Bank Jalandhar', code: 'JCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਜਲੰਧਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Ludhiana', code: 'LCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਲੁਧਿਆਣਾ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Amritsar', code: 'ACCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਅੰਮ੍ਰਿਤਸਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Hoshiarpur', code: 'HCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਹੁਸ਼ਿਆਰਪੁਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Patiala', code: 'PCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਪਟਿਆਲਾ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Bathinda', code: 'BCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਬਠਿੰਡਾ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Kapurthala', code: 'KCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਕਪੂਰਥਲਾ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Ferozepur', code: 'FCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਫਿਰੋਜ਼ਪੁਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Sangrur', code: 'SCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਸੰਗਰੂਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Gurdaspur', code: 'GCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਗੁਰਦਾਸਪੁਰ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Faridkot / Moga', code: 'MCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਮੋਗਾ/ਫਰੀਦਕੋਟ ਸੈਂਟਰਲ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Nawanshahr / SBS Nagar', code: 'NCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਨਵਾਂਸ਼ਹਿਰ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Central Cooperative Bank Ropar / SAS Nagar', code: 'RCCB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਰੋਪੜ/ਮੋਹਾਲੀ ਕੋਆਪਰੇਟਿਵ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'Punjab State Agricultural Development Bank (PADB)', code: 'PADB', category: 'Punjab Cooperative & RRB', punjabiName: 'ਪੰਜਾਬ ਖੇਤੀਬਾੜੀ ਵਿਕਾਸ ਬੈਂਕ', ifscPrefix: 'PUNB0' },

  // 2. All Public Sector Banks
  { name: 'Punjab National Bank (PNB)', code: 'PNB', category: 'Public Sector', punjabiName: 'ਪੰਜਾਬ ਨੈਸ਼ਨਲ ਬੈਂਕ', ifscPrefix: 'PUNB0' },
  { name: 'State Bank of India (SBI)', code: 'SBI', category: 'Public Sector', punjabiName: 'ਸਟੇਟ ਬੈਂਕ ਆਫ਼ ਇੰਡੀਆ', ifscPrefix: 'SBIN00' },
  { name: 'Punjab & Sind Bank (PSB)', code: 'PSB', category: 'Public Sector', punjabiName: 'ਪੰਜਾਬ ਐਂਡ ਸਿੰਧ ਬੈਂਕ', ifscPrefix: 'PSIB000' },
  { name: 'Bank of Baroda (BOB)', code: 'BOB', category: 'Public Sector', punjabiName: 'ਬੈਂਕ ਆਫ਼ ਬੜੌਦਾ', ifscPrefix: 'BARB0' },
  { name: 'Canara Bank', code: 'CNRB', category: 'Public Sector', punjabiName: 'ਕੈਨਰਾ ਬੈਂਕ', ifscPrefix: 'CNRB000' },
  { name: 'Union Bank of India (UBI)', code: 'UBI', category: 'Public Sector', punjabiName: 'ਯੂਨੀਅਨ ਬੈਂਕ ਆਫ਼ ਇੰਡੀਆ', ifscPrefix: 'UBIN05' },
  { name: 'Central Bank of India (CBI)', code: 'CBI', category: 'Public Sector', punjabiName: 'ਸੈਂਟਰਲ ਬੈਂਕ ਆਫ਼ ਇੰਡੀਆ', ifscPrefix: 'CBIN028' },
  { name: 'Indian Bank', code: 'IDIB', category: 'Public Sector', punjabiName: 'ਇੰਡੀਅਨ ਬੈਂਕ', ifscPrefix: 'IDIB000' },
  { name: 'Bank of India (BOI)', code: 'BOI', category: 'Public Sector', punjabiName: 'ਬੈਂਕ ਆਫ਼ ਇੰਡੀਆ', ifscPrefix: 'BKID000' },
  { name: 'UCO Bank', code: 'UCBA', category: 'Public Sector', punjabiName: 'ਯੂਕੋ ਬੈਂਕ', ifscPrefix: 'UCBA000' },
  { name: 'Indian Overseas Bank (IOB)', code: 'IOB', category: 'Public Sector', punjabiName: 'ਇੰਡੀਅਨ ਓਵਰਸੀਜ਼ ਬੈਂਕ', ifscPrefix: 'IOBA000' },
  { name: 'Bank of Maharashtra', code: 'MAHB', category: 'Public Sector', punjabiName: 'ਬੈਂਕ ਆਫ਼ ਮਹਾਰਾਸ਼ਟਰ', ifscPrefix: 'MAHB000' },

  // 3. All Leading Private Sector Banks
  { name: 'HDFC Bank', code: 'HDFC', category: 'Private Sector', punjabiName: 'ਐਚ ਡੀ ਐਫ ਸੀ ਬੈਂਕ', ifscPrefix: 'HDFC000' },
  { name: 'ICICI Bank', code: 'ICICI', category: 'Private Sector', punjabiName: 'ਆਈ ਸੀ ਆਈ ਸੀ ਆਈ ਬੈਂਕ', ifscPrefix: 'ICIC000' },
  { name: 'Axis Bank', code: 'UTIB', category: 'Private Sector', punjabiName: 'ਐਕਸਿਸ ਬੈਂਕ', ifscPrefix: 'UTIB000' },
  { name: 'Kotak Mahindra Bank', code: 'KKBK', category: 'Private Sector', punjabiName: 'ਕੋਟਕ ਮਹਿੰਦਰਾ ਬੈਂਕ', ifscPrefix: 'KKBK000' },
  { name: 'IndusInd Bank', code: 'INDB', category: 'Private Sector', punjabiName: 'ਇੰਡਸਇੰਡ ਬੈਂਕ', ifscPrefix: 'INDB000' },
  { name: 'Federal Bank', code: 'FDRL', category: 'Private Sector', punjabiName: 'ਫੈਡਰਲ ਬੈਂਕ', ifscPrefix: 'FDRL000' },
  { name: 'IDBI Bank', code: 'IBKL', category: 'Private Sector', punjabiName: 'ਆਈ ਡੀ ਬੀ ਆਈ ਬੈਂਕ', ifscPrefix: 'IBKL000' },
  { name: 'YES Bank', code: 'YESB', category: 'Private Sector', punjabiName: 'ਯੈੱਸ ਬੈਂਕ', ifscPrefix: 'YESB000' },
  { name: 'IDFC FIRST Bank', code: 'IDFB', category: 'Private Sector', punjabiName: 'ਆਈ ਡੀ ਐਫ ਸੀ ਫਸਟ ਬੈਂਕ', ifscPrefix: 'IDFB00' },
  { name: 'Bandhan Bank', code: 'BDBL', category: 'Private Sector', punjabiName: 'ਬੰਧਨ ਬੈਂਕ', ifscPrefix: 'BDBL000' },
  { name: 'Jammu & Kashmir Bank (J&K Bank)', code: 'JAKA', category: 'Private Sector', punjabiName: 'ਜੰਮੂ ਐਂਡ ਕਸ਼ਮੀਰ ਬੈਂਕ', ifscPrefix: 'JAKA0' },
  { name: 'South Indian Bank', code: 'SIBL', category: 'Private Sector', punjabiName: 'ਸਾਊਥ ਇੰਡੀਅਨ ਬੈਂਕ', ifscPrefix: 'SIBL000' },
  { name: 'RBL Bank', code: 'RATN', category: 'Private Sector', punjabiName: 'ਆਰ ਬੀ ਐਲ ਬੈਂਕ', ifscPrefix: 'RATN000' },
  { name: 'City Union Bank', code: 'CIUB', category: 'Private Sector', punjabiName: 'ਸਿਟੀ ਯੂਨੀਅਨ ਬੈਂਕ', ifscPrefix: 'CIUB000' },
  { name: 'Karur Vysya Bank', code: 'KVBL', category: 'Private Sector', punjabiName: 'ਕਰੂਰ ਵੈਸ਼ਿਆ ਬੈਂਕ', ifscPrefix: 'KVBL000' },
  { name: 'DCB Bank', code: 'DCBL', category: 'Private Sector', punjabiName: 'ਡੀ ਸੀ ਬੀ ਬੈਂਕ', ifscPrefix: 'DCBL000' },

  // 4. Small Finance Banks & Payment Banks
  { name: 'AU Small Finance Bank', code: 'AUBL', category: 'Small Finance & Payments', punjabiName: 'ਏ ਯੂ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'AUBL000' },
  { name: 'Equitas Small Finance Bank', code: 'ESFB', category: 'Small Finance & Payments', punjabiName: 'ਇਕਵਿਟਾਸ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'ESFB000' },
  { name: 'Ujjivan Small Finance Bank', code: 'UJVN', category: 'Small Finance & Payments', punjabiName: 'ਉੱਜੀਵਨ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'UJVN000' },
  { name: 'Utkarsh Small Finance Bank', code: 'UTKS', category: 'Small Finance & Payments', punjabiName: 'ਉਤਕਰਸ਼ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'UTKS000' },
  { name: 'Jana Small Finance Bank', code: 'JSFB', category: 'Small Finance & Payments', punjabiName: 'ਜਨਾ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'JSFB000' },
  { name: 'Suryoday Small Finance Bank', code: 'SURY', category: 'Small Finance & Payments', punjabiName: 'ਸੂਰਯੋਦਯ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'SURY000' },
  { name: 'ESAF Small Finance Bank', code: 'ESAF', category: 'Small Finance & Payments', punjabiName: 'ਈ ਐਸ ਏ ਐਫ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'ESMF000' },
  { name: 'Fincare Small Finance Bank', code: 'FNCB', category: 'Small Finance & Payments', punjabiName: 'ਫਿਨਕੇਅਰ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'FNCB000' },
  { name: 'Unity Small Finance Bank', code: 'UNTY', category: 'Small Finance & Payments', punjabiName: 'ਯੂਨਿਟੀ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'UNIB000' },
  { name: 'Shivalik Small Finance Bank', code: 'SMCB', category: 'Small Finance & Payments', punjabiName: 'ਸ਼ਿਵਾਲਿਕ ਸਮਾਲ ਫਾਇਨਾਂਸ ਬੈਂਕ', ifscPrefix: 'SMCB000' },
  { name: 'India Post Payments Bank (IPPB)', code: 'IPPB', category: 'Post Office', punjabiName: 'ਇੰਡੀਆ ਪੋਸਟ ਪੇਮੈਂਟਸ ਬੈਂਕ', ifscPrefix: 'IPOS000' },
  { name: 'Airtel Payments Bank', code: 'AIRP', category: 'Small Finance & Payments', punjabiName: 'ਏਅਰਟੈਲ ਪੇਮੈਂਟਸ ਬੈਂਕ', ifscPrefix: 'AIRP000' },
  { name: 'Paytm Payments Bank', code: 'PYTM', category: 'Small Finance & Payments', punjabiName: 'ਪੇਟੀਐਮ ਪੇਮੈਂਟਸ ਬੈਂਕ', ifscPrefix: 'PYTM012' },
  { name: 'Fino Payments Bank', code: 'FINO', category: 'Small Finance & Payments', punjabiName: 'ਫੀਨੋ ਪੇਮੈਂਟਸ ਬੈਂਕ', ifscPrefix: 'FINO000' },

  // 5. Post Office Savings Bank
  { name: 'Post Office Savings Bank (POSB)', code: 'POSB', category: 'Post Office', punjabiName: 'ਡਾਕਖਾਨਾ ਬਚਤ ਖਾਤਾ (Post Office)', ifscPrefix: 'IPOS0000DOP' },
];

export const POPULAR_PUNJAB_BANK_NAMES = PUNJAB_BANKS.map((b) => b.name);

