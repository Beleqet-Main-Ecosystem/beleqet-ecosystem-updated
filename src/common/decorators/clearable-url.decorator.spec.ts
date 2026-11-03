import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateUserDto } from '../../modules/users/dto/update-user.dto';

describe('ClearableUrl', () => {
  const check = (portfolioUrl: unknown) => {
    const dto = plainToInstance(UpdateUserDto, { portfolioUrl });
    return { value: dto.portfolioUrl, errors: validateSync(dto).length };
  };

  it('turns an empty link into null so it can be cleared', () => {
    expect(check('')).toEqual({ value: null, errors: 0 });
    expect(check('  ')).toEqual({ value: null, errors: 0 });
  });

  it('still accepts a real link and rejects a bad one', () => {
    expect(check('https://example.com/me').errors).toBe(0);
    expect(check('not a link').errors).toBe(1);
  });
});
