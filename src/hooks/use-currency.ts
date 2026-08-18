import { useState, useEffect } from 'react';

export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'BRL' | 'MXN' | 'PLN';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  BRL: 'R$',
  MXN: 'MX$',
  PLN: 'zł',
};

const EXCHANGE_RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  JPY: 163,
  CAD: 1.47,
  AUD: 1.65,
  CHF: 0.96,
  BRL: 5.45,
  MXN: 19.5,
  PLN: 4.25,
};

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem('collectiq-currency') as Currency) ?? 'EUR';
  });

  useEffect(() => {
    const handler = () => {
      setCurrencyState((localStorage.getItem('collectiq-currency') as Currency) ?? 'EUR');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setCurrency = (c: string) => {
    localStorage.setItem('collectiq-currency', c);
    setCurrencyState(c as Currency);
  };

  const symbol = CURRENCY_SYMBOLS[currency];

  const formatPrice = (priceInEur: number | null | undefined): string => {
    if (!priceInEur) return 'Sin precio';
    const converted = priceInEur * EXCHANGE_RATES[currency];
    return symbol + converted.toFixed(2);
  };

  return { currency, symbol, formatPrice, setCurrency };
}