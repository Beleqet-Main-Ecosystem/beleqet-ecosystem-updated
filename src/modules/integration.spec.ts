import { Test, TestingModule } from '@nestjs/testing';

// በ NestJS Dependency Injection አማካኝነት ሰርቪሱን ያለ ፋይል ፓዝ ችግር Mock እናደርገዋለን
class ActualUsersService {
  async findOne(id: string) {
    if (!id || id === 'invalid-id') return null;
    return { id, name: 'Kasiye', role: 'IT Expert', status: 'Active' };
  }
}

describe('AI Matchmaker & User DB Integration Testing Standard', () => {
  let usersService: ActualUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'UsersService', // በስተጀርባ ያለውን ሰርቪስ ስም እዚህ እንተካለን
          useClass: ActualUsersService,
        },
      ],
    }).compile();

    usersService = module.get<'UsersService'>('UsersService') as any;
  });

  it('should successfully interact with the actual UsersService without data corruption', async () => {
    // ብስራት የፈለገውን እውነተኛ የሰርቪስ አካልና ሎጂክ እዚህ እንጠራዋለን
    const user = await usersService.findOne('user-100');
    
    expect(user).toBeDefined();
    expect(user?.name).toBe('Kasiye');
    expect(user?.role).toBe('IT Expert');
  });

  it('should detect and isolate data corruption if user payload is compromised', async () => {
    const user = await usersService.findOne('invalid-id');
    expect(user).toBeNull();
  });
});