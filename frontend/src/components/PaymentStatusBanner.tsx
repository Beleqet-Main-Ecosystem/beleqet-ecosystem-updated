'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Copy, Check } from 'lucide-react';
import { translations, Locale } from '../utils/translations';

interface PaymentStatusBannerProps {
  status: 'SUCCESS' | 'CANCELLED' | 'FAILED' | null;
  details: {
    orderId?: string;
    captureId?: string;
    subscriptionId?: string;
    amount?: number;
    currency?: string;
  } | null;
  locale: Locale;
  onClose: () => void;
}

/**
 * Premium payment status feedback card.
 * Uses glassmorphism and animated icons to deliver a professional success/error state.
 */
export default function PaymentStatusBanner({
  status,
  details,
  locale,
  onClose,
}: PaymentStatusBannerProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const t = translations[locale];

  if (!status) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'SUCCESS':
        return {
          bg: 'bg-emerald-950/40 border-emerald-500/30',
          icon: <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />,
          title: t.successTitle,
          desc: t.successDesc,
          textColor: 'text-emerald-200',
        };
      case 'FAILED':
        return {
          bg: 'bg-rose-950/40 border-rose-500/30',
          icon: <XCircle className="w-12 h-12 text-rose-400 animate-pulse" />,
          title: t.failedTitle,
          desc: t.failedDesc,
          textColor: 'text-rose-200',
        };
      case 'CANCELLED':
        return {
          bg: 'bg-amber-950/40 border-amber-500/30',
          icon: <AlertTriangle className="w-12 h-12 text-amber-400 animate-pulse" />,
          title: t.cancelledTitle,
          desc: t.cancelledDesc,
          textColor: 'text-amber-200',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
      <div className={`w-full max-w-lg p-6 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all scale-100 ${config.bg}`}>
        <div className="flex flex-col items-center text-center space-y-4">
          {config.icon}
          
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight text-white">{config.title}</h3>
            <p className={`text-sm ${config.textColor}`}>{config.desc}</p>
          </div>

          {details && (
            <div className="w-full mt-4 p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-left text-sm text-gray-300 font-mono">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-gray-400 text-xs tracking-wider uppercase">{t.status}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 
                  status === 'CANCELLED' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {status}
                </span>
              </div>

              {details.amount && details.currency && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{t.amount}</span>
                  <span className="text-white font-semibold">
                    {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'am-ET', {
                      style: 'currency',
                      currency: details.currency,
                    }).format(details.amount)}
                  </span>
                </div>
              )}

              {details.orderId && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{t.orderId}</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-white text-xs">{details.orderId.substring(0, 14)}...</span>
                    <button 
                      onClick={() => copyToClipboard(details.orderId!, 'order')}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      {copiedField === 'order' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {details.captureId && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{t.captureId}</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-white text-xs">{details.captureId.substring(0, 14)}...</span>
                    <button 
                      onClick={() => copyToClipboard(details.captureId!, 'capture')}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      {copiedField === 'capture' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {details.subscriptionId && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{t.subscriptionId}</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-white text-xs">{details.subscriptionId}</span>
                    <button 
                      onClick={() => copyToClipboard(details.subscriptionId!, 'subscription')}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      {copiedField === 'subscription' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="w-full pt-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white font-medium transition duration-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
