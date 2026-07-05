'use client';

import { FormEvent, useState } from 'react';
import { useFaqBotStream } from '@/lib/useFaqBotStream';
import { t, type Currency, type Locale } from '@/lib/translations';

/**
 * Floating FAQ Bot chat widget with GDPR consent, i18n, and real-time streaming.
 */
export function FaqBotWidget() {
  const [open, setOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [input, setInput] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [currency, setCurrency] = useState<Currency>('ETB');
  const [starting, setStarting] = useState(false);

  const { sessionId, messages, isStreaming, error, startSession, sendMessage } =
    useFaqBotStream(locale, currency);

  const handleConsent = async () => {
    setStarting(true);
    try {
      await startSession();
      setConsented(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="faq-fab"
          onClick={() => setOpen(true)}
          aria-label={t(locale, 'openChat')}
        >
          💬
        </button>
      )}

      {open && (
        <div className="faq-panel" role="dialog" aria-label={t(locale, 'title')}>
          <header className="faq-header">
            <div>
              <strong>{t(locale, 'title')}</strong>
              <p>{t(locale, 'subtitle')}</p>
            </div>
            <button type="button" className="faq-close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>

          <div className="faq-controls">
            <label>
              {t(locale, 'language')}
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </label>
            <label>
              {t(locale, 'currency')}
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="ETB">ETB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>

          {!consented || !sessionId ? (
            <div className="faq-consent">
              <h3>{t(locale, 'consentTitle')}</h3>
              <p>{t(locale, 'consentBody')}</p>
              <div className="faq-consent-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  {t(locale, 'consentDecline')}
                </button>
                <button type="button" className="primary" onClick={handleConsent} disabled={starting}>
                  {starting ? t(locale, 'thinking') : t(locale, 'consentAccept')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="faq-messages">
                {messages.map((msg) => (
                  <div key={msg.id} className={`faq-msg faq-msg-${msg.role}`}>
                    <span>{msg.content || (msg.streaming ? t(locale, 'thinking') : '')}</span>
                  </div>
                ))}
                {error && <div className="faq-error">{error}</div>}
              </div>

              <p className="faq-hint">{t(locale, 'demoHint')}</p>

              <form className="faq-input-row" onSubmit={handleSubmit}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t(locale, 'placeholder')}
                  disabled={isStreaming}
                  maxLength={2000}
                />
                <button type="submit" disabled={isStreaming || !input.trim()}>
                  {t(locale, 'send')}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
