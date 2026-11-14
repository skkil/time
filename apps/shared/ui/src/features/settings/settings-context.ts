import { createContext, use } from 'react';

export type SettingsApi = {
  openSettings: (section?: string) => void;
};

export const SettingsContext = createContext<SettingsApi | null>(null);

export function useSettings() {
  const api = use(SettingsContext);
  if (!api) throw new Error('useSettings needs SettingsProvider');
  return api;
}
