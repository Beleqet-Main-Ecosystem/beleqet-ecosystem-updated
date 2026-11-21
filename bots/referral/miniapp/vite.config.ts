import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {BOTS, isBotName} from './src/bots';

export default defineConfig(({command, mode}) => {
  // A build must name its bot, so a Go build can never carry Boost's invite links.
  if (command === 'build' && !isBotName(mode)) {
    throw new Error(`Build with --mode ${Object.keys(BOTS).join(' or ')} (got "${mode}")`);
  }
  // `vite` without a mode (local development) shows Boost.
  const bot = BOTS[isBotName(mode) ? mode : 'boost'];
  return {
    define: {__BOT__: JSON.stringify(bot)},
    plugins: [
      react(),
      tailwindcss(),
      {name: 'bot-title', transformIndexHtml: (html: string) => html.replace('%BOT_TITLE%', bot.title)},
    ],
  };
});
