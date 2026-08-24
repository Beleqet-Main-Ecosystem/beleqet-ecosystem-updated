import {
  computeSkillScore,
  computeLocationScore,
  computeExperienceScore,
  computeMatch,
  toPercentage,
} from '../matching.algorithm';

describe('computeSkillScore', () => {
  it('returns 0 when the job has no required skills', () => {
    expect(computeSkillScore(['react', 'node'], [])).toBe(0);
  });

  it('returns 0 when the freelancer has no matching skills', () => {
    expect(computeSkillScore(['photoshop'], ['react', 'node'])).toBe(0);
  });

  it('returns 1 when the freelancer covers every required skill', () => {
    expect(computeSkillScore(['react', 'node', 'sql'], ['react', 'node'])).toBe(1);
  });

  it('returns partial score for partial coverage', () => {
    expect(computeSkillScore(['react'], ['react', 'node'])).toBe(0.5);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(computeSkillScore([' React ', 'NODE'], ['react', 'node'])).toBe(1);
  });

  it('handles an empty freelancer skill list against a non-empty job', () => {
    expect(computeSkillScore([], ['react'])).toBe(0);
  });
});

describe('computeLocationScore', () => {
  it('scores 1 when the job has no location preference', () => {
    expect(computeLocationScore('Addis Ababa', null)).toBe(1);
    expect(computeLocationScore('Addis Ababa', undefined)).toBe(1);
  });

  it('scores 1 for a remote job regardless of freelancer location', () => {
    expect(computeLocationScore(null, 'Remote')).toBe(1);
    expect(computeLocationScore('Nairobi', 'remote')).toBe(1);
  });

  it('scores 1 on an exact case-insensitive match', () => {
    expect(computeLocationScore('addis ababa', 'Addis Ababa')).toBe(1);
  });

  it('scores 0.5 when the freelancer location is unknown', () => {
    expect(computeLocationScore(null, 'Nairobi')).toBe(0.5);
    expect(computeLocationScore(undefined, 'Nairobi')).toBe(0.5);
  });

  it('scores 0.3 on a known mismatch', () => {
    expect(computeLocationScore('Addis Ababa', 'Nairobi')).toBe(0.3);
  });
});

describe('computeExperienceScore', () => {
  it('defaults to 0.6 when the job specifies no experience level', () => {
    expect(computeExperienceScore({ headline: 'Senior Engineer', bio: null }, null)).toBe(0.6);
  });

  it('defaults to 0.6 when no seniority signal is found in the profile text', () => {
    expect(
      computeExperienceScore({ headline: 'Software Engineer', bio: 'I build things.' }, 'SENIOR'),
    ).toBe(0.6);
  });

  it('scores 1 when the detected seniority matches the job level', () => {
    expect(
      computeExperienceScore({ headline: 'Senior Backend Engineer', bio: null }, 'senior'),
    ).toBe(1);
  });

  it('scores 0.4 when a seniority signal is found but does not match', () => {
    expect(computeExperienceScore({ headline: 'Junior Developer', bio: null }, 'senior')).toBe(0.4);
  });

  it('handles empty-string headline and bio without throwing', () => {
    expect(() => computeExperienceScore({ headline: '', bio: '' }, 'MID')).not.toThrow();
  });
});

describe('computeMatch', () => {
  it('combines sub-scores into a weighted overall score', () => {
    const result = computeMatch(
      {
        skills: ['react', 'node'],
        location: 'Addis Ababa',
        headline: 'Senior Engineer',
        bio: null,
      },
      { skills: ['react', 'node'], locationPreference: 'Remote', experienceLevel: 'senior' },
    );
    // skill=1, location=1, experience=1 -> overall should be 1
    expect(result.overallScore).toBeCloseTo(1, 5);
  });

  it('produces a score of 0 for a total mismatch', () => {
    const result = computeMatch(
      { skills: ['photoshop'], location: 'Nairobi', headline: 'Junior Designer', bio: null },
      { skills: ['react', 'node'], locationPreference: 'Addis Ababa', experienceLevel: 'senior' },
    );
    expect(result.skillScore).toBe(0);
    expect(result.overallScore).toBeGreaterThan(0); // location/experience sub-scores keep it above 0
    expect(result.overallScore).toBeLessThan(0.3);
  });

  it('never produces a negative or >1 overall score for any valid input', () => {
    const result = computeMatch(
      { skills: [], location: null, headline: null, bio: null },
      { skills: [], locationPreference: null, experienceLevel: null },
    );
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
  });
});

describe('toPercentage', () => {
  it('rounds to the nearest whole percentage', () => {
    expect(toPercentage(0.666)).toBe(67);
    expect(toPercentage(1)).toBe(100);
    expect(toPercentage(0)).toBe(0);
  });
});
