/**
 * Deployment policy: decides whether a workflow event is allowed to trigger a
 * staging deployment.
 *
 * The rules mirror the guards in `.github/workflows/deploy-staging.yml` and are
 * unit-tested here so the policy is verifiable outside GitHub:
 *
 * - `workflow_run` deploys only when the upstream CI run concluded `success`,
 *   was triggered by a `push`, and ran against `main` with a valid commit SHA.
 * - `workflow_dispatch` deploys only when manual deploys are enabled and the
 *   dispatch ref is `main`.
 * - Everything else — pull requests, failed or cancelled runs, feature
 *   branches, unknown events — is refused.
 */

import type { DeploymentContext, DeploymentDecision, WorkflowRunEvent } from './types';
import { isValidImageSha } from './image-tag';

/** The only branch staging may deploy from. */
const DEPLOYABLE_BRANCH = 'main';

function refuse(reason: string): DeploymentDecision {
  return { allowed: false, reason };
}

function evaluateWorkflowRun(run: WorkflowRunEvent | undefined): DeploymentDecision {
  if (run === undefined) {
    return refuse('workflow_run event carries no run payload');
  }
  if (run.conclusion !== 'success') {
    return refuse(`upstream CI conclusion is "${run.conclusion ?? 'absent'}", not "success"`);
  }
  if (run.event === 'pull_request') {
    return refuse('upstream CI ran for a pull request; pull requests never deploy');
  }
  if (run.event !== 'push') {
    return refuse(`upstream CI event is "${run.event ?? 'absent'}", not "push"`);
  }
  if (run.headBranch !== DEPLOYABLE_BRANCH) {
    return refuse(
      `upstream CI branch is "${run.headBranch ?? 'absent'}", only "${DEPLOYABLE_BRANCH}" deploys`,
    );
  }
  if (run.headSha === undefined || !isValidImageSha(run.headSha)) {
    return refuse('upstream CI head SHA is missing or not a full 40-character commit SHA');
  }
  return {
    allowed: true,
    sha: run.headSha,
    reason: `CI succeeded for push to ${DEPLOYABLE_BRANCH} at ${run.headSha}`,
  };
}

/**
 * Decide whether the given workflow context may deploy to staging.
 *
 * Missing or malformed event properties are treated as refusals, never as
 * errors — the function is total over its input type.
 */
export function evaluateDeployment(context: DeploymentContext): DeploymentDecision {
  switch (context.eventName) {
    case 'workflow_run':
      return evaluateWorkflowRun(context.workflowRun);
    case 'workflow_dispatch': {
      if (!context.allowManualDeploy) {
        return refuse('manual staging deployment is not enabled');
      }
      if (context.ref !== `refs/heads/${DEPLOYABLE_BRANCH}` && context.ref !== DEPLOYABLE_BRANCH) {
        return refuse(
          `manual deploys are restricted to "${DEPLOYABLE_BRANCH}" (got "${context.ref ?? 'absent'}")`,
        );
      }
      return {
        allowed: true,
        reason: 'approved manual staging deployment from main',
      };
    }
    case 'pull_request':
    case 'pull_request_target':
      return refuse('pull request events never deploy');
    default:
      return refuse(`event "${context.eventName}" is not a permitted deployment trigger`);
  }
}
