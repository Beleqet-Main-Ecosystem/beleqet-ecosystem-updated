import { ThemePreference } from '@prisma/client';
import { PerformanceGaugeThemeRepository } from './performance-gauge-theme.repository';
import { PerformanceGaugeThemeService } from './performance-gauge-theme.service';

describe('PerformanceGaugeThemeService', () => {
  const findByUserId = jest.fn<Promise<{ theme: ThemePreference } | null>, [string]>();
  const save = jest.fn<Promise<{ theme: ThemePreference }>, [string, ThemePreference]>();
  const repository = { findByUserId, save } as unknown as PerformanceGaugeThemeRepository;
  const service = new PerformanceGaugeThemeService(repository);

  beforeEach(() => jest.clearAllMocks());

  it('returns SYSTEM without creating a preference for a new user', async () => {
    findByUserId.mockResolvedValue(null);

    await expect(service.getThemePreference('user-1')).resolves.toEqual({ theme: ThemePreference.SYSTEM });
    expect(findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('returns the persisted preference', async () => {
    findByUserId.mockResolvedValue({ theme: ThemePreference.DARK });

    await expect(service.getThemePreference('user-1')).resolves.toEqual({ theme: ThemePreference.DARK });
  });

  it('upserts a validated preference for the authenticated user', async () => {
    save.mockResolvedValue({ theme: ThemePreference.LIGHT });

    await expect(service.updateThemePreference('user-1', ThemePreference.LIGHT)).resolves.toEqual({
      theme: ThemePreference.LIGHT,
    });
    expect(save).toHaveBeenCalledWith('user-1', ThemePreference.LIGHT);
  });
});
