import { nowSeconds } from '@skkil-time/rules/time';
import { requireOptionalNativeModule } from 'expo';

import { commands } from '@/core/local/backend';
import {
  type WidgetPublisher,
  createWidgetPublisher,
} from '@/core/widgets/publisher';

type NativeWidgets = { publish(json: string): Promise<void> };

const native = requireOptionalNativeModule<NativeWidgets>('SkkilWidgets');

const NO_WIDGETS: WidgetPublisher = {
  signedIn: () => undefined,
  soon: () => undefined,
  flush: async () => undefined,
};

export const widgets: WidgetPublisher = native
  ? createWidgetPublisher({
      readGlance: () => commands.todayGlance(),
      write: (json) => native.publish(json),
      now: nowSeconds,
    })
  : NO_WIDGETS;
