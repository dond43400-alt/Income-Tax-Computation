import { TaxComputation, FirmDetails, Language } from '../types';
import { DEFAULT_FIRM_DETAILS, SAMPLE_COMPUTATIONS } from './sampleData';

const COMPUTATIONS_KEY = 'itr_tax_computations_v1';
const FIRM_DETAILS_KEY = 'itr_firm_details_v1';
const LANGUAGE_KEY = 'itr_language_v1';

export function loadSavedComputations(): TaxComputation[] {
  try {
    const raw = localStorage.getItem(COMPUTATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading saved computations from localStorage', e);
  }
  return SAMPLE_COMPUTATIONS;
}

export function saveComputations(computations: TaxComputation[]): void {
  try {
    localStorage.setItem(COMPUTATIONS_KEY, JSON.stringify(computations));
  } catch (e) {
    console.error('Error saving computations to localStorage', e);
  }
}

export function loadFirmDetails(): FirmDetails {
  try {
    const raw = localStorage.getItem(FIRM_DETAILS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading firm details from localStorage', e);
  }
  return DEFAULT_FIRM_DETAILS;
}

export function saveFirmDetails(firm: FirmDetails): void {
  try {
    localStorage.setItem(FIRM_DETAILS_KEY, JSON.stringify(firm));
  } catch (e) {
    console.error('Error saving firm details to localStorage', e);
  }
}

export function loadLanguage(): Language {
  try {
    const raw = localStorage.getItem(LANGUAGE_KEY);
    if (raw === 'pa' || raw === 'hi' || raw === 'en') {
      return raw as Language;
    }
  } catch (e) {
    console.error('Error loading language', e);
  }
  return 'pa'; // Default to Punjabi as user typed in Punjabi/Hindi
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch (e) {
    console.error('Error saving language', e);
  }
}
