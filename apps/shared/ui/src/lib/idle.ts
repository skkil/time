import { platform } from '@/platform';

function setIdle(idle: boolean) {
  document.documentElement.toggleAttribute('data-idle', idle);
}

export function syncIdle() {
  const update = () => setIdle(document.hidden || !document.hasFocus());
  update();
  document.addEventListener('visibilitychange', update);
  platform().onFocusChange((focused) => setIdle(document.hidden || !focused));
}
