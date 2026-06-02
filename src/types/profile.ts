export interface UserProfile {
  profileId: string;
  sessionToken: string;
  email: string;
  displayName: string | null;
  demoBalance: number;
  realBalance: number;
  needsName: boolean;
}

export type AuthStep = 'auth' | 'name';
