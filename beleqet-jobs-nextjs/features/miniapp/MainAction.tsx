'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';

type Props = {
  text: string;
  /** Where the button goes; or `onClick` for an action. */
  href?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
};

/**
 * A screen's main action. Inside Telegram it is Telegram's own bottom button (MainButton,
 * coloured lime by useMiniAppChrome); in a normal browser, the same button at the foot of the page.
 */
export default function MainAction({ text, href, onClick, disabled = false }: Props) {
  const { isTMA } = useTelegram();
  const router = useRouter();
  const run = useCallback(async () => {
    if (disabled) return;
    if (href) router.push(href);
    else await onClick?.();
  }, [disabled, href, onClick, router]);

  useTelegramMainButton({ text, onClick: run, visible: isTMA, disabled });

  if (isTMA) return null;
  return (
    <div className="sticky bottom-0 z-10 border-t border-ink-200 bg-white px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => void run()}
        disabled={disabled}
        className="flex h-[52px] w-full items-center justify-center rounded-xl bg-mini-lime text-base font-extrabold text-mini-onLime disabled:bg-ink-200 disabled:text-ink-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
      >
        {text}
      </button>
    </div>
  );
}
