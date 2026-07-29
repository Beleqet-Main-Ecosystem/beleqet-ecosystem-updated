type ApprovalState = {
    employerApprovedAt?: Date | null;
    freelancerApprovedAt?: Date | null;
};
export declare function applyMilestoneConfirmation(state: ApprovalState, actor: 'EMPLOYER' | 'FREELANCER', confirmedAt?: Date): ApprovalState;
export declare function isMilestoneFullyConfirmed(state: ApprovalState): boolean;
export {};
