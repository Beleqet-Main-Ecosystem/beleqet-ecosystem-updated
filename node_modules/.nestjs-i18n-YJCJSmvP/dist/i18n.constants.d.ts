export declare const I18N_OPTIONS = "I18nOptions";
export declare const I18N_TRANSLATIONS = "I18nTranslations";
export declare const I18N_LANGUAGES = "I18nLanguages";
export declare const I18N_RESOLVER_OPTIONS = "I18nResolverOptions";
export declare const I18N_RESOLVERS = "I18nResolvers";
export declare const I18N_LOADER_OPTIONS = "I18nLoaderOptions";
export declare const I18N_LOADERS = "I18nLoaders";
export declare const I18N_LANGUAGES_SUBJECT = "I18nLanguagesSubject";
export declare const I18N_TRANSLATIONS_SUBJECT = "I18nTranslationsSubject";
export declare enum ExecutionContextType {
    HTTP = "http",
    GRAPHQL = "graphql",
    RPC = "rpc",
    WS = "ws",
    RMQ = "rmq"
}
export declare const SUPPORTED_CONTEXT_TYPES: readonly [ExecutionContextType.HTTP, ExecutionContextType.GRAPHQL, ExecutionContextType.RPC, ExecutionContextType.RMQ, ExecutionContextType.WS];
export declare enum PluralKey {
    ZERO = "zero",
    ONE = "one",
    TWO = "two",
    FEW = "few",
    MANY = "many",
    OTHER = "other"
}
export declare const PLURAL_KEYS: readonly [PluralKey.ZERO, PluralKey.ONE, PluralKey.TWO, PluralKey.FEW, PluralKey.MANY, PluralKey.OTHER];
export declare enum TransformPipeName {
    UPPERCASE = "uppercase",
    LOWERCASE = "lowercase",
    CAPITALIZE = "capitalize"
}
export declare const DEFAULT_KEY_SEPARATOR = ".";
export declare const DEFAULT_NAMESPACE_SEPARATOR = false;
export declare const TEMPLATE_PLACEHOLDER_REGEX: RegExp;
export declare const PIPE_SEPARATOR = "|";
export declare const NESTED_TRANSLATION_REGEX: RegExp;
export declare const TRANSFORM_PLACEHOLDER_PREFIX = "__i18n_transform_";
export declare const FASTIFY_ADAPTER_NAME = "fastify";
export declare const TYPEOF_OBJECT = "object";
