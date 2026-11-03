import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsUrl } from 'class-validator';

/**
 * An optional link that can also be cleared: an empty string or null becomes null (which
 * Prisma stores as "no link"), and anything else must be a valid URL. Plain @IsUrl rejects
 * the empty string, so a link, once saved, could never be removed.
 */
export function ClearableUrl() {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value)),
    IsOptional(),
    IsUrl(),
  );
}
