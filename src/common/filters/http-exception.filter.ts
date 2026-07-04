// common/filters/http-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const responseBody: Record<string, any> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    if (typeof message === 'string') {
      responseBody.message = message;
    } else if (typeof message === 'object') {
      responseBody.message = (message as any).message ?? 'Internal server error';
      for (const key of Object.keys(message as object)) {
        if (key !== 'message' && key !== 'statusCode') {
          responseBody[key] = (message as any)[key];
        }
      }
    }

    res.status(status).json(responseBody);
  }
}
