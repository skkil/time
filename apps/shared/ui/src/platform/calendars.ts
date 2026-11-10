export type CalendarAccount = {
  id: string;
  provider: string;
  email: string | null;
  /** `reauth` once the account lost access and must be connected again. */
  status: string;
  syncedAt: number | null;
};

export type CalendarStatus = {
  /** False while this device isn't signed in: calendars live in the account. */
  signedIn: boolean;
  /** Whether the server can connect calendars at all. */
  available: boolean;
  accounts: CalendarAccount[];
};

/** Connected calendars, read and written on the server for the signed-in account. */
export interface Calendars {
  status(): Promise<CalendarStatus>;
  /** Opens the provider's consent page; the account appears once it's done. */
  connect(): Promise<void>;
  disconnect(id: string): Promise<void>;
}
