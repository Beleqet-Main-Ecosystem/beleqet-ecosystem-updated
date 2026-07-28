import { ThemePreference } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export interface PersistedThemePreference {
    theme: ThemePreference;
}
export declare class UserPreferencesRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByUserId(userId: string): Promise<PersistedThemePreference | null>;
    save(userId: string, theme: ThemePreference): Promise<PersistedThemePreference>;
}
