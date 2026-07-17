"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle"; // Adjust path if needed

/**
 * TSDoc: AffiliateDashboard manages onboarding forms, link generation, 
 * and operational metrics for platform advocates.
 * This acts as the entry page for the /affiliate route.
 */
export default function AffiliateDashboard() {
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [referralLink, setReferralLink] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});

  // Mock initial metrics state
  const [metrics] = useState({
    clicks: 142,
    referrals: 18,
    earnings: 2450.00
  });

  const fullNamePattern = /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/;
  const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  /** Generates a localized unique affiliate tracking link */
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const validationErrors: { fullName?: string; email?: string } = {};

    if (!trimmedName) {
      validationErrors.fullName = "Please enter your company or full name.";
    } else if (!fullNamePattern.test(trimmedName)) {
      validationErrors.fullName = "Name can only include letters, spaces, hyphens, and apostrophes.";
    }

    if (!trimmedEmail) {
      validationErrors.email = "Please enter your email address.";
    } else if (!emailPattern.test(trimmedEmail)) {
      validationErrors.email = "Please enter a valid email like example@domain.com.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setReferralLink(`https://beleqet.com/register?ref=${uniqueId}`);
    setIsRegistered(true);
  };

  /** Copies link to clipboard with brief UI state update */
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-pageBg dark:bg-primary text-textInk dark:text-pageBg p-6 transition-colors duration-300">
      
      {/* Header section with Theme Toggle */}
      <header className="flex justify-between items-center border-b border-border dark:border-darkGreen pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brandGreen dark:text-success">Beleqet Affiliate Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage links, track conversions, and earn rewards</p>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto space-y-8">
        
        {/* Step 1: Onboarding / Registration Panel */}
        {!isRegistered ? (
          <div className="bg-white dark:bg-darkGreen p-6 rounded-xl shadow-md border border-border dark:border-transparent">
            <h2 className="text-xl font-semibold mb-2">Join the Affiliate Program</h2>
            <p className="text-sm mb-4 text-gray-600 dark:text-gray-300">
              Promote top vacancies on Beleqet and earn commissions on successful recommendations.
            </p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company or Full Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full p-2 border border-border rounded bg-transparent dark:border-brandGreen focus:ring-2 focus:ring-success outline-none" 
                  placeholder="Enter name..."
                  aria-invalid={errors.fullName ? "true" : "false"}
                />
                {errors.fullName ? (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fullName}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full p-2 border border-border rounded bg-transparent dark:border-brandGreen focus:ring-2 focus:ring-success outline-none"
                  placeholder="Enter email..."
                  aria-invalid={errors.email ? "true" : "false"}
                />
                {errors.email ? (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                ) : null}
              </div>

              <button 
                type="submit"
                className="bg-brandGreen hover:bg-darkGreen dark:bg-success dark:hover:bg-green-600 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Activate My Portal
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: Active Dashboard View */
          <div className="space-y-6">
            
            {/* Referral Link Workspace */}
            <div className="bg-white dark:bg-darkGreen p-6 rounded-xl shadow-md border border-border dark:border-transparent">
              <h2 className="text-xl font-semibold mb-2">Your Unique Promotion Link</h2>
              <div className="flex gap-2 mt-3">
                <input 
                  type="text" 
                  readOnly 
                  value={referralLink}
                  className="w-full p-2 bg-pageBg dark:bg-primary border border-border dark:border-transparent rounded font-mono text-sm"
                />
                <button 
                  onClick={copyToClipboard}
                  className="bg-cyanAccent text-primary dark:bg-cyanAccent font-medium py-2 px-4 rounded hover:bg-cyan-400 transition-colors shrink-0"
                >
                  {copied ? "Copied! ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-darkGreen p-6 rounded-xl shadow-md border border-border dark:border-transparent">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Clicks</p>
                <p className="text-3xl font-bold mt-1 text-orangeAccent">{metrics.clicks}</p>
              </div>
              <div className="bg-white dark:bg-darkGreen p-6 rounded-xl shadow-md border border-border dark:border-transparent">
                <p className="text-sm text-gray-500 dark:text-gray-400">Successful Referrals</p>
                <p className="text-3xl font-bold mt-1 text-purpleAccent">{metrics.referrals}</p>
              </div>
              <div className="bg-white dark:bg-darkGreen p-6 rounded-xl shadow-md border border-border dark:border-transparent">
                <p className="text-sm text-gray-500 dark:text-gray-400">Accumulated Income</p>
                <p className="text-3xl font-bold mt-1 text-success">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(metrics.earnings)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}