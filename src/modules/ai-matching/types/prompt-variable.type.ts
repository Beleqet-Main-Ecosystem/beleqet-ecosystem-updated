/**
 * A map of variable names to their string values for prompt template
 * interpolation. Keys must match the `{{variable}}` placeholders in
 * the prompt template files.
 */
export type PromptVariables = Record<string, string>;
