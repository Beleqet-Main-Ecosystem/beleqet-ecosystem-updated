"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaypalAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let PaypalAuthService = PaypalAuthService_1 = class PaypalAuthService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(PaypalAuthService_1.name);
        this.cachedToken = null;
        this.tokenExpiresAt = 0;
        this.REFRESH_BUFFER_MS = 5 * 60 * 1_000;
    }
    async getAccessToken() {
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        if (mode === 'mock') {
            return 'mock-access-token-12345';
        }
        if (this.cachedToken &&
            Date.now() < this.tokenExpiresAt - this.REFRESH_BUFFER_MS) {
            return this.cachedToken;
        }
        return this.refreshToken();
    }
    async refreshToken() {
        const clientId = this.config.get('PAYPAL_CLIENT_ID');
        const clientSecret = this.config.get('PAYPAL_CLIENT_SECRET');
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        const baseUrl = mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
        try {
            const response = await axios_1.default.post(`${baseUrl}/v1/oauth2/token`, 'grant_type=client_credentials', {
                auth: { username: clientId, password: clientSecret },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const { access_token, expires_in } = response.data;
            this.cachedToken = access_token;
            this.tokenExpiresAt = Date.now() + expires_in * 1_000;
            this.logger.debug(`PayPal token refreshed. Expires in ${expires_in}s (${mode} mode)`);
            return access_token;
        }
        catch (err) {
            const msg = axios_1.default.isAxiosError(err)
                ? `${err.response?.status} — ${JSON.stringify(err.response?.data)}`
                : String(err);
            this.logger.error(`Failed to fetch PayPal access token: ${msg}`);
            throw new common_1.UnauthorizedException('Unable to authenticate with PayPal. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
        }
    }
    getBaseUrl() {
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        return mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }
    invalidateToken() {
        this.cachedToken = null;
        this.tokenExpiresAt = 0;
        this.logger.debug('PayPal token cache invalidated — will re-authenticate on next request');
    }
    getTokenExpiresAt() {
        return this.tokenExpiresAt > 0 ? new Date(this.tokenExpiresAt) : null;
    }
};
exports.PaypalAuthService = PaypalAuthService;
exports.PaypalAuthService = PaypalAuthService = PaypalAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PaypalAuthService);
//# sourceMappingURL=paypal-auth.service.js.map