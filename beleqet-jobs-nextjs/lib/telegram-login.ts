/**
 * Telegram's login button (https://core.telegram.org/widgets/login), with our own button: a
 * Telegram popup asks the person to confirm, then hands back their signed Telegram details, which
 * the API checks. It signs in with the Jobs bot, whose domain must be set to beleqetjobs.com in
 * @BotFather (/setdomain). "write" access lets the bot message them, for notifications.
 */

const SCRIPT_URL = 'https://telegram.org/js/telegram-widget.js?22';
/** The Jobs bot (@BeleqetJobs_Bot). Its id is public; the token never leaves the server. */
export const TELEGRAM_LOGIN_BOT_ID = process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_BOT_ID ?? '7902805005';

/** What Telegram returns: id, first_name, username, photo_url, auth_date and hash. */
export type TelegramLoginData = Record<string, string | number>;

type TelegramLoginApi = {
  auth: (
    options: { bot_id: string; request_access?: 'write'; lang?: string },
    callback: (data: TelegramLoginData | false) => void,
  ) => void;
};

let loading: Promise<TelegramLoginApi | null> | null = null;

function loginApi(): TelegramLoginApi | null {
  const telegram = (window as unknown as { Telegram?: { Login?: TelegramLoginApi } }).Telegram;
  return telegram?.Login ?? null;
}

function loadScript(): Promise<TelegramLoginApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (loginApi()) return Promise.resolve(loginApi());
  if (!loading) {
    loading = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(loginApi());
      script.onerror = () => {
        loading = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Load the script early (on hover or focus), so the popup opens straight from the click. */
export function prepareTelegramLogin(): void {
  void loadScript();
}

/**
 * Opens Telegram's sign-in popup. Resolves with the signed details, or null when the person
 * closed it or the script couldn't load (`failed` tells which).
 */
export async function askTelegram(lang: string): Promise<{ data: TelegramLoginData | null; failed: boolean }> {
  const api = await loadScript();
  if (!api) return { data: null, failed: true };
  return new Promise((resolve) => {
    api.auth({ bot_id: TELEGRAM_LOGIN_BOT_ID, request_access: 'write', lang }, (data) =>
      resolve({ data: data || null, failed: false }),
    );
  });
}
