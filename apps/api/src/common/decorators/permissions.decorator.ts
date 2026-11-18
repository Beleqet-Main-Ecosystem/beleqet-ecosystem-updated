import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to enforce required permissions for an endpoint.
 * @param permissions List of permission actions (e.g., 'create:jobs', 'view:users')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
