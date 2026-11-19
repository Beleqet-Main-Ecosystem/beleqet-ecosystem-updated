/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { 
  Users, Wallet, Share2, 
  ChevronRight, X, Copy, Check, Home, User, ShieldCheck, Zap, Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// The API is served from the same address as this page, under /api. Every request carries the
// initData Telegram signed for this user; the API refuses requests without it.
const api = (path: string, options: { method?: string; body?: string } = {}) =>
  fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': WebApp.initData },
  });

interface UserData {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

interface UserStats {
  balance: number;
  totalReferrals: number;
  activeReferrals: number;
}

type TabType = 'home' | 'earning' | 'profile';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [stats, setStats] = useState<UserStats>({
    balance: 0,
    totalReferrals: 0,
    activeReferrals: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Withdrawal Modal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState<{type: 'success' | 'error' | null, msg: string}>({ type: null, msg: '' });

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    // Detect Device Theme
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(systemPrefersDark);

    const user = WebApp.initDataUnsafe?.user;
    if (user) {
      setUserData(user as UserData);
      loadData(user.id);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadData = async (userId: number) => {
    try {
      const response = await api(`/api/user/${userId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats({
          balance: data.balance || 0,
          totalReferrals: data.totalReferrals || 0,
          activeReferrals: data.activeReferrals || 0
        });
      }
    } catch (error) {
      console.error("Data fetch error", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Safety check for Haptic Feedback (version 6.1+)
  const safeHaptic = (type: 'impact' | 'notification', style: any) => {
    if (WebApp.isVersionAtLeast('6.1')) {
      if (type === 'impact') WebApp.HapticFeedback.impactOccurred(style);
      if (type === 'notification') WebApp.HapticFeedback.notificationOccurred(style);
    }
  };

  const inviteLink = `https://t.me/BeleqetJobsInviteAndWin_Bot?start=${userData?.id || 'join'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    safeHaptic('notification', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = () => {
    WebApp.switchInlineQuery(inviteLink, ["users", "groups"]);
    safeHaptic('impact', 'medium');
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    safeHaptic('impact', 'light');
  };

  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawStatus({ type: null, msg: '' });
    if (!withdrawAmount || !withdrawPhone) return;

    try {
      const response = await api('/api/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userData?.id,
          amount: parseInt(withdrawAmount),
          phone_number: withdrawPhone
        })
      });

      if (response.ok) {
        setWithdrawStatus({ type: 'success', msg: 'Request Sent!' });
        setStats(prev => ({ ...prev, balance: prev.balance - parseInt(withdrawAmount) }));
        setTimeout(() => setIsWithdrawOpen(false), 2000);
      } else {
        const data = await response.json();
        setWithdrawStatus({ type: 'error', msg: data.detail || 'Failed.' });
      }
    } catch {
      setWithdrawStatus({ type: 'error', msg: 'Network Error.' });
    }
  };

  if (isLoading) return (
    <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-[#121212]' : 'bg-[#f1f2f6]'}`}>
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#2481cc]"></div>
    </div>
  );

  return (
    <div className={`min-h-screen pb-28 font-sans transition-colors duration-300 relative overflow-x-hidden ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#f1f2f6] text-[#2c3e50]'}`}>
      
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} px-6 pt-8 pb-12 rounded-b-[3rem] shadow-sm mb-6 border-b transition-colors duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#2481cc] p-0.5">
              <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold ${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                {userData?.photo_url ? (
                  <img src={userData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userData?.first_name?.charAt(0) || 'B'
                )}
              </div>
            </div>
            <div>
              <h1 className="font-black text-xl leading-tight tracking-tight">{userData?.first_name}</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck size={10} className="text-green-500" /> Registered Member
              </p>
            </div>
          </div>
          
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-2xl transition-all active:scale-90 ${isDarkMode ? 'bg-[#2a2a2a] text-yellow-400' : 'bg-[#eef5fd] text-[#2481cc]'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="px-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} p-6 rounded-[2.5rem] shadow-sm border relative overflow-hidden`}>
                <div className="relative z-10">
                  <h2 className="font-black text-2xl mb-2">Hello, {userData?.first_name}!</h2>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm leading-relaxed mb-4`}>
                    Share Beleqet Academy with friends and earn 1.00 ETB per referral.
                  </p>
                  <button onClick={() => setActiveTab('earning')} className="bg-[#2481cc] text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-2">
                    GO TO EARNINGS <Zap size={14} fill="white" />
                  </button>
                </div>
                <div className={`absolute -right-4 -bottom-4 rotate-12 ${isDarkMode ? 'opacity-[0.03]' : 'opacity-5'}`}>
                  <Users size={120} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} p-5 rounded-[2rem] border shadow-sm text-center`}>
                  <p className="text-2xl font-black">{stats.totalReferrals}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total Invites</p>
                </div>
                <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} p-5 rounded-[2rem] border shadow-sm text-center`}>
                  <p className="text-2xl font-black text-green-500">{stats.balance.toFixed(0)}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total Birr</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'earning' && (
            <motion.div key="earning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-[#2481cc] p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col items-center">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Available Balance</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black">{stats.balance.toFixed(2)}</span>
                  <span className="text-lg font-bold">ETB</span>
                </div>
                <Wallet size={100} className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-10" />
              </div>

              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 pt-4">Rewards</h3>
              
              <button 
                onClick={handleCopyLink}
                className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} w-full p-5 rounded-3xl flex items-center justify-between border shadow-sm active:scale-95 transition-all text-left`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${copied ? 'bg-green-100 text-green-600' : (isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600')}`}>
                    {copied ? <Check size={24} /> : <Copy size={24} />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">Copy Referral Link</p>
                    <p className="text-xs text-gray-400">Manual Share</p>
                  </div>
                </div>
              </button>

              <button 
                onClick={handleShareLink}
                className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} w-full p-5 rounded-3xl flex items-center justify-between border shadow-sm active:scale-95 transition-all text-left`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2481cc]'} p-4 rounded-2xl`}>
                    <Share2 size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Direct Share</p>
                    <p className="text-xs text-gray-400">Invite Telegram Friends</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </button>

              <button 
                onClick={() => setIsWithdrawOpen(true)}
                className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} w-full p-5 rounded-3xl flex items-center justify-between border shadow-sm active:scale-95 transition-all text-left`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'} p-4 rounded-2xl`}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Withdrawal</p>
                    <p className="text-xs text-gray-400">Min Payout: 25 Birr</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </button>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} p-8 rounded-[3rem] border text-center shadow-sm`}>
                <div className="w-24 h-24 rounded-full border-4 border-[#2481cc] mx-auto mb-4 p-1">
                  <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center text-[#2481cc] text-3xl font-bold ${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                     {userData?.photo_url ? <img src={userData.photo_url} className="w-full h-full object-cover" /> : userData?.first_name?.charAt(0)}
                  </div>
                </div>
                <h3 className="font-black text-xl">{userData?.first_name} {userData?.last_name}</h3>
                <p className="text-xs text-gray-400 font-mono">@{userData?.username || 'no_username'}</p>
              </div>

              <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-[#2a2a2a]' : 'bg-white border-gray-100'} rounded-[2rem] overflow-hidden border shadow-sm p-2`}>
                <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-[#2a2a2a]' : 'border-gray-50'}`}>
                  <span className="text-sm font-bold text-gray-400">Telegram ID</span>
                  <span className="text-sm font-mono font-bold">{userData?.id}</span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm font-bold text-gray-400">Account Status</span>
                  <span className="text-[10px] font-black text-green-500 uppercase bg-green-500/10 px-3 py-1.5 rounded-full">Active</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className={`${isDarkMode ? 'bg-[#1e1e1e]/80 border-[#2a2a2a]' : 'bg-white/80 border-gray-100'} fixed bottom-0 left-0 w-full backdrop-blur-xl border-t px-8 py-5 flex justify-between items-center rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-40 transition-colors duration-300`}>
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'home' ? 'text-[#2481cc] scale-110' : 'text-gray-400'}`}>
          <Home size={24} fill={activeTab === 'home' ? 'currentColor' : 'none'} />
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('earning')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'earning' ? 'text-[#2481cc] scale-110' : 'text-gray-400'}`}>
          <Wallet size={24} fill={activeTab === 'earning' ? 'currentColor' : 'none'} />
          <span className="text-[9px] font-black uppercase tracking-widest">Earning</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'profile' ? 'text-[#2481cc] scale-110' : 'text-gray-400'}`}>
          <User size={24} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
          <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </nav>

      {/* Modal */}
      <AnimatePresence>
        {isWithdrawOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWithdrawOpen(false)} className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className={`${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'} fixed bottom-0 left-0 w-full rounded-t-[3rem] p-8 z-50`}>
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-2xl">Request Payout</h3>
                <button onClick={() => setIsWithdrawOpen(false)} className={`${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-100'} p-2.5 rounded-full`}><X size={20} /></button>
              </div>
              <form onSubmit={handleWithdrawRequest} className="space-y-5">
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount (ETB)" className={`${isDarkMode ? 'bg-[#2a2a2a] text-white' : 'bg-[#f1f2f6] text-black'} w-full rounded-[1.5rem] px-6 py-4 outline-none font-black text-xl`} />
                <input type="tel" value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} placeholder="Mobile Number" className={`${isDarkMode ? 'bg-[#2a2a2a] text-white' : 'bg-[#f1f2f6] text-black'} w-full rounded-[1.5rem] px-6 py-4 outline-none font-black text-xl`} />
                {withdrawStatus.msg && (
                  <p className={`text-center font-bold text-sm ${withdrawStatus.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{withdrawStatus.msg}</p>
                )}
                <button type="submit" className="w-full bg-[#2481cc] text-white font-black py-5 rounded-[1.5rem] shadow-xl">SUBMIT</button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}