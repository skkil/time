import { createContext, useContext } from 'react';

export const PerMinute = createContext(48 / 60);

export const usePerMinute = () => useContext(PerMinute);
