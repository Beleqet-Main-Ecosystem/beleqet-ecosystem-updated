'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

/**
 * @interface PayPalProviderProps
 * @description Properties accepted by the {@link PayPalProvider} component.
 */
interface PayPalProviderProps {
  /** The children nodes to be rendered inside the provider context */
  children: React.ReactNode;
  /** The PayPal client ID. Default is 'test' for mock sandbox loading. */
  clientId?: string;
  /** The ISO-4217 currency code context (e.g. 'USD') */
  currency?: string;
}

/**
 * @function PayPalProvider
 * @description PayPalScriptProvider wrapper component.
 * Loads the PayPal Javascript SDK asynchronously and shares the SDK context state
 * with all nested children (such as checkout and subscription buttons).
 *
 * @param props - Properties to configure the SDK scripts.
 * @returns React component wrapping children in the PayPal script provider context.
 *
 * @example
 * ```tsx
 * <PayPalProvider clientId="YOUR_PAYPAL_CLIENT_ID" currency="USD">
 *   <PayPalCheckoutButton amount={100} currency="USD" ... />
 * </PayPalProvider>
 * ```
 */
export default function PayPalProvider({
  children,
  clientId = 'test',
  currency = 'USD',
}: PayPalProviderProps) {
  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || clientId,
    currency: currency,
    intent: 'capture',
    vault: false, // Set to true when dealing with subscriptions
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
}
