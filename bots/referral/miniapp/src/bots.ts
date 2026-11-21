// Boost and Go share this Mini App; these are the only ways the two differ. The build picks one
// with its mode (`vite build --mode boost` or `--mode go`, as the deploy does): see vite.config.ts.
export const BOTS = {
  boost: { title: 'Beleqet Boost', username: 'BeleqetBoost_Bot', airtime: true },
  go: { title: 'Beleqet Go: Invite & Earn', username: 'BeleqetJobsInviteAndWin_Bot', airtime: false },
} as const;

export type BotName = keyof typeof BOTS;

export const isBotName = (name: string): name is BotName => name in BOTS;
