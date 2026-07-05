'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, Lock, Landmark, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PayPalMockCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get('orderId');
  const subscriptionId = searchParams.get('subscriptionId');
  const planId = searchParams.get('planId');
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency') || 'USD';
  const type = searchParams.get('type') || 'order'; // 'order' or 'subscription'

  const [loading, setLoading] = React.useState<boolean>(false);
  const [complete, setComplete] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      if (type === 'order' && orderId) {
        // Call the capture order endpoint on the backend
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
        // For subscription, simulate PayPal webhook trigger by calling the callback page with success status
        setComplete(true);
        setTimeout(() => {
          router.push(`/paypal-demo?status=SUCCESS&subscriptionId=${subscriptionId}&planId=${planId}`);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Simulated capture error:', err);
      setError(err.message || 'Verification failed. Could not capture payment.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/paypal-demo?status=CANCELLED');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans antialiased selection:bg-yellow-500/20">
      {/* Top Banner Replica */}
      <header className="bg-[#003087] border-b border-blue-900 py-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          {/* Replica Logo */}
          <div className="italic font-extrabold text-2xl tracking-tighter text-white select-none">
            <span className="text-[#0079C1]">Pay</span>
            <span className="text-[#00457C]">Pal</span>
            <span className="ml-2 text-xs font-sans not-italic font-bold tracking-normal uppercase bg-[#0079C1] px-1.5 py-0.5 rounded text-white border border-blue-400/20">
              Simulator
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-blue-200">
          <Lock className="w-3.5 h-3.5 text-blue-400" />
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
                  <strong>Interview Demo Mode:</strong> This page simulates PayPal's secure login & consent screen. It communicates with your backend APIs locally.
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
                    <span className="text-blue-400 font-semibold">Beleqet Solutions</span>
                  </div>
                </div>
              </div>

              {/* simulated payment options */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulated Funding Source</div>
                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Landmark className="w-5 h-5 text-blue-400" />
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
                  onClick={handleApprove}
                  disabled={loading}
                  className="w-full bg-[#FFC439] hover:bg-[#F2B522] text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition duration-150 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                >
                  {loading && <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-2" />}
                  <span>Authorize & Pay</span>
                </button>
                <button
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
