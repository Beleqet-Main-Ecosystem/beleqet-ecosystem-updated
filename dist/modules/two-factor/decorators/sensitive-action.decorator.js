"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensitiveAction = exports.ACTION_TYPE_KEY = exports.SENSITIVE_ACTION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SENSITIVE_ACTION_KEY = 'sensitive_action';
exports.ACTION_TYPE_KEY = 'action_type';
const SensitiveAction = (action) => {
    return (target, key, descriptor) => {
        (0, common_1.SetMetadata)(exports.SENSITIVE_ACTION_KEY, true)(target, key, descriptor);
        if (action) {
            (0, common_1.SetMetadata)(exports.ACTION_TYPE_KEY, action)(target, key, descriptor);
        }
    };
};
exports.SensitiveAction = SensitiveAction;
//# sourceMappingURL=sensitive-action.decorator.js.map