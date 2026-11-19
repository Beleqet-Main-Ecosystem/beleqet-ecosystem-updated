import { EMPTY_FIELDS, fieldsFromJob, jobProblem, jobRequestBody, type JobFields, type SavedJob } from '../post-job-fields';

const filled: JobFields = {
  ...EMPTY_FIELDS,
  title: 'Accountant',
  categoryId: 'accounting-and-finance',
  location: 'Addis Ababa',
  description: 'x'.repeat(50),
};

describe('job form rules', () => {
  it('accepts a complete form', () => {
    expect(jobProblem(filled)).toBe('');
  });

  it('names the first problem in form order', () => {
    expect(jobProblem({ ...filled, title: 'Ac', location: '' })).toBe('postJob.errTitle');
    expect(jobProblem({ ...filled, categoryId: '' })).toBe('postJob.errCategory');
    expect(jobProblem({ ...filled, location: '  ' })).toBe('postJob.errLocation');
    expect(jobProblem({ ...filled, salaryMin: '20000', salaryMax: '10000' })).toBe('postJob.errSalary');
    expect(jobProblem({ ...filled, description: 'too short' })).toBe('postJob.errDescription');
  });

  it('checks only the fields asked for, as each Mini App step does', () => {
    const blank = { ...EMPTY_FIELDS };
    expect(jobProblem(blank, ['salaryMax'])).toBe('');
    expect(jobProblem(blank, ['description'])).toBe('postJob.errDescription');
    expect(jobProblem({ ...blank, salaryMin: '5', salaryMax: '1' }, ['salaryMax'])).toBe('postJob.errSalary');
  });

  it('builds the request: a new job leaves empty fields out, an edit clears them', () => {
    const created = jobRequestBody({ ...filled, salaryMin: '' }, { editing: false, canFeature: false });
    expect(created).toMatchObject({ title: 'Accountant', vacancies: 1, salaryMin: undefined, featured: undefined });
    const edited = jobRequestBody({ ...filled, featured: true }, { editing: true, canFeature: true });
    expect(edited).toMatchObject({ salaryMin: null, requirements: null, applyUrl: null, featured: true });
  });

  it('fills the form from a saved job', () => {
    const job = {
      id: 'j1', title: 'Driver', categoryId: 'transportation', location: 'Adama', vacancies: null, type: 'CONTRACT',
      salaryMin: 8000, salaryMax: null, salaryType: 'MONTHLY', description: 'd', requirements: null, experienceLevel: null,
      yearsOfExperience: null, qualification: null, gender: 'female', tags: [], applyType: null, applyUrl: null,
      applyEmail: null, deadline: '2026-12-01T00:00:00.000Z', featured: false, urgent: true,
    } as SavedJob;
    expect(fieldsFromJob(job)).toMatchObject({
      vacancies: '1', salaryMin: '8000', salaryMax: '', salaryType: 'monthly', deadline: '2026-12-01', urgent: true, gender: 'FEMALE',
    });
  });
});
