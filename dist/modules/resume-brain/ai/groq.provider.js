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
var GroqProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
const ai_chat_provider_interface_1 = require("./ai-chat-provider.interface");
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;
let GroqProvider = GroqProvider_1 = class GroqProvider {
    constructor(config) {
        this.config = config;
        this.name = 'groq';
        this.logger = new common_1.Logger(GroqProvider_1.name);
        this.model = this.config.get('GROQ_MODEL', 'llama-3.1-8b-instant');
        this.client = new openai_1.default({
            apiKey: this.config.get('GROQ_API_KEY') ?? '',
            baseURL: this.config.get('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
            timeout: this.config.get('GROQ_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
            maxRetries: this.config.get('GROQ_MAX_RETRIES', DEFAULT_MAX_RETRIES),
        });
    }
    async complete(messages, options = {}) {
        if (!this.config.get('GROQ_API_KEY')) {
            throw new ai_chat_provider_interface_1.AiProviderError(503, 'GROQ_API_KEY is not configured');
        }
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: options.temperature ?? 0.1,
                max_tokens: options.maxTokens ?? 1500,
                ...(options.json ? { response_format: { type: 'json_object' } } : {}),
            });
            const content = completion.choices[0]?.message?.content?.trim();
            if (!content) {
                throw new ai_chat_provider_interface_1.AiProviderError(502, 'Groq returned an empty response');
            }
            const usage = completion.usage;
            return {
                content,
                usage: {
                    promptTokens: usage?.prompt_tokens ?? 0,
                    completionTokens: usage?.completion_tokens ?? 0,
                    totalTokens: usage?.total_tokens ?? 0,
                },
            };
        }
        catch (err) {
            if (err instanceof ai_chat_provider_interface_1.AiProviderError)
                throw err;
            if (err instanceof openai_1.default.APIConnectionTimeoutError ||
                err instanceof openai_1.default.APIConnectionError) {
                this.logger.warn(`Groq request timed out / unreachable: ${err.message}`);
                throw new ai_chat_provider_interface_1.AiProviderError(503, 'Groq request timed out');
            }
            const status = err instanceof openai_1.default.APIError && typeof err.status === 'number' ? err.status : 503;
            this.logger.warn(`Groq request failed (${status}): ${err.message}`);
            throw new ai_chat_provider_interface_1.AiProviderError(status, 'Groq request failed');
        }
    }
};
exports.GroqProvider = GroqProvider;
exports.GroqProvider = GroqProvider = GroqProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GroqProvider);
//# sourceMappingURL=groq.provider.js.map