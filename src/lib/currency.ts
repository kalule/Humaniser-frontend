// Single source of truth for turning a plan/top-up's ISO currency code into a
// display symbol — HumaniseAI is a global product priced in USD; ZAR is kept
// only as a fallback for any legacy records that haven't been migrated yet.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  ZAR: 'R',
  EUR: '€',
  GBP: '£',
}

export function currencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `
}

export function formatMoney(amount: number, currencyCode: string): string {
  return `${currencySymbol(currencyCode)}${amount.toLocaleString()}`
}
