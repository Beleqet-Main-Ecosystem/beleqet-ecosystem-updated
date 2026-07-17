/**
 * FAQ knowledge base seed data for the Beleqet FAQ Bot.
 * Embeddings are generated at seed time when OPENAI_API_KEY is configured.
 */
export const FAQ_KNOWLEDGE_SEED = [
  {
    slug: 'wallet-withdrawal',
    category: 'wallet',
    questionEn: 'How do I withdraw money from my freelancer wallet?',
    questionAm: 'ከፍሪላንስ ቦርሳዬ ገንዘብ እንዴት እውጣ?',
    answerEn:
      'Go to Freelance > Wallet, enter your withdrawal amount (minimum {{MIN_WITHDRAWAL}}), choose CHAPA, Telebirr, or CBE Birr, and submit. Funds typically arrive within 1-3 business days after the 3-day hold period clears.',
    answerAm:
      'ወደ Freelance > Wallet ይሂዱ፣ የማውጣት መጠን ያስገቡ (ቢያንስ {{MIN_WITHDRAWAL}})፣ CHAPA፣ Telebirr ወይም CBE Birr ይምረጡ እና ይላኩ። 3 ቀን hold ከተጠናቀቀ በኋላ 1-3 የስራ ቀናት ውስጥ ገንዘቡ ይደርሳል።',
    keywords: ['withdraw', 'withdrawal', 'wallet', 'telebirr', 'chapa', 'cbe birr', 'cash out'],
    currency: 'ETB',
  },
  {
    slug: 'escrow-overview',
    category: 'escrow',
    questionEn: 'How does BeleqetSafe escrow work?',
    questionAm: 'BeleqetSafe escrow እንዴት ይሰራል?',
    answerEn:
      'BeleqetSafe holds your project funds securely until milestones are approved. A platform fee of {{ESCROW_FEE}} applies. After funding, freelancers can bid. Once work is approved, funds move to the freelancer wallet after a 3-day review hold.',
    answerAm:
      'BeleqetSafe holds project funds until milestones are approved. Platform fee is {{ESCROW_FEE}}. After funding, freelancers can submit bids.',
    keywords: ['escrow', 'beleqetsafe', 'fund', 'milestone', 'hold', 'release payment'],
    currency: 'ETB',
  },
  {
    slug: 'job-application',
    category: 'jobs',
    questionEn: 'How do I apply for a job on Beleqet?',
    questionAm: 'በበልቀት ላይ ለስራ እንዴት እመደምር?',
    answerEn:
      'Browse Jobs, open a listing, and click Apply. Upload your resume, write a cover letter, and answer any screening questions. You can track application status from your dashboard.',
    answerAm:
      'Jobs ይመልከቱ፣ listing ይክፈቱ እና Apply ይጫኑ። Resume ይ upload ያድርጉ፣ cover letter ይፃፉ እና screening ጥያቄዎችን ይመልሱ።',
    keywords: ['apply', 'application', 'job', 'resume', 'cv', 'cover letter'],
  },
  {
    slug: 'freelance-bidding',
    category: 'freelance',
    questionEn: 'How do I bid on a freelance project?',
    questionAm: 'በፍሪላንስ ፕሮጀክት ላይ bid እንዴት እقدم?',
    answerEn:
      'Find a funded project in Freelance > Browse Gigs. Submit your bid amount, timeline, and cover letter. The client reviews bids and accepts one to start a contract with milestones.',
    answerAm:
      'በ Freelance > Browse Gigs funded ፕሮጀክት ያግኙ። bid amount፣ timeline እና cover letter ያስገቡ። client bid ይገምግማል እና contract ይጀምራል።',
    keywords: ['bid', 'freelance', 'gig', 'proposal', 'milestone', 'contract'],
  },
  {
    slug: 'account-security',
    category: 'account',
    questionEn: 'How do I keep my Beleqet account secure?',
    questionAm: 'መለያዬን እንዴት ደህንነቱ የተጠበቀ አድርገ?',
    answerEn:
      'Use a strong unique password (12+ characters), verify your email, and never share your login credentials. Contact support immediately if you notice suspicious activity.',
    answerAm:
      'ጠንካራ unique password (12+ characters) ይጠቀሙ፣ email ያረጋግጡ እና credentials አይጋሩ። suspicious activity ካዩ support ያግኙ።',
    keywords: ['password', 'login', 'account', 'security', 'verify email'],
  },
  {
    slug: 'platform-fees',
    category: 'fees',
    questionEn: 'What fees does Beleqet charge?',
    questionAm: 'በልቀት ምን fees ይጠይቃል?',
    answerEn:
      'BeleqetSafe escrow charges a platform fee of {{ESCROW_FEE}} on funded projects. Withdrawal fees depend on your chosen payment provider (CHAPA, Telebirr, CBE Birr).',
    answerAm:
      'BeleqetSafe escrow {{ESCROW_FEE}} platform fee ይጠይቃል። withdrawal fees በ payment provider ይለያያሉ።',
    keywords: ['fee', 'commission', 'platform fee', 'pricing', 'cost'],
    currency: 'ETB',
  },
  {
    slug: 'multi-currency',
    category: 'wallet',
    questionEn: 'Which currencies does Beleqet support?',
    questionAm: 'በልቀት ምን currencies ይደግፋል?',
    answerEn:
      'Beleqet supports ETB, USD, and EUR. Wallet balances are stored in ETB; amounts display in your preferred currency using live exchange rates. Minimum withdrawal is {{MIN_WITHDRAWAL}}.',
    answerAm:
      'Beleqet supports ETB, USD, and EUR. Wallet balances are stored in ETB. Minimum withdrawal is {{MIN_WITHDRAWAL}}.',
    keywords: ['currency', 'exchange', 'usd', 'eur', 'etb', 'convert', 'dollar'],
    currency: 'ETB',
  },
  {
    slug: 'contact-support',
    category: 'support',
    questionEn: 'How do I contact Beleqet support?',
    questionAm: 'የበልቀት support እንዴት እገናኝ?',
    answerEn:
      'Use the Contact page or email support@beleqet.com. For urgent payment issues, include your transaction reference. Our team typically responds within 24 hours.',
    answerAm:
      'Contact page ወይም support@beleqet.com ይጠቀሙ። urgent payment issues transaction reference ያካትቱ።',
    keywords: ['support', 'help', 'contact', 'human agent', 'email'],
  },
] as const;
