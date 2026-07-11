import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewModule } from './modules/review/review.module';
// import other feature modules, e.g. FreelancerModule, PaymentModule, AuthModule...

/**
 * Application root module. Feature modules are registered here and
 * remain fully decoupled from one another — the Review System module
 * exposes only its `ReviewService` export for other modules to
 * consume via DI if needed (e.g. a future FreelancerProfileModule
 * pulling in average ratings).
 */
@Module({
  imports: [
    // Loads process.env into ConfigService; isGlobal makes it
    // available across every feature module without re-importing.
    ConfigModule.forRoot({ isGlobal: true }),
    ReviewModule,
  ],
})
export class AppModule {}
