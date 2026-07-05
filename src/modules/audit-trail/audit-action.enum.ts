/**
 * All auditable actions across the Beleqet platform.
 * Each member represents a distinct business event captured in the audit log.
 */
export enum AuditAction {
  /** User successfully authenticated. */
  AUTH_LOGIN = 'AUTH_LOGIN',
  /** User session terminated. */
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  /** New user account created. */
  AUTH_REGISTER = 'AUTH_REGISTER',
  /** User confirmed their email address. */
  AUTH_EMAIL_VERIFIED = 'AUTH_EMAIL_VERIFIED',
  /** Password-reset link requested. Email is masked before storage. */
  AUTH_PASSWORD_RESET_REQUESTED = 'AUTH_PASSWORD_RESET_REQUESTED',
  /** Password successfully changed via reset token. */
  AUTH_PASSWORD_RESET_COMPLETED = 'AUTH_PASSWORD_RESET_COMPLETED',

  /** Escrow transaction created and payment link generated. */
  PAYMENT_ESCROW_INITIATED = 'PAYMENT_ESCROW_INITIATED',
  /** Payment gateway confirmed funds received. */
  PAYMENT_ESCROW_FUNDED = 'PAYMENT_ESCROW_FUNDED',
  /** Milestone approved and payout released to freelancer wallet. */
  PAYMENT_MILESTONE_RELEASED = 'PAYMENT_MILESTONE_RELEASED',
  /** Freelancer submitted a withdrawal request. */
  PAYMENT_WITHDRAWAL_REQUESTED = 'PAYMENT_WITHDRAWAL_REQUESTED',
  /** Withdrawal attempt rejected or rolled back. */
  PAYMENT_WITHDRAWAL_FAILED = 'PAYMENT_WITHDRAWAL_FAILED',

  /** New job listing created by an employer. */
  JOB_CREATED = 'JOB_CREATED',
  /** Existing job listing edited. */
  JOB_UPDATED = 'JOB_UPDATED',
  /** Job listing moved to published status. */
  JOB_PUBLISHED = 'JOB_PUBLISHED',
  /** Job listing removed. */
  JOB_DELETED = 'JOB_DELETED',

  /** Application status changed by employer or system. */
  APPLICATION_STATUS_CHANGED = 'APPLICATION_STATUS_CHANGED',

  /** Freelance contract created after bid acceptance. */
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  /** Contract marked as successfully completed. */
  CONTRACT_COMPLETED = 'CONTRACT_COMPLETED',
  /** Contract cancelled by either party. */
  CONTRACT_CANCELLED = 'CONTRACT_CANCELLED',
  /** Dispute raised against an active contract. */
  CONTRACT_DISPUTE_RAISED = 'CONTRACT_DISPUTE_RAISED',

  /** Bid accepted or rejected by the client. */
  BID_STATUS_CHANGED = 'BID_STATUS_CHANGED',

  /** Admin performed a user management action (activate / deactivate / role change). */
  ADMIN_USER_UPDATED = 'ADMIN_USER_UPDATED',
}
