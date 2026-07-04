export type UserRoleType = 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER' | 'FREELANCER';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: UserRoleType[]) => import("@nestjs/common").CustomDecorator<string>;
