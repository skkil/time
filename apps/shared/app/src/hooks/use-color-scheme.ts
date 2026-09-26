export function useColorScheme(): 'light' | 'dark' {
  return 'dark';
}

export function syncColorScheme() {
  document.documentElement.classList.add('dark');
  return () => {};
}
