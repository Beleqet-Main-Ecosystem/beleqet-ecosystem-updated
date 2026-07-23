import { Injectable } from '@nestjs/common';
import { ThemePreference } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/** Minimal persisted record required by the theme-preference service. */
export interface PersistedThemePreference {
  theme: ThemePreference;
}

/**
 * Encapsulates persistence concerns for the Performance Gauge theme setting.
 * Keeping Prisma calls here lets the service remain focused on feature policy.
 */
@Injectable()
export class PerformanceGaugeThemeRepository {
  /**
   * @param prisma - shared PostgreSQL access service supplied by PrismaModule
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches the saved theme preference for one user.
   *
   * @param userId - owning user's immutable identifier
   * @returns the persisted record, or null when one has not been created
   */
  async findByUserId(userId: string): Promise<PersistedThemePreference | null> {
    return this.prisma.userPreference.findUnique({
      where: { userId },
      select: { theme: true },
    });
  }

  /**
   * Creates or updates a user's theme preference atomically.
   *
   * @param userId - owning user's immutable identifier
   * @param theme - validated preference to persist
   * @returns the saved record
   */
  async save(userId: string, theme: ThemePreference): Promise<PersistedThemePreference> {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, theme },
      update: { theme },
      select: { theme: true },
    });
  }
}
