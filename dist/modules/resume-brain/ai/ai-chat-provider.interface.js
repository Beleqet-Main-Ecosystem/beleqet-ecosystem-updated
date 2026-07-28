"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_CHAT_PROVIDER = exports.AiProviderError = void 0;
class AiProviderError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'AiProviderError';
    }
}
exports.AiProviderError = AiProviderError;
exports.AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER');
//# sourceMappingURL=ai-chat-provider.interface.js.map