import '@fontsource-variable/hanken-grotesk';
import '@skkil-time/design/tokens.css';
import icon from '~assets/icon.svg?url';
import logo from '~assets/skkil-time-horizontal.svg?raw';

import { appUrl } from './config';
import { startQuickAdd } from './quick-add';
import { clockLabel, phaseOf } from './sky/bodies';
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

const scrub = document.querySelector<HTMLInputElement>('#hour')!;
const scrubLabel = document.querySelector<HTMLOutputElement>('#hour-label')!;
const clock = document.querySelector<HTMLElement>('#clock-time')!;
const phase = document.querySelector<HTMLElement>('#clock-phase')!;
const sections = [...document.querySelectorAll<HTMLElement>('[data-hour]')];

const localHour = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

let heroHour = localHour();
let moved = false;
let shown = heroHour;
let target = heroHour;

const anchors = (): Anchor[] => {
  const middle = innerHeight / 2;
  return sections.map((section) => {
    const box = section.getBoundingClientRect();
    const hour =
      section.dataset.hour === 'now' ? heroHour : Number(section.dataset.hour);
    return { at: box.top + box.height / 2 - middle, hour };
  });
};

const retarget = () => {
  target = hourAt(anchors(), 0);
};

const show = (hour: number) => {
  shown = hour;
  sky.setHour(hour);
  clock.textContent = clockLabel(hour);
  phase.textContent = phaseOf(hour);
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

const syncScrub = () => {
  scrub.value = String(Math.round(heroHour * 4) / 4);
  scrubLabel.textContent = clockLabel(heroHour);
};

scrub.addEventListener('input', () => {
  moved = true;
  heroHour = Number(scrub.value);
  scrubLabel.textContent = clockLabel(heroHour);
  settle();
});

setInterval(() => {
  if (moved) return;
  heroHour = localHour();
  syncScrub();
  settle();
}, 60_000);

addEventListener('scroll', settle, { passive: true });
addEventListener('resize', settle);

syncScrub();
retarget();
show(target);

startQuickAdd(document.querySelector<HTMLElement>('#quick-add')!);
