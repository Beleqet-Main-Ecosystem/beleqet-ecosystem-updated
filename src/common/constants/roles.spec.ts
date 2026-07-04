import { describe, expect, it } from '@jest/globals';
import { DEFAULT_USER_ROLE, ROLE_VALUES, USER_ROLES } from './roles';

describe('roles constants', () => {
  it('exposes the expected role names', () => {
    expect(USER_ROLES).toEqual({
      ADMIN: 'ADMIN',
      EMPLOYER: 'EMPLOYER',
      JOB_SEEKER: 'JOB_SEEKER',
      FREELANCER: 'FREELANCER',
    });
  });

  it('includes all supported roles in a flat list', () => {
    expect(ROLE_VALUES).toEqual([
      'ADMIN',
      'EMPLOYER',
      'JOB_SEEKER',
      'FREELANCER',
    ]);
  });

  it('uses job seeker as the default role', () => {
    expect(DEFAULT_USER_ROLE).toBe('JOB_SEEKER');
  });
});
