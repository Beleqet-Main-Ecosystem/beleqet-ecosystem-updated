"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const auth_errors_1 = require("../errors/auth.errors");
let AuthExceptionFilter = class AuthExceptionFilter {
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        const status = this.resolveStatus(exception);
        response.status(status).json({
            statusCode: status,
            error: exception.name,
            message: exception.message,
        });
    }
    resolveStatus(exception) {
        if (exception instanceof auth_errors_1.UnverifiedEmailLinkAttemptError) {
            return common_1.HttpStatus.FORBIDDEN;
        }
        if (exception instanceof auth_errors_1.InvalidLinkConfirmationTokenError) {
            return common_1.HttpStatus.BAD_REQUEST;
        }
        if (exception instanceof auth_errors_1.ProviderIdentityAlreadyLinkedError) {
            return common_1.HttpStatus.CONFLICT;
        }
        return common_1.HttpStatus.BAD_REQUEST;
    }
};
exports.AuthExceptionFilter = AuthExceptionFilter;
exports.AuthExceptionFilter = AuthExceptionFilter = __decorate([
    (0, common_1.Catch)(auth_errors_1.AuthDomainError)
], AuthExceptionFilter);
//# sourceMappingURL=auth-exception.filter.js.map