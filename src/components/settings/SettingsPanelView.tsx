import React, { useState } from 'react';
import {
  Bell, Zap, LogOut, AlertTriangle,
  CheckCircle2, RefreshCw, Database, Wallet, IndianRupee,
  ArrowDownToLine, ArrowUpFromLine, Pencil, X, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WITHDRAWAL_LIMIT } from '../../types/account';
import { formatInr, shortUid } from './settingsFormat';
import { Row, Section, StatCard, Toggle } from './SettingsUi';

export default function SettingsPanelView() {
  const {
    profile, logout, demoBalance, realBalance, accountMode, setAccountMode,
    userSettings, accountStats, settingsLoading, refreshDashboard,
    updateUserSettings, renameProfile, isSupabaseLive,
  } = useAuth();

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const displayName = profile?.displayName?.trim() || 'Tryonetrade User';
  const emailLabel = profile?.email ?? '—';
  const uid = profile?.profileId ? shortUid(profile.profileId) : '—';

  const openEditName = () => {
    setNameInput(profile?.displayName ?? '');
    setNameError('');
    setEditNameOpen(true);
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameSaving(true);
    setNameError('');
    const res = await renameProfile(trimmed);
    setNameSaving(false);
    if (res.success) setEditNameOpen(false);
    else setNameError(res.error ?? 'Could not save name');
  };

  return (
    <div className="min-h-full bg-[#0b0c10] pb-24">
      <div className="bg-[#14161f] pt-12 pb-6 px-6 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 p-0.5">
              <div className="w-full h-full rounded-full bg-[#0b0c10] flex items-center justify-center">
                <span className="text-xl font-black text-amber-400">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">{displayName}</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{emailLabel}</p>
              <p className="text-[10px] font-bold text-gray-600 mt-0.5">UID {uid}</p>
              {accountStats?.memberSince && (
                <p className="text-[10px] text-gray-500 mt-1">Member since {accountStats.memberSince}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={openEditName} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white" aria-label="Edit name">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 relative z-10">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${
            isSupabaseLive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <Database className="w-3 h-3" />
            {isSupabaseLive ? 'Cloud synced' : 'Local demo mode'}
          </span>
          <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md text-[10px] font-black text-green-400 uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" /> Phone verified
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 grid grid-cols-2 gap-2">
        <StatCard label="Demo balance" value={formatInr(demoBalance)} accent="text-blue-400" />
        <StatCard label="Real balance" value={formatInr(realBalance)} accent="text-emerald-400" />
      </div>

      {accountStats && (
        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          <StatCard label="Total deposits" value={formatInr(accountStats.totalDeposits)} />
          <StatCard label="Total withdrawals" value={formatInr(accountStats.totalWithdrawals)} />
          <StatCard label="Transactions" value={String(accountStats.transactionCount)} />
          <StatCard label="Trades" value={String(accountStats.tradeCount)} />
        </div>
      )}

      <div className="pt-6 space-y-6">
        <Section title="Account">
          <Row icon={Wallet} iconBg="bg-blue-500/10" iconColor="text-blue-400" label="Default account" sub={accountMode === 'demo' ? 'Demo (practice)' : 'Real (₹)'}
            right={
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button type="button" onClick={() => { setAccountMode('demo'); updateUserSettings({ defaultAccountMode: 'demo' }); }}
                  className={`px-3 py-1 text-[10px] font-black uppercase ${accountMode === 'demo' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Demo</button>
                <button type="button" onClick={() => { setAccountMode('real'); updateUserSettings({ defaultAccountMode: 'real' }); }}
                  className={`px-3 py-1 text-[10px] font-black uppercase ${accountMode === 'real' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>Real</button>
              </div>
            }
          />
          <Row icon={IndianRupee} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" label="Withdrawal limit" sub={`Max ${formatInr(WITHDRAWAL_LIMIT)} per request`} />
          <Row icon={RefreshCw} iconBg="bg-purple-500/10" iconColor="text-purple-400" label="Sync from server" sub={settingsLoading ? 'Refreshing…' : 'Pull latest balances & stats'}
            right={settingsLoading ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <RefreshCw className="w-4 h-4 text-gray-500" />}
            onClick={() => !settingsLoading && refreshDashboard()} />
        </Section>

        <Section title="Trading">
          <Row icon={Zap} iconBg="bg-amber-500/10" iconColor="text-amber-400" label="One-click trading" sub="Skip confirmation before placing trade"
            right={<Toggle on={userSettings.oneClickTrading} disabled={settingsLoading} onToggle={() => updateUserSettings({ oneClickTrading: !userSettings.oneClickTrading })} />} />
          <Row icon={AlertTriangle} iconBg="bg-blue-500/10" iconColor="text-blue-400" label="Order confirmation" sub="Confirm amount & direction"
            right={<Toggle on={userSettings.confirmTrade} disabled={settingsLoading} onToggle={() => updateUserSettings({ confirmTrade: !userSettings.confirmTrade })} />} />
        </Section>

        <Section title="Notifications">
          <Row icon={Bell} iconBg="bg-orange-500/10" iconColor="text-orange-400" label="Push alerts" sub="Trade results & balance updates"
            right={<Toggle on={userSettings.pushNotifications} disabled={settingsLoading} onToggle={() => updateUserSettings({ pushNotifications: !userSettings.pushNotifications })} />} />
        </Section>

        <Section title="Session">
          <Row icon={ArrowDownToLine} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" label="Deposits recorded" sub={isSupabaseLive ? 'Saved in Supabase' : 'Local only until cloud connected'}
            right={<span className="text-xs font-bold text-gray-400">{formatInr(accountStats?.totalDeposits ?? 0)}</span>} />
          <Row icon={ArrowUpFromLine} iconBg="bg-rose-500/10" iconColor="text-rose-400" label="Withdrawals recorded" sub="Real account only"
            right={<span className="text-xs font-bold text-gray-400">{formatInr(accountStats?.totalWithdrawals ?? 0)}</span>} />
          <Row icon={LogOut} iconBg="bg-transparent" iconColor="text-red-400" label="Sign out" sub={emailLabel} isDestructive onClick={logout} />
        </Section>

        <p className="text-center text-[10px] font-bold text-gray-600 uppercase tracking-widest pt-2 pb-8">
          Tryonetrade · {isSupabaseLive ? 'Supabase' : 'Offline'} · v2.2.0
        </p>
      </div>

      {editNameOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm bg-[#14161f] border border-white/10 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Edit display name</h2>
              <button type="button" onClick={() => setEditNameOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name"
              className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium outline-none focus:border-amber-500/50" maxLength={40} />
            {nameError && <p className="text-red-400 text-xs mt-2">{nameError}</p>}
            <button type="button" disabled={nameSaving} onClick={saveName}
              className="w-full mt-4 py-3 rounded-xl bg-amber-500 text-black font-black text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2">
              {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
