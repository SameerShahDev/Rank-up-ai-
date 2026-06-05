import React, { useState } from 'react';
import {
  Bell, Zap, LogOut, AlertTriangle,
  CheckCircle2, RefreshCw, Database, Wallet, IndianRupee,
  ArrowDownToLine, ArrowUpFromLine, Pencil, X, Loader2, ChevronRight,
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

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#1a1d2e] to-[#14161f] pt-14 pb-7 px-4 border-b border-white/5">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/8 rounded-full blur-[60px] pointer-events-none" />
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-[2px] shadow-[0_0_20px_rgba(251,191,36,0.25)]">
              <div className="w-full h-full rounded-full bg-[#0b0c10] flex items-center justify-center">
                <span className="text-xl font-black text-amber-400 select-none">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-black text-white tracking-tight leading-none">{displayName}</h1>
              <p className="text-[11px] font-bold text-gray-400 leading-none">{emailLabel}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">UID {uid}</span>
                {accountStats?.memberSince && (
                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">· {accountStats.memberSince}</span>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={openEditName}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
            aria-label="Edit name">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 relative z-10">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
            isSupabaseLive
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
          }`}>
            <Database className="w-3 h-3" />
            {isSupabaseLive ? 'Cloud Synced' : 'Local Demo'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black bg-green-500/10 border border-green-500/25 text-green-400 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Phone Verified
          </span>
        </div>
      </div>

      {/* ── Balance Grid ── */}
      <div className="px-4 -mt-5 relative z-20">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Demo Balance" value={formatInr(demoBalance)} accent="text-blue-400"
            active={accountMode === 'demo'} />
          <StatCard label="Real Balance" value={formatInr(realBalance)} accent="text-emerald-400"
            active={accountMode === 'real'} />
        </div>
      </div>

      {accountStats && (
        <div className="px-4 mt-3">
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Deposits" value={formatInr(accountStats.totalDeposits)} />
            <StatCard label="Withdrawals" value={formatInr(accountStats.totalWithdrawals)} />
            <StatCard label="Txs" value={String(accountStats.transactionCount)} />
            <StatCard label="Trades" value={String(accountStats.tradeCount)} />
          </div>
        </div>
      )}

      {/* ── Sections ── */}
      <div className="mt-6 space-y-5">

        <Section title="Account">
          <Row icon={Wallet} iconBg="bg-blue-500/10" iconColor="text-blue-400" label="Default account" sub={accountMode === 'demo' ? 'Demo · practice funds' : 'Real · live funds'}
            right={
              <div className="relative flex bg-black/30 rounded-lg p-0.5 border border-white/10">
                <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-gradient-to-b transition-all duration-300 ${
                  accountMode === 'demo' ? 'left-0.5 from-blue-500 to-blue-600' : 'left-[calc(50%+0.5px)] from-emerald-500 to-emerald-600'
                }`} />
                <button type="button" onClick={() => { setAccountMode('demo'); updateUserSettings({ defaultAccountMode: 'demo' }); }}
                  className={`relative z-10 px-3 py-1 text-[10px] font-black uppercase rounded-md transition-colors ${accountMode === 'demo' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Demo</button>
                <button type="button" onClick={() => { setAccountMode('real'); updateUserSettings({ defaultAccountMode: 'real' }); }}
                  className={`relative z-10 px-3 py-1 text-[10px] font-black uppercase rounded-md transition-colors ${accountMode === 'real' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Real</button>
              </div>
            }
          />
          <Row icon={IndianRupee} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" label="Withdrawal limit" sub={`Max ${formatInr(WITHDRAWAL_LIMIT)} per request`} />
          <Row icon={RefreshCw} iconBg="bg-purple-500/10" iconColor="text-purple-400" label="Sync from server" sub={settingsLoading ? 'Refreshing…' : 'Pull latest balances & stats'}
            right={settingsLoading ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
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
          <Row icon={ArrowDownToLine} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" label="Deposits recorded" sub={isSupabaseLive ? 'Persisted in Supabase' : 'Local only until connected'}
            right={<span className="text-xs font-bold text-gray-400">{formatInr(accountStats?.totalDeposits ?? 0)}</span>} />
          <Row icon={ArrowUpFromLine} iconBg="bg-rose-500/10" iconColor="text-rose-400" label="Withdrawals recorded" sub="Real account only"
            right={<span className="text-xs font-bold text-gray-400">{formatInr(accountStats?.totalWithdrawals ?? 0)}</span>} />
          <Row icon={LogOut} iconBg="bg-red-500/10" iconColor="text-red-400" label="Sign out" sub={emailLabel} isDestructive onClick={logout}
            right={<ChevronRight className="w-4 h-4 text-gray-600" />} />
        </Section>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-1.5 bg-[#14161f] border border-white/5 rounded-full px-4 py-1.5">
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Tryonetrade</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{isSupabaseLive ? 'Supabase' : 'Offline'}</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">v2.2.0</span>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Edit Name Modal ── */}
      {editNameOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditNameOpen(false); }}>
          <div className="w-full max-w-sm bg-[#14161f] border border-white/10 rounded-3xl p-6 shadow-2xl animate-[slideUp_0.25s_ease-out]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Edit display name</h2>
                <p className="text-[10px] font-bold text-gray-500 mt-1">This is how others see you</p>
              </div>
              <button type="button" onClick={() => setEditNameOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your display name"
                className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-4 py-3.5 pr-14 text-white text-sm font-medium outline-none focus:border-amber-500/50 transition-colors placeholder:text-gray-600"
                maxLength={40} autoFocus />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600 tabular-nums">
                {nameInput.length}/40
              </span>
            </div>
            {nameError && (
              <div className="flex items-center gap-1.5 mt-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-red-400 text-xs">{nameError}</p>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setEditNameOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm uppercase tracking-wider transition-all active:scale-95">
                Cancel
              </button>
              <button type="button" disabled={nameSaving} onClick={saveName}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95">
                {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
