import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto, VerifyEmailCodeDto } from './register.dto';

describe('RegisterDto', () => {
  const base = {
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'User',
    password: 'Password123!',
  };
  const errorsFor = async (body: object) => validate(plainToInstance(RegisterDto, body));

  it.each(['JOB_SEEKER', 'EMPLOYER', 'FREELANCER'])('accepts the %s role', async (role) => {
    expect(await errorsFor({ ...base, role })).toHaveLength(0);
  });

  it('accepts no role (the service defaults to JOB_SEEKER)', async () => {
    expect(await errorsFor(base)).toHaveLength(0);
  });

  it('refuses ADMIN, so nobody can make themselves an administrator by signing up', async () => {
    const errors = await errorsFor({ ...base, role: 'ADMIN' });
    expect(errors.map((e) => e.property)).toEqual(['role']);
  });
});

describe('VerifyEmailCodeDto', () => {
  const errorsFor = async (code: string) =>
    validate(plainToInstance(VerifyEmailCodeDto, { verificationToken: 'ticket', code }));

  it.each(['246810', '246 810', ' 2 4 6 8 1 0 '])('accepts %j', async (code) => {
    expect(await errorsFor(code)).toHaveLength(0);
  });

  it.each(['24681', '2468101', '24681a', ''])('refuses %j', async (code) => {
    expect((await errorsFor(code)).map((e) => e.property)).toEqual(['code']);
  });
});
