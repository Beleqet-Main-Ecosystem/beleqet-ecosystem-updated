// common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const sanitizedUrl = req.url.replace(
      /([?&])(token|password|secret|key|authorization|access_token)=[^&]*/gi,
      '$1$2=[REDACTED]',
    );

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${sanitizedUrl} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Preserve custom fields from HttpException responses (e.g. requiresStepUp, stepUpToken)
    // so the frontend can consume them without regression.
    const baseResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: sanitizedUrl,
    };

    if (typeof message === 'string') {
      res.status(status).json({ ...baseResponse, message });
    } else {
      // Spread the full exception response object to preserve custom fields, ensuring message exists
      const exceptionBody = message as Record<string, unknown>;
      res.status(status).json({
        message: 'An error occurred',
        ...baseResponse,
        ...exceptionBody,
      });
    }
  }
}
