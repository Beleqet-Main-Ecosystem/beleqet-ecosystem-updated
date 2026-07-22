import { selectRollbackTarget } from './rollback';

const PREVIOUS_SHA = 'b'.repeat(40);
const FAILING_SHA = 'c'.repeat(40);

describe('selectRollbackTarget', () => {
  it('selects the last successful image SHA', () => {
    const selection = selectRollbackTarget(PREVIOUS_SHA, FAILING_SHA);
    expect(selection.ok).toBe(true);
    expect(selection.sha).toBe(PREVIOUS_SHA);
  });

  it('tolerates surrounding whitespace from the state file', () => {
    const selection = selectRollbackTarget(`  ${PREVIOUS_SHA}\n`, FAILING_SHA);
    expect(selection.ok).toBe(true);
    expect(selection.sha).toBe(PREVIOUS_SHA);
  });

  it('refuses rollback when no valid previous deployment exists', () => {
    expect(selectRollbackTarget(undefined, FAILING_SHA).ok).toBe(false);
    expect(selectRollbackTarget('', FAILING_SHA).ok).toBe(false);
    expect(selectRollbackTarget('   \n', FAILING_SHA).ok).toBe(false);
  });

  it('does not select the currently failing SHA', () => {
    const selection = selectRollbackTarget(FAILING_SHA, FAILING_SHA);
    expect(selection.ok).toBe(false);
    expect(selection.sha).toBeUndefined();
    expect(selection.reason).toContain('failing SHA');
  });

  it('rejects an invalid stored SHA', () => {
    expect(selectRollbackTarget('not-a-sha', FAILING_SHA).ok).toBe(false);
    expect(selectRollbackTarget('abc123', FAILING_SHA).ok).toBe(false);
    expect(selectRollbackTarget(`${PREVIOUS_SHA}$(id)`, FAILING_SHA).ok).toBe(false);
  });
});
