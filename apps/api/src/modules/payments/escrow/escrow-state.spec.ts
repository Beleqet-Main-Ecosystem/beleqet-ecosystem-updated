import { applyMilestoneConfirmation, isMilestoneFullyConfirmed } from './escrow-state';

describe('escrow-state', () => {
  it('requires employer and freelancer confirmations before release', () => {
    const employerOnly = applyMilestoneConfirmation(
      {},
      'EMPLOYER',
      new Date('2026-07-19T00:00:00Z'),
    );

    expect(isMilestoneFullyConfirmed(employerOnly)).toBe(false);

    const both = applyMilestoneConfirmation(
      employerOnly,
      'FREELANCER',
      new Date('2026-07-19T01:00:00Z'),
    );

    expect(isMilestoneFullyConfirmed(both)).toBe(true);
  });
});
