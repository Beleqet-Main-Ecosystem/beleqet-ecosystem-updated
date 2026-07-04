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
var OpenAiKycProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiKycProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
let OpenAiKycProvider = OpenAiKycProvider_1 = class OpenAiKycProvider {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(OpenAiKycProvider_1.name);
        this.openai = new openai_1.default({
            apiKey: this.config.get('OPENAI_API_KEY'),
        });
    }
    async verify(documentBuffer, faceScanBuffer) {
        this.logger.log('Executing OpenAI Vision KYC verification');
        const apiKey = this.config.get('OPENAI_API_KEY');
        if (!apiKey || apiKey === 'dummy_key_for_testing') {
            this.logger.warn('OpenAI API key not configured or dummy. Falling back to simulated verification.');
            return this.getFallbackResult();
        }
        try {
            const documentBase64 = documentBuffer.toString('base64');
            const faceScanBase64 = faceScanBuffer.toString('base64');
            const model = this.config.get('OPENAI_MODEL', 'gpt-4o-mini');
            const response = await this.openai.chat.completions.create({
                model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a secure, highly accurate KYC verification assistant for an Ethiopian freelance network. ' +
                            'Always return verification responses in a strict JSON format.',
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'You are given two images:\n' +
                                    'Image 1: User uploaded ID document (passport, national ID card, or driver\'s license).\n' +
                                    'Image 2: User\'s live face scan (selfie).\n\n' +
                                    'Please perform these checks:\n' +
                                    '1. Verify if the ID document in Image 1 is authentic, valid, not expired, and contains clear details.\n' +
                                    '2. Perform a face comparison: Does the face in the ID document (Image 1) match the face in the selfie (Image 2)?\n' +
                                    '3. Perform a liveness check: Does Image 2 show a live person scan (no screens, paper printouts, or deepfakes)?\n' +
                                    '4. Extract the full name and identification number from the document in Image 1.\n\n' +
                                    'You MUST respond with a valid JSON object matching the following structure:\n' +
                                    '{\n' +
                                    '  "matchScore": <number between 0 and 100 representing facial match confidence>,\n' +
                                    '  "livenessPassed": <boolean indicating if selfie liveness check succeeded>,\n' +
                                    '  "isDocumentValid": <boolean indicating if ID document is authentic & readable>,\n' +
                                    '  "extractedName": "<name on document or null>",\n' +
                                    '  "extractedIdNumber": "<document number or null>",\n' +
                                    '  "rejectionReason": "<short reason for rejection, or null if verification passed>"\n' +
                                    '}',
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${documentBase64}`,
                                },
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${faceScanBase64}`,
                                },
                            },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            });
            const rawContent = response.choices[0]?.message?.content ?? '{}';
            const parsed = JSON.parse(rawContent);
            return {
                matchScore: Math.min(100, Math.max(0, parsed.matchScore ?? 0)),
                livenessPassed: !!parsed.livenessPassed,
                isDocumentValid: !!parsed.isDocumentValid,
                extractedName: parsed.extractedName || undefined,
                extractedIdNumber: parsed.extractedIdNumber || undefined,
                rejectionReason: parsed.rejectionReason || undefined,
            };
        }
        catch (err) {
            this.logger.error(`OpenAI Vision call failed: ${err.message}`, err.stack);
            return {
                matchScore: 0,
                livenessPassed: false,
                isDocumentValid: false,
                rejectionReason: `AI processing failed: ${err.message}`,
            };
        }
    }
    getFallbackResult() {
        return {
            matchScore: 0,
            livenessPassed: false,
            isDocumentValid: false,
            rejectionReason: 'KYC identity verification provider is unconfigured.',
        };
    }
};
exports.OpenAiKycProvider = OpenAiKycProvider;
exports.OpenAiKycProvider = OpenAiKycProvider = OpenAiKycProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiKycProvider);
//# sourceMappingURL=openai-kyc-provider.service.js.map