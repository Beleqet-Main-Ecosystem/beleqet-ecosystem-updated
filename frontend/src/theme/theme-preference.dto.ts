import 'reflect-metadata';
import { IsIn } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { THEME_PREFERENCE_VALUES } from './theme.types';
import type { ThemePreference } from './theme.types';

/**
 * ThemePreferenceDto
 *
 * Rule 3 of the project README requires every piece of *input data* to be
 * validated with `class-validator`. This module has no HTTP request body —
 * its only "input" is whatever string happens to be sitting in
 * `localStorage` under the theme key, which the browser (or a user poking
 * at devtools) could set to anything.
 *
 * Rather than skip the rule because there's no NestJS controller here,
 * this DTO applies the same library to that input: the persisted value is
 * treated as untrusted, parsed into this DTO, and validated before the app
 * ever trusts it as a real {@link ThemePreference}.
 */
export class ThemePreferenceDto {
  @IsIn(THEME_PREFERENCE_VALUES, {
    message: `theme preference must be one of: ${THEME_PREFERENCE_VALUES.join(', ')}`,
  })
  value!: ThemePreference;
}

/**
 * Validates an unknown value (typically read from localStorage) against
 * {@link ThemePreferenceDto} and returns it as a typed {@link ThemePreference}
 * only if it passes validation.
 *
 * @param candidate - The raw, untrusted value to check.
 * @returns The validated {@link ThemePreference}, or `null` if the value
 *          is missing, malformed, or not one of the allowed values.
 */
export function isValidThemePreference(
  candidate: unknown,
): ThemePreference | null {
  if (typeof candidate !== 'string') {
    return null;
  }

  const dto = plainToInstance(ThemePreferenceDto, { value: candidate });
  const errors = validateSync(dto);

  return errors.length === 0 ? dto.value : null;
}
