import { FaqBotWidget } from '@/components/FaqBotWidget';

export default function HomePage() {
  return (
    <main className="page">
      <span className="badge">feat/faq-bot-henok-tilahun</span>
      <h1>Beleqet FAQ Bot</h1>
      <p>
        AI-powered assistant module for the Beleqet ecosystem. Open the floating chat widget
        to ask about wallet withdrawals, BeleqetSafe escrow, job applications, freelance bidding,
        and more — with real-time streaming, i18n, GDPR consent, and multi-currency support.
      </p>
      <FaqBotWidget />
    </main>
  );
}
