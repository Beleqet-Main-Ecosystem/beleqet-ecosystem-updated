import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

@Injectable()
@Catch(BadRequestException)
export class SkillTesterInvalidPayloadFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  async catch(
    exception: BadRequestException,
    host: ArgumentsHost,
  ): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const exceptionResponse = exception.getResponse();
    const payload =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : {};
    const details = Array.isArray(payload.message)
      ? payload.message.join('; ')
      : typeof payload.message === 'string'
        ? payload.message
        : undefined;

    const translated = await this.i18n.t('messages.skillTester.invalidPayload', {
      args: details ? { details } : undefined,
      defaultValue: details ?? 'Invalid skill tester payload.',
    });

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
      message:
        typeof translated === 'string'
          ? translated
          : details ?? 'Invalid skill tester payload.',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
