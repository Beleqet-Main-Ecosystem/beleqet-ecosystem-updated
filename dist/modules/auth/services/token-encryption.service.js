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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenEncryptionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const auth_config_1 = require("../config/auth.config");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
let TokenEncryptionService = class TokenEncryptionService {
    constructor(key) {
        this.key = key;
        if (this.key.length !== 32) {
            throw new Error(`TokenEncryptionService requires a 32-byte key, received ${this.key.length} bytes.`);
        }
    }
    encrypt(plaintext) {
        const iv = (0, crypto_1.randomBytes)(IV_LENGTH_BYTES);
        const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, this.key, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    }
    decrypt(ciphertext) {
        const payload = Buffer.from(ciphertext, 'base64');
        if (payload.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
            throw new Error('Malformed ciphertext: payload too short to contain IV and auth tag.');
        }
        const iv = payload.subarray(0, IV_LENGTH_BYTES);
        const authTag = payload.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
        const encrypted = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
        const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
};
exports.TokenEncryptionService = TokenEncryptionService;
exports.TokenEncryptionService = TokenEncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_config_1.TOKEN_ENCRYPTION_KEY)),
    __metadata("design:paramtypes", [Buffer])
], TokenEncryptionService);
//# sourceMappingURL=token-encryption.service.js.map