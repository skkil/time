type Unsubscribe = () => void;

export type SyncPhase =
  | 'signedOut'
  | 'signingIn'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'needsSignIn'
  | 'needsChoice';

export type SyncStatus = {
  phase: SyncPhase;
  account: { name: string | null; email: string | null } | null;
  /** Local changes not yet accepted by the server. */
  pending: number;
  /** Unix milliseconds of the last pull. */
  lastSyncedAt: number | null;
  issues: number;
  error: string | null;
};

/** A change the server refused; it stays here until dismissed. */
export type SyncIssue = {
  id: number;
  name: string;
  subject: string | null;
  reason: string;
  createdAt: number;
};

export type SyncConfig = {
  serverUrl: string;
  authority: string;
  clientId: string;
  audience: string | null;
};

/** `keepLocal` uploads this device's data into the account; `startFresh` replaces it with the account's. */
export type AccountChoice = 'keepLocal' | 'startFresh';

/** A local-first device that signs in and syncs on its own (desktop, web). */
export type Sync = {
  status(): Promise<SyncStatus>;
  onStatus(listener: (status: SyncStatus) => void): Unsubscribe;
  syncNow(): Promise<void>;
  issues(): Promise<SyncIssue[]>;
  dismissIssue(id: number): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  chooseAccountData(choice: AccountChoice): Promise<void>;
  /** Where this device syncs, for devices whose server can be changed (desktop). */
  config?(): Promise<SyncConfig>;
  saveConfig?(config: SyncConfig): Promise<void>;
};
