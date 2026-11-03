import { alertMatches } from './job-alert-match';

describe('alertMatches', () => {
  const job = { title: 'Senior Accountant', tags: ['IFRS'], description: 'Month-end close', location: 'Addis Ababa', type: 'FULL_TIME', salaryMin: 25000, salaryMax: 32000 };
  const none = { keywords: [], location: null, jobType: null, minSalary: null };

  it('matches a keyword in the title, tags or description, ignoring case', () => {
    expect(alertMatches({ ...none, keywords: ['accountant'] }, job)).toBe(true);
    expect(alertMatches({ ...none, keywords: ['ifrs'] }, job)).toBe(true);
    expect(alertMatches({ ...none, keywords: ['nurse'] }, job)).toBe(false);
  });

  it('needs every criterion the alert sets', () => {
    expect(alertMatches({ ...none, keywords: ['accountant'], location: 'addis' }, job)).toBe(true);
    expect(alertMatches({ ...none, keywords: ['accountant'], location: 'Adama' }, job)).toBe(false);
    expect(alertMatches({ ...none, jobType: 'PART_TIME' }, job)).toBe(false);
  });

  it('checks the minimum against the top of the range, and skips jobs with no salary', () => {
    expect(alertMatches({ ...none, minSalary: 30000 }, job)).toBe(true);
    expect(alertMatches({ ...none, minSalary: 40000 }, job)).toBe(false);
    expect(alertMatches({ ...none, minSalary: 1000 }, { ...job, salaryMin: null, salaryMax: null })).toBe(false);
  });
});
