export interface UserSettings {
  confirmTrade: boolean;
  oneClickTrading: boolean;
  pushNotifications: boolean;
  defaultAccountMode: 'demo' | 'real';
}

export interface AccountStats {
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
  tradeCount: number;
  memberSince: string;
}

export interface AccountDashboard {
  profile: {
    profileId: string;
    email: string;
    displayName: string | null;
    demoBalance: number;
    realBalance: number;
    createdAt: string;
  };
  settings: UserSettings;
  stats: AccountStats;
}

export const DEFAULT_SETTINGS: UserSettings = {
  confirmTrade: true,
  oneClickTrading: false,
  pushNotifications: true,
  defaultAccountMode: 'demo',
};
