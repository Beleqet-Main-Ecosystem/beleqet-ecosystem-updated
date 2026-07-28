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
exports.AllExceptionsFilter = exports.ERROR_CODES = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const error_recurrence_tracker_service_1 = require("./error-recurrence-tracker.service");
function isPrismaError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof err['code'] === 'string' &&
        String(err['code']).startsWith('P'));
}
exports.ERROR_CODES = {
    BAD_REQUEST: 'ERR_BAD_REQUEST',
    UNAUTHORIZED: 'ERR_UNAUTHORIZED',
    FORBIDDEN: 'ERR_FORBIDDEN',
    NOT_FOUND: 'ERR_RESOURCE_NOT_FOUND',
    CONFLICT: 'ERR_CONFLICT',
    UNPROCESSABLE: 'ERR_VALIDATION_FAILED',
    TOO_MANY_REQUESTS: 'ERR_RATE_LIMIT_EXCEEDED',
    INTERNAL_SERVER_ERROR: 'ERR_INTERNAL',
    DB_UNIQUE_VIOLATION: 'ERR_DUPLICATE_RECORD',
    DB_RECORD_NOT_FOUND: 'ERR_RECORD_NOT_FOUND',
    DB_FOREIGN_KEY_VIOLATION: 'ERR_REFERENTIAL_INTEGRITY',
    DB_CONNECTION: 'ERR_DB_UNAVAILABLE',
    UNKNOWN: 'ERR_UNKNOWN',
};
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SENSITIVE_PARAMS = ['email', 'token', 'password', 'phone', 'telegramId', 'code'];
let AllExceptionsFilter = class AllExceptionsFilter {
    constructor(httpAdapterHost, recurrenceTracker) {
        this.httpAdapterHost = httpAdapterHost;
        this.recurrenceTracker = recurrenceTracker;
        this.logger = new common_1.Logger('ExceptionFilter');
    }
    catch(exception, host) {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const traceId = this.generateTraceId();
        const safePath = this.redactSensitiveParams(req.url);
        const { statusCode, errorCode, internalMessage, prismaCode } = this.classify(exception);
        const logEntry = {
            level: statusCode >= 500 ? 'error' : 'warn',
            timestamp: new Date().toISOString(),
            traceId,
            method: req.method,
            path: safePath,
            statusCode,
            errorCode,
            internalMessage,
            prismaCode,
            stack: exception instanceof Error ? exception.stack : undefined,
        };
        if (logEntry.level === 'error') {
            this.logger.error(JSON.stringify(logEntry));
        }
        else {
            this.logger.warn(JSON.stringify(logEntry));
        }
        this.recurrenceTracker.track(errorCode, safePath, internalMessage);
        const body = {
            statusCode,
            errorCode,
            message: this.buildClientMessage(statusCode, errorCode, exception),
            timestamp: new Date().toISOString(),
            path: safePath,
            traceId,
            ...(exception instanceof common_1.HttpException
                ? (() => {
                    const resp = exception.getResponse();
                    if (typeof resp === 'object' && resp !== null) {
                        const r = resp;
                        return {
                            ...(r.requiresStepUp === true ? { requiresStepUp: true } : {}),
                            ...(typeof r.stepUpToken === 'string' ? { stepUpToken: r.stepUpToken } : {}),
                        };
                    }
                    return {};
                })()
                : {}),
        };
        httpAdapter.reply(ctx.getResponse(), body, statusCode);
    }
    classify(exception) {
        if (exception instanceof common_1.HttpException) {
            const statusCode = exception.getStatus();
            const response = exception.getResponse();
            const internalMessage = typeof response === 'string'
                ? response
                : (response.message?.toString() ??
                    exception.message);
            return {
                statusCode,
                errorCode: this.httpStatusToCode(statusCode),
                internalMessage,
            };
        }
        if (isPrismaError(exception)) {
            return this.classifyPrismaError(exception);
        }
        if (exception instanceof Error) {
            return {
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                errorCode: exports.ERROR_CODES.INTERNAL_SERVER_ERROR,
                internalMessage: exception.message,
            };
        }
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            errorCode: exports.ERROR_CODES.UNKNOWN,
            internalMessage: String(exception),
        };
    }
    classifyPrismaError(err) {
        switch (err.code) {
            case 'P2002':
                return {
                    statusCode: common_1.HttpStatus.CONFLICT,
                    errorCode: exports.ERROR_CODES.DB_UNIQUE_VIOLATION,
                    internalMessage: err.message,
                    prismaCode: err.code,
                };
            case 'P2025':
                return {
                    statusCode: common_1.HttpStatus.NOT_FOUND,
                    errorCode: exports.ERROR_CODES.DB_RECORD_NOT_FOUND,
                    internalMessage: err.message,
                    prismaCode: err.code,
                };
            case 'P2003':
                return {
                    statusCode: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
                    errorCode: exports.ERROR_CODES.DB_FOREIGN_KEY_VIOLATION,
                    internalMessage: err.message,
                    prismaCode: err.code,
                };
            case 'P1001':
            case 'P1002':
                return {
                    statusCode: common_1.HttpStatus.SERVICE_UNAVAILABLE,
                    errorCode: exports.ERROR_CODES.DB_CONNECTION,
                    internalMessage: err.message,
                    prismaCode: err.code,
                };
            default:
                return {
                    statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                    errorCode: exports.ERROR_CODES.INTERNAL_SERVER_ERROR,
                    internalMessage: err.message,
                    prismaCode: err.code,
                };
        }
    }
    httpStatusToCode(status) {
        const map = {
            [common_1.HttpStatus.BAD_REQUEST]: exports.ERROR_CODES.BAD_REQUEST,
            [common_1.HttpStatus.UNAUTHORIZED]: exports.ERROR_CODES.UNAUTHORIZED,
            [common_1.HttpStatus.FORBIDDEN]: exports.ERROR_CODES.FORBIDDEN,
            [common_1.HttpStatus.NOT_FOUND]: exports.ERROR_CODES.NOT_FOUND,
            [common_1.HttpStatus.CONFLICT]: exports.ERROR_CODES.CONFLICT,
            [common_1.HttpStatus.UNPROCESSABLE_ENTITY]: exports.ERROR_CODES.UNPROCESSABLE,
            [common_1.HttpStatus.TOO_MANY_REQUESTS]: exports.ERROR_CODES.TOO_MANY_REQUESTS,
            [common_1.HttpStatus.INTERNAL_SERVER_ERROR]: exports.ERROR_CODES.INTERNAL_SERVER_ERROR,
        };
        return map[status] ?? exports.ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
    buildClientMessage(statusCode, _errorCode, exception) {
        if (statusCode < 500) {
            if (exception instanceof common_1.HttpException) {
                const resp = exception.getResponse();
                if (typeof resp === 'string')
                    return resp;
                const msg = resp.message;
                if (Array.isArray(msg))
                    return msg.join('; ');
                return msg ?? 'Request error.';
            }
            if (isPrismaError(exception)) {
                if (exception.code === 'P2002')
                    return 'A record with this value already exists.';
                if (exception.code === 'P2025')
                    return 'The requested resource was not found.';
                if (exception.code === 'P2003')
                    return 'Referential integrity constraint violated.';
            }
        }
        if (IS_PRODUCTION) {
            return 'An unexpected error occurred. Please try again later.';
        }
        if (exception instanceof Error)
            return exception.message;
        if (isPrismaError(exception))
            return `Database error (${exception.code}).`;
        return 'An unexpected error occurred.';
    }
    redactSensitiveParams(url) {
        try {
            const [path, query] = url.split('?');
            if (!query)
                return url;
            const redacted = query
                .split('&')
                .map((pair) => {
                const [key] = pair.split('=');
                return SENSITIVE_PARAMS.includes(key.toLowerCase()) ? `${key}=[REDACTED]` : pair;
            })
                .join('&');
            return `${path}?${redacted}`;
        }
        catch {
            return url;
        }
    }
    generateTraceId() {
        return (Date.now().toString(36) + Math.random().toString(36).substring(2, 8)).toUpperCase();
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Injectable)(),
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [core_1.HttpAdapterHost,
        error_recurrence_tracker_service_1.ErrorRecurrenceTrackerService])
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map