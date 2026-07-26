/**
 * Multi-Currency Compliance Utility.
 * Ensures financial transaction records enforce standard ISO 4217 currency codes.
 */

export const VALID_ISO_CURRENCY_CODES = new Set([
  'ETB',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
  'INR',
  'AED',
  'SAR',
  'KES',
  'ZAR',
]);

const FINANCIAL_FIELD_NAMES = new Set([
  'amount',
  'price',
  'budget',
  'budgetmin',
  'budgetmax',
  'salary',
  'salarymin',
  'salarymax',
  'agreedamount',
  'netamount',
  'grossamount',
  'platformfee',
  'balance',
]);

/**
 * Validates whether a currency string matches standard ISO 4217 currency codes.
 *
 * @param currency - Target currency code string (e.g., "ETB", "USD")
 * @returns Boolean indicating validity
 */
export function isValidIsoCurrency(currency: unknown): boolean {
  if (typeof currency !== 'string') {
    return false;
  }
  return VALID_ISO_CURRENCY_CODES.has(currency.toUpperCase());
}

/**
 * Checks if a given object contains financial numeric fields, and if so,
 * validates or ensures that a valid ISO currency code is present.
 *
 * @param payload - Target object payload to evaluate
 * @returns Result object with status and formatted details
 * @security Multi-Currency Standard: Enforces ISO currency tracking on financial events.
 */
export function validateMultiCurrencyPayload(payload: unknown): { isValid: boolean; detectedCurrency?: string; error?: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: true };
  }

  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);

  let hasFinancialField = false;

  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (FINANCIAL_FIELD_NAMES.has(lowerKey) && typeof obj[key] === 'number') {
      hasFinancialField = true;
      break;
    }
  }

  if (!hasFinancialField) {
    return { isValid: true };
  }

  // Search for currency attribute in payload
  const currencyKey = keys.find((k) => k.toLowerCase() === 'currency');
  const currencyValue = currencyKey ? obj[currencyKey] : undefined;

  if (!currencyValue) {
    return {
      isValid: false,
      error: 'Financial transaction payload missing currency field (ISO 4217 standard required)',
    };
  }

  if (!isValidIsoCurrency(currencyValue)) {
    return {
      isValid: false,
      error: `Invalid ISO 4217 currency code: ${String(currencyValue)}`,
    };
  }

  return {
    isValid: true,
    detectedCurrency: String(currencyValue).toUpperCase(),
  };
}
