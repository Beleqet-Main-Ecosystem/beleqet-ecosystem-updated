"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMailEnvConfig = loadMailEnvConfig;
function requireEnv(name) {
    const value = process.env[name];
    if (value === undefined || value.trim().length === 0) {
        throw new Error(`Missing required environment variable "${name}".`);
    }
    return value;
}
function loadMailEnvConfig() {
    return {
        smtpHost: requireEnv('SMTP_HOST'),
        smtpPort: Number(requireEnv('SMTP_PORT')),
        smtpUser: requireEnv('SMTP_USER'),
        smtpPassword: requireEnv('SMTP_PASSWORD'),
        fromAddress: requireEnv('SMTP_FROM_ADDRESS'),
    };
}
//# sourceMappingURL=mail.config.js.map