/**
 * @beleqet/common
 *
 * Single entry point for the types, and the framework-free logic, shared across the Beleqet
 * ecosystem. Import from this package in mobile, web, and backend code to stay in sync.
 *
 * @example
 * import type { AuthUser, LoginDto, Job, FreelanceJob } from '@beleqet/common';
 * import { calculateTax, emptyCv } from '@beleqet/common';
 */

export * from './enums';
export * from './api-response.types';
export * from './auth.types';
export * from './job.types';
export * from './freelance.types';
export * from './application.types';
export * from './wallet.types';
export * from './subscription.types';

// Logic the website and the app both run (one copy, tested here).
export * from './cv';
export * from './tax';
