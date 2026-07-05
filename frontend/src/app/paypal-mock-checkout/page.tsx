'use client';

/**
 * @file paypal-mock-checkout/page.tsx
 * @description Simulated PayPal Checkout Portal — Interview/Demo Mode.
 *
 * This page replicates the PayPal consent and payment confirmation screen
 * for **offline demonstration purposes only**. It is rendered when the backend
 * is running in `PAYPAL_MODE=mock` and returns a local simulator redirect URL
 * instead of an external PayPal approval URL.
 *
 * **How it works**:
 * 1. The user is redirected here from the payment demo page after clicking "Pay with PayPal".
 * 2. Query parameters carry the `orderId` (or `subscriptionId`), `amount`, `currency`, and `type`.
 * 3. Clicking "Authorize & Pay" triggers the NestJS `POST /paypal/capture-order/:orderId`
 *    endpoint using the JWT token stored in `localStorage`.
 * 4. On success, the user is redirected back to `/paypal-demo?status=SUCCESS&...`.
 * 5. Clicking "Cancel" redirects to `/paypal-demo?status=CANCELLED`.
 *
 * **Security note**: This page requires a valid JWT in `localStorage` to call the
 * capture endpoint. In a real PayPal flow, this step happens after PayPal's
 * OAuth redirect — the JWT requirement replaces the PayPal buyer session.
 *
 * @module PaypalMockCheckout
 */

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, Lock, Landmark, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * PayPal Mock Checkout Page component.
 *
 * Renders a styled PayPal consent screen replica. Supports both one-time
 * payment orders and recurring subscription approval flows.
 *
 * @returns The simulated PayPal checkout portal UI.
 *
 * @example
 * ```
 * // Navigated to from the backend redirect URL:
 * /paypal-mock-checkout?orderId=MOCK-ORD-1234&amount=150&currency=USD&type=order
 * /paypal-mock-checkout?subscriptionId=MOCK-SUB-5678&planId=P-PLAN123&type=subscription
 * ```
 */
export default function PayPalMockCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  /** PayPal Order ID for one-time payments (populated when type=order) */
  const orderId = searchParams.get('orderId');

  /** PayPal Subscription ID for recurring plans (populated when type=subscription) */
  const subscriptionId = searchParams.get('subscriptionId');

  /** PayPal Plan ID for subscription display */
  const planId = searchParams.get('planId');

  /** Payment amount (string from URL param, parsed to float for display) */
  const amount = searchParams.get('amount');

  /** ISO-4217 currency code (defaults to 'USD' if not provided) */
  const currency = searchParams.get('currency') || 'USD';

  /** Payment flow type: 'order' for one-time payments, 'subscription' for recurring */
  const type = searchParams.get('type') || 'order';

  /** True while the capture API call is in flight */
  const [loading, setLoading] = React.useState<boolean>(false);

  /** True after successful authorization — shows success state before redirect */
  const [complete, setComplete] = React.useState<boolean>(false);

  /** Error message from the capture API call, or null if no error */
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Backend NestJS API base URL.
   * Reads from `NEXT_PUBLIC_API_URL` environment variable with localhost fallback.
   * Set this in `frontend/.env.local` for non-default configurations.
   */
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  /**
   * Handles the "Authorize & Pay" button click.
   *
   * For order flows, calls the NestJS `POST /paypal/capture-order/:orderId` endpoint
   * with the JWT from localStorage. On success, redirects to the payment demo page
   * with `status=SUCCESS` and the payment details as query params.
   *
   * For subscription flows, simulates approval by redirecting directly (the webhook
   * would normally fire to confirm activation).
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      if (type === 'order' && orderId) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`${API_BASE}/paypal/capture-order/${orderId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Capture failed');
        }

        setComplete(true);
        setTimeout(() => {
          router.push(`/paypal-demo?status=SUCCESS&orderId=${orderId}&amount=${amount}&currency=${currency}`);
        }, 1500);

      } else if (type === 'subscription' && subscriptionId) {
        // Subscription: simulate approval redirect (webhook handles actual activation)
        setComplete(true);
        setTimeout(() => {
          router.push(`/paypal-demo?status=SUCCESS&subscriptionId=${subscriptionId}&planId=${planId}`);
        }, 1500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed. Could not capture payment.';
      console.error('Simulated capture error:', err);
      setError(message);
      setLoading(false);
    }
  };

  /**
   * Handles the "Cancel transaction" button click.
   * Redirects the user back to the demo dashboard with `status=CANCELLED`.
   */
  const handleCancel = () => {
    router.push('/paypal-demo?status=CANCELLED');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans antialiased selection:bg-emerald-500/20">
      {/* Top Banner Replica */}
      <header className="bg-[#064e3b] border-b border-emerald-800 py-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          {/* Replica Logo */}
          <div className="italic font-extrabold text-2xl tracking-tighter text-white select-none">
            <span className="text-emerald-400">Pay</span>
            <span className="text-emerald-200">Pal</span>
            <span className="ml-2 text-xs font-sans not-italic font-bold tracking-normal uppercase bg-emerald-600 px-1.5 py-0.5 rounded text-white border border-emerald-400/20">
              Simulator
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-emerald-200">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secure Connection</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto w-full px-4 py-12 flex-grow flex flex-col justify-center">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          
          {complete ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">Payment Authorized</h2>
                <p className="text-sm text-slate-400">Redirecting back to Beleqet Solutions...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Simulator info badge */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start space-x-2.5 text-amber-300 text-xs">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">
                  <strong>Interview Demo Mode:</strong> This page simulates PayPal&apos;s secure login &amp; consent screen. It communicates with your backend APIs locally.
                </p>
              </div>

              {/* Order Information Panel */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Summary</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-300">
                    {type === 'order' ? 'Project Escrow Fund' : 'Platform Subscription Plan'}
                  </span>
                  <span className="text-lg font-extrabold text-white">
                    {type === 'order' && amount ? (
                      new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(parseFloat(amount))
                    ) : (
                      planId === 'P-5ML4271244454362WXNWU5NQ' ? '$15.00/mo' : '$120.00/yr'
                    )}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-slate-700/50 text-[11px] font-mono text-slate-400 flex flex-col space-y-1">
                  {orderId && (
                    <div className="flex justify-between">
                      <span>Order ID</span>
                      <span className="text-slate-200">{orderId}</span>
                    </div>
                  )}
                  {subscriptionId && (
                    <div className="flex justify-between">
                      <span>Subscription ID</span>
                      <span className="text-slate-200">{subscriptionId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Merchant</span>
                    <span className="text-emerald-400 font-semibold">Beleqet Solutions</span>
                  </div>
                </div>
              </div>

              {/* Simulated payment options */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulated Funding Source</div>
                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Landmark className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">PayPal Balance (Sandbox Wallet)</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">Available</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  id="paypal-simulator-approve-btn"
                  onClick={handleApprove}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition duration-150 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                >
                  {loading && <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-2" />}
                  <span>Authorize &amp; Pay</span>
                </button>
                <button
                  id="paypal-simulator-cancel-btn"
                  onClick={handleCancel}
                  disabled={loading}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded-xl border border-slate-600 transition duration-150 text-sm disabled:opacity-50"
                >
                  Cancel transaction
                </button>
              </div>
            </>
          )}

        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-6 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1">
        <div className="flex justify-center items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>PayPal simulated checkout portal</span>
        </div>
        <p>© 2026 Beleqet Solutions Platform Sandbox Client</p>
      </footer>
    </div>
  );
}
