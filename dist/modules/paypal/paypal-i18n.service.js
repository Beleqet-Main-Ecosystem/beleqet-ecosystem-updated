"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PaypalI18nService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalI18nService = void 0;
const common_1 = require("@nestjs/common");
let PaypalI18nService = PaypalI18nService_1 = class PaypalI18nService {
    constructor() {
        this.logger = new common_1.Logger(PaypalI18nService_1.name);
        this.strings = {
            'paypal.payment.confirmed': {
                en: 'Your payment of {{currency}} {{amount}} has been successfully processed.',
                am: 'ክፍያዎ ተቀብሏል፡ {{currency}} {{amount}} በተሳካ ሁኔታ ተካሂዷል።',
            },
            'paypal.payment.failed': {
                en: 'Your PayPal payment could not be processed. Please try again.',
                am: 'የPayPal ክፍያዎ ሊካሄድ አልቻለም። እባክዎ እንደገና ይሞክሩ።',
            },
            'paypal.refund.issued': {
                en: 'A refund of {{currency}} {{amount}} has been issued to your PayPal account.',
                am: 'የ{{currency}} {{amount}} ተመላሽ ወደ PayPal መለያዎ ተልኳል።',
            },
            'paypal.subscription.active': {
                en: 'Your Beleqet subscription is now active.',
                am: 'የ Beleqet ደንበኝነትዎ አሁን ንቁ ነው።',
            },
            'paypal.subscription.cancelled': {
                en: 'Your Beleqet subscription has been cancelled.',
                am: 'የ Beleqet ደንበኝነትዎ ተሰርዟል።',
            },
            'paypal.subscription.suspended': {
                en: 'Your Beleqet subscription has been suspended.',
                am: 'የ Beleqet ደንበኝነትዎ ታግዷል።',
            },
            'paypal.subscription.expired': {
                en: 'Your Beleqet subscription has expired.',
                am: 'የ Beleqet ደንበኝነትዎ ጊዜው አልፏል።',
            },
            'paypal.dispute.created': {
                en: 'A new PayPal dispute has been opened: {{disputeId}}',
                am: 'አዲስ የPayPal ቅሬታ ተከፍቷል፡ {{disputeId}}',
            },
            'paypal.dispute.resolved': {
                en: 'PayPal dispute {{disputeId}} has been resolved.',
                am: 'የPayPal ቅሬታ {{disputeId}} ተፈትቷል።',
            },
        };
    }
    translate(key, locale = 'en', params = {}) {
        const keyMap = this.strings[key];
        if (!keyMap) {
            this.logger.warn(`[PaypalI18n] Missing i18n key: "${key}"`);
            return key;
        }
        const shortLocale = locale.split('-')[0].toLowerCase();
        const template = keyMap[shortLocale] ?? keyMap['en'] ?? key;
        if (!keyMap[shortLocale]) {
            this.logger.debug(`[PaypalI18n] Locale "${shortLocale}" not found for key "${key}" — using English fallback`);
        }
        return this.interpolate(template, params);
    }
    t(key, locale = 'en', params = {}) {
        return this.translate(key, locale, params);
    }
    interpolate(template, params) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] !== undefined ? String(params[key]) : `{{${key}}}`);
    }
    getAvailableKeys() {
        return Object.keys(this.strings);
    }
};
exports.PaypalI18nService = PaypalI18nService;
exports.PaypalI18nService = PaypalI18nService = PaypalI18nService_1 = __decorate([
    (0, common_1.Injectable)()
], PaypalI18nService);
//# sourceMappingURL=paypal-i18n.service.js.map