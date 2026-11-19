import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateCompanyDto } from './update-user.dto';

describe('UpdateCompanyDto', () => {
  const errors = (body: Record<string, unknown>) =>
    validateSync(plainToInstance(UpdateCompanyDto, body)).map((error) => error.property);

  it('accepts every company field the dashboard edits', () => {
    expect(
      errors({
        name: 'Beleqet',
        foundedYear: 2015,
        benefits: ['Health insurance', 'Transport allowance'],
        coverImageUrl: 'https://cdn.example.com/cover.jpg',
        linkedinUrl: 'https://linkedin.com/company/beleqet',
        facebookUrl: '',
        twitterUrl: null,
      }),
    ).toEqual([]);
  });

  it('clears the year and the cover image with null or an empty value', () => {
    expect(errors({ foundedYear: null, coverImageUrl: '' })).toEqual([]);
  });

  it('refuses a year that is not a whole number in range', () => {
    expect(errors({ foundedYear: '2015' })).toEqual(['foundedYear']);
    expect(errors({ foundedYear: 1700 })).toEqual(['foundedYear']);
    expect(errors({ foundedYear: 2015.5 })).toEqual(['foundedYear']);
  });

  it('limits benefits to 20 short lines', () => {
    expect(errors({ benefits: Array.from({ length: 21 }, (_, i) => `Benefit ${i}`) })).toEqual([
      'benefits',
    ]);
    expect(errors({ benefits: ['x'.repeat(81)] })).toEqual(['benefits']);
    expect(errors({ benefits: 'Health insurance' })).toEqual(['benefits']);
  });

  it('refuses a cover image that is not a link', () => {
    expect(errors({ coverImageUrl: 'my cover photo' })).toEqual(['coverImageUrl']);
  });
});
