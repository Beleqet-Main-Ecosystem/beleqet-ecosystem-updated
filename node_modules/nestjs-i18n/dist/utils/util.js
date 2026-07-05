"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usingFastify = exports.isNestMiddleware = exports.logger = void 0;
exports.shouldResolve = shouldResolve;
exports.httpStatusToMessage = httpStatusToMessage;
exports.i18nValidationErrorFactory = i18nValidationErrorFactory;
exports.i18nValidationMessage = i18nValidationMessage;
exports.formatI18nErrors = formatI18nErrors;
const common_1 = require("@nestjs/common");
const interfaces_1 = require("../interfaces");
const i18n_context_1 = require("../i18n.context");
exports.logger = new common_1.Logger('I18nService');
function shouldResolve(e) {
    return typeof e === 'function' || 'use' in e;
}
function httpStatusToMessage(status) {
    const key = common_1.HttpStatus[status];
    return key
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
function validationErrorToI18n(e) {
    return {
        property: e.property,
        value: e.value,
        target: e.target,
        contexts: e.contexts,
        children: e?.children?.map(validationErrorToI18n),
        constraints: e.constraints
            ? Object.keys(e.constraints).reduce((result, key) => {
                result[key] = e.constraints[key];
                return result;
            }, {})
            : {},
    };
}
function i18nValidationErrorFactory(errors) {
    const normalizedErrors = errors.map((e) => {
        return validationErrorToI18n(e);
    });
    const i18n = i18n_context_1.I18nContext.current();
    if (!i18n) {
        return new interfaces_1.I18nValidationException(normalizedErrors);
    }
    return new interfaces_1.I18nValidationException(formatI18nErrors(normalizedErrors, i18n.service, {
        lang: i18n.lang,
    }), undefined, true);
}
function i18nValidationMessage(key, args) {
    return (a) => {
        const { constraints } = a;
        let { value } = a;
        if (typeof value === 'string') {
            value = value.replace(/\|/g, '');
        }
        return `${key}|${JSON.stringify({ value, constraints, ...args })}`;
    };
}
function formatI18nErrors(errors, i18n, options) {
    return errors.map((error) => {
        error.children = formatI18nErrors(error.children ?? [], i18n, options);
        error.constraints = Object.keys(error.constraints ?? {}).reduce((result, key) => {
            const rawConstraint = error.constraints[key];
            const separatorIndex = rawConstraint.indexOf('|');
            const translationKey = separatorIndex === -1
                ? rawConstraint
                : rawConstraint.slice(0, separatorIndex);
            const argsString = separatorIndex === -1 ? '' : rawConstraint.slice(separatorIndex + 1);
            let args = {};
            if (argsString) {
                try {
                    args = JSON.parse(argsString);
                }
                catch {
                    args = {};
                }
            }
            const constraints = args.constraints
                ? args.constraints.reduce((acc, cur, index) => {
                    acc[index.toString()] = cur;
                    return acc;
                }, {})
                : error.constraints;
            result[key] = i18n.translate(translationKey, {
                ...options,
                args: {
                    property: error.property,
                    value: error.value,
                    target: error.target,
                    contexts: error.contexts,
                    ...args,
                    constraints,
                },
            });
            return result;
        }, {});
        return error;
    });
}
const isNestMiddleware = (consumer) => {
    return typeof consumer.httpAdapter === 'object';
};
exports.isNestMiddleware = isNestMiddleware;
const usingFastify = (consumer) => {
    return consumer.httpAdapter.constructor.name
        .toLowerCase()
        .startsWith('fastify');
};
exports.usingFastify = usingFastify;
//# sourceMappingURL=util.js.map