// Pincode Lookup Utility - Offline Database for Punjab & All India + Online Postal API
export interface PincodeInfo {
  pincode: string;
  state: string;
  district: string;
  tehsil: string;
  villageOrCity?: string;
  placeOfFiling?: string;
}

// Comprehensive Offline Punjab & Regional Pincode Database
const PUNJAB_PINCODE_MAP: Record<string, PincodeInfo> = {
  // Jalandhar District & Tehsils
  '144702': { pincode: '144702', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'SHAHKOT', villageOrCity: 'LOHIAN KHAS', placeOfFiling: 'LOHIAN KHAS' },
  '144701': { pincode: '144701', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'SHAHKOT', villageOrCity: 'SHAHKOT', placeOfFiling: 'SHAHKOT' },
  '144629': { pincode: '144629', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'SHAHKOT', villageOrCity: 'MEHATPUR', placeOfFiling: 'SHAHKOT' },
  '144040': { pincode: '144040', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'NAKODAR', villageOrCity: 'NAKODAR', placeOfFiling: 'NAKODAR' },
  '144044': { pincode: '144044', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'NAKODAR', villageOrCity: 'NURMAHAL', placeOfFiling: 'NAKODAR' },
  '144033': { pincode: '144033', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'NAKODAR', villageOrCity: 'BILLGA', placeOfFiling: 'NAKODAR' },
  '144410': { pincode: '144410', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'PHILLAUR', villageOrCity: 'PHILLAUR', placeOfFiling: 'PHILLAUR' },
  '144418': { pincode: '144418', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'PHILLAUR', villageOrCity: 'GORAYA', placeOfFiling: 'PHILLAUR' },
  '144415': { pincode: '144415', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'PHILLAUR', villageOrCity: 'APRA', placeOfFiling: 'PHILLAUR' },
  '144101': { pincode: '144101', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'ADAMPUR', villageOrCity: 'ADAMPUR DOABA', placeOfFiling: 'ADAMPUR' },
  '144102': { pincode: '144102', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'ADAMPUR', villageOrCity: 'ALAWALPUR', placeOfFiling: 'ADAMPUR' },
  '144104': { pincode: '144104', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'BHOGPUR', villageOrCity: 'BHOGPUR', placeOfFiling: 'BHOGPUR' },
  '144201': { pincode: '144201', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'BHOGPUR', villageOrCity: 'TANDA URMAR / BHOGPUR', placeOfFiling: 'BHOGPUR' },
  '144001': { pincode: '144001', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-I', villageOrCity: 'JALANDHAR CITY', placeOfFiling: 'JALANDHAR' },
  '144002': { pincode: '144002', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-I', villageOrCity: 'BASTI GUZAN / JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144003': { pincode: '144003', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-II', villageOrCity: 'INDUSTRIAL AREA JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144004': { pincode: '144004', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-I', villageOrCity: 'MODEL TOWN JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144005': { pincode: '144005', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-II', villageOrCity: 'JALANDHAR CANTT', placeOfFiling: 'JALANDHAR' },
  '144006': { pincode: '144006', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-I', villageOrCity: 'BASTI NAU JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144008': { pincode: '144008', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-I', villageOrCity: 'RAMA MANDI JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144011': { pincode: '144011', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-II', villageOrCity: 'NIT JALANDHAR', placeOfFiling: 'JALANDHAR' },
  '144022': { pincode: '144022', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-II', villageOrCity: 'SURANUSSI', placeOfFiling: 'JALANDHAR' },
  '144026': { pincode: '144026', state: 'PUNJAB', district: 'JALANDHAR', tehsil: 'JALANDHAR-II', villageOrCity: 'KARTARPUR', placeOfFiling: 'KARTARPUR' },

  // Kapurthala District & Tehsils
  '144601': { pincode: '144601', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'KAPURTHALA', villageOrCity: 'KAPURTHALA CITY', placeOfFiling: 'KAPURTHALA' },
  '144602': { pincode: '144602', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'KAPURTHALA', villageOrCity: 'RAIL COACH FACTORY (RCF)', placeOfFiling: 'KAPURTHALA' },
  '144626': { pincode: '144626', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'SULTANPUR LODHI', villageOrCity: 'SULTANPUR LODHI', placeOfFiling: 'SULTANPUR LODHI' },
  '144622': { pincode: '144622', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'BHOLATH', villageOrCity: 'BHOLATH', placeOfFiling: 'BHOLATH' },
  '144620': { pincode: '144620', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'BHOLATH', villageOrCity: 'BEGOWAL', placeOfFiling: 'BHOLATH' },
  '144628': { pincode: '144628', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'BHOLATH', villageOrCity: 'NADALA', placeOfFiling: 'BHOLATH' },
  '144630': { pincode: '144630', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'BHOLATH', villageOrCity: 'DHILWAN', placeOfFiling: 'BHOLATH' },
  '144401': { pincode: '144401', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'PHAGWARA', villageOrCity: 'PHAGWARA', placeOfFiling: 'PHAGWARA' },
  '144402': { pincode: '144402', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'PHAGWARA', villageOrCity: 'SATNAMPURA PHAGWARA', placeOfFiling: 'PHAGWARA' },
  '144403': { pincode: '144403', state: 'PUNJAB', district: 'KAPURTHALA', tehsil: 'PHAGWARA', villageOrCity: 'HADIABAD PHAGWARA', placeOfFiling: 'PHAGWARA' },

  // Ludhiana District & Tehsils
  '141001': { pincode: '141001', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA EAST', villageOrCity: 'LUDHIANA GPO', placeOfFiling: 'LUDHIANA' },
  '141002': { pincode: '141002', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA WEST', villageOrCity: 'MILLER GANJ LUDHIANA', placeOfFiling: 'LUDHIANA' },
  '141003': { pincode: '141003', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA EAST', villageOrCity: 'INDUSTRIAL AREA-A LUDHIANA', placeOfFiling: 'LUDHIANA' },
  '141004': { pincode: '141004', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA WEST', villageOrCity: 'PAU LUDHIANA', placeOfFiling: 'LUDHIANA' },
  '141008': { pincode: '141008', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA EAST', villageOrCity: 'CIVIL LINES LUDHIANA', placeOfFiling: 'LUDHIANA' },
  '141109': { pincode: '141109', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'JAGRAON', villageOrCity: 'JAGRAON', placeOfFiling: 'JAGRAON' },
  '141401': { pincode: '141401', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'KHANNA', villageOrCity: 'KHANNA', placeOfFiling: 'KHANNA' },
  '141114': { pincode: '141114', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'SAMRALA', villageOrCity: 'SAMRALA', placeOfFiling: 'SAMRALA' },
  '141120': { pincode: '141120', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'PAYAL', villageOrCity: 'DORAHA', placeOfFiling: 'PAYAL' },
  '141416': { pincode: '141416', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'PAYAL', villageOrCity: 'PAYAL', placeOfFiling: 'PAYAL' },
  '141115': { pincode: '141115', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'RAIKOT', villageOrCity: 'RAIKOT', placeOfFiling: 'RAIKOT' },
  '141106': { pincode: '141106', state: 'PUNJAB', district: 'LUDHIANA', tehsil: 'LUDHIANA WEST', villageOrCity: 'MULLANPUR DAKHA', placeOfFiling: 'LUDHIANA' },

  // Amritsar & Tarn Taran
  '143001': { pincode: '143001', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'AMRITSAR-I', villageOrCity: 'AMRITSAR GPO', placeOfFiling: 'AMRITSAR' },
  '143002': { pincode: '143002', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'AMRITSAR-II', villageOrCity: 'GOLDEN TEMPLE / AMRITSAR CITY', placeOfFiling: 'AMRITSAR' },
  '143006': { pincode: '143006', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'AMRITSAR-I', villageOrCity: 'CHHEHARTA AMRITSAR', placeOfFiling: 'AMRITSAR' },
  '143102': { pincode: '143102', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'AJNALA', villageOrCity: 'AJNALA', placeOfFiling: 'AJNALA' },
  '143115': { pincode: '143115', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'BABA BAKALA', villageOrCity: 'BABA BAKALA', placeOfFiling: 'BABA BAKALA' },
  '143201': { pincode: '143201', state: 'PUNJAB', district: 'AMRITSAR', tehsil: 'BABA BAKALA', villageOrCity: 'RAYYA', placeOfFiling: 'BABA BAKALA' },
  '143401': { pincode: '143401', state: 'PUNJAB', district: 'TARN TARAN', tehsil: 'TARN TARAN', villageOrCity: 'TARN TARAN SAHIB', placeOfFiling: 'TARN TARAN' },
  '143416': { pincode: '143416', state: 'PUNJAB', district: 'TARN TARAN', tehsil: 'PATTI', villageOrCity: 'PATTI', placeOfFiling: 'PATTI' },
  '143412': { pincode: '143412', state: 'PUNJAB', district: 'TARN TARAN', tehsil: 'KHADUR SAHIB', villageOrCity: 'KHADUR SAHIB', placeOfFiling: 'KHADUR SAHIB' },
  '143419': { pincode: '143419', state: 'PUNJAB', district: 'TARN TARAN', tehsil: 'BHIKHIWIND', villageOrCity: 'BHIKHIWIND', placeOfFiling: 'BHIKHIWIND' },

  // Hoshiarpur District
  '146001': { pincode: '146001', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'HOSHIARPUR', villageOrCity: 'HOSHIARPUR CITY', placeOfFiling: 'HOSHIARPUR' },
  '144205': { pincode: '144205', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'DASUYA', villageOrCity: 'DASUYA', placeOfFiling: 'DASUYA' },
  '144211': { pincode: '144211', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'MUKERIAN', villageOrCity: 'MUKERIAN', placeOfFiling: 'MUKERIAN' },
  '144527': { pincode: '144527', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'GARHSHANKAR', villageOrCity: 'GARHSHANKAR', placeOfFiling: 'GARHSHANKAR' },
  '144204': { pincode: '144204', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'DASUYA', villageOrCity: 'TANDA / URMAR TANDA', placeOfFiling: 'DASUYA' },
  '144214': { pincode: '144214', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'MUKERIAN', villageOrCity: 'HAJIPUR', placeOfFiling: 'MUKERIAN' },
  '144222': { pincode: '144222', state: 'PUNJAB', district: 'HOSHIARPUR', tehsil: 'MUKERIAN', villageOrCity: 'TALWARA TOWNSHIP', placeOfFiling: 'MUKERIAN' },

  // Gurdaspur & Pathankot
  '143521': { pincode: '143521', state: 'PUNJAB', district: 'GURDASPUR', tehsil: 'GURDASPUR', villageOrCity: 'GURDASPUR CITY', placeOfFiling: 'GURDASPUR' },
  '143505': { pincode: '143505', state: 'PUNJAB', district: 'GURDASPUR', tehsil: 'BATALA', villageOrCity: 'BATALA', placeOfFiling: 'BATALA' },
  '143514': { pincode: '143514', state: 'PUNJAB', district: 'GURDASPUR', tehsil: 'DERA BABA NANAK', villageOrCity: 'DERA BABA NANAK', placeOfFiling: 'DERA BABA NANAK' },
  '143517': { pincode: '143517', state: 'PUNJAB', district: 'GURDASPUR', tehsil: 'DINANAGAR', villageOrCity: 'DINANAGAR', placeOfFiling: 'DINANAGAR' },
  '143518': { pincode: '143518', state: 'PUNJAB', district: 'GURDASPUR', tehsil: 'FATTEHGARH CHURIAN', villageOrCity: 'FATEHGARH CHURIAN', placeOfFiling: 'BATALA' },
  '145001': { pincode: '145001', state: 'PUNJAB', district: 'PATHANKOT', tehsil: 'PATHANKOT', villageOrCity: 'PATHANKOT CITY', placeOfFiling: 'PATHANKOT' },
  '145023': { pincode: '145023', state: 'PUNJAB', district: 'PATHANKOT', tehsil: 'PATHANKOT', villageOrCity: 'SUJANPUR', placeOfFiling: 'PATHANKOT' },
  '145025': { pincode: '145025', state: 'PUNJAB', district: 'PATHANKOT', tehsil: 'DHAR KALAN', villageOrCity: 'DHAR KALAN', placeOfFiling: 'PATHANKOT' },

  // Patiala & Fatehgarh Sahib
  '147001': { pincode: '147001', state: 'PUNJAB', district: 'PATIALA', tehsil: 'PATIALA', villageOrCity: 'PATIALA GPO', placeOfFiling: 'PATIALA' },
  '147004': { pincode: '147004', state: 'PUNJAB', district: 'PATIALA', tehsil: 'PATIALA', villageOrCity: 'PUNJABI UNIVERSITY PATIALA', placeOfFiling: 'PATIALA' },
  '147201': { pincode: '147201', state: 'PUNJAB', district: 'PATIALA', tehsil: 'NABHA', villageOrCity: 'NABHA', placeOfFiling: 'NABHA' },
  '147101': { pincode: '147101', state: 'PUNJAB', district: 'PATIALA', tehsil: 'SAMANA', villageOrCity: 'SAMANA', placeOfFiling: 'SAMANA' },
  '140401': { pincode: '140401', state: 'PUNJAB', district: 'PATIALA', tehsil: 'RAJPURA', villageOrCity: 'RAJPURA', placeOfFiling: 'RAJPURA' },
  '147105': { pincode: '147105', state: 'PUNJAB', district: 'PATIALA', tehsil: 'PATRAN', villageOrCity: 'PATRAN', placeOfFiling: 'PATRAN' },
  '140406': { pincode: '140406', state: 'PUNJAB', district: 'FATEHGARH SAHIB', tehsil: 'FATEHGARH SAHIB', villageOrCity: 'SIRHIND / FATEHGARH SAHIB', placeOfFiling: 'FATEHGARH SAHIB' },
  '140412': { pincode: '140412', state: 'PUNJAB', district: 'FATEHGARH SAHIB', tehsil: 'AMLOH', villageOrCity: 'MANDI GOBINDGARH', placeOfFiling: 'MANDI GOBINDGARH' },
  '147301': { pincode: '147301', state: 'PUNJAB', district: 'FATEHGARH SAHIB', tehsil: 'AMLOH', villageOrCity: 'AMLOH', placeOfFiling: 'AMLOH' },
  '140407': { pincode: '140407', state: 'PUNJAB', district: 'FATEHGARH SAHIB', tehsil: 'KHAMANON', villageOrCity: 'KHAMANON', placeOfFiling: 'KHAMANON' },
  '147202': { pincode: '147202', state: 'PUNJAB', district: 'FATEHGARH SAHIB', tehsil: 'BASSI PATHANA', villageOrCity: 'BASSI PATHANA', placeOfFiling: 'BASSI PATHANA' },

  // Bathinda & Mansa
  '151001': { pincode: '151001', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'BATHINDA', villageOrCity: 'BATHINDA CITY', placeOfFiling: 'BATHINDA' },
  '151101': { pincode: '151101', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'TALWANDI SABO', villageOrCity: 'RAMAN MANDI', placeOfFiling: 'TALWANDI SABO' },
  '151302': { pincode: '151302', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'TALWANDI SABO', villageOrCity: 'TALWANDI SABO', placeOfFiling: 'TALWANDI SABO' },
  '151103': { pincode: '151103', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'RAMPURA PHUL', villageOrCity: 'RAMPURA PHUL', placeOfFiling: 'RAMPURA PHUL' },
  '151201': { pincode: '151201', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'GONIANA', villageOrCity: 'GONIANA MANDI', placeOfFiling: 'BATHINDA' },
  '151401': { pincode: '151401', state: 'PUNJAB', district: 'BATHINDA', tehsil: 'MAUR', villageOrCity: 'MAUR MANDI', placeOfFiling: 'MAUR' },
  '151505': { pincode: '151505', state: 'PUNJAB', district: 'MANSA', tehsil: 'MANSA', villageOrCity: 'MANSA CITY', placeOfFiling: 'MANSA' },
  '151503': { pincode: '151503', state: 'PUNJAB', district: 'MANSA', tehsil: 'BUDHLADA', villageOrCity: 'BUDHLADA', placeOfFiling: 'BUDHLADA' },
  '151504': { pincode: '151504', state: 'PUNJAB', district: 'MANSA', tehsil: 'BHIKHI', villageOrCity: 'BHIKHI', placeOfFiling: 'BHIKHI' },
  '151507': { pincode: '151507', state: 'PUNJAB', district: 'MANSA', tehsil: 'SARDULGARH', villageOrCity: 'SARDULGARH', placeOfFiling: 'SARDULGARH' },

  // Sangrur, Barnala & Malerkotla
  '148001': { pincode: '148001', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'SANGRUR', villageOrCity: 'SANGRUR CITY', placeOfFiling: 'SANGRUR' },
  '148024': { pincode: '148024', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'SUNAM', villageOrCity: 'SUNAM', placeOfFiling: 'SUNAM' },
  '148025': { pincode: '148025', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'LEHRAGAGA', villageOrCity: 'LEHRAGAGA', placeOfFiling: 'LEHRAGAGA' },
  '148033': { pincode: '148033', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'MOONAK', villageOrCity: 'MOONAK', placeOfFiling: 'MOONAK' },
  '148026': { pincode: '148026', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'DIRBA', villageOrCity: 'DIRBA', placeOfFiling: 'DIRBA' },
  '148020': { pincode: '148020', state: 'PUNJAB', district: 'SANGRUR', tehsil: 'BHAWANIGARH', villageOrCity: 'BHAWANIGARH', placeOfFiling: 'BHAWANIGARH' },
  '148101': { pincode: '148101', state: 'PUNJAB', district: 'BARNALA', tehsil: 'BARNALA', villageOrCity: 'BARNALA CITY', placeOfFiling: 'BARNALA' },
  '148106': { pincode: '148106', state: 'PUNJAB', district: 'BARNALA', tehsil: 'TAPA', villageOrCity: 'TAPA MANDI', placeOfFiling: 'TAPA' },
  '148104': { pincode: '148104', state: 'PUNJAB', district: 'BARNALA', tehsil: 'MEHAL KALAN', villageOrCity: 'MEHAL KALAN', placeOfFiling: 'BARNALA' },
  '148023': { pincode: '148023', state: 'PUNJAB', district: 'MALERKOTLA', tehsil: 'MALERKOTLA', villageOrCity: 'MALERKOTLA CITY', placeOfFiling: 'MALERKOTLA' },
  '148021': { pincode: '148021', state: 'PUNJAB', district: 'MALERKOTLA', tehsil: 'AHMEDGARH', villageOrCity: 'AHMEDGARH', placeOfFiling: 'AHMEDGARH' },
  '148022': { pincode: '148022', state: 'PUNJAB', district: 'MALERKOTLA', tehsil: 'AMARGARH', villageOrCity: 'AMARGARH', placeOfFiling: 'MALERKOTLA' },

  // Ferozepur & Fazilka
  '152001': { pincode: '152001', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'FEROZEPUR', villageOrCity: 'FEROZEPUR CANTT', placeOfFiling: 'FEROZEPUR' },
  '152002': { pincode: '152002', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'FEROZEPUR', villageOrCity: 'FEROZEPUR CITY', placeOfFiling: 'FEROZEPUR' },
  '152004': { pincode: '152004', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'FEROZEPUR', villageOrCity: 'FEROZEPUR GPO', placeOfFiling: 'FEROZEPUR' },
  '152023': { pincode: '152023', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'GURUHARSAHAI', villageOrCity: 'GURU HAR SAHAI', placeOfFiling: 'GURU HAR SAHAI' },
  '142044': { pincode: '142044', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'ZIRA', villageOrCity: 'ZIRA', placeOfFiling: 'ZIRA' },
  '142052': { pincode: '142052', state: 'PUNJAB', district: 'FEROZEPUR', tehsil: 'MAKHU', villageOrCity: 'MAKHU', placeOfFiling: 'MAKHU' },
  '152123': { pincode: '152123', state: 'PUNJAB', district: 'FAZILKA', tehsil: 'FAZILKA', villageOrCity: 'FAZILKA CITY', placeOfFiling: 'FAZILKA' },
  '152024': { pincode: '152024', state: 'PUNJAB', district: 'FAZILKA', tehsil: 'ABOHAR', villageOrCity: 'ABOHAR', placeOfFiling: 'ABOHAR' },
  '152116': { pincode: '152116', state: 'PUNJAB', district: 'FAZILKA', tehsil: 'JALALABAD', villageOrCity: 'JALALABAD WEST', placeOfFiling: 'JALALABAD' },

  // Moga, Faridkot & Sri Muktsar Sahib
  '142001': { pincode: '142001', state: 'PUNJAB', district: 'MOGA', tehsil: 'MOGA', villageOrCity: 'MOGA CITY', placeOfFiling: 'MOGA' },
  '142011': { pincode: '142011', state: 'PUNJAB', district: 'MOGA', tehsil: 'BAGHA PURANA', villageOrCity: 'BAGHA PURANA', placeOfFiling: 'BAGHA PURANA' },
  '142038': { pincode: '142038', state: 'PUNJAB', district: 'MOGA', tehsil: 'NIHAL SINGH WALA', villageOrCity: 'NIHAL SINGH WALA', placeOfFiling: 'NIHAL SINGH WALA' },
  '142042': { pincode: '142042', state: 'PUNJAB', district: 'MOGA', tehsil: 'DHARAMKOT', villageOrCity: 'DHARAMKOT', placeOfFiling: 'DHARAMKOT' },
  '151203': { pincode: '151203', state: 'PUNJAB', district: 'FARIDKOT', tehsil: 'FARIDKOT', villageOrCity: 'FARIDKOT CITY', placeOfFiling: 'FARIDKOT' },
  '151204': { pincode: '151204', state: 'PUNJAB', district: 'FARIDKOT', tehsil: 'KOTKAPURA', villageOrCity: 'KOTKAPURA', placeOfFiling: 'KOTKAPURA' },
  '151207': { pincode: '151207', state: 'PUNJAB', district: 'FARIDKOT', tehsil: 'JAITU', villageOrCity: 'JAITU', placeOfFiling: 'JAITU' },
  '152026': { pincode: '152026', state: 'PUNJAB', district: 'SRI MUKTSAR SAHIB', tehsil: 'MUKTSAR', villageOrCity: 'SRI MUKTSAR SAHIB', placeOfFiling: 'SRI MUKTSAR SAHIB' },
  '152107': { pincode: '152107', state: 'PUNJAB', district: 'SRI MUKTSAR SAHIB', tehsil: 'MALOUT', villageOrCity: 'MALOUT', placeOfFiling: 'MALOUT' },
  '152031': { pincode: '152031', state: 'PUNJAB', district: 'SRI MUKTSAR SAHIB', tehsil: 'GIDDERBAHA', villageOrCity: 'GIDDERBAHA', placeOfFiling: 'GIDDERBAHA' },

  // SAS Nagar (Mohali) & Rupnagar (Ropar)
  '160055': { pincode: '160055', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'MOHALI', villageOrCity: 'PHASE 1-7 MOHALI', placeOfFiling: 'SAS NAGAR (MOHALI)' },
  '160059': { pincode: '160059', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'MOHALI', villageOrCity: 'PHASE 3B2 MOHALI', placeOfFiling: 'SAS NAGAR (MOHALI)' },
  '160062': { pincode: '160062', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'MOHALI', villageOrCity: 'PHASE 7-8 MOHALI', placeOfFiling: 'SAS NAGAR (MOHALI)' },
  '160071': { pincode: '160071', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'MOHALI', villageOrCity: 'SECTOR 70-71 MOHALI', placeOfFiling: 'SAS NAGAR (MOHALI)' },
  '140507': { pincode: '140507', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'KHARAR', villageOrCity: 'KHARAR', placeOfFiling: 'KHARAR' },
  '140603': { pincode: '140603', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'DERA BASSI', villageOrCity: 'ZIRAKPUR', placeOfFiling: 'ZIRAKPUR' },
  '140501': { pincode: '140501', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'DERA BASSI', villageOrCity: 'DERA BASSI', placeOfFiling: 'DERA BASSI' },
  '140604': { pincode: '140604', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'DERA BASSI', villageOrCity: 'LALRU', placeOfFiling: 'DERA BASSI' },
  '140301': { pincode: '140301', state: 'PUNJAB', district: 'SAS NAGAR (MOHALI)', tehsil: 'KHARAR', villageOrCity: 'KURALI', placeOfFiling: 'KURALI' },
  '140001': { pincode: '140001', state: 'PUNJAB', district: 'RUPNAGAR', tehsil: 'RUPNAGAR', villageOrCity: 'RUPNAGAR (ROPAR)', placeOfFiling: 'RUPNAGAR' },
  '140103': { pincode: '140103', state: 'PUNJAB', district: 'RUPNAGAR', tehsil: 'ANANDPUR SAHIB', villageOrCity: 'SRI ANANDPUR SAHIB', placeOfFiling: 'ANANDPUR SAHIB' },
  '140115': { pincode: '140115', state: 'PUNJAB', district: 'RUPNAGAR', tehsil: 'CHAMKAUR SAHIB', villageOrCity: 'SRI CHAMKAUR SAHIB', placeOfFiling: 'CHAMKAUR SAHIB' },
  '140111': { pincode: '140111', state: 'PUNJAB', district: 'RUPNAGAR', tehsil: 'NANGAL', villageOrCity: 'NANGAL TOWNSHIP', placeOfFiling: 'NANGAL' },
  '140119': { pincode: '140119', state: 'PUNJAB', district: 'RUPNAGAR', tehsil: 'MORINDA', villageOrCity: 'MORINDA', placeOfFiling: 'MORINDA' },

  // SBS Nagar (Nawanshahr)
  '144514': { pincode: '144514', state: 'PUNJAB', district: 'SBS NAGAR (NAWANSHAHR)', tehsil: 'NAWANSHAHR', villageOrCity: 'NAWANSHAHR', placeOfFiling: 'NAWANSHAHR' },
  '144505': { pincode: '144505', state: 'PUNJAB', district: 'SBS NAGAR (NAWANSHAHR)', tehsil: 'BANGA', villageOrCity: 'BANGA', placeOfFiling: 'BANGA' },
  '144517': { pincode: '144517', state: 'PUNJAB', district: 'SBS NAGAR (NAWANSHAHR)', tehsil: 'BALACHAUR', villageOrCity: 'BALACHAUR', placeOfFiling: 'BALACHAUR' },
  '144522': { pincode: '144522', state: 'PUNJAB', district: 'SBS NAGAR (NAWANSHAHR)', tehsil: 'NAWANSHAHR', villageOrCity: 'RAHON', placeOfFiling: 'NAWANSHAHR' },

  // Chandigarh (U.T.)
  '160001': { pincode: '160001', state: 'CHANDIGARH', district: 'CHANDIGARH', tehsil: 'CHANDIGARH', villageOrCity: 'SECTOR 1-10 CHANDIGARH', placeOfFiling: 'CHANDIGARH' },
  '160017': { pincode: '160017', state: 'CHANDIGARH', district: 'CHANDIGARH', tehsil: 'CHANDIGARH', villageOrCity: 'SECTOR 17 CHANDIGARH', placeOfFiling: 'CHANDIGARH' },
  '160022': { pincode: '160022', state: 'CHANDIGARH', district: 'CHANDIGARH', tehsil: 'CHANDIGARH', villageOrCity: 'SECTOR 22 CHANDIGARH', placeOfFiling: 'CHANDIGARH' },
  '160036': { pincode: '160036', state: 'CHANDIGARH', district: 'CHANDIGARH', tehsil: 'CHANDIGARH', villageOrCity: 'SECTOR 36 CHANDIGARH', placeOfFiling: 'CHANDIGARH' },
  '160047': { pincode: '160047', state: 'CHANDIGARH', district: 'CHANDIGARH', tehsil: 'CHANDIGARH', villageOrCity: 'SECTOR 47 CHANDIGARH', placeOfFiling: 'CHANDIGARH' },
};

// General heuristics for other Indian states based on first 2 digits of PIN code
const STATE_PIN_PREFIX_MAP: Record<string, string> = {
  '11': 'DELHI',
  '12': 'HARYANA',
  '13': 'HARYANA',
  '14': 'PUNJAB',
  '15': 'PUNJAB',
  '16': 'CHANDIGARH',
  '17': 'HIMACHAL PRADESH',
  '18': 'JAMMU & KASHMIR',
  '19': 'JAMMU & KASHMIR',
  '20': 'UTTAR PRADESH',
  '21': 'UTTAR PRADESH',
  '22': 'UTTAR PRADESH',
  '23': 'UTTAR PRADESH',
  '24': 'UTTAR PRADESH',
  '25': 'UTTAR PRADESH',
  '26': 'UTTAR PRADESH',
  '27': 'UTTAR PRADESH',
  '28': 'UTTAR PRADESH',
  '30': 'RAJASTHAN',
  '31': 'RAJASTHAN',
  '32': 'RAJASTHAN',
  '33': 'RAJASTHAN',
  '34': 'RAJASTHAN',
  '36': 'GUJARAT',
  '37': 'GUJARAT',
  '38': 'GUJARAT',
  '39': 'GUJARAT',
  '40': 'MAHARASHTRA',
  '41': 'MAHARASHTRA',
  '42': 'MAHARASHTRA',
  '43': 'MAHARASHTRA',
  '44': 'MAHARASHTRA',
  '45': 'MADHYA PRADESH',
  '46': 'MADHYA PRADESH',
  '47': 'MADHYA PRADESH',
  '48': 'MADHYA PRADESH',
  '49': 'CHHATTISGARH',
  '50': 'TELANGANA',
  '51': 'ANDHRA PRADESH',
  '52': 'ANDHRA PRADESH',
  '53': 'ANDHRA PRADESH',
  '56': 'KARNATAKA',
  '57': 'KARNATAKA',
  '58': 'KARNATAKA',
  '59': 'KARNATAKA',
  '60': 'TAMIL NADU',
  '61': 'TAMIL NADU',
  '62': 'TAMIL NADU',
  '63': 'TAMIL NADU',
  '64': 'TAMIL NADU',
  '67': 'KERALA',
  '68': 'KERALA',
  '69': 'KERALA',
  '70': 'WEST BENGAL',
  '71': 'WEST BENGAL',
  '72': 'WEST BENGAL',
  '73': 'WEST BENGAL',
  '74': 'WEST BENGAL',
  '75': 'ODISHA',
  '76': 'ODISHA',
  '77': 'ODISHA',
  '78': 'ASSAM',
  '79': 'NORTH EAST',
  '80': 'BIHAR',
  '81': 'BIHAR',
  '82': 'BIHAR',
  '83': 'JHARKHAND',
  '84': 'BIHAR',
  '85': 'BIHAR',
};

// In-memory cache for online lookups
const pincodeApiCache = new Map<string, PincodeInfo>();

/**
 * Synchronous Instant Offline Pincode Lookup
 */
export function lookupPincodeOffline(pin: string): PincodeInfo | null {
  const cleanPin = pin.trim().replace(/\D/g, '');
  if (!cleanPin || cleanPin.length < 3) return null;

  // Direct exact match
  if (PUNJAB_PINCODE_MAP[cleanPin]) {
    return PUNJAB_PINCODE_MAP[cleanPin];
  }

  // Cached API response
  if (pincodeApiCache.has(cleanPin)) {
    return pincodeApiCache.get(cleanPin)!;
  }

  // If 6 digits, approximate by prefix
  if (cleanPin.length === 6) {
    const prefix2 = cleanPin.slice(0, 2);
    const guessedState = STATE_PIN_PREFIX_MAP[prefix2] || 'PUNJAB';
    
    return {
      pincode: cleanPin,
      state: guessedState,
      district: '',
      tehsil: '',
      placeOfFiling: '',
    };
  }

  return null;
}

/**
 * Full Pincode Lookup with Instant Offline Response + Asynchronous India Post API Enrichment
 */
export async function lookupPincodeAsync(pin: string): Promise<PincodeInfo | null> {
  const cleanPin = pin.trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) {
    return lookupPincodeOffline(cleanPin);
  }

  // Check offline exact match first
  if (PUNJAB_PINCODE_MAP[cleanPin]) {
    return PUNJAB_PINCODE_MAP[cleanPin];
  }

  // Check cache
  if (pincodeApiCache.has(cleanPin)) {
    return pincodeApiCache.get(cleanPin)!;
  }

  // Try fetching from public India Post PIN code API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max

    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
        const po = data[0].PostOffice[0];
        const state = (po.State || '').toUpperCase();
        const district = (po.District || '').toUpperCase();
        const tehsil = (po.Taluk || po.Block || po.District || '').toUpperCase();
        const villageOrCity = (po.Name || '').toUpperCase();
        const placeOfFiling = tehsil || district || villageOrCity;

        const info: PincodeInfo = {
          pincode: cleanPin,
          state,
          district,
          tehsil,
          villageOrCity,
          placeOfFiling,
        };

        pincodeApiCache.set(cleanPin, info);
        return info;
      }
    }
  } catch {
    // Ignore network failures and use fallback
  }

  // Fallback to prefix heuristics
  return lookupPincodeOffline(cleanPin);
}
