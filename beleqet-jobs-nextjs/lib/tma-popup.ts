import type { TelegramWebApp } from '@/hooks/useTelegram';

/**
 * Shows a native Telegram popup — use this instead of `window.alert()`.
 *
 * Falls back to `window.alert()` in a regular browser so the same call
 * works in both environments without any extra branching at the call site.
 *
 * @example
 * showTelegramAlert(webApp, 'File uploaded successfully!');
 */
export function showTelegramAlert(
  webApp: TelegramWebApp | null,
  message: string,
  title?: string,
): void {
  if (webApp) {
    webApp.showPopup({ title, message, buttons: [{ type: 'ok' }] });
  } else {
    window.alert(title ? `${title}\n\n${message}` : message);
  }
}

/**
 * Shows a native Telegram confirmation popup — use this instead of
 * `window.confirm()`.
 *
 * Returns a Promise that resolves to `true` when the user taps the confirm
 * button, or `false` when they cancel.
 *
 * Falls back to `window.confirm()` in a regular browser.
 *
 * @example
 * const confirmed = await showTelegramConfirm(
 *   webApp,
 *   'Are you sure you want to transfer $358.00?',
 *   'Confirm Withdrawal',
 * );
 * if (confirmed) processWithdrawal();
 */
export function showTelegramConfirm(
  webApp: TelegramWebApp | null,
  message: string,
  title?: string,
  confirmText = 'Yes, Confirm',
): Promise<boolean> {
  if (!webApp) {
    return Promise.resolve(window.confirm(title ? `${title}\n\n${message}` : message));
  }

  return new Promise((resolve) => {
    webApp.showPopup(
      {
        title,
        message,
        buttons: [
          { id: 'confirm', type: 'default', text: confirmText },
          { type: 'cancel' },
        ],
      },
      (buttonId) => resolve(buttonId === 'confirm'),
    );
  });
}

/**
 * Shows a native Telegram destructive-action popup (red confirm button).
 *
 * Use for irreversible actions: deleting data, withdrawing funds, etc.
 * Falls back to `window.confirm()` in a regular browser.
 *
 * @example
 * const confirmed = await showTelegramDestructiveConfirm(
 *   webApp,
 *   'This will permanently delete your account.',
 *   'Delete Account',
 * );
 */
export function showTelegramDestructiveConfirm(
  webApp: TelegramWebApp | null,
  message: string,
  title?: string,
  confirmText = 'Delete',
): Promise<boolean> {
  if (!webApp) {
    return Promise.resolve(window.confirm(title ? `${title}\n\n${message}` : message));
  }

  return new Promise((resolve) => {
    webApp.showPopup(
      {
        title,
        message,
        buttons: [
          { id: 'confirm', type: 'destructive', text: confirmText },
          { type: 'cancel' },
        ],
      },
      (buttonId) => resolve(buttonId === 'confirm'),
    );
  });
}
