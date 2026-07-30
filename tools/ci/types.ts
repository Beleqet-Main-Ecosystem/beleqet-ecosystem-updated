/**
 * Shared types for the Beleqet CI/CD helper library (`tools/ci`).
 *
 * These helpers run in GitHub Actions runner steps (via `ts-node`) — they are
 * tooling, not application runtime code, and are excluded from the NestJS
 * build output (`tsconfig.build.json`).
 */

/** Discriminates which variable set the environment validator enforces. */
export type ValidationMode = 'ci-test' | 'staging-deploy';

/** Result of validating a set of environment variables. */
export interface ValidationResult {
  /** True when every required variable is present and well-formed. */
  readonly valid: boolean;
  /**
   * Human-readable problems, one per offending variable. Messages name the
   * variable but NEVER include its value, so they are safe to print in logs.
   */
  readonly errors: readonly string[];
}

/** The subset of a `workflow_run` event the deployment guard inspects. */
export interface WorkflowRunEvent {
  /** `success`, `failure`, `cancelled`, … or undefined when absent. */
  readonly conclusion?: string;
  /** The event that triggered the upstream workflow (`push`, `pull_request`, …). */
  readonly event?: string;
  /** Branch the upstream workflow ran against. */
  readonly headBranch?: string;
  /** Full commit SHA the upstream workflow ran against. */
  readonly headSha?: string;
}

/** Input for a deployment-policy decision. */
export interface DeploymentContext {
  /** Name of the event that triggered THIS workflow. */
  readonly eventName: string;
  /** Present only when `eventName` is `workflow_run`. */
  readonly workflowRun?: WorkflowRunEvent;
  /** True when a manual `workflow_dispatch` staging deploy is permitted. */
  readonly allowManualDeploy: boolean;
  /** Ref for manual dispatches, e.g. `refs/heads/main`. */
  readonly ref?: string;
}

/** Outcome of a deployment-policy decision. */
export interface DeploymentDecision {
  readonly allowed: boolean;
  /** Exact commit SHA to deploy when allowed. */
  readonly sha?: string;
  /** Log-safe explanation of why deployment was allowed or refused. */
  readonly reason: string;
}

/** Options for the bounded HTTP health check. */
export interface HealthCheckOptions {
  /** Fully-qualified http(s) URL to probe. */
  readonly url: string;
  /** Maximum number of attempts before giving up (>= 1). */
  readonly maxAttempts: number;
  /** Per-attempt timeout in milliseconds (> 0). */
  readonly timeoutMs: number;
  /** Delay between attempts in milliseconds (>= 0). */
  readonly retryDelayMs: number;
}

/** Result of a health-check run. */
export interface HealthCheckResult {
  readonly healthy: boolean;
  /** Attempts actually performed (<= maxAttempts). */
  readonly attempts: number;
  /** Last HTTP status observed, when any response was received. */
  readonly lastStatus?: number;
  /** Log-safe description of the final outcome. */
  readonly detail: string;
}

/** Result of selecting a rollback target. */
export interface RollbackSelection {
  /** SHA of the last known-good deployment, when one is usable. */
  readonly sha?: string;
  readonly ok: boolean;
  /** Log-safe explanation. */
  readonly reason: string;
}
