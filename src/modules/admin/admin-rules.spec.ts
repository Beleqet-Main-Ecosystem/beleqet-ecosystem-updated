import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertAccountChangeAllowed,
  assertGigModeration,
  assertJobModeration,
  assertRemovalAllowed,
} from './admin-rules';

describe('admin rules', () => {
  const me = { id: 'me', role: 'ADMIN', isActive: true };
  const other = { id: 'other', role: 'ADMIN', isActive: true };
  const seeker = { id: 'seeker', role: 'JOB_SEEKER', isActive: true };

  describe('changing an account', () => {
    it('stops admins demoting or suspending themselves', () => {
      expect(() => assertAccountChangeAllowed('me', me, { role: 'EMPLOYER' }, 3)).toThrow(
        BadRequestException,
      );
      expect(() => assertAccountChangeAllowed('me', me, { isActive: false }, 3)).toThrow(
        BadRequestException,
      );
    });

    it('keeps the last active admin', () => {
      expect(() => assertAccountChangeAllowed('me', other, { role: 'EMPLOYER' }, 1)).toThrow(
        ConflictException,
      );
      expect(() => assertAccountChangeAllowed('me', other, { isActive: false }, 1)).toThrow(
        ConflictException,
      );
    });

    it('allows other changes', () => {
      expect(() => assertAccountChangeAllowed('me', other, { role: 'EMPLOYER' }, 2)).not.toThrow();
      expect(() => assertAccountChangeAllowed('me', seeker, { role: 'ADMIN' }, 1)).not.toThrow();
      expect(() =>
        assertAccountChangeAllowed('me', me, { role: 'ADMIN', isActive: true }, 1),
      ).not.toThrow();
      expect(() =>
        assertAccountChangeAllowed('me', { ...other, isActive: false }, { role: 'EMPLOYER' }, 1),
      ).not.toThrow();
    });
  });

  describe('removing an account', () => {
    it('refuses yourself and the last admin', () => {
      expect(() => assertRemovalAllowed('me', me, 5)).toThrow(BadRequestException);
      expect(() => assertRemovalAllowed('me', other, 1)).toThrow(ConflictException);
    });

    it('allows anyone else', () => {
      expect(() => assertRemovalAllowed('me', seeker, 1)).not.toThrow();
      expect(() => assertRemovalAllowed('me', other, 2)).not.toThrow();
    });
  });

  describe('moderation', () => {
    it('only takes jobs down, once', () => {
      expect(() => assertJobModeration('PUBLISHED', 'ARCHIVED')).not.toThrow();
      expect(() => assertJobModeration('ARCHIVED', 'PUBLISHED')).toThrow(BadRequestException);
      expect(() => assertJobModeration('ARCHIVED', 'ARCHIVED')).toThrow(ConflictException);
    });

    it('never re-opens a cancelled project', () => {
      expect(() => assertGigModeration('CANCELLED', 'OPEN')).toThrow(BadRequestException);
      expect(() => assertGigModeration('CANCELLED', 'CANCELLED')).toThrow(ConflictException);
    });

    it('takes open projects down but leaves escrow alone', () => {
      expect(() => assertGigModeration('OPEN', 'CANCELLED')).not.toThrow();
      expect(() => assertGigModeration('DRAFT', 'CANCELLED')).not.toThrow();
      expect(() => assertGigModeration('FUNDED', 'CANCELLED')).toThrow(ConflictException);
      expect(() => assertGigModeration('IN_PROGRESS', 'CANCELLED')).toThrow(ConflictException);
    });
  });
});
