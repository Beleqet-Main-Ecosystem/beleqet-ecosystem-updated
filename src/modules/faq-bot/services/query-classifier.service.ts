import { Injectable } from '@nestjs/common';

export interface ClassificationResult {
  intent: string;
  confidence: number;
  matchedKeywords: string[];
}

/** Intent patterns mapped to FAQ categories and slugs. */
const INTENT_PATTERNS: Record<string, { keywords: string[]; slug?: string }> = {
  wallet_withdraw: {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'telebirr', 'chapa', 'cbe birr', 'wallet balance', 'get my money'],
    slug: 'wallet-withdrawal',
  },
  escrow_funding: {
    keywords: ['escrow', 'fund project', 'secure payment', 'beleqetsafe', 'hold period', 'release payment'],
    slug: 'escrow-overview',
  },
  job_application: {
    keywords: ['apply', 'application', 'job apply', 'submit resume', 'cv', 'cover letter'],
    slug: 'job-application',
  },
  freelance_bidding: {
    keywords: ['bid', 'freelance', 'gig', 'proposal', 'milestone', 'contract'],
    slug: 'freelance-bidding',
  },
  account_security: {
    keywords: ['password', 'login', 'account', 'verify email', 'two factor', 'security'],
    slug: 'account-security',
  },
  fees_pricing: {
    keywords: ['fee', 'commission', 'platform fee', 'pricing', 'cost', 'charge'],
    slug: 'platform-fees',
  },
  currency_conversion: {
    keywords: ['currency', 'exchange', 'usd', 'eur', 'etb', 'convert', 'dollar'],
    slug: 'multi-currency',
  },
  support_contact: {
    keywords: ['support', 'help', 'contact', 'human agent', 'talk to someone'],
    slug: 'contact-support',
  },
};

/**
 * Classifies user queries using keyword and intent matching (NLP-lite).
 * Provides a fast path before vector search and AI generation.
 */
@Injectable()
export class QueryClassifierService {
  /**
   * Score a user query against known intent keyword patterns.
   * @param query - Raw user message
   * @returns Classification with intent, confidence, and matched keywords
   */
  classify(query: string): ClassificationResult {
    const normalized = query.toLowerCase().trim();
    let bestIntent = 'unknown';
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
      const matched = config.keywords.filter((kw) => normalized.includes(kw.toLowerCase()));
      if (matched.length === 0) continue;

      const score = Math.min(0.95, 0.5 + matched.length * 0.15);
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
        bestKeywords = matched;
      }
    }

    return {
      intent: bestIntent,
      confidence: bestScore,
      matchedKeywords: bestKeywords,
    };
  }

  /**
   * Resolve the FAQ slug associated with a classified intent.
   * @param intent - Intent identifier from classify()
   */
  getSlugForIntent(intent: string): string | undefined {
    return INTENT_PATTERNS[intent]?.slug;
  }
}
