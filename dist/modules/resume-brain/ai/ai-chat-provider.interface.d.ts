export type AiChatRole = 'system' | 'user' | 'assistant';
export interface AiChatMessage {
    role: AiChatRole;
    content: string;
}
export interface AiCompletionOptions {
    maxTokens?: number;
    temperature?: number;
    json?: boolean;
}
export interface AiUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface AiCompletion {
    content: string;
    usage: AiUsage;
}
export interface AiChatProvider {
    readonly name: string;
    complete(messages: AiChatMessage[], options?: AiCompletionOptions): Promise<AiCompletion>;
}
export declare class AiProviderError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare const AI_CHAT_PROVIDER: unique symbol;
