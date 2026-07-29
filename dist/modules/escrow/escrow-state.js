"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMilestoneConfirmation = applyMilestoneConfirmation;
exports.isMilestoneFullyConfirmed = isMilestoneFullyConfirmed;
function applyMilestoneConfirmation(state, actor, confirmedAt = new Date()) {
    return {
        employerApprovedAt: actor === 'EMPLOYER' ? (state.employerApprovedAt ?? confirmedAt) : state.employerApprovedAt,
        freelancerApprovedAt: actor === 'FREELANCER'
            ? (state.freelancerApprovedAt ?? confirmedAt)
            : state.freelancerApprovedAt,
    };
}
function isMilestoneFullyConfirmed(state) {
    return Boolean(state.employerApprovedAt && state.freelancerApprovedAt);
}
//# sourceMappingURL=escrow-state.js.map