"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_CURRENCY_CODES = exports.CURRENCY_CODES = exports.SUPPORTED_CURRENCIES = void 0;
exports.getCurrencyMeta = getCurrencyMeta;
exports.isMockOnlyCurrency = isMockOnlyCurrency;
exports.formatAmount = formatAmount;
exports.toMinorUnits = toMinorUnits;
exports.isValidCurrencyCode = isValidCurrencyCode;
exports.SUPPORTED_CURRENCIES = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2, mockOnly: true },
];
exports.CURRENCY_CODES = new Set(exports.SUPPORTED_CURRENCIES.map((c) => c.code));
exports.LIVE_CURRENCY_CODES = new Set(exports.SUPPORTED_CURRENCIES.filter((c) => !c.mockOnly).map((c) => c.code));
function getCurrencyMeta(code) {
    return exports.SUPPORTED_CURRENCIES.find((c) => c.code === code);
}
function isMockOnlyCurrency(code) {
    return getCurrencyMeta(code)?.mockOnly === true;
}
function formatAmount(amount, code, locale = 'en-US') {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
        }).format(amount);
    }
    catch {
        const meta = getCurrencyMeta(code);
        return `${meta?.symbol ?? code} ${amount.toFixed(meta?.decimals ?? 2)}`;
    }
}
function toMinorUnits(amount, currency) {
    const meta = getCurrencyMeta(currency);
    const factor = Math.pow(10, meta?.decimals ?? 2);
    return Math.round(amount * factor);
}
function isValidCurrencyCode(code) {
    return exports.CURRENCY_CODES.has(code);
}
//# sourceMappingURL=paypal-currency.utils.js.map