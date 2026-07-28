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
var AIExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIExtractorService = void 0;
const common_1 = require("@nestjs/common");
const ai_chat_provider_interface_1 = require("./ai/ai-chat-provider.interface");
const extracted_resume_dto_1 = require("./dto/extracted-resume.dto");
let AIExtractorService = AIExtractorService_1 = class AIExtractorService {
    constructor(provider) {
        this.provider = provider;
        this.logger = new common_1.Logger(AIExtractorService_1.name);
    }
    get providerName() {
        return this.provider.name;
    }
    async extract(text) {
        const trimmed = (text ?? '').trim();
        if (!trimmed) {
            throw new common_1.UnprocessableEntityException('Cannot extract a profile from empty resume text.');
        }
        const resumeText = this.sanitize(trimmed.slice(0, 12_000));
        let raw;
        let usage;
        try {
            const completion = await this.provider.complete([
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: this.buildUserPrompt(resumeText) },
            ], { json: true, temperature: 0.1, maxTokens: 1500 });
            raw = completion.content;
            usage = completion.usage;
        }
        catch (err) {
            throw this.toHttpException(err);
        }
        const parsed = this.parseJson(raw) ?? {};
        const resume = this.normalize(parsed);
        this.logger.log(`Extracted resume via ${this.provider.name}: ` +
            `${resume.skills.length} skills, ${resume.experience.length} roles, ` +
            `${resume.education.length} education entries ` +
            `(${usage.totalTokens} tokens).`);
        return { resume, usage };
    }
    sanitize(text) {
        return text
            .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, ' ')
            .replace(/disregard\s+(all\s+)?(previous|prior)\s+instructions/gi, ' ')
            .replace(/^\s*system\s*:/gim, ' ')
            .replace(/^\s*assistant\s*:/gim, ' ')
            .trim();
    }
    buildUserPrompt(resumeText) {
        return ('Extract the candidate profile from the following resume text and return ' +
            'it as JSON matching the schema exactly.\n\n' +
            '=== RESUME START ===\n' +
            resumeText +
            '\n=== RESUME END ===');
    }
    parseJson(raw) {
        const cleaned = raw
            .replace(/^\s*```(?:json)?/i, '')
            .replace(/```\s*$/i, '')
            .trim();
        const candidates = [cleaned, this.firstJsonObject(cleaned)];
        for (const candidate of candidates) {
            if (!candidate)
                continue;
            try {
                const value = JSON.parse(candidate);
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return value;
                }
            }
            catch {
            }
        }
        this.logger.warn('AI reply was not valid JSON; returning empty profile.');
        return null;
    }
    firstJsonObject(text) {
        const start = text.indexOf('{');
        if (start === -1)
            return null;
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{')
                depth++;
            else if (text[i] === '}' && --depth === 0) {
                return text.slice(start, i + 1);
            }
        }
        return null;
    }
    normalize(data) {
        return {
            ...extracted_resume_dto_1.EMPTY_EXTRACTED_RESUME,
            firstName: this.str(data.firstName),
            lastName: this.str(data.lastName),
            email: this.str(data.email),
            phone: this.str(data.phone),
            summary: this.str(data.summary),
            headline: this.str(data.headline),
            location: this.str(data.location),
            skills: this.strArray(data.skills),
            languages: this.strArray(data.languages),
            certifications: this.strArray(data.certifications),
            education: this.educationArray(data.education),
            experience: this.experienceArray(data.experience),
        };
    }
    str(value) {
        if (typeof value === 'string')
            return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return '';
    }
    strArray(value) {
        if (!Array.isArray(value))
            return [];
        return value.map((item) => this.str(item)).filter((item) => item.length > 0);
    }
    educationArray(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .map((item) => {
            const obj = (item ?? {});
            return {
                school: this.str(obj.school ?? obj.institution),
                qualification: this.str(obj.qualification ?? obj.degree),
                year: this.str(obj.year ?? obj.graduationYear),
            };
        })
            .filter((e) => e.school || e.qualification || e.year);
    }
    experienceArray(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .map((item) => {
            const obj = (item ?? {});
            return {
                role: this.str(obj.role ?? obj.title ?? obj.position),
                company: this.str(obj.company ?? obj.employer ?? obj.organization),
                start: this.str(obj.start ?? obj.startDate),
                end: this.str(obj.end ?? obj.endDate),
                description: this.str(obj.description ?? obj.summary),
            };
        })
            .filter((e) => e.role || e.company || e.description);
    }
    toHttpException(err) {
        if (err instanceof ai_chat_provider_interface_1.AiProviderError) {
            if (err.status === common_1.HttpStatus.TOO_MANY_REQUESTS) {
                return new common_1.HttpException('AI capacity reached. Please try again shortly.', common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            return new common_1.ServiceUnavailableException('The resume AI service is temporarily unavailable.');
        }
        this.logger.error(`Unexpected AI extraction error: ${err.message}`);
        return new common_1.ServiceUnavailableException('The resume AI service is temporarily unavailable.');
    }
};
exports.AIExtractorService = AIExtractorService;
exports.AIExtractorService = AIExtractorService = AIExtractorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(ai_chat_provider_interface_1.AI_CHAT_PROVIDER)),
    __metadata("design:paramtypes", [Object])
], AIExtractorService);
const SYSTEM_PROMPT = `You are a resume parser. Read the resume text and return ONLY valid JSON — no markdown, no code fences, no commentary.

Use this exact schema and these exact keys:
{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "summary": "",
  "headline": "",
  "location": "",
  "skills": [],
  "languages": [],
  "certifications": [],
  "education": [{ "school": "", "qualification": "", "year": "" }],
  "experience": [{ "role": "", "company": "", "start": "", "end": "", "description": "" }]
}

Rules:
- Output a single JSON object, nothing else.
- Use "" for any string you cannot find and [] for any list you cannot find.
- "summary" is a short professional summary; "headline" is the person's job title.
- "skills", "languages" and "certifications" are arrays of short strings.
- Never invent facts. Only use information present in the resume.`;
//# sourceMappingURL=ai-extractor.service.js.map