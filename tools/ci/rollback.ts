/**
 * Rollback-target selection.
 *
 * The deploy script records the SHA of every healthy deployment in a state
 * file on the staging server (one line, the full commit SHA). When a new
 * deployment fails its health checks, the previous healthy SHA is the only
 * acceptable container-rollback target. This module owns that decision so it
 * can be unit-tested; `scripts/deploy/rollback.sh` applies the same rules on
 * the server.
 */

import { isValidImageSha } from './image-tag';
import type { RollbackSelection } from './types';

/**
 * Select the container-rollback target from recorded deployment state.
 *
 * @param recordedSha Raw content of the last-successful-deployment state file
 *                    (undefined when no deployment has ever succeeded).
 * @param failingSha  SHA of the deployment that just failed health checks.
 * @returns The previous healthy SHA, or a refusal with a log-safe reason.
 */
export function selectRollbackTarget(
  recordedSha: string | undefined,
  failingSha: string,
): RollbackSelection {
  if (recordedSha === undefined || recordedSha.trim() === '') {
    return {
      ok: false,
      reason: 'No previous successful deployment is recorded; container rollback is impossible',
    };
  }
  const candidate = recordedSha.trim();
  if (!isValidImageSha(candidate)) {
    return {
      ok: false,
      reason: 'Recorded deployment state is not a valid 40-character commit SHA; refusing rollback',
    };
  }
  if (candidate === failingSha) {
    return {
      ok: false,
      reason: 'Recorded SHA equals the failing SHA; rolling back to it would change nothing',
    };
  }
  return { ok: true, sha: candidate, reason: `Rolling back containers to ${candidate}` };
}
