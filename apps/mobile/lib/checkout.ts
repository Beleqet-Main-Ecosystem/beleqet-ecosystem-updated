import * as WebBrowser from 'expo-web-browser';
import { safeHttpUrl } from './format';

/**
 * Opens a Chapa checkout in the in-app browser. Card and mobile-money details stay on Chapa's page.
 * Resolves when the person closes it (or Chapa sends them to the return page); the caller then
 * asks the API whether the payment went through, as the website's return page does.
 */
export async function openCheckout(checkoutUrl: string | null | undefined): Promise<void> {
  const url = safeHttpUrl(checkoutUrl);
  if (!url) return;
  await WebBrowser.openBrowserAsync(url, {
    dismissButtonStyle: 'close',
    showTitle: true,
    toolbarColor: '#041603',
    controlsColor: '#d8ff3e',
  });
}

/** Re-checks something a few times after a payment, while Chapa's confirmation arrives. */
export async function pollUntil(check: () => Promise<boolean>, tries = 6, everyMs = 2500): Promise<boolean> {
  for (let i = 0; i < tries; i += 1) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  return false;
}
