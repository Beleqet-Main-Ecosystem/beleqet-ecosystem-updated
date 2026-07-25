import type { Candidate } from '../interfaces/candidate.interface';
import { SanitizerService } from '../services/sanitizer.service';

describe('SanitizerService', () => {
  let service: SanitizerService;

  const baseCandidate: Candidate = {
    id: 'cand_1',
    freelancerId: 'fl_abc123',
    title: 'Senior Fullstack Developer',
    bio: 'I am a software developer with 8 years of experience.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    experienceYears: 8,
    hourlyRate: 50,
    portfolioUrls: ['https://github.com/user'],
    pastProjects: [
      {
        title: 'E-commerce Platform',
        description: 'Built a scalable e-commerce platform using React and Node.js.',
        skillsUsed: ['React', 'Node.js', 'PostgreSQL'],
        durationMonths: 12,
      },
    ],
    consentGiven: true,
  };

  beforeEach(() => {
    service = new SanitizerService();
  });

  describe('sanitize', () => {
    it('should replace freelancerId with a sessionToken', async () => {
      const profile = await service.sanitize(baseCandidate);

      expect(profile.sessionToken).toBeDefined();
      expect(profile.sessionToken).not.toBe(baseCandidate.freelancerId);
      expect(profile.sessionToken).toMatch(/^candidate_/);
    });

    it('should retain skills, title, and experienceYears unchanged', async () => {
      const profile = await service.sanitize(baseCandidate);

      expect(profile.title).toBe('Senior Fullstack Developer');
      expect(profile.skills).toEqual(['React', 'Node.js', 'TypeScript', 'PostgreSQL']);
      expect(profile.experienceYears).toBe(8);
    });

    it('should redact emails in bio with [REDACTED]', async () => {
      const candidate: Candidate = {
        ...baseCandidate,
        bio: 'Contact me at john.doe@example.com for more details.',
      };

      const profile = await service.sanitize(candidate);

      expect(profile.bioSummary).toBe('[REDACTED]');
    });

    it('should redact phone numbers in bio with [REDACTED]', async () => {
      const candidate: Candidate = {
        ...baseCandidate,
        bio: 'Call me at +251911234567.',
      };

      const profile = await service.sanitize(candidate);

      expect(profile.bioSummary).toBe('[REDACTED]');
    });

    it('should redact emails in pastProjects with [REDACTED]', async () => {
      const candidate: Candidate = {
        ...baseCandidate,
        pastProjects: [
          {
            title: 'Project X',
            description: 'Contact: dev@example.com for reference.',
            skillsUsed: ['React'],
            durationMonths: 6,
          },
        ],
      };

      const profile = await service.sanitize(candidate);

      expect(profile.pastProjectsSummary[0]).toBe('[REDACTED]');
    });

    it('should redact phone numbers in pastProjects with [REDACTED]', async () => {
      const candidate: Candidate = {
        ...baseCandidate,
        pastProjects: [
          {
            title: 'Project X',
            description: 'Reach out at +1-555-123-4567.',
            skillsUsed: ['React'],
            durationMonths: 6,
          },
        ],
      };

      const profile = await service.sanitize(candidate);

      expect(profile.pastProjectsSummary[0]).toBe('[REDACTED]');
    });

    it('should keep clean text without PII unchanged', async () => {
      const cleanBio = 'Experienced full-stack developer with a focus on React and Node.js.';
      const candidate: Candidate = {
        ...baseCandidate,
        bio: cleanBio,
        pastProjects: [
          {
            title: 'Clean Project',
            description: 'A standard software project with no contact details.',
            skillsUsed: ['TypeScript'],
            durationMonths: 3,
          },
        ],
      };

      const profile = await service.sanitize(candidate);

      expect(profile.bioSummary).toBe(cleanBio);
      expect(profile.pastProjectsSummary[0]).toBe(
        'Clean Project: A standard software project with no contact details.',
      );
    });

    it('should not expose freelancerId in the output profile', async () => {
      const profile = await service.sanitize(baseCandidate);

      expect(profile).not.toHaveProperty('freelancerId');
    });
  });

  describe('getMapping', () => {
    it('should store and retrieve a CandidateTokenMapping', async () => {
      await service.sanitize(baseCandidate);

      const allMappings = service.getAllMappings();
      expect(allMappings).toHaveLength(1);

      const mapping = allMappings[0];
      expect(mapping.freelancerId).toBe('fl_abc123');
      expect(mapping.sessionToken).toMatch(/^candidate_/);

      const retrieved = service.getMapping(mapping.sessionToken);
      expect(retrieved).toEqual(mapping);
    });

    it('should return undefined for unknown session tokens', () => {
      const result = service.getMapping('nonexistent_token');

      expect(result).toBeUndefined();
    });
  });

  describe('sanitizeBatch', () => {
    it('should sanitize all candidates and create mappings for each', async () => {
      const candidates: Candidate[] = [
        baseCandidate,
        { ...baseCandidate, freelancerId: 'fl_def456', id: 'cand_2' },
      ];

      const profiles = await service.sanitizeBatch(candidates);

      expect(profiles).toHaveLength(2);
      expect(service.getAllMappings()).toHaveLength(2);

      expect(profiles[0].sessionToken).not.toBe(profiles[1].sessionToken);
    });

    it('should return an empty array when given no candidates', async () => {
      const profiles = await service.sanitizeBatch([]);

      expect(profiles).toEqual([]);
    });
  });
});
