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
var EncryptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 'v1';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
let EncryptionService = EncryptionService_1 = class EncryptionService {
    constructor(config) {
        this.logger = new common_1.Logger(EncryptionService_1.name);
        const raw = config.get('TOTP_ENCRYPTION_KEY');
        if (!raw) {
            throw new Error('TOTP_ENCRYPTION_KEY is required. Generate with: openssl rand -hex 32');
        }
        const normalized = raw.length === 64 ? raw : raw.slice(0, 64);
        this.key = Buffer.from(normalized, 'hex');
        if (this.key.length !== 32) {
            throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes for AES-256). Generate with: openssl rand -hex 32');
        }
    }
    encrypt(plaintext) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const payload = Buffer.concat([iv, authTag, encrypted]);
        return { ciphertext: payload.toString('base64'), keyVersion: KEY_VERSION };
    }
    decrypt(ciphertext) {
        const payload = Buffer.from(ciphertext, 'base64');
        const iv = payload.subarray(0, IV_LENGTH);
        const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = EncryptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map