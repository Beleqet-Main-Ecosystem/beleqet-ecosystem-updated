/**
 * Image-tag helpers: build and validate the container image references the
 * pipeline pushes to GHCR and the staging server pulls.
 *
 * Staging images are addressed by the exact 40-character Git commit SHA so a
 * deployment is always traceable to the tested commit; the mutable `staging`
 * alias is applied only after a deployment passes its health checks.
 */

/** The stable alias applied to the most recent healthy staging deployment. */
export const STAGING_ALIAS = 'staging';

/** True when the value is a full lowercase 40-character Git commit SHA. */
export function isValidImageSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value);
}

/**
 * True when the value is safe to use as a Docker tag AND to interpolate into
 * shell commands: alphanumerics, `.`, `_`, `-`, max 128 chars, must start with
 * an alphanumeric. This intentionally rejects every shell metacharacter.
 */
export function isSafeImageTag(value: string): boolean {
  return /^[0-9a-zA-Z][0-9a-zA-Z._-]{0,127}$/.test(value);
}

/**
 * Build the deterministic image reference for a service at a commit.
 *
 * @param registry   Registry host, e.g. `ghcr.io`.
 * @param repository Image repository, e.g. `nathnaelmesfin/beleqet-backend`.
 *                   Uppercase is normalized to lowercase (GHCR requirement).
 * @param sha        Full 40-character Git commit SHA.
 * @throws Error when any component is malformed or unsafe. The message names
 *         the component but does not echo untrusted content back verbatim.
 */
export function buildImageRef(registry: string, repository: string, sha: string): string {
  if (!/^[0-9a-z.-]+(:\d+)?$/.test(registry)) {
    throw new Error('Invalid registry host');
  }
  const repo = repository.toLowerCase();
  if (!/^[0-9a-z]+([._/-][0-9a-z]+)*$/.test(repo)) {
    throw new Error('Invalid image repository');
  }
  if (!isValidImageSha(sha)) {
    throw new Error('Invalid image tag: expected a full 40-character commit SHA');
  }
  return `${registry}/${repo}:${sha}`;
}

/**
 * Build the mutable staging-alias reference for a service.
 * Same validation as {@link buildImageRef}, with the fixed `staging` tag.
 */
export function buildStagingAliasRef(registry: string, repository: string): string {
  if (!/^[0-9a-z.-]+(:\d+)?$/.test(registry)) {
    throw new Error('Invalid registry host');
  }
  const repo = repository.toLowerCase();
  if (!/^[0-9a-z]+([._/-][0-9a-z]+)*$/.test(repo)) {
    throw new Error('Invalid image repository');
  }
  return `${registry}/${repo}:${STAGING_ALIAS}`;
}
