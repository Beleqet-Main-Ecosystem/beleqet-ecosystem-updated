import { create } from 'zustand';
import type { ExtractedResume } from '../api/resume';

/** A CV read by Resume Brain, waiting for CV Maker to pick it up (like the website's sessionStorage hand-off). */
export const useCvImport = create<{ pending: ExtractedResume | null; set: (cv: ExtractedResume | null) => void }>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));
