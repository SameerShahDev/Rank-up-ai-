import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { AccountMode } from '../types/account';
import { INITIAL_DEMO_BALANCE, INITIAL_REAL_BALANCE } from '../types/account';

const STORAGE_KEY = 'tryonetrade_account_v1';

interface StoredAccount {
  accountMode: AccountMode;
  demoBalance: number;
  realBalance: number;
}

function load(): StoredAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAccount;
      return {
        accountMode: parsed.accountMode === 'real' ? 'real' : 'demo',
        demoBalance: Number(parsed.demoBalance) || INITIAL_DEMO_BALANCE,
        realBalance: Math.max(0, Number(parsed.realBalance) || INITIAL_REAL_BALANCE),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    accountMode: 'demo',
    demoBalance: INITIAL_DEMO_BALANCE,
    realBalance: INITIAL_REAL_BALANCE,
  };
}

export function useAccountStorage() {
  const [accountMode, setAccountMode] = useState<AccountMode>(() => load().accountMode);
  const [demoBalance, setDemoBalance] = useState(() => load().demoBalance);
  const [realBalance, setRealBalance] = useState(() => load().realBalance);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accountMode, demoBalance, realBalance }),
    );
  }, [accountMode, demoBalance, realBalance]);

  const activeBalance = accountMode === 'demo' ? demoBalance : realBalance;
  const setActiveBalance: Dispatch<SetStateAction<number>> = (value) => {
    const setter = accountMode === 'demo' ? setDemoBalance : setRealBalance;
    setter(value);
  };

  return {
    accountMode,
    setAccountMode,
    demoBalance,
    setDemoBalance,
    realBalance,
    setRealBalance,
    activeBalance,
    setActiveBalance,
  };
}
