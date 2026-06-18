"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, BarChart2, History, Settings, User } from 'lucide-react';
import WalletDashboard from './components/WalletDashboard';
import TradingDashboard from './components/TradingDashboard';
import TransactionHistory from './components/TransactionHistory';
import SettingsPanel from './components/SettingsPanel';
import AuthFlow from './components/auth/AuthFlow';
import TradingChartDemo from './components/TradingChartDemo';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WITHDRAWAL_LIMIT } from './types/account';
import type { UserProfile } from './types/profile';
import { finalizePayboltDeposit } from './services/authService';

const NAV = [
  { id: 'send',      label: 'Trade',    Icon: BarChart2 },
  { id: 'history',   label: 'Activity', Icon: History   },
  { id: 'dashboard', label: 'Wallet',   Icon: Wallet    },
  { id: 'settings',  label: 'Settings', Icon: Settings  },
];

const TAB_TITLES: Record<string, string> = {
  send:      'Markets',
  history:   'Activity',
  dashboard: 'Wallet',
  settings:  'Settings',
};

function AppShell() {
  // Standalone chart preview: visit /?chart=1
  const params = new URLSearchParams(window.location.search);
  if (params.get("chart") === "1") {
    return (
      <div className="h-[100dvh] w-full bg-[#1a1a2e]">
        <TradingChartDemo />
      </div>
    );
  }

  const {
    isLoading,
    isAuthenticated,
    profile,
    completeLogin,
    accountMode,
    setAccountMode,
    demoBalance,
    realBalance,
    activeBalance,
    setActiveBalance,
    setDemoBalance,
    setRealBalance,
    addTransactionDb,
    depositReal,
    withdrawReal,
    withdrawFake,
    loadTransactions,
    refreshDashboard,
  } = useAuth();

  const [activeTab, setActiveTab] = useState('send');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transactions, setTransactions] = useState<Record<string, string>[]>([]);

  const handleTabChange = useCallback((id: string) => {
    if (id === activeTab) return;
    window.navigator.vibrate?.(10);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(id);
      setIsTransitioning(false);
    }, 150);
  }, [activeTab]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions().then(rows => {
        if (rows && rows.length > 0) setTransactions(rows);
      });
    }
  }, [isAuthenticated, loadTransactions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === '1') handleTabChange('dashboard');
        if (e.key === '2') handleTabChange('send');
        if (e.key === '3') handleTabChange('history');
        if (e.key === '4') handleTabChange('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTabChange]);

  const addTransaction = (tx: Record<string, string>) => {
    setTransactions(prev => [tx, ...prev]);
  };

  const handleDeposit = async (amount: number, meta?: { orderId: string; utr?: string }) => {
    const res = meta?.orderId
      ? await finalizePayboltDeposit(meta.orderId, amount, meta.utr)
      : await depositReal(amount, 'paybolt');
    if (res.success) {
      await refreshDashboard();
      addTransaction({
        id: meta?.orderId ?? `TX-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
        type: 'buy',
        coin: 'INR',
        amount: `+₹${amount.toLocaleString('en-IN')}`,
        usd: `+₹${amount.toLocaleString('en-IN')}`,
        price: '₹1.00',
        fee: '₹0.00',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: 'Today',
        status: 'completed',
        account: 'real',
      });
    }
    return res;
  };

  const handleWithdraw = async (amount: number) => {
    let res;
    if (accountMode === 'demo') {
      res = withdrawFake(amount);
    } else {
      res = await withdrawReal(amount);
    }
    if (res.success) {
      addTransaction({
        id: `TX-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
        type: 'sell',
        coin: 'INR',
        amount: `-₹${amount.toLocaleString('en-IN')}`,
        usd: `-₹${amount.toLocaleString('en-IN')}`,
        price: '₹1.00',
        fee: '₹0.00',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: 'Today',
        status: 'completed',
        account: accountMode,
      });
    }
    return res;
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0b0f] flex flex-col items-center justify-center gap-6">
        <img
          src="/logo/logo.png"
          alt="Tryonetrade"
          className="w-32 h-32 rounded-3xl object-cover shadow-[0_0_60px_rgba(37,99,235,0.4)] border-2 border-blue-400/30"
        />
        <div className="flex flex-col items-center gap-1">
          <span className="font-black text-2xl tracking-tighter text-white">TRYONETRADE</span>
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Loading...</span>
        </div>
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthFlow
        onComplete={(p: UserProfile) => {
          completeLogin(p);
          setActiveTab('send');
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <WalletDashboard
            accountMode={accountMode}
            setAccountMode={setAccountMode}
            demoBalance={demoBalance}
            realBalance={realBalance}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            withdrawalLimit={WITHDRAWAL_LIMIT}
            displayName={profile?.displayName ?? ''}
          />
        );
      case 'send':
        return (
          <TradingDashboard
            accountMode={accountMode}
            setAccountMode={setAccountMode}
            balance={activeBalance}
            setBalance={setActiveBalance}
            realBalance={realBalance}
            setDemoBalance={setDemoBalance}
            setRealBalance={setRealBalance}
            addTransaction={addTransaction}
          />
        );
      case 'history':
        return <TransactionHistory transactions={transactions} />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#0b0c10] text-white flex flex-col md:flex-row overflow-hidden font-space">
      <aside className="hidden md:flex flex-col w-20 lg:w-72 bg-[#0d0e14] border-r border-white/5 z-40 shadow-2xl">
        <div className="p-8 flex items-center gap-4">
          <img src="/logo/logo.png" alt="Tryonetrade" className="w-12 h-12 rounded-2xl object-cover shadow-[0_0_30px_rgba(37,99,235,0.4)] border border-blue-400/30" />
          <div className="hidden lg:flex flex-col">
            <span className="font-black text-2xl tracking-tighter text-white leading-none">TRYONETRADE</span>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-1">PRO TERMINAL</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-3 mt-8">
          {NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`w-full flex items-center gap-5 py-4 px-5 rounded-[1.25rem] transition-all ${
                  active ? 'bg-blue-600 text-white border border-blue-400/30' : 'text-gray-500 hover:bg-white/5'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="hidden lg:block font-black text-[15px]">{label}</span>
              </button>
            );
          })}
        </nav>
        {profile?.displayName && (
          <p className="hidden lg:block px-6 pb-6 text-xs text-gray-500 truncate">Hi, {profile.displayName}</p>
        )}
      </aside>

      <div className="flex-1 flex flex-col relative h-full w-full overflow-hidden">
        {activeTab !== 'send' && (
          <header className="h-12 flex-shrink-0 px-4 bg-[#0d0e14] border-b border-white/5 flex items-center justify-between z-30 sm:h-16 sm:px-6">
            <h1 className="text-xs font-black text-white uppercase tracking-[0.2em] sm:text-sm">{TAB_TITLES[activeTab]}</h1>
            <button type="button" className="w-8 h-8 rounded-xl bg-[#161821] border border-white/10 flex items-center justify-center sm:w-10 sm:h-10 sm:rounded-2xl">
              <User className="w-4 h-4 text-gray-400 sm:w-5 sm:h-5" />
            </button>
          </header>
        )}

        <main className={`flex-1 relative overflow-y-auto scrollbar-hide transition-all ${isTransitioning ? 'opacity-0 scale-98' : 'opacity-100'} ${activeTab === 'send' ? 'pb-[68px] overflow-hidden sm:pb-[72px] md:pb-0' : 'pb-[80px] sm:pb-[90px]'}`}>
          <div className={`h-full w-full mx-auto ${activeTab === 'send' ? 'max-w-full' : 'max-w-7xl'}`}>
            {renderContent()}
          </div>
        </main>

        <nav className="md:hidden absolute bottom-0 left-0 right-0 z-50 h-[68px] bg-[#0d0e14]/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] sm:h-[72px]">
          <div className="flex items-center justify-around h-full px-1 sm:px-2">
            {NAV.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} type="button" onClick={() => handleTabChange(id)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 active:scale-95 transition-all sm:gap-1">
                  <div className={`p-1.5 rounded-xl transition-all sm:p-2 sm:rounded-2xl ${active ? (id === 'send' ? 'bg-[#ffb300] text-black' : 'bg-blue-600 text-white') : 'text-gray-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[7px] font-black uppercase tracking-wider sm:text-[8px] ${active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
