// src/common/constants/roles.ts

export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYER = 'EMPLOYER',
  FREELANCER = 'FREELANCER',
  JOB_SEEKER = 'JOB_SEEKER',
}

export const USER_ROLES = {
  ADMIN: UserRole.ADMIN,
  EMPLOYER: UserRole.EMPLOYER,
  JOB_SEEKER: UserRole.JOB_SEEKER,
  FREELANCER: UserRole.FREELANCER,
} as const;

export type UserRoleName = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROLE_VALUES = Object.values(USER_ROLES) as UserRoleName[];
export const DEFAULT_USER_ROLE = USER_ROLES.JOB_SEEKER;

export enum Permission {
  VIEW_USERS = 'view:users',
  CREATE_USER = 'create:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',

  VIEW_JOBS = 'view:jobs',
  CREATE_JOB = 'create:job',
  UPDATE_JOB = 'update:job',
  DELETE_JOB = 'delete:job',

  VIEW_APPLICATIONS = 'view:applications',
  CREATE_APPLICATION = 'create:application',
  UPDATE_APPLICATION = 'update:application',
  DELETE_APPLICATION = 'delete:application',

  VIEW_FREELANCE = 'view:freelance',
  CREATE_FREELANCE = 'create:freelance',
  UPDATE_FREELANCE = 'update:freelance',
  DELETE_FREELANCE = 'delete:freelance',

  VIEW_ANALYTICS = 'view:analytics',
  MANAGE_ROLES = 'manage:roles',
  VIEW_AUDIT_LOGS = 'view:audit:logs',

  EXPORT_USER_DATA = 'export:user:data',
  DELETE_USER_ACCOUNT = 'delete:user:account',
  VIEW_CONSENTS = 'view:consents',
  UPDATE_CONSENTS = 'update:consents',
  CONVERT_CURRENCY = 'convert:currency',
  VIEW_CURRENCIES = 'view:currencies',
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.VIEW_JOBS,
    Permission.CREATE_JOB,
    Permission.UPDATE_JOB,
    Permission.DELETE_JOB,
    Permission.VIEW_APPLICATIONS,
    Permission.CREATE_APPLICATION,
    Permission.UPDATE_APPLICATION,
    Permission.DELETE_APPLICATION,
    Permission.VIEW_FREELANCE,
    Permission.CREATE_FREELANCE,
    Permission.UPDATE_FREELANCE,
    Permission.DELETE_FREELANCE,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_ROLES,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_USER_DATA,
    Permission.DELETE_USER_ACCOUNT,
    Permission.VIEW_CONSENTS,
    Permission.UPDATE_CONSENTS,
    Permission.CONVERT_CURRENCY,
  ],
  [UserRole.EMPLOYER]: [
    Permission.VIEW_JOBS,
    Permission.CREATE_JOB,
    Permission.UPDATE_JOB,
    Permission.DELETE_JOB,
    Permission.VIEW_APPLICATIONS,
    Permission.CREATE_APPLICATION,
    Permission.UPDATE_APPLICATION,
    Permission.DELETE_APPLICATION,
    Permission.VIEW_FREELANCE,
    Permission.CREATE_FREELANCE,
  ],
  [UserRole.FREELANCER]: [
    Permission.VIEW_JOBS,
    Permission.VIEW_APPLICATIONS,
    Permission.CREATE_APPLICATION,
    Permission.VIEW_FREELANCE,
    Permission.CREATE_FREELANCE,
  ],
  [UserRole.JOB_SEEKER]: [
    Permission.VIEW_JOBS,
    Permission.VIEW_APPLICATIONS,
    Permission.CREATE_APPLICATION,
  ],
};