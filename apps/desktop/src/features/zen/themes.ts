export type ZenTheme = {
  id: string;
  label: string;
  poster: string;
  animation: string;
  credit: string;
};

export const ZEN_THEMES: ZenTheme[] = [
  {
    id: 'water',
    label: 'Open sea',
    poster: '/zen/ocean.jpg',
    animation: '/zen/ocean.webp',
    credit: '“Ocean surface waves”, Wikimedia Commons, CC0',
  },
];

export const zenTheme = (id: string) =>
  ZEN_THEMES.find((theme) => theme.id === id) ?? ZEN_THEMES[0];
