'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

interface PayPalProviderProps {
  children: React.ReactNode;
  clientId?: string;
  currency?: string;
}

/**
 * PayPalScriptProvider wrapper component.
 * Loads the PayPal JS SDK asynchronously and provides state to child components.
 */
export default function PayPalProvider({
  children,
  clientId = 'test', // 'test' is the default sandbox client ID provided by PayPal SDK
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
