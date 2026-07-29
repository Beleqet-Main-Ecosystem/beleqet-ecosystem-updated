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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChapaSignatureService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let ChapaSignatureService = class ChapaSignatureService {
    constructor(config) {
        this.config = config;
    }
    verifyWebhook(rawBody, headers) {
        const secret = this.config.get('CHAPA_WEBHOOK_SECRET');
        if (!secret) {
            return false;
        }
        const payloadSignature = this.header(headers, 'x-chapa-signature');
        const chapaSignature = this.header(headers, 'chapa-signature');
        const payloadHash = this.hmac(rawBody.toString('utf8'), secret);
        return (this.safeEquals(payloadSignature, payloadHash) || this.safeEquals(chapaSignature, payloadHash));
    }
    hmac(value, secret) {
        return (0, crypto_1.createHmac)('sha256', secret).update(value).digest('hex');
    }
    header(headers, name) {
        const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
        return Array.isArray(value) ? value[0] : value;
    }
    safeEquals(left, right) {
        const normalized = this.normalizeSignature(left);
        if (!normalized) {
            return false;
        }
        const leftBuffer = Buffer.from(normalized, 'hex');
        const rightBuffer = Buffer.from(right, 'hex');
        return leftBuffer.length === rightBuffer.length && (0, crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
    }
    normalizeSignature(value) {
        const signature = value?.trim().replace(/^sha256=/i, '');
        return signature && /^[a-f0-9]{64}$/i.test(signature) ? signature : undefined;
    }
};
exports.ChapaSignatureService = ChapaSignatureService;
exports.ChapaSignatureService = ChapaSignatureService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChapaSignatureService);
//# sourceMappingURL=chapa-signature.service.js.map