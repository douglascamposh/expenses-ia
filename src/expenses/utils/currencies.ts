import type { Currency } from '../models/Expense';

/** Nombre y país por moneda (selector con buscador). */
export const CURRENCY_INFO: Record<Currency, { nameEs: string; nameEn: string; countryEs: string; countryEn: string }> = {
  BOB: { nameEs: 'boliviano', nameEn: 'boliviano', countryEs: 'Bolivia', countryEn: 'Bolivia' },
  USD: { nameEs: 'dólar estadounidense', nameEn: 'US dollar', countryEs: 'Estados Unidos', countryEn: 'United States' },
  EUR: { nameEs: 'euro', nameEn: 'euro', countryEs: 'Eurozona', countryEn: 'Eurozone' },
  ARS: { nameEs: 'peso argentino', nameEn: 'Argentine peso', countryEs: 'Argentina', countryEn: 'Argentina' },
  BRL: { nameEs: 'real brasileño', nameEn: 'Brazilian real', countryEs: 'Brasil', countryEn: 'Brazil' },
  CLP: { nameEs: 'peso chileno', nameEn: 'Chilean peso', countryEs: 'Chile', countryEn: 'Chile' },
  COP: { nameEs: 'peso colombiano', nameEn: 'Colombian peso', countryEs: 'Colombia', countryEn: 'Colombia' },
  MXN: { nameEs: 'peso mexicano', nameEn: 'Mexican peso', countryEs: 'México', countryEn: 'Mexico' },
  PEN: { nameEs: 'sol peruano', nameEn: 'Peruvian sol', countryEs: 'Perú', countryEn: 'Peru' },
  PYG: { nameEs: 'guaraní', nameEn: 'guarani', countryEs: 'Paraguay', countryEn: 'Paraguay' },
  UYU: { nameEs: 'peso uruguayo', nameEn: 'Uruguayan peso', countryEs: 'Uruguay', countryEn: 'Uruguay' },
};

export function currencyName(cur: Currency, lang: 'es' | 'en' = 'es'): string {
  const info = CURRENCY_INFO[cur];
  if (!info) return cur;
  return lang === 'en' ? info.nameEn : info.nameEs;
}

export function currencyCountry(cur: Currency, lang: 'es' | 'en' = 'es'): string {
  const info = CURRENCY_INFO[cur];
  if (!info) return '';
  return lang === 'en' ? info.countryEn : info.countryEs;
}
