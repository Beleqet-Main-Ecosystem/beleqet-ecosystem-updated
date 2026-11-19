import {
  buildImageRef,
  buildStagingAliasRef,
  isSafeImageTag,
  isValidImageSha,
  STAGING_ALIAS,
} from './image-tag';

const GOOD_SHA = '389ca9eec7815ad66ba7ae8f842111958558d8b9';

describe('isValidImageSha', () => {
  it('accepts a valid 40-character git commit SHA', () => {
    expect(isValidImageSha(GOOD_SHA)).toBe(true);
  });

  it.each([
    ['short SHA', 'abc123'],
    ['41 chars', `${GOOD_SHA}0`],
    ['uppercase', GOOD_SHA.toUpperCase()],
    ['non-hex', 'z'.repeat(40)],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidImageSha(value)).toBe(false);
  });
});

describe('isSafeImageTag', () => {
  it('accepts plain tags and the staging alias', () => {
    expect(isSafeImageTag(GOOD_SHA)).toBe(true);
    expect(isSafeImageTag(STAGING_ALIAS)).toBe(true);
    expect(isSafeImageTag('v1.2.3-rc_1')).toBe(true);
  });

  it.each([
    ['shell substitution', '$(rm -rf /)'],
    ['semicolon', 'tag;ls'],
    ['backtick', '`id`'],
    ['space', 'tag name'],
    ['pipe', 'tag|cat'],
    ['leading dash', '-tag'],
    ['empty', ''],
    ['too long', 'a'.repeat(129)],
  ])('rejects unsafe tag with %s', (_label, value) => {
    expect(isSafeImageTag(value)).toBe(false);
  });
});

describe('buildImageRef', () => {
  it('produces deterministic image references', () => {
    const ref = buildImageRef('ghcr.io', 'nathnaelmesfin/beleqet-backend', GOOD_SHA);
    expect(ref).toBe(`ghcr.io/nathnaelmesfin/beleqet-backend:${GOOD_SHA}`);
    // Same inputs, same output — determinism matters for pull/rollback symmetry.
    expect(buildImageRef('ghcr.io', 'nathnaelmesfin/beleqet-backend', GOOD_SHA)).toBe(ref);
  });

  it('normalizes repository owner case (GHCR requires lowercase)', () => {
    expect(buildImageRef('ghcr.io', 'Nathnaelmesfin/Beleqet-Backend', GOOD_SHA)).toBe(
      `ghcr.io/nathnaelmesfin/beleqet-backend:${GOOD_SHA}`,
    );
  });

  it('rejects malformed tags', () => {
    expect(() => buildImageRef('ghcr.io', 'owner/repo', 'latest')).toThrow(
      /40-character commit SHA/,
    );
    expect(() => buildImageRef('ghcr.io', 'owner/repo', 'abc123')).toThrow();
  });

  it('does not permit unsafe shell characters anywhere', () => {
    expect(() => buildImageRef('ghcr.io', 'owner/repo', '$(id)')).toThrow();
    expect(() => buildImageRef('ghcr.io;evil', 'owner/repo', GOOD_SHA)).toThrow(/registry/i);
    expect(() => buildImageRef('ghcr.io', 'owner/repo$(id)', GOOD_SHA)).toThrow(/repository/i);
  });
});

describe('buildStagingAliasRef', () => {
  it('supports a stable staging alias', () => {
    expect(buildStagingAliasRef('ghcr.io', 'nathnaelmesfin/beleqet-backend')).toBe(
      'ghcr.io/nathnaelmesfin/beleqet-backend:staging',
    );
  });

  it('applies the same repository validation as buildImageRef', () => {
    expect(() => buildStagingAliasRef('ghcr.io', 'owner/repo;rm')).toThrow();
  });
});
