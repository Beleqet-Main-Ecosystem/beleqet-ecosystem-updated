"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * TSDoc: AffiliateDashboard manages onboarding forms, link generation, 
 * and operational metrics for platform advocates using local design tokens.
 */
export default function AffiliateDashboard() {
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [referralLink, setReferralLink] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Mock initial dashboard metrics state
  const [metrics] = useState({
    clicks: 142,
    referrals: 18,
    earnings: 2450.00
  });

  /** Generates a localized unique affiliate tracking link */
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        transition: "background-color var(--transition-base), color var(--transition-base)",
      }}
    >
      
      {/* Decorative Cloud Background Glow using your native tokens */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: 0.12,
        zIndex: 0
      }}>
        <div style={{
          width: "700px",
          height: "450px",
          background: "radial-gradient(circle, var(--accent-blue) 0%, transparent 70%)",
          filter: "blur(80px)",
          position: "absolute",
          top: "5%"
        }}></div>
      </div>

      {/* Styled Header matching your .page-header specifications */}
      <header className="page-header" style={{ position: "relative", zIndex: 10 }}>
        <div>
          <div className="flex items-center gap-3">
            {/* Native Brand Cloud SVG */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--accent-blue)" }}>
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
            </svg>
            <h1 className="page-header-title" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Beleqet Affiliate Center
            </h1>
          </div>
          <p className="page-header-subtitle">Build the ecosystem network and track your professional advocacy rewards.</p>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content Area using your layout patterns */}
      <main className="page-body" style={{ position: "relative", zIndex: 10, maxWidth: "800px", margin: "0 auto" }}>
        
        {!isRegistered ? (
          <div style={{ animation: "slideUp 0.3s ease", display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Card 1: Brand System Value Showcase */}
            <div className="card" style={{ textAlign: "center", padding: "40px 32px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>Welcome to Beleqet Advocates</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "32px", maxWidth: "520px", margin: "0 auto 32px" }}>
                Join the program to start selling success, amplify tech reach, and build the brand's affiliate network.
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", textAlign: "left", maxWidth: "520px", margin: "0 auto" }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-green)", fontWeight: "bold" }}>✓</span>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>High Commissions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-blue)", fontWeight: "bold" }}>📊</span>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Performance Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-purple)", fontWeight: "bold" }}>🛡️</span>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Dedicated Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-amber)", fontWeight: "bold" }}>🌐</span>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Grow Your Network</span>
                </div>
              </div>
            </div>

            {/* Card 2: Interactive Advocate Entry Form */}
            <div className="card" style={{ padding: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", textAlign: "center" }}>Become a Beleqet Advocate</h3>
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" required placeholder="Full Name (e.g. Abebe kebede)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" required placeholder="Email Address" />
                </div>
                <div className="form-group">
                  <label className="form-label">Company / Website (Optional)</label>
                  <input type="text" placeholder="Company / Website (Optional)" />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px", padding: "12px" }}>
                  Activate My Portal
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Active Analytics View matching dashboard grid styles */
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Live Link Assignment Shell */}
            <div className="card">
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "6px" }}>Your Unique Promotion Link</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>Share this unique tracking link across your tech channels to collect dynamic metrics.</p>
              <div style={{ display: "flex", gap: "12px" }}>
                <input 
                  type="text" 
                  readOnly 
                  value={referralLink} 
                  style={{ fontFamily: "monospace", fontSize: "13px" }} 
                />
                <button onClick={copyToClipboard} className="btn btn-primary" style={{ whiteSpace: "nowrap", padding: "0 24px" }}>
                  {copied ? "Copied! ✓" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Performance Metric Modules mapping directly to your .stats-grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--accent-blue)" }}>🖱️</div>
                <span className="stat-card-label">Total Clicks</span>
                <span className="stat-card-value">{metrics.clicks}</span>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--accent-green)" }}>🚀</div>
                <span className="stat-card-label">Successful Referrals</span>
                <span className="stat-card-value">{metrics.referrals}</span>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon" style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--accent-purple)" }}>💰</div>
                <span className="stat-card-label">Accumulated Income</span>
                <span className="stat-card-value" style={{ color: "var(--accent-green)" }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(metrics.earnings)}
                </span>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Styled App Ecosystem Footer */}
      <footer style={{ marginTop: "60px", padding: "24px", textAlign: "center", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "13px", position: "relative", zIndex: 10 }}>
        <div className="flex items-center justify-between" style={{ maxWidth: "800px", margin: "0 auto", flexDirection: "column", gap: "8px" }}>
          <div className="flex gap-3">
            <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Support</a>
          </div>
          <p>Beleqet © Beleq-tech</p>
        </div>
      </footer>
    </div>
  );
}