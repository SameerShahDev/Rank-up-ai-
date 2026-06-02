export type AccountMode = 'demo' | 'real';

export const WITHDRAWAL_LIMIT = 1000;
export const INITIAL_DEMO_BALANCE = 10000;
export const INITIAL_REAL_BALANCE = 0;

export const ACCOUNT_LABELS: Record<AccountMode, { title: string; subtitle: string }> = {
  demo: { title: 'Demo', subtitle: 'Practice · No withdrawal' },
  real: { title: 'Real', subtitle: 'Live balance · Withdraw up to ₹1,000' },
};
