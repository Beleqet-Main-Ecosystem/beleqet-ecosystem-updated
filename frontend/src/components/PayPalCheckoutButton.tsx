'use client';

import React from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { Loader2, AlertCircle } from 'lucide-react';
import { translations, Locale } from '../utils/translations';

interface PayPalCheckoutButtonProps {
  amount: number;
  currency: string;
  idempotencyKey?: string;
  freelancerId?: string;
  freelanceJobId?: string;
  locale: Locale;
  onSuccess: (details: { orderId: string; captureId: string; amount: number; currency: string }) => void;
  onFailure: (err: any) => void;
  onCancel: () => void;
}

/**
 * PayPal Smart Payment Button wrapper for One-Time Escrow Payments.
 * Calls backend endpoints for order creation and capture.
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

  // Get client-side token or use dummy authorization header matching backend guard
  const getAuthHeaders = () => {
    // In production, fetch the actual user JWT token from cookies/localStorage.
    // For demo purposes, we will supply a mock header if not authenticated.
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  /**
   * Triggers when the PayPal button is clicked.
   * Calls our NestJS backend to create a PayPal Order.
   */
  const createOrder = async () => {
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
      return data.orderId; // Returns PayPal's order ID (e.g. 5O190127TN364715T)
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err.message || 'Could not connect to payment server');
      onFailure(err);
      throw err;
    }
  };

  /**
   * Triggers after the buyer approves the payment on PayPal.
   * Calls our NestJS backend to capture the order and finalize the charge.
   */
  const onApprove = async (data: any) => {
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
    } catch (err: any) {
      console.error('Error capturing order:', err);
      setError(err.message || 'Capture process failed');
      onFailure(err);
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
          onError={(err) => {
            console.error('PayPal Buttons error:', err);
            setError('Payment button initialization or configuration error');
            onFailure(err);
          }}
        />
      </div>
    </div>
  );
}
