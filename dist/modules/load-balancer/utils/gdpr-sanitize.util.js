"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicBackendView = toPublicBackendView;
exports.pseudonymizeIp = pseudonymizeIp;
function toPublicBackendView(backend) {
    return {
        id: backend.id,
        region: backend.region,
        supportedCurrencies: backend.supportedCurrencies,
        healthy: backend.healthy,
        activeConnections: backend.activeConnections,
    };
}
function pseudonymizeIp(clientIp) {
    const parts = clientIp.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.x.x`;
    }
    return 'masked';
}
//# sourceMappingURL=gdpr-sanitize.util.js.map