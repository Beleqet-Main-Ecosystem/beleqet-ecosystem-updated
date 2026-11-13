import type { ApplicationStatus } from '@/features/dashboard/api';

/** The four steps an application shows, in order. */
export const STAGES = ['sent', 'reviewed', 'shortlisted', 'interview'] as const;
export type Stage = (typeof STAGES)[number];

/** How far an application got, and whether it ended (not selected, withdrawn). */
export function stageOf(status: ApplicationStatus): { reached: number; ended: boolean } {
  switch (status) {
    case 'SUBMITTED':
      return { reached: 0, ended: false };
    case 'SCREENING':
      return { reached: 1, ended: false };
    case 'SHORTLISTED':
      return { reached: 2, ended: false };
    case 'INTERVIEW_SCHEDULED':
    case 'OFFERED':
      return { reached: 3, ended: false };
    case 'REJECTED':
      return { reached: 1, ended: true };
    case 'WITHDRAWN':
    default:
      return { reached: 0, ended: true };
  }
}
