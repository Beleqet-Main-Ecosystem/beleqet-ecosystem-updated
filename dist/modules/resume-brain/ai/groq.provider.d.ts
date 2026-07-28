import { ConfigService } from '@nestjs/config';
import { AiChatMessage, AiChatProvider, AiCompletion, AiCompletionOptions } from './ai-chat-provider.interface';
export declare class GroqProvider implements AiChatProvider {
    private readonly config;
    readonly name = "groq";
    private readonly logger;
    private readonly client;
    private readonly model;
    constructor(config: ConfigService);
    complete(messages: AiChatMessage[], options?: AiCompletionOptions): Promise<AiCompletion>;
}
