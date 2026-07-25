import { evaluateDeployment } from './deployment-policy';
import type { DeploymentContext, WorkflowRunEvent } from './types';

const GOOD_SHA = 'a'.repeat(40);

function successfulMainRun(overrides: Partial<WorkflowRunEvent> = {}): WorkflowRunEvent {
  return {
    conclusion: 'success',
    event: 'push',
    headBranch: 'main',
    headSha: GOOD_SHA,
    ...overrides,
  };
}

function workflowRunContext(run?: WorkflowRunEvent): DeploymentContext {
  return { eventName: 'workflow_run', workflowRun: run, allowManualDeploy: false };
}

describe('evaluateDeployment — workflow_run', () => {
  it('allows deployment for a successful push-triggered CI run on main', () => {
    const decision = evaluateDeployment(workflowRunContext(successfulMainRun()));
    expect(decision.allowed).toBe(true);
    expect(decision.sha).toBe(GOOD_SHA);
  });

  it('rejects pull-request deployment even when CI succeeded', () => {
    const decision = evaluateDeployment(
      workflowRunContext(successfulMainRun({ event: 'pull_request' })),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('pull request');
  });

  it('rejects failed CI runs', () => {
    const decision = evaluateDeployment(
      workflowRunContext(successfulMainRun({ conclusion: 'failure' })),
    );
    expect(decision.allowed).toBe(false);
  });

  it('rejects cancelled CI runs', () => {
    const decision = evaluateDeployment(
      workflowRunContext(successfulMainRun({ conclusion: 'cancelled' })),
    );
    expect(decision.allowed).toBe(false);
  });

  it('rejects deployment from feature branches', () => {
    const decision = evaluateDeployment(
      workflowRunContext(successfulMainRun({ headBranch: 'feat/ci-cd-pipeline-nathnael' })),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('main');
  });

  it('rejects a missing or short head SHA', () => {
    expect(
      evaluateDeployment(workflowRunContext(successfulMainRun({ headSha: undefined }))).allowed,
    ).toBe(false);
    expect(
      evaluateDeployment(workflowRunContext(successfulMainRun({ headSha: 'abc123' }))).allowed,
    ).toBe(false);
  });

  it('handles missing event properties without throwing', () => {
    expect(evaluateDeployment(workflowRunContext(undefined)).allowed).toBe(false);
    expect(evaluateDeployment(workflowRunContext({})).allowed).toBe(false);
    expect(evaluateDeployment(workflowRunContext({ conclusion: 'success' })).allowed).toBe(false);
  });
});

describe('evaluateDeployment — workflow_dispatch', () => {
  it('accepts approved manual staging deployment when enabled and on main', () => {
    const decision = evaluateDeployment({
      eventName: 'workflow_dispatch',
      allowManualDeploy: true,
      ref: 'refs/heads/main',
    });
    expect(decision.allowed).toBe(true);
  });

  it('rejects manual deployment when not enabled', () => {
    const decision = evaluateDeployment({
      eventName: 'workflow_dispatch',
      allowManualDeploy: false,
      ref: 'refs/heads/main',
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects manual deployment from a feature branch ref', () => {
    const decision = evaluateDeployment({
      eventName: 'workflow_dispatch',
      allowManualDeploy: true,
      ref: 'refs/heads/feat/ci-cd-pipeline-nathnael',
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('evaluateDeployment — other events', () => {
  it.each(['pull_request', 'pull_request_target', 'push', 'schedule', ''])(
    'rejects event %j outright',
    (eventName) => {
      const decision = evaluateDeployment({ eventName, allowManualDeploy: true });
      expect(decision.allowed).toBe(false);
    },
  );
});
