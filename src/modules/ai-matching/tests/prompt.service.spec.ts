import type { JobSummary } from '../interfaces/job.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import { PromptService } from '../services/prompt.service';

describe('PromptService', () => {
  let service: PromptService;

  const mockJob: JobSummary = {
    title: 'Senior React Developer',
    description: 'Build and maintain React applications.',
    requiredSkills: ['React', 'TypeScript', 'Node.js'],
    preferredSkills: ['GraphQL'],
    locale: 'en',
  };

  const mockCandidate: LlmCandidateProfile = {
    sessionToken: 'candidate_token_1',
    title: 'Fullstack Developer',
    bioSummary: 'Experienced with React and Node.js.',
    skills: ['React', 'Node.js', 'JavaScript'],
    experienceYears: 5,
    pastProjectsSummary: ['Project A: built a web app'],
  };

  beforeEach(() => {
    service = new PromptService();
  });

  describe('buildEvaluationPrompt', () => {
    it('should interpolate all job variables into the user prompt', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');

      expect(prompt.userPrompt).toContain('Senior React Developer');
      expect(prompt.userPrompt).toContain('Build and maintain React applications.');
      expect(prompt.userPrompt).toContain('react, typescript, node.js');
    });

    it('should interpolate all candidate variables into the user prompt', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');

      expect(prompt.userPrompt).toContain('Fullstack Developer');
      expect(prompt.userPrompt).toContain('Experienced with React and Node.js.');
      expect(prompt.userPrompt).toContain('react, node.js, javascript');
      expect(prompt.userPrompt).toContain('5');
      expect(prompt.userPrompt).toContain('project a: built a web app');
    });

    it('should return the system prompt unchanged', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');

      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.systemPrompt.length).toBeGreaterThan(0);
    });

    it('should return the requiredVariables list', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');

      expect(prompt.requiredVariables).toBeDefined();
      expect(prompt.requiredVariables.length).toBeGreaterThan(0);
    });

    it('should fall back to English when locale is unsupported', () => {
      const enPrompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');
      const frPrompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'fr');

      expect(frPrompt.systemPrompt).toBe(enPrompt.systemPrompt);
      expect(frPrompt.userPrompt).toContain('Senior React Developer');
    });

    it('should handle missing candidate bio gracefully', () => {
      const candidateWithoutBio: LlmCandidateProfile = {
        ...mockCandidate,
        bioSummary: '',
      };

      const prompt = service.buildEvaluationPrompt(mockJob, candidateWithoutBio, 'en');

      expect(prompt.userPrompt).not.toContain('undefined');
      expect(prompt.userPrompt).not.toContain('null');
    });

    it('should handle missing job description gracefully', () => {
      const jobWithoutDesc: JobSummary = {
        ...mockJob,
        description: '',
      };

      const prompt = service.buildEvaluationPrompt(jobWithoutDesc, mockCandidate, 'en');

      expect(prompt.userPrompt).not.toContain('undefined');
      expect(prompt.userPrompt).not.toContain('null');
    });

    it('should handle empty skills arrays', () => {
      const candidateNoSkills: LlmCandidateProfile = {
        ...mockCandidate,
        skills: [],
      };

      const prompt = service.buildEvaluationPrompt(mockJob, candidateNoSkills, 'en');

      expect(prompt.userPrompt).not.toContain('undefined');
    });

    it('should handle amharic locale', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'am');

      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userPrompt).toContain('Senior React Developer');
    });

    it('should normalize skills via normalizeTextArray', () => {
      const candidateWithMessy: LlmCandidateProfile = {
        ...mockCandidate,
        skills: ['  React ', ' TypeScript  '],
      };

      const prompt = service.buildEvaluationPrompt(mockJob, candidateWithMessy, 'en');

      expect(prompt.userPrompt).toContain('react, typescript');
    });

    it('should not leave any {{variable}} placeholders unresolved', () => {
      const prompt = service.buildEvaluationPrompt(mockJob, mockCandidate, 'en');

      expect(prompt.userPrompt).not.toMatch(/\{\{/);
    });
  });
});
