"use client";

import React from 'react';
import type { AccountMode } from '../types/account';

interface AccountToggleProps {
  mode: AccountMode;
  onChange: (mode: AccountMode) => void;
  compact?: boolean;
}

const AccountToggle: React.FC<AccountToggleProps> = ({ mode, onChange, compact }) => {
  return (
    <div
      className={`flex p-1 rounded-xl bg-[#2d2e3b] border border-white/5 ${compact ? 'scale-90 origin-center' : ''}`}
      role="group"
      aria-label="Account mode"
    >
      {(['demo', 'real'] as AccountMode[]).map(m => {
        const active = mode === m;
        const isDemo = m === 'demo';
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
              active
                ? isDemo
                  ? 'bg-[#ffb300] text-black shadow-sm'
                  : 'bg-[#0fb359] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {isDemo ? 'Demo' : 'Real'}
          </button>
        );
      })}
    </div>
  );
};

export default AccountToggle;
