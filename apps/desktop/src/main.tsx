import { commands } from '@skkil-time/client/types';

import { mount } from '@/mount';

import { tauriPlatform } from './platform';

mount({ backend: commands, platform: tauriPlatform });
