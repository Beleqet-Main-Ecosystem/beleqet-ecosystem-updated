"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPEOF_OBJECT = exports.FASTIFY_ADAPTER_NAME = exports.TRANSFORM_PLACEHOLDER_PREFIX = exports.NESTED_TRANSLATION_REGEX = exports.PIPE_SEPARATOR = exports.TEMPLATE_PLACEHOLDER_REGEX = exports.DEFAULT_NAMESPACE_SEPARATOR = exports.DEFAULT_KEY_SEPARATOR = exports.TransformPipeName = exports.PLURAL_KEYS = exports.PluralKey = exports.SUPPORTED_CONTEXT_TYPES = exports.ExecutionContextType = exports.I18N_TRANSLATIONS_SUBJECT = exports.I18N_LANGUAGES_SUBJECT = exports.I18N_LOADERS = exports.I18N_LOADER_OPTIONS = exports.I18N_RESOLVERS = exports.I18N_RESOLVER_OPTIONS = exports.I18N_LANGUAGES = exports.I18N_TRANSLATIONS = exports.I18N_OPTIONS = void 0;
exports.I18N_OPTIONS = 'I18nOptions';
exports.I18N_TRANSLATIONS = 'I18nTranslations';
exports.I18N_LANGUAGES = 'I18nLanguages';
exports.I18N_RESOLVER_OPTIONS = 'I18nResolverOptions';
exports.I18N_RESOLVERS = 'I18nResolvers';
exports.I18N_LOADER_OPTIONS = 'I18nLoaderOptions';
exports.I18N_LOADERS = 'I18nLoaders';
exports.I18N_LANGUAGES_SUBJECT = 'I18nLanguagesSubject';
exports.I18N_TRANSLATIONS_SUBJECT = 'I18nTranslationsSubject';
var ExecutionContextType;
(function (ExecutionContextType) {
    ExecutionContextType["HTTP"] = "http";
    ExecutionContextType["GRAPHQL"] = "graphql";
    ExecutionContextType["RPC"] = "rpc";
    ExecutionContextType["WS"] = "ws";
    ExecutionContextType["RMQ"] = "rmq";
})(ExecutionContextType || (exports.ExecutionContextType = ExecutionContextType = {}));
exports.SUPPORTED_CONTEXT_TYPES = [
    ExecutionContextType.HTTP,
    ExecutionContextType.GRAPHQL,
    ExecutionContextType.RPC,
    ExecutionContextType.RMQ,
    ExecutionContextType.WS,
];
var PluralKey;
(function (PluralKey) {
    PluralKey["ZERO"] = "zero";
    PluralKey["ONE"] = "one";
    PluralKey["TWO"] = "two";
    PluralKey["FEW"] = "few";
    PluralKey["MANY"] = "many";
    PluralKey["OTHER"] = "other";
})(PluralKey || (exports.PluralKey = PluralKey = {}));
exports.PLURAL_KEYS = [
    PluralKey.ZERO,
    PluralKey.ONE,
    PluralKey.TWO,
    PluralKey.FEW,
    PluralKey.MANY,
    PluralKey.OTHER,
];
var TransformPipeName;
(function (TransformPipeName) {
    TransformPipeName["UPPERCASE"] = "uppercase";
    TransformPipeName["LOWERCASE"] = "lowercase";
    TransformPipeName["CAPITALIZE"] = "capitalize";
})(TransformPipeName || (exports.TransformPipeName = TransformPipeName = {}));
exports.DEFAULT_KEY_SEPARATOR = '.';
exports.DEFAULT_NAMESPACE_SEPARATOR = false;
exports.TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;
exports.PIPE_SEPARATOR = '|';
exports.NESTED_TRANSLATION_REGEX = /\$t\((.*?)(,(.*?))?\)/g;
exports.TRANSFORM_PLACEHOLDER_PREFIX = '__i18n_transform_';
exports.FASTIFY_ADAPTER_NAME = 'fastify';
exports.TYPEOF_OBJECT = 'object';
//# sourceMappingURL=i18n.constants.js.map