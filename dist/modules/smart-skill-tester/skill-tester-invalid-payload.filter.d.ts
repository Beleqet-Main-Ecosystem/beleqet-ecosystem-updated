import { ArgumentsHost, BadRequestException, ExceptionFilter } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
export declare class SkillTesterInvalidPayloadFilter implements ExceptionFilter {
    private readonly i18n;
    constructor(i18n: I18nService);
    catch(exception: BadRequestException, host: ArgumentsHost): Promise<void>;
}
