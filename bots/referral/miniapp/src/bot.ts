import type { BOTS } from './bots';

// This build's bot, written in by vite.config.ts from the build's mode (boost or go), so a build
// carries only its own bot's values.
declare const __BOT__: (typeof BOTS)[keyof typeof BOTS];
export const bot = __BOT__;
