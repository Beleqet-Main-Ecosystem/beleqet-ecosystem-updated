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
exports.ChapaClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ChapaClient = class ChapaClient {
    constructor(config) {
        this.config = config;
        this.baseUrl = this.config
            .get('CHAPA_BASE_URL', 'https://api.chapa.co/v1')
            .replace(/\/$/, '');
    }
    async initializePayment(request) {
        return this.post('/transaction/initialize', {
            amount: request.amount,
            currency: request.currency,
            email: request.email,
            first_name: request.firstName,
            last_name: request.lastName,
            tx_ref: request.txRef,
            callback_url: request.callbackUrl,
            return_url: request.returnUrl,
            customization: {
                title: request.title,
                description: request.description,
            },
        });
    }
    async verifyTransaction(txRef) {
        return this.get(`/transaction/verify/${encodeURIComponent(txRef)}`);
    }
    async createTransfer(request) {
        return this.post('/transfers', {
            account_name: request.accountName,
            account_number: request.accountNumber,
            amount: request.amount,
            currency: request.currency,
            reference: request.reference,
            bank_code: request.bankCode,
        });
    }
    async verifyTransfer(reference) {
        return this.get(`/transfers/verify/${encodeURIComponent(reference)}`);
    }
    async get(path) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: this.headers(),
        });
        return this.parse(response);
    }
    async post(path, body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        return this.parse(response);
    }
    headers() {
        const secretKey = this.config.getOrThrow('CHAPA_SECRET_KEY');
        return {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        };
    }
    async parse(response) {
        const text = await response.text();
        let payload;
        try {
            payload = text
                ? JSON.parse(text)
                : {};
        }
        catch {
            throw new common_1.BadGatewayException({
                message: 'Chapa returned a non-JSON response',
                statusCode: response.status,
                provider: {
                    body: text.slice(0, 500),
                },
            });
        }
        if (!response.ok) {
            throw new common_1.BadGatewayException({
                message: payload?.message ?? 'Chapa request failed',
                statusCode: response.status,
                provider: payload,
            });
        }
        return payload;
    }
};
exports.ChapaClient = ChapaClient;
exports.ChapaClient = ChapaClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChapaClient);
//# sourceMappingURL=chapa.client.js.map