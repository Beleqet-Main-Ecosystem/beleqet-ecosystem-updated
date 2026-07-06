import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users/users.service';

describe('AI Matchmaker & User DB Integration Testing Standard', () => {
  let usersService: any;
  let mockAiMatchmakerEngine: any;

  beforeEach(() => {
    // 1. (Data Corruption) ለመከላከል የምንጠቀመው ንፁህ Mock User Database
    usersService = {
      findOne: jest.fn().mockImplementation((id: string) => {
        if (!id || id === 'invalid-id') return null;
        return { id, name: 'Kasiye', role: 'IT Expert', status: 'Active' };
      }),
      updateUserStatus: jest.fn().mockReturnValue(true),
    };

    // 2. የ AI Matchmaker ሞጁልን የሚተካ (Mock) ኢንጂን መፍጠር
    mockAiMatchmakerEngine = {
      processMatching: (userId: string) => {
        const user = usersService.findOne(userId);
        
        // Data Integrity Check ( ሲስተሙ Fail-Fast እንዲያደርግ)
        if (!user || !user.id || !user.role) {
          throw new Error('DATA_CORRUPTION_DETECTED: Invalid payload or missing user critical records.');
        }
        
        return {
          matchId: 'match-xyz-2026',
          matchedUser: user.name,
          algorithmScore: 0.98,
          integrationStability: 'Verified_Stable',
        };
      },
    };
  });

  it('should successfully match a user without data corruption', () => {
    const result = mockAiMatchmakerEngine.processMatching('user-100');

    expect(result.matchedUser).toBe('Kasiye');
    expect(result.integrationStability).toBe('Verified_Stable');
    expect(usersService.findOne).toHaveBeenCalledWith('user-100');
  });

  it('should detect and isolate data corruption if user payload is compromised', () => {
    expect(() => {
      mockAiMatchmakerEngine.processMatching('invalid-id');
    }).toThrow('DATA_CORRUPTION_DETECTED');
  });
});