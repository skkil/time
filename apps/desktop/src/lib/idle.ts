import { getCurrentWindow } from '@tauri-apps/api/window';

function setIdle(idle: boolean) {
  document.documentElement.toggleAttribute('data-idle', idle);
}

export function syncIdle() {
  const update = () => setIdle(document.hidden || !document.hasFocus());
  update();
  document.addEventListener('visibilitychange', update);
  void getCurrentWindow().onFocusChanged(({ payload: focused }) =>
    setIdle(document.hidden || !focused),
  );
}
