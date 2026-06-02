"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, BarChart2, History, Settings, User } from 'lucide-react';
import WalletDashboard from './components/WalletDashboard';
import TradingDashboard from './components/TradingDashboard';
import TransactionHistory from './components/TransactionHistory';
import SettingsPanel from './components/SettingsPanel';
import AuthFlow from './components/auth/AuthFlow';
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
    addTransactionDb,
    depositReal,
    withdrawReal,
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
    addTransactionDb(tx);
  };

  const handleDeposit = async (amount: number, meta?: { orderId: string; utr?: string }) => {
    const res = meta?.orderId && profile?.sessionToken
      ? await finalizePayboltDeposit(profile.sessionToken, meta.orderId, amount, meta.utr)
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
    const res = await withdrawReal(amount);
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
        account: 'real',
      });
    }
    return res;
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0b0f] flex items-center justify-center">
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
            customerPhone=""
            sessionToken={profile?.sessionToken}
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
            customerPhone=""
            sessionToken={profile?.sessionToken}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
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
          <header className="h-16 flex-shrink-0 px-6 bg-[#0d0e14] border-b border-white/5 flex items-center justify-between z-30">
            <h1 className="text-sm font-black text-white uppercase tracking-[0.2em]">{TAB_TITLES[activeTab]}</h1>
            <button type="button" className="w-10 h-10 rounded-2xl bg-[#161821] border border-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </button>
          </header>
        )}

        <main className={`flex-1 relative overflow-y-auto scrollbar-hide transition-all ${isTransitioning ? 'opacity-0 scale-98' : 'opacity-100'} ${activeTab === 'send' ? 'pb-[72px] overflow-hidden' : 'pb-[90px]'}`}>
          <div className={`h-full w-full mx-auto ${activeTab === 'send' ? '' : 'max-w-7xl'}`}>
            {renderContent()}
          </div>
        </main>

        <nav className="md:hidden absolute bottom-0 left-0 right-0 z-50 h-[72px] bg-[#0d0e14]/90 backdrop-blur border-t border-white/10">
          <div className="flex items-center justify-around h-full px-2">
            {NAV.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} type="button" onClick={() => handleTabChange(id)} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`p-2 rounded-2xl ${active ? (id === 'send' ? 'bg-[#ffb300] text-black' : 'bg-blue-600 text-white') : 'text-gray-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[8px] font-black uppercase ${active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
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
