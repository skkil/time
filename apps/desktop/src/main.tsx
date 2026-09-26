import { commands } from '@skkil-time/contract';

import { mount } from '@/mount';

import { tauriPlatform } from './platform';

mount({ backend: commands, platform: tauriPlatform });
