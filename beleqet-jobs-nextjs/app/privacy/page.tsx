import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { createMetadata } from '@/lib/seo/generate-metadata';

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy | Beleqet Jobs',
  description:
    'Privacy Policy for the Beleqet Jobs platform and Beleqet Mobile application (com.beleqet.jobs). Learn how we collect, use, and protect your personal data.',
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 23, 2026';

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-gray-900">
      {/* Header Banner */}
      <section className="relative overflow-hidden bg-primary py-16 text-white lg:py-20">
        <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[50px] border-[#d8ff3e]/10 pointer-events-none" />
        <div className="container-page relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#d8ff3e] hover:underline mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-6 w-6 text-[#d8ff3e]" />
            <span className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              Legal &amp; Privacy
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Last Updated: {lastUpdated} · Applicable to Beleqet Web and Beleqet Mobile App (<code className="text-[#d8ff3e] font-mono text-xs">com.beleqet.jobs</code>)
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-12 rounded-2xl bg-white p-8 shadow-sm border border-black/5 sm:p-12">
          
          {/* Introduction */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-primary">1. Overview &amp; Scope</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              Beleqet (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the <strong>Beleqet Jobs</strong> ecosystem, including our website (<Link href="https://beleqet.com" className="text-primary font-semibold underline">beleqet.com</Link>) and the <strong>Beleqet Jobs Mobile Application</strong> (<code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-primary">com.beleqet.jobs</code>) published on Google Play and Apple App Store.
            </p>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              This Privacy Policy explains how we collect, use, disclose, and safeguard personal information when you use our job matching platform, freelance marketplace, and related services. By using Beleqet, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* Data Collected */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-primary">2. Information We Collect</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              We collect information that you provide directly, information collected automatically, and permissions granted when using mobile app features:
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="rounded-xl border border-gray-100 bg-[#faf9f5] p-5">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Account &amp; Profile Data
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  Full name, email address, phone number, location (city/subcity in Ethiopia or remote), profile pictures, professional experience, education, skills, and portfolio links.
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-[#faf9f5] p-5">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Job Applications &amp; Bids
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  Resumes (CV) uploaded in PDF/DOCX format, cover letters, proposed freelance bids, milestones, and direct communications between employers and freelancers.
                </p>
              </div>
            </div>
          </section>

          {/* Sensitive Mobile Permissions */}
          <section className="space-y-4 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/50 p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-emerald-950 flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-700" /> 3. Mobile Device Permissions (Google Play Disclosure)
            </h2>
            <p className="text-xs leading-relaxed text-emerald-900 sm:text-sm">
              The Beleqet Jobs Android application (<code className="font-mono text-xs font-bold text-emerald-950">com.beleqet.jobs</code>) requests specific hardware and OS permissions strictly to deliver core user features:
            </p>
            <ul className="space-y-3 text-xs sm:text-sm text-emerald-900 mt-3">
              <li className="flex items-start gap-2">
                <strong className="min-w-[120px] text-emerald-950">• Microphone (Audio):</strong>
                <span>
                  Used solely when you explicitly tap the <strong>Chat-to-Text</strong> voice recording button to dictate messages and search queries. Voice data is processed transiently for speech recognition and is <em>never</em> recorded continuously, stored indefinitely, or sold to third parties.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <strong className="min-w-[120px] text-emerald-950">• Storage / Photos:</strong>
                <span>
                  Used solely to allow you to select and upload your resume/CV files (PDF, DOCX) and profile photos. The app does not access photos or files outside of those explicitly chosen by you.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <strong className="min-w-[120px] text-emerald-950">• Notifications:</strong>
                <span>
                  Used to notify you about application status changes, new job alerts matching your preferences, interview invitations, and freelance proposal responses. You can disable notifications anytime in your device settings.
                </span>
              </li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-primary">4. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 sm:text-base">
              <li>To match job seekers with verified employers and freelance clients.</li>
              <li>To process employer job listings, candidate screening, and application tracking.</li>
              <li>To secure freelance transactions and escrow milestones.</li>
              <li>To send critical system updates, verification emails, and security notifications.</li>
              <li>To detect and prevent fraudulent postings, spam, and platform abuse.</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-primary">5. Information Sharing &amp; Third Parties</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              We do <strong>not</strong> sell, rent, or trade your personal data. We only share information in the following limited contexts:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 sm:text-base">
              <li><strong>With Employers / Clients:</strong> When you submit a job application or a freelance bid, the employer receives your resume, cover letter, and profile details.</li>
              <li><strong>Essential Infrastructure Providers:</strong> Trusted cloud hosting providers, database services, and notification delivery services (such as Expo and Google Play Services) under strict data confidentiality agreements.</li>
              <li><strong>Legal Compliance:</strong> When required by Ethiopian law, court orders, or governmental regulations.</li>
            </ul>
          </section>

          {/* Account & Data Deletion */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> 6. Data Retention &amp; User Account Deletion (User Rights)
            </h2>
            <p className="text-sm leading-relaxed text-gray-700 sm:text-base">
              You retain full control over your personal data:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 sm:text-base">
              <li><strong>Access &amp; Update:</strong> You may edit or update your profile details and CV at any time directly through your account dashboard or mobile profile.</li>
              <li><strong>Account Deletion:</strong> You may request permanent deletion of your account and all associated personal data by emailing us at <a href="mailto:support@beleqet.com" className="font-semibold text-primary underline">support@beleqet.com</a> with the subject line <em>&quot;Account Deletion Request&quot;</em>.</li>
              <li><strong>Turnaround:</strong> Upon receiving your verified deletion request, all personal data, uploaded resumes, and contact history will be permanently deleted or anonymized within 30 days, subject to legal compliance requirements.</li>
            </ul>
          </section>

          {/* Security */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-primary">7. Data Security</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              We employ industry-standard technical measures to protect your information, including TLS/HTTPS encryption for data in transit, encrypted credential storage, and role-based administrative access controls.
            </p>
          </section>

          {/* Contact */}
          <section className="space-y-4 border-t border-gray-100 pt-8">
            <h2 className="text-2xl font-bold tracking-tight text-primary">8. Contact Us</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
              If you have any questions or concerns regarding this Privacy Policy or our data practices, please contact our privacy team:
            </p>
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm space-y-1.5">
              <p className="font-bold text-gray-900">Beleqet Platform Team</p>
              <p className="text-gray-600">Addis Ababa, Ethiopia</p>
              <p className="text-gray-600">
                Email: <a href="mailto:support@beleqet.com" className="text-primary font-semibold underline">support@beleqet.com</a> / <a href="mailto:privacy@beleqet.com" className="text-primary font-semibold underline">privacy@beleqet.com</a>
              </p>
              <p className="text-gray-600">
                Website: <Link href="https://beleqet.com" className="text-primary font-semibold underline">https://beleqet.com</Link>
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
