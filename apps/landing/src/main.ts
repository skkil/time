import '@fontsource-variable/hanken-grotesk';
import '@skkil-time/design/tokens.css';
import icon from '~assets/icon.svg?url';
import logo from '~assets/skkil-time-horizontal.svg?raw';

import { appUrl } from './config';
import { startQuickAdd } from './quick-add';
import { phaseOf } from './sky/bodies';
import { createSky } from './sky/sky';
import { type Anchor, hourAt } from './story';
import './styles.css';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sky = createSky(
  document.querySelector<HTMLCanvasElement>('#sky')!,
  still,
);

document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href = icon;
for (const slot of document.querySelectorAll('[data-logo]'))
  slot.innerHTML = logo;
for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-app]'))
  link.href = appUrl;

const sections = [...document.querySelectorAll<HTMLElement>('[data-hour]')];

let shown = 0;
let target = 0;

const anchors = (): Anchor[] => {
  const middle = innerHeight / 2;
  return sections.map((section) => {
    const box = section.getBoundingClientRect();
    return {
      at: box.top + box.height / 2 - middle,
      hour: Number(section.dataset.hour),
    };
  });
};

const retarget = () => {
  target = hourAt(anchors(), 0);
};

const show = (hour: number) => {
  shown = hour;
  sky.setHour(hour);
  document.documentElement.dataset.phase = phaseOf(hour).toLowerCase();
};

const follow = () => {
  const delta = ((target - shown + 36) % 24) - 12;
  if (Math.abs(delta) < 0.002) {
    if (shown !== target) show(target);
    return;
  }
  show(shown + delta * (still ? 1 : 0.12));
  requestAnimationFrame(follow);
};

const settle = () => {
  retarget();
  requestAnimationFrame(follow);
};

addEventListener('scroll', settle, { passive: true });
addEventListener('resize', settle);

retarget();
show(target);

startQuickAdd(document.querySelector<HTMLElement>('#quick-add')!);
