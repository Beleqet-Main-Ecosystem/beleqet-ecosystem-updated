"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextObject = getContextObject;
const i18n_constants_1 = require("../i18n.constants");
const util_1 = require("./util");
function getContextObject(i18nOptions, context) {
    if (!context) {
        if (i18nOptions?.logging) {
            util_1.logger.warn('context type: undefined not supported');
        }
        return context;
    }
    const contextType = context.getType();
    switch (contextType) {
        case i18n_constants_1.ExecutionContextType.HTTP:
            return context.switchToHttp().getRequest();
        case i18n_constants_1.ExecutionContextType.WS:
            return context.switchToWs().getClient();
        case i18n_constants_1.ExecutionContextType.GRAPHQL:
            return context.getArgs()[2];
        case i18n_constants_1.ExecutionContextType.RPC:
            return context.switchToRpc().getContext();
        case i18n_constants_1.ExecutionContextType.RMQ:
            return context.getArgs()[1];
        default:
            if (i18nOptions?.logging) {
                util_1.logger.warn(`context type: ${contextType} not supported`);
            }
            return context;
    }
}
//# sourceMappingURL=context.js.map