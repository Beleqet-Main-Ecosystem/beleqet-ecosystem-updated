import Link from 'next/link';
import { Shield, Sparkles, ArrowRight, DollarSign, RefreshCw, Lock } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden flex flex-col justify-between">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-green-500/5 blur-[150px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-20 flex-grow flex flex-col justify-center items-center text-center space-y-10 relative z-10">
        
        {/* Animated Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PayPal Global Digital Wallet Live</span>
        </div>

        {/* Catchy Hero Text */}
        <div className="space-y-4 max-w-4xl">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-gray-200 to-gray-500 bg-clip-text text-transparent leading-tight">
            Connecting Ethiopian Freelancers <br className="hidden md:inline"/>
            to the Global Market
          </h1>
          <p className="text-gray-400 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Task ID: <code className="text-emerald-400 font-mono">Global-Payments-002</code>. A premium escrow, recurring billing, and dispute management integration powered by NestJS and PayPal REST SDK v2.
          </p>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link
            href="/paypal-demo"
            className="group px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-base shadow-xl shadow-white/5 flex items-center space-x-2 transition duration-200"
          >
            <span>Launch Payment Workspace</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-semibold text-base transition duration-200"
          >
            Explore API Documentation
          </a>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-16 w-full text-left">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white">Escrow Protection</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Employer funds are safely held in PayPal escrow vaulting, only released to freelancers upon successful milestone completions.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white">Recurring billing</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Handles subscription agreements, monthly plan logic, suspension, and cancel workflows with instant database synchronization.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white">GDPR & PII Privacy</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Full data protection in transit (TLS 1.3) and at rest. Personally Identifiable Information is soft-deleted or anonymized on request.
            </p>
          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-gray-500 font-mono relative z-10">
        © 2026 Beleqet Solutions Ecosystem • Developed by Antigravity
      </footer>
    </div>
  );
}

