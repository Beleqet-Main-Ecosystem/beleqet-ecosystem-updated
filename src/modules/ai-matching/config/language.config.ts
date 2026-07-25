/**
 * Configuration for multilingual support in the matching pipeline.
 * Controls prompt template selection and embedding model routing.
 */
export interface LanguageConfig {
  /** Locale codes the system is deployed to support (e.g., "en", "am"). */
  readonly supportedLocales: readonly string[];

  /** The fallback locale when none is specified or the requested locale is unsupported. */
  readonly defaultLocale: string;
}

export const defaultLanguageConfig: LanguageConfig = {
  supportedLocales: ['en', 'am'],
  defaultLocale: 'en',
} as const;
