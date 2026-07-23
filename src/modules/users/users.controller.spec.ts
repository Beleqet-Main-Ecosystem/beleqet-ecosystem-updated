import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController - Search Feature', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const mockUsersService = {
      searchUsers: jest.fn().mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call UsersService.searchUsers with query and current user id', async () => {
    const mockUser = { userId: 'current-user-id', role: 'EMPLOYER', email: 'test@test.com' };
    const query = 'john';

    const result = await controller.searchUsers(query, mockUser);

    expect(service.searchUsers).toHaveBeenCalledWith(query, mockUser.userId);
    expect(result).toEqual([
      { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    ]);
  });
});
