'use client';

import React from 'react';
import { 
  CreditCard, 
  HelpCircle, 
  ShieldCheck, 
  RefreshCw, 
  Layers, 
  Globe, 
  Settings, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  DollarSign
} from 'lucide-react';

import PayPalProvider from '../../components/PayPalProvider';
import PayPalCheckoutButton from '../../components/PayPalCheckoutButton';
import PayPalSubscriptionButton from '../../components/PayPalSubscriptionButton';
import PaymentStatusBanner from '../../components/PaymentStatusBanner';
import { translations, Locale } from '../../utils/translations';

// Mock IDs for the sandbox demonstration
const MOCK_CLIENT_ID = 'e8c56fa7-2688-4f2b-8a48-8df0c345388c';
const MOCK_FREELANCER_ID = 'a4d5218d-f571-460d-bc01-9a74288b8cc8';
const MOCK_JOB_ID = '936efca7-1bfa-4cda-921c-cb8452ef72a2';

export default function PayPalDemoPage() {
  const [locale, setLocale] = React.useState<Locale>('en');
  const [paymentType, setPaymentType] = React.useState<'ONE_TIME' | 'SUBSCRIPTION'>('ONE_TIME');
  
  // One-time payment configurations
  const [amount, setAmount] = React.useState<number>(150.00);
  const [currency, setCurrency] = React.useState<string>('USD');
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>('');

  // Subscription plan configurations
  const [subPlan, setSubPlan] = React.useState<string>('P-5ML4271244454362WXNWU5NQ');

  // Callback States
  const [paymentStatus, setPaymentStatus] = React.useState<'SUCCESS' | 'CANCELLED' | 'FAILED' | null>(null);
  const [paymentDetails, setPaymentDetails] = React.useState<any>(null);

  const t = translations[locale];

  // Auto-generate an idempotency key on load
  React.useEffect(() => {
    setIdempotencyKey(`idemp-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const handleSuccess = (details: any) => {
    setPaymentDetails(details);
    setPaymentStatus('SUCCESS');
  };

  const handleFailure = (err: any) => {
    setPaymentDetails(null);
    setPaymentStatus('FAILED');
  };

  const handleCancel = () => {
    setPaymentDetails(null);
    setPaymentStatus('CANCELLED');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Decorative Gradient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">BELEQET</span>
              <span className="ml-1.5 text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold uppercase tracking-wider">Gateway</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Language Selection */}
            <div className="flex items-center space-x-1.5 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                onClick={() => setLocale('en')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wider transition ${
                  locale === 'en' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLocale('am')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wider transition ${
                  locale === 'am' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                አማ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Banner Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            {t.subtitle}
          </p>
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{t.sandboxMode}</span>
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: Payment configurations (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Payment Type Selector Card */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm space-y-4 shadow-xl">
              <h2 className="text-lg font-bold flex items-center space-x-2 text-white/90">
                <Layers className="w-5 h-5 text-blue-400" />
                <span>{t.paymentType}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* One Time Escrow */}
                <button
                  onClick={() => setPaymentType('ONE_TIME')}
                  className={`p-4 rounded-xl border text-left transition duration-200 ${
                    paymentType === 'ONE_TIME'
                      ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">One-Time Escrow</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      paymentType === 'ONE_TIME' ? 'border-blue-400' : 'border-gray-600'
                    }`}>
                      {paymentType === 'ONE_TIME' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{t.oneTimeDesc}</p>
                </button>

                {/* Subscriptions */}
                <button
                  onClick={() => setPaymentType('SUBSCRIPTION')}
                  className={`p-4 rounded-xl border text-left transition duration-200 ${
                    paymentType === 'SUBSCRIPTION'
                      ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">Platform Subscription</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      paymentType === 'SUBSCRIPTION' ? 'border-blue-400' : 'border-gray-600'
                    }`}>
                      {paymentType === 'SUBSCRIPTION' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{t.subscriptionDesc}</p>
                </button>
              </div>
            </div>

            {/* Custom Payment Detail Forms */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm space-y-6 shadow-xl">
              <h2 className="text-lg font-bold flex items-center space-x-2 text-white/90">
                <Settings className="w-5 h-5 text-indigo-400" />
                <span>Configuration details</span>
              </h2>

              {paymentType === 'ONE_TIME' ? (
                // One-Time Form Fields
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Amount Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.amount}</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-gray-400 font-medium">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Math.max(0.01, parseFloat(e.target.value) || 0))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-8 pr-4 text-white font-semibold focus:outline-none focus:border-blue-500/50 transition"
                      />
                    </div>
                  </div>

                  {/* Currency selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.currency}</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-white font-semibold focus:outline-none focus:border-blue-500/50 transition appearance-none"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>

                  {/* Idempotency Key (Read-only/auto) */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.idempotencyKey}</label>
                      <button 
                        onClick={() => setIdempotencyKey(`idemp-${Math.random().toString(36).substr(2, 9)}`)}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={idempotencyKey}
                      readOnly
                      className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 px-4 text-gray-400 font-mono text-xs cursor-default"
                    />
                  </div>
                </div>
              ) : (
                // Subscription Form Fields
                <div className="space-y-4">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.selectPlan}</label>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSubPlan('P-5ML4271244454362WXNWU5NQ')}
                      className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition ${
                        subPlan === 'P-5ML4271244454362WXNWU5NQ'
                          ? 'bg-indigo-950/20 border-indigo-500/40'
                          : 'bg-black/20 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{t.monthlyPlan}</div>
                        <p className="text-xs text-gray-400 mt-1">Platform monthly developer fee with priority escrow support.</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition ${subPlan === 'P-5ML4271244454362WXNWU5NQ' && 'rotate-90 text-indigo-400'}`} />
                    </button>

                    <button
                      onClick={() => setSubPlan('P-8SU6382955513837XYNXP8OP')}
                      className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition ${
                        subPlan === 'P-8SU6382955513837XYNXP8OP'
                          ? 'bg-indigo-950/20 border-indigo-500/40'
                          : 'bg-black/20 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{t.annualPlan}</div>
                        <p className="text-xs text-gray-400 mt-1">Platform annual fee with zero fee on first 3 escrows.</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition ${subPlan === 'P-8SU6382955513837XYNXP8OP' && 'rotate-90 text-indigo-400'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audit log warning */}
            <div className="p-4 rounded-xl bg-blue-950/10 border border-blue-500/10 text-xs text-blue-300 leading-relaxed flex items-start space-x-2.5">
              <Globe className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <span>{t.disputeWarning}</span>
            </div>

          </div>

          {/* Column 2: Payment Button Wrapper and Summary Card (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Receipt Summary Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 shadow-2xl space-y-6">
              <h2 className="text-lg font-bold text-white/95 pb-4 border-b border-white/5 flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-yellow-400" />
                <span>Checkout Summary</span>
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t.clientName}</span>
                  <span className="text-gray-200 text-xs font-mono font-bold">{MOCK_CLIENT_ID.substring(0, 8)}... (Employer)</span>
                </div>
                {paymentType === 'ONE_TIME' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{t.freelancerName}</span>
                    <span className="text-gray-200 text-xs font-mono font-bold">{MOCK_FREELANCER_ID.substring(0, 8)}... (Freelancer)</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Gateway Provider</span>
                  <span className="text-blue-400 font-semibold flex items-center space-x-1">
                    <span>PayPal Global</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </div>
                
                {paymentType === 'ONE_TIME' && (
                  <div className="pt-4 border-t border-white/5 flex justify-between items-baseline">
                    <span className="text-white font-semibold">Total Amount</span>
                    <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                      {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'am-ET', {
                        style: 'currency',
                        currency: currency,
                      }).format(amount)}
                    </span>
                  </div>
                )}
              </div>

              {/* PayPal Provider Wrapper with Smart Buttons */}
              <div className="pt-2">
                <PayPalProvider currency={paymentType === 'ONE_TIME' ? currency : 'USD'}>
                  {paymentType === 'ONE_TIME' ? (
                    <PayPalCheckoutButton
                      amount={amount}
                      currency={currency}
                      idempotencyKey={idempotencyKey}
                      freelancerId={MOCK_FREELANCER_ID}
                      freelanceJobId={MOCK_JOB_ID}
                      locale={locale}
                      onSuccess={handleSuccess}
                      onFailure={handleFailure}
                      onCancel={handleCancel}
                    />
                  ) : (
                    <PayPalSubscriptionButton
                      planId={subPlan}
                      locale={locale}
                      onSuccess={handleSuccess}
                      onFailure={handleFailure}
                      onCancel={handleCancel}
                    />
                  )}
                </PayPalProvider>
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500 font-mono">
                Transaction processed securely. GDPR-compliant.
              </div>
            </div>

            {/* Platform statistics (Impressive UX additions) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-left">
                <div className="flex items-center space-x-2 text-xs text-gray-400 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Success Rate</span>
                </div>
                <div className="text-xl font-bold">99.8%</div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 text-left">
                <div className="flex items-center space-x-2 text-xs text-gray-400 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                  <span>Settlement</span>
                </div>
                <div className="text-xl font-bold">Instant</div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Global Status Modal Overlay */}
      <PaymentStatusBanner
        status={paymentStatus}
        details={paymentDetails}
        locale={locale}
        onClose={() => setPaymentStatus(null)}
      />
    </div>
  );
}
