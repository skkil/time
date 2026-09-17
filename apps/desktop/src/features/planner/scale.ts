import { createContext, useContext } from 'react';

import { type TimeScale, createTimeScale } from './time-scale';

export const TimeScaleContext = createContext<TimeScale>(createTimeScale(48));

export const useTimeScale = () => useContext(TimeScaleContext);
