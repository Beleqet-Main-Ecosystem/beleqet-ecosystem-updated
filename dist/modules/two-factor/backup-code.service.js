"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BackupCodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupCodeService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;
const BCRYPT_SALT_ROUNDS = 10;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
let BackupCodeService = BackupCodeService_1 = class BackupCodeService {
    constructor() {
        this.logger = new common_1.Logger(BackupCodeService_1.name);
    }
    generate() {
        const plainCodes = [];
        const hashedCodes = [];
        for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
            const code = this.randomCode();
            plainCodes.push(code);
            hashedCodes.push(bcrypt.hashSync(code, BCRYPT_SALT_ROUNDS));
        }
        return { plainCodes, hashedCodes };
    }
    verify(code, hashedCode) {
        return bcrypt.compareSync(code, hashedCode);
    }
    randomCode() {
        const len = ALPHABET.length;
        const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
        const chars = [];
        for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
            const byte = bytes[i];
            const index = byte % len;
            chars.push(ALPHABET[index]);
        }
        return chars.join('');
    }
};
exports.BackupCodeService = BackupCodeService;
exports.BackupCodeService = BackupCodeService = BackupCodeService_1 = __decorate([
    (0, common_1.Injectable)()
], BackupCodeService);
//# sourceMappingURL=backup-code.service.js.map