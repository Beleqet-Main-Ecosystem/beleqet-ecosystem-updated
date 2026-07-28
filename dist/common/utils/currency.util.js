"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyUtil = void 0;
class CurrencyUtil {
    static toSmallestUnit(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error('Invalid monetary amount: Must be a valid number.');
        }
        return Math.round(amount * 100);
    }
    static toDecimal(smallestUnit) {
        if (typeof smallestUnit !== 'number' || !Number.isInteger(smallestUnit)) {
            throw new Error('Invalid input: Smallest unit value must be an integer.');
        }
        return smallestUnit / 100;
    }
    static add(a, b) {
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            throw new Error('Addition inputs must be safe integers representing the smallest currency units.');
        }
        return a + b;
    }
    static subtract(a, b) {
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            throw new Error('Subtraction inputs must be safe integers representing the smallest currency units.');
        }
        return a - b;
    }
    static multiply(amount, factor) {
        if (!Number.isInteger(amount) || typeof factor !== 'number' || isNaN(factor)) {
            throw new Error('Multiplication inputs must be an integer amount and a valid factor.');
        }
        return Math.round(amount * factor);
    }
    static format(smallestUnit, currency = 'ETB', locale = 'en-US') {
        const decimalValue = this.toDecimal(smallestUnit);
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency.toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(decimalValue);
    }
}
exports.CurrencyUtil = CurrencyUtil;
//# sourceMappingURL=currency.util.js.map