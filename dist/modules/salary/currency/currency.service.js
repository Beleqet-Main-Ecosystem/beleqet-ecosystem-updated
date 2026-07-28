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
var CurrencyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let CurrencyService = CurrencyService_1 = class CurrencyService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(CurrencyService_1.name);
        this.exchangeRates = this.loadExchangeRates();
    }
    loadExchangeRates() {
        const rates = this.configService.get('EXCHANGE_RATES');
        if (rates) {
            return rates;
        }
        return {
            base: 1,
            ETB: 1,
            USD: 140,
            EUR: 152,
            GBP: 180,
            AED: 38,
            SAR: 38,
        };
    }
    convert(amount, from, to) {
        if (from === to) {
            return Math.round(amount);
        }
        const rateFrom = this.exchangeRates[from] || 1;
        const rateTo = this.exchangeRates[to] || 1;
        const converted = (amount * rateFrom) / rateTo;
        this.logger.debug(`Converted ${amount} ${from} to ${converted.toFixed(2)} ${to}`);
        return Math.round(converted);
    }
    convertSalaryPrediction(prediction, targetCurrency, sourceCurrency = 'ETB') {
        if (targetCurrency === sourceCurrency) {
            return prediction;
        }
        return {
            minSalary: this.convert(prediction.minSalary, sourceCurrency, targetCurrency),
            maxSalary: this.convert(prediction.maxSalary, sourceCurrency, targetCurrency),
            averageSalary: this.convert(prediction.averageSalary, sourceCurrency, targetCurrency),
            medianSalary: this.convert(prediction.medianSalary, sourceCurrency, targetCurrency),
            currency: targetCurrency,
            standardDeviation: this.convert(prediction.standardDeviation, sourceCurrency, targetCurrency),
        };
    }
    getSupportedCurrencies() {
        return ['ETB', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];
    }
    isSupported(currency) {
        return this.getSupportedCurrencies().includes(currency);
    }
    updateExchangeRates(newRates) {
        this.exchangeRates = { ...this.exchangeRates, ...newRates };
        this.logger.log('Exchange rates updated');
    }
    getExchangeRate(currency) {
        return this.exchangeRates[currency] || 1;
    }
};
exports.CurrencyService = CurrencyService;
exports.CurrencyService = CurrencyService = CurrencyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CurrencyService);
//# sourceMappingURL=currency.service.js.map