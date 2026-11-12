import { Fragment, type ReactNode } from 'react';

import { usePreference } from '@/lib/preferences';

/** Dates are formatted outside React state, so redraw everything when the order changes. */
export function DateOrderBoundary({ children }: { children: ReactNode }) {
  const order = usePreference('dateOrder');
  return <Fragment key={order}>{children}</Fragment>;
}
