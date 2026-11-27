export interface ITRBusinessCode {
  code: string;
  name: string;
  category: string;
  description: string;
}

export const ITR_BUSINESS_CODES: ITRBusinessCode[] = [
  {
    code: '21008',
    name: 'Boutique / Stitching of Clothes & Tailoring',
    category: 'Textile & Garments',
    description: 'Custom tailoring, stitching of ladies/gents suits, embroidery, boutique and dress design',
  },
  {
    code: '09028',
    name: 'Retail Sale of Other Goods in Specialized Stores',
    category: 'Retail Trade',
    description: 'General retail trade of various commodities in dedicated shops / showrooms',
  },
  {
    code: '09005',
    name: 'Retail Sale of Groceries, Food, Beverages & Kiryana Store',
    category: 'Retail Trade',
    description: 'Kiryana store, grocery provision store, packaged foods, daily essentials',
  },
  {
    code: '09020',
    name: 'Retail Sale of Textiles, Clothing and Footwear',
    category: 'Retail Trade',
    description: 'Readymade garments, cloth merchant, sarees, suiting-shirting, shoes & footwear shop',
  },
  {
    code: '09016',
    name: 'Retail Sale of Electrical Household Appliances & Mobile Phones',
    category: 'Retail Trade',
    description: 'Mobile phone retail, electronic appliances, TV/Fridge/AC sales, accessories',
  },
  {
    code: '09012',
    name: 'Retail Sale of Hardware, Paints, Sanitary and Glass',
    category: 'Retail Trade',
    description: 'Hardware store, sanitary fittings, building paints, glass & plywood merchant',
  },
  {
    code: '09023',
    name: 'Retail Sale of Pharmaceutical & Medical Goods / Chemist',
    category: 'Retail Trade',
    description: 'Medical store, chemist shop, pharma retail and surgical goods',
  },
  {
    code: '09001',
    name: 'Wholesale & Retail Sale of Motor Vehicles, Tractors & Spare Parts',
    category: 'Automotive',
    description: 'Auto parts, tractor spare parts, tyres, batteries and automobile accessories',
  },
  {
    code: '11001',
    name: 'Freight Transport by Road (Truck / Canter / Carrier Operator)',
    category: 'Transport & Logistics',
    description: 'Goods transport services, commercial truck operation, logistics and fleet services',
  },
  {
    code: '11002',
    name: 'Passenger Transport by Road (Taxi / Cab / Bus Operator)',
    category: 'Transport & Logistics',
    description: 'Tour and travel taxi services, cab operations, passenger transportation',
  },
  {
    code: '07001',
    name: 'Construction of Buildings & Civil Contractor Works',
    category: 'Construction',
    description: 'Civil contractor, masonry works, building construction, material contracting',
  },
  {
    code: '01001',
    name: 'Agriculture Support Services / Commission Agent (Aadhtiya) / Seed & Fertilizer',
    category: 'Agriculture',
    description: 'Agricultural equipment repair, seed/fertilizer dealership, commission agent at Grain Market',
  },
  {
    code: '10001',
    name: 'Restaurants, Fast Food, Dhabas & Catering Services',
    category: 'Hospitality',
    description: 'Dhaba, restaurant, confectionery, sweet shop, catering and banquet food services',
  },
  {
    code: '20010',
    name: 'Personal Services (Beauty Parlour / Hair Salon / Dry Cleaning)',
    category: 'Services',
    description: 'Beauty parlour, unisex hair salon, spa, laundry and dry cleaning services',
  },
  {
    code: '19001',
    name: 'Repair of Computers, Mobiles, Electrical & Household Goods',
    category: 'Repair & Service',
    description: 'Mobile repair center, laptop/PC repair, home appliances electrical repair shop',
  },
  {
    code: '06001',
    name: 'Wholesale / Commission Agent / Trading (Non-Food)',
    category: 'Wholesale Trade',
    description: 'Wholesale trade and dealership of various non-food commercial commodities',
  },
  {
    code: '04001',
    name: 'Manufacturing of Textiles, Knitwear & Garments',
    category: 'Manufacturing',
    description: 'Hosiery manufacturing, cloth weaving, garment manufacturing unit',
  },
  {
    code: '14005',
    name: 'Other Professional, Technical & Consultant Services (u/s 44ADA)',
    category: 'Profession (44ADA)',
    description: 'IT consulting, software development, tax consultancy, technical design services',
  },
  {
    code: '14001',
    name: 'Legal, Accounting & Bookkeeping Services (u/s 44ADA)',
    category: 'Profession (44ADA)',
    description: 'Advocacy, legal consultancy, accounts writing, audit and tax return preparation',
  },
  {
    code: '14003',
    name: 'Medical & Healthcare Practice (Doctor / Clinic / Dentist)',
    category: 'Profession (44ADA)',
    description: 'Medical practitioners, clinical consultation, dental clinic, physiotherapy',
  },
];
