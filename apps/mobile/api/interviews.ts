import { get, send } from '../lib/api';

export type InterviewStatus = 'SCHEDULED' | 'CONFIRMED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export type Interview = {
  id: string;
  startTime: string;
  endTime: string;
  status: InterviewStatus;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  candidateNote: string | null;
  candidateId: string;
  employerId: string;
  application: { id: string; job: { id: string; title: string; location?: string; company?: { name?: string; userId?: string } | null } };
  candidate?: { id: string; firstName: string; lastName: string };
};

export const fetchInterviews = () => get<Interview[]>('/interview-planner/interviews');
/** The candidate confirms or declines, with an optional note. */
export const respondToInterview = (id: string, response: 'CONFIRMED' | 'DECLINED', note?: string) =>
  send<Interview>('PATCH', `/interview-planner/interviews/${encodeURIComponent(id)}/respond`, { response, note });
/** The employer sets where it happens, the meeting link and notes. */
export const updateInterview = (id: string, details: { location?: string; meetingLink?: string; notes?: string }) =>
  send<Interview>('PATCH', `/interview-planner/interviews/${encodeURIComponent(id)}`, details);

export type Slot = { id: string; startTime: string; endTime: string; booked?: boolean };
export const fetchSlots = () => get<Slot[]>('/interview-planner/availability');
export const addSlot = (startTime: string, endTime: string) => send<Slot>('POST', '/interview-planner/availability', { startTime, endTime });
export const removeSlot = (id: string) => send('DELETE', `/interview-planner/availability/${encodeURIComponent(id)}`);
