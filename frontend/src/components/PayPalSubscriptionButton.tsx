'use client';

import React from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { Loader2, AlertCircle } from 'lucide-react';
import { translations, Locale } from '../utils/translations';

/**
 * @interface PayPalSubscriptionButtonProps
 * @description Configuration properties for the {@link PayPalSubscriptionButton} component.
 */
interface PayPalSubscriptionButtonProps {
  /** The billing plan ID created in the PayPal merchant dashboard Catalog */
  planId: string;
  /** Target language locale code for text translations ('en' or 'am') */
  locale: Locale;
  /** Callback triggered after the subscription is successfully authorized in the browser */
  onSuccess: (details: { subscriptionId: string; planId: string }) => void;
  /** Callback triggered when a subscription creation or approval error occurs */
  onFailure: (err: Error) => void;
  /** Callback triggered if the user cancels out of the subscription flow */
  onCancel: () => void;
}

/**
 * @function PayPalSubscriptionButton
 * @description PayPal Smart Payment Button wrapper for Recurring Subscriptions.
 * Re-initializes SDK scripts for vaulting/subscription intent and calls the backend subscription endpoint.
 *
 * Ensures script reducer context options (`vault: true`, `intent: 'subscription'`) are set
 * prior to loading the buttons to comply with PayPal SDK Vault specifications.
 *
 * @param props - Component configuration props.
 * @returns React component wrapping the PayPal subscribe buttons.
 */
export default function PayPalSubscriptionButton({
  planId,
  locale,
  onSuccess,
  onFailure,
  onCancel,
}: PayPalSubscriptionButtonProps) {
  const [{ options, isPending, isRejected }, dispatch] = usePayPalScriptReducer();
  const [error, setError] = React.useState<string | null>(null);
  const t = translations[locale];

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  // Proactively reset scripts to vault=true and intent=subscription if they aren't already set
  React.useEffect(() => {
    if (options.vault !== true || options.intent !== 'subscription') {
      dispatch({
        type: 'resetOptions',
        value: {
          ...options,
          vault: true,
          intent: 'subscription',
        },
      });
    }
  }, [options, dispatch]);

  /**
   * Helper to retrieve JWT token and construct request authorization headers.
   * @returns Request headers object.
   */
  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  /**
   * Callback sent to the PayPal SDK to create a PayPal Subscription.
   * Calls backend `/paypal/create-subscription` to initiate the billing agreement.
   *
   * @async
   * @returns The generated PayPal Subscription ID string.
   */
  const createSubscription = async (): Promise<string> => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/paypal/create-subscription`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          planId: planId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create PayPal subscription');
      }

      const data = await res.json();
      return data.subscriptionId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not initiate subscription agreement';
      console.error('Error creating subscription:', err);
      setError(message);
      onFailure(err instanceof Error ? err : new Error(message));
      throw err;
    }
  };

  /**
   * Callback sent to the PayPal SDK after the user approves the subscription.
   * Finalizes the local subscription activation callback mapping.
   *
   * @async
   * @param data - Subscription details payload returned by PayPal SDK.
   */
  const onApprove = async (data: { subscriptionID: string }): Promise<void> => {
    try {
      setError(null);
      onSuccess({
        subscriptionId: data.subscriptionID,
        planId: planId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to finalize subscription confirmation';
      console.error('Subscription approval error:', err);
      setError(message);
      onFailure(err instanceof Error ? err : new Error(message));
    }
  };

  if (isPending || options.vault !== true || options.intent !== 'subscription') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-2 border border-white/5 bg-black/20 rounded-xl">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <span className="text-sm text-gray-400 font-medium">{t.processing}</span>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-2 border border-red-500/20 bg-red-950/20 rounded-xl text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <span className="text-sm text-red-300 font-semibold">PayPal SDK Failed to Load</span>
        <span className="text-xs text-red-400 max-w-xs">Please verify your internet connection or check your NEXT_PUBLIC_PAYPAL_CLIENT_ID configuration.</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="relative z-10 w-full overflow-hidden rounded-xl">
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'subscribe',
          }}
          createSubscription={createSubscription}
          onApprove={onApprove}
          onCancel={onCancel}
          onError={(err: Record<string, any>) => {
            console.error('PayPal Subscription error:', err);
            const message = err.message || 'Subscription button initialization or configuration error';
            setError(message);
            onFailure(new Error(message));
          }}
        />
      </div>
    </div>
  );
}
