"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprUtil = void 0;
class GdprUtil {
    static maskPII(text) {
        if (typeof text !== 'string') {
            throw new Error('Input must be a valid string for masking.');
        }
        let sanitized = text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, emailName, domain) => {
            if (emailName.length <= 4) {
                return '****@' + domain;
            }
            return emailName.substring(0, 3) + '...' + emailName.slice(-1) + '@' + domain;
        });
        sanitized = sanitized.replace(/(\+?[0-9\s-]{7,15})/g, (match) => {
            const cleanDigits = match.replace(/[\s-]/g, '');
            if (cleanDigits.length >= 8) {
                const visibleLength = Math.max(3, cleanDigits.length - 6);
                return match.substring(0, visibleLength) + '***' + match.slice(-3);
            }
            return match;
        });
        return sanitized;
    }
}
exports.GdprUtil = GdprUtil;
//# sourceMappingURL=gdpr.interface.js.map