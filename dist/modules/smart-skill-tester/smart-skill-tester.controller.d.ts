import { I18nService } from 'nestjs-i18n';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { GenerateQuestionsResult, SubmitAnswersResult } from './interfaces/skill-tester.interfaces';
import { SmartSkillTesterService } from './smart-skill-tester.service';
export declare class SmartSkillTesterController {
    private readonly smartSkillTesterService;
    private readonly i18n;
    constructor(smartSkillTesterService: SmartSkillTesterService, i18n: I18nService);
    generate(user: CurrentUserPayload, dto: GenerateQuestionsDto): Promise<GenerateQuestionsResult>;
    submit(user: CurrentUserPayload, dto: SubmitAnswersDto): Promise<SubmitAnswersResult>;
    private mapRouteError;
    private mapAiGenerationFailed;
    private resolveI18nMessage;
}
