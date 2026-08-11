'use client';

import { useEffect, useCallback } from 'react';
import { useTelegram } from './useTelegram';

export interface UseTelegramMainButtonOptions {
  /** Button label text */
  text: string;
  /** Called when the user taps the button */
  onClick: () => void | Promise<void>;
  /**
   * When true the button is shown, when false it is hidden.
   * Defaults to true.
   */
  visible?: boolean;
  /**
   * When true the button is rendered in a disabled/greyed-out state.
   * Defaults to false.
   */
  disabled?: boolean;
}

/**
 * Controls Telegram's native sticky bottom MainButton.
 *
 * Use this hook on pages where a critical conversion action should be
 * surfaced — "Submit Proposal", "Release Escrow", "Withdraw Earnings", etc.
 * The native button sits outside the WebView, so it is always visible
 * regardless of scroll position.
 *
 * The hook automatically:
 *  - Shows the button with the provided text when the component mounts
 *  - Hides the button when the component unmounts (cleanup)
 *  - Shows a loading spinner while an async `onClick` is in progress
 *  - Fires a medium haptic impact on each tap
 *  - Fires a success haptic notification when an async `onClick` resolves
 *
 * Has no effect in a regular browser (isTMA === false).
 *
 * @example
 * useTelegramMainButton({
 *   text: 'SUBMIT PROPOSAL',
 *   onClick: handleSubmit,
 * });
 */
export function useTelegramMainButton({
  text,
  onClick,
  visible = true,
  disabled = false,
}: UseTelegramMainButtonOptions): void {
  const { webApp, isTMA } = useTelegram();

  const handleClick = useCallback(async () => {
    if (!webApp) return;
    const btn = webApp.MainButton;

    btn.showProgress(false);
    webApp.HapticFeedback.impactOccurred('medium');

    try {
      await onClick();
      webApp.HapticFeedback.notificationOccurred('success');
    } catch {
      webApp.HapticFeedback.notificationOccurred('error');
    } finally {
      btn.hideProgress();
    }
  }, [webApp, onClick]);

  useEffect(() => {
    if (!isTMA || !webApp) return;

    const btn = webApp.MainButton;
    btn.setText(text);

    if (visible && !disabled) {
      btn.enable();
      btn.show();
    } else if (visible && disabled) {
      btn.disable();
      btn.show();
    } else {
      btn.hide();
    }

    btn.onClick(handleClick);

    return () => {
      btn.offClick(handleClick);
      btn.hide();
    };
  }, [isTMA, webApp, text, visible, disabled, handleClick]);
}
