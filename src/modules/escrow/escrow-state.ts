type ApprovalState = {
  employerApprovedAt?: Date | null;
  freelancerApprovedAt?: Date | null;
};

export function applyMilestoneConfirmation(
  state: ApprovalState,
  actor: 'EMPLOYER' | 'FREELANCER',
  confirmedAt = new Date(),
): ApprovalState {
  return {
    employerApprovedAt:
      actor === 'EMPLOYER' ? (state.employerApprovedAt ?? confirmedAt) : state.employerApprovedAt,
    freelancerApprovedAt:
      actor === 'FREELANCER'
        ? (state.freelancerApprovedAt ?? confirmedAt)
        : state.freelancerApprovedAt,
  };
}

export function isMilestoneFullyConfirmed(state: ApprovalState): boolean {
  return Boolean(state.employerApprovedAt && state.freelancerApprovedAt);
}
