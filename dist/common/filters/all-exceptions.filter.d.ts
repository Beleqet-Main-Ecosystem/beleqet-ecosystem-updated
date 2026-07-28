import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ErrorRecurrenceTrackerService } from './error-recurrence-tracker.service';
export declare const ERROR_CODES: {
    readonly BAD_REQUEST: "ERR_BAD_REQUEST";
    readonly UNAUTHORIZED: "ERR_UNAUTHORIZED";
    readonly FORBIDDEN: "ERR_FORBIDDEN";
    readonly NOT_FOUND: "ERR_RESOURCE_NOT_FOUND";
    readonly CONFLICT: "ERR_CONFLICT";
    readonly UNPROCESSABLE: "ERR_VALIDATION_FAILED";
    readonly TOO_MANY_REQUESTS: "ERR_RATE_LIMIT_EXCEEDED";
    readonly INTERNAL_SERVER_ERROR: "ERR_INTERNAL";
    readonly DB_UNIQUE_VIOLATION: "ERR_DUPLICATE_RECORD";
    readonly DB_RECORD_NOT_FOUND: "ERR_RECORD_NOT_FOUND";
    readonly DB_FOREIGN_KEY_VIOLATION: "ERR_REFERENTIAL_INTEGRITY";
    readonly DB_CONNECTION: "ERR_DB_UNAVAILABLE";
    readonly UNKNOWN: "ERR_UNKNOWN";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export interface StructuredErrorLog {
    level: 'error' | 'warn';
    timestamp: string;
    traceId: string;
    method: string;
    path: string;
    statusCode: number;
    errorCode: ErrorCode;
    internalMessage: string;
    stack?: string;
    prismaCode?: string;
}
export interface ErrorResponse {
    statusCode: number;
    errorCode: ErrorCode;
    message: string;
    timestamp: string;
    path: string;
    traceId: string;
    requiresStepUp?: boolean;
    stepUpToken?: string;
}
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly httpAdapterHost;
    private readonly recurrenceTracker;
    private readonly logger;
    constructor(httpAdapterHost: HttpAdapterHost, recurrenceTracker: ErrorRecurrenceTrackerService);
    catch(exception: unknown, host: ArgumentsHost): void;
    private classify;
    private classifyPrismaError;
    private httpStatusToCode;
    private buildClientMessage;
    private redactSensitiveParams;
    private generateTraceId;
}
