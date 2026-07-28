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
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
const mail_config_1 = require("./mail.config");
let MailService = class MailService {
    constructor() {
        const config = (0, mail_config_1.loadMailEnvConfig)();
        this.fromAddress = config.fromAddress;
        this.transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpPort === 465,
            auth: { user: config.smtpUser, pass: config.smtpPassword },
        });
    }
    async sendAccountLinkConfirmation(toEmail, confirmationUrl) {
        await this.transporter.sendMail({
            from: this.fromAddress,
            to: toEmail,
            subject: 'Confirm linking your account — Beleqet',
            html: `
        <p>Someone tried to sign in using a social account linked to this email.</p>
        <p>If this was you, click below to confirm linking it to your Beleqet account:</p>
        <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
        });
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map