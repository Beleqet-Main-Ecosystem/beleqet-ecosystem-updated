import { Module } from '@nestjs/common';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesRepository } from './user-preferences.repository';
import { UserPreferencesService } from './user-preferences.service';

/** Wires the isolated Performance Gauge theme feature into Nest dependency injection. */
@Module({
  controllers: [UserPreferencesController],
  providers: [UserPreferencesRepository, UserPreferencesService],
  exports: [UserPreferencesService],
})
export class UserPreferencesModule {}
