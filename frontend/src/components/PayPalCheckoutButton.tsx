'use client';

import React from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { Loader2, AlertCircle } from 'lucide-react';
import { translations, Locale } from '../utils/translations';

/**
 * @interface PayPalCheckoutButtonProps
 * @description Configuration properties for the {@link PayPalCheckoutButton} component.
 */
interface PayPalCheckoutButtonProps {
  /** Charge amount (e.g. 150.00) */
  amount: number;
  /** ISO-4217 currency code (e.g. 'USD', 'EUR'). Simulator additionally supports 'ETB'. */
  currency: string;
  /** Optional client-side UUID v4 to prevent duplicate charges on retry */
  idempotencyKey?: string;
  /** Optional freelancer user UUID receiving the funds */
  freelancerId?: string;
  /** Optional freelance job UUID linked to this payment transaction */
  freelanceJobId?: string;
  /** Target language locale code for text copy ('en' or 'am') */
  locale: Locale;
  /** Callback triggered after payment is captured on backend successfully */
  onSuccess: (details: { orderId: string; captureId: string; amount: number; currency: string }) => void;
  /** Callback triggered if any error is encountered during creation/capture */
  onFailure: (err: Error) => void;
  /** Callback triggered if the user exits the PayPal portal window */
  onCancel: () => void;
}

/**
 * @function PayPalCheckoutButton
 * @description PayPal Smart Payment Button wrapper for One-Time Escrow Payments.
 * Renders the responsive PayPal button UI and coordinates order creation and capture
 * endpoints on the NestJS backend.
 *
 * Handles auth headers from `localStorage` JWT, displays loaders while the SDK
 * script is pending, and renders local error alerts for inline feedback.
 *
 * @param props - Component configuration props.
 * @returns React component wrapping the PayPal payment button.
 */
export default function PayPalCheckoutButton({
  amount,
  currency,
  idempotencyKey,
  freelancerId,
  freelanceJobId,
  locale,
  onSuccess,
  onFailure,
  onCancel,
}: PayPalCheckoutButtonProps) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [error, setError] = React.useState<string | null>(null);
  const t = translations[locale];

  // Base API url (relative or fully qualified config)
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
   * Callback sent to the PayPal SDK to create a PayPal Order.
   * Sends payment metadata to the backend to generate the order.
   *
   * @async
   * @returns The generated PayPal Order ID string.
   */
  const createOrder = async (): Promise<string> => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/paypal/create-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amount,
          currency: currency,
          idempotencyKey: idempotencyKey || undefined,
          freelancerId: freelancerId || undefined,
          freelanceJobId: freelanceJobId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create PayPal order on backend');
      }

      const data = await res.json();
      return data.orderId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not connect to payment server';
      console.error('Error creating order:', err);
      setError(message);
      onFailure(err instanceof Error ? err : new Error(message));
      throw err;
    }
  };

  /**
   * Callback sent to the PayPal SDK after the user approves the payment.
   * Instructs the backend to capture the transaction and finalize the escrow.
   *
   * @async
   * @param data - The metadata payload returned by the PayPal button window containing the orderID.
   */
  const onApprove = async (data: { orderID: string }): Promise<void> => {
    try {
      setError(null);
      const orderId = data.orderID;

      const res = await fetch(`${API_BASE}/paypal/capture-order/${orderId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Capture failed on backend');
      }

      const captureData = await res.json();
      
      onSuccess({
        orderId: captureData.orderId,
        captureId: captureData.captureId,
        amount: Number(captureData.amount),
        currency: captureData.currency,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Capture process failed';
      console.error('Error capturing order:', err);
      setError(message);
      onFailure(err instanceof Error ? err : new Error(message));
    }
  };

  if (isPending) {
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
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
          }}
          createOrder={createOrder}
          onApprove={onApprove}
          onCancel={onCancel}
          onError={(err: Record<string, any>) => {
            console.error('PayPal Buttons error:', err);
            const message = err.message || 'Payment button initialization or configuration error';
            setError(message);
            onFailure(new Error(message));
          }}
        />
      </div>
    </div>
  );
}
