"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDPR_REDACTED = void 0;
exports.hashPii = hashPii;
exports.maskPayerPii = maskPayerPii;
exports.sanitiseForStorage = sanitiseForStorage;
const crypto_1 = require("crypto");
exports.GDPR_REDACTED = '[GDPR_REDACTED]';
const HASHABLE_PII_FIELDS = new Set(['email_address', 'email']);
const REDACTABLE_PII_FIELDS = new Set([
    'given_name',
    'surname',
    'full_name',
    'phone',
    'phone_number',
    'address',
    'address_line_1',
    'address_line_2',
    'admin_area_1',
    'admin_area_2',
    'postal_code',
    'country_code',
    'national_number',
]);
function hashPii(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
function maskPayerPii(payload) {
    if (payload === null || payload === undefined) {
        return payload;
    }
    if (Array.isArray(payload)) {
        return payload.map((item) => maskPayerPii(item));
    }
    if (typeof payload === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
            if (HASHABLE_PII_FIELDS.has(key) && typeof value === 'string') {
                result[key] = hashPii(value);
            }
            else if (REDACTABLE_PII_FIELDS.has(key)) {
                result[key] = exports.GDPR_REDACTED;
            }
            else {
                result[key] = maskPayerPii(value);
            }
        }
        return result;
    }
    return payload;
}
function sanitiseForStorage(response) {
    if (response === null || response === undefined)
        return {};
    return maskPayerPii(response);
}
//# sourceMappingURL=paypal-pii.utils.js.map