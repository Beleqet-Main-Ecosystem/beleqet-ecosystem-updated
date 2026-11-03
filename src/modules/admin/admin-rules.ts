import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * Rules for what one admin may do to another account or a listing. Kept apart from the
 * controller so each rule has a direct test.
 */

type Account = { id: string; role: string; isActive: boolean };
type Change = { role?: string; isActive?: boolean };

/** True when the change would take admin access away from, or suspend, an active admin. */
export function removesAdmin(target: Account, change: Change): boolean {
  if (target.role !== 'ADMIN' || !target.isActive) return false;
  return (change.role !== undefined && change.role !== 'ADMIN') || change.isActive === false;
}

/**
 * Admins can't lock themselves out, and the platform always keeps one active admin.
 * `activeAdmins` counts active admins including the target.
 */
export function assertAccountChangeAllowed(
  actorId: string,
  target: Account,
  change: Change,
  activeAdmins: number,
): void {
  if (target.id === actorId && removesAdmin(target, change)) {
    throw new BadRequestException(
      'You can’t remove your own admin access or suspend yourself. Ask another admin.',
    );
  }
  if (removesAdmin(target, change) && activeAdmins <= 1) {
    throw new ConflictException('This is the last active admin. Make someone else an admin first.');
  }
}

/** Deleting or erasing: never yourself, never the last active admin. */
export function assertRemovalAllowed(actorId: string, target: Account, activeAdmins: number): void {
  if (target.id === actorId) {
    throw new BadRequestException('You can’t delete your own account here.');
  }
  if (target.role === 'ADMIN' && target.isActive && activeAdmins <= 1) {
    throw new ConflictException('This is the last active admin. Make someone else an admin first.');
  }
}

/**
 * Moderation only takes listings down. There is no review queue: jobs and projects go live
 * when their owner publishes them, and an admin can't know whether an archived or cancelled
 * listing was closed by its owner, so nothing is brought back from here.
 */
export const JOB_TAKE_DOWN = 'ARCHIVED';
export const GIG_TAKE_DOWN = 'CANCELLED';

export function assertJobModeration(current: string, next: string): void {
  if (next !== JOB_TAKE_DOWN) {
    throw new BadRequestException('Admins can only take a job down.');
  }
  if (current === JOB_TAKE_DOWN) {
    throw new ConflictException('This job is already taken down.');
  }
}

export function assertGigModeration(current: string, next: string): void {
  if (next !== GIG_TAKE_DOWN) {
    throw new BadRequestException('Admins can only take a project down.');
  }
  if (current === GIG_TAKE_DOWN || current === 'COMPLETED') {
    throw new ConflictException('This project is already closed.');
  }
  // Funded and in-progress projects hold escrow money; cancelling would strand it.
  if (current === 'FUNDED' || current === 'IN_PROGRESS') {
    throw new ConflictException(
      'This project holds money in escrow. Settle it through a dispute instead.',
    );
  }
}
