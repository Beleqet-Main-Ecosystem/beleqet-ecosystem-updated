import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles';

export type UserRoleType = UserRole | 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER' | 'FREELANCER';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRoleType[]) => SetMetadata(ROLES_KEY, roles);