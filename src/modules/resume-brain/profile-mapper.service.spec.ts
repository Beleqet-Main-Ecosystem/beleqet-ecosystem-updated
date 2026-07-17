import { ProfileMapperService } from './profile-mapper.service';
import {
  EMPTY_EXTRACTED_RESUME,
  ExtractedResume,
} from './dto/extracted-resume.dto';

const resume = (over: Partial<ExtractedResume> = {}): ExtractedResume => ({
  ...EMPTY_EXTRACTED_RESUME,
  ...over,
});

describe('ProfileMapperService', () => {
  let service: ProfileMapperService;

  beforeEach(() => {
    service = new ProfileMapperService();
  });

  it('maps skills onto the User DTO shape (Phase 6 canonical test)', () => {
    const out = service.toUserProfile(resume({ skills: ['Node', 'React'] }));
    expect(out).toEqual({ skills: ['Node', 'React'] });
  });

  it('maps summary → bio and headline → headline', () => {
    const out = service.toUserProfile(
      resume({ summary: 'Great engineer', headline: 'Senior Engineer' }),
    );
    expect(out.bio).toBe('Great engineer');
    expect(out.headline).toBe('Senior Engineer');
  });

  it('maps the full scalar profile', () => {
    const out = service.toUserProfile(
      resume({
        firstName: 'Abebe',
        lastName: 'Bikila',
        phone: '+251911',
        headline: 'Engineer',
        summary: 'Bio here',
        location: 'Addis Ababa',
        skills: ['Node'],
      }),
    );
    expect(out).toEqual({
      firstName: 'Abebe',
      lastName: 'Bikila',
      phone: '+251911',
      headline: 'Engineer',
      bio: 'Bio here',
      location: 'Addis Ababa',
      skills: ['Node'],
    });
  });

  it('omits empty fields so a partial extraction never blanks the profile', () => {
    const out = service.toUserProfile(resume({ firstName: 'OnlyName' }));
    expect(out).toEqual({ firstName: 'OnlyName' });
    expect(out).not.toHaveProperty('bio');
    expect(out).not.toHaveProperty('skills');
  });

  it('never emits email (that goes through the change-email flow)', () => {
    const out = service.toUserProfile(
      resume({ email: 'a@b.com', firstName: 'A' }),
    );
    expect(out).not.toHaveProperty('email');
  });

  it('drops empty/whitespace skill entries', () => {
    const out = service.toUserProfile(
      resume({ skills: ['Node', '  ', '', 'React'] }),
    );
    expect(out.skills).toEqual(['Node', 'React']);
  });

  it('returns an empty object for an empty resume', () => {
    expect(service.toUserProfile(resume())).toEqual({});
  });
});
