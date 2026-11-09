export const MIN_ENTRY_HEIGHT = 8;

export const trackedFill = (color: string) =>
  `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 70%, transparent) 0 5px, color-mix(in oklab, ${color} 35%, transparent) 5px 9px)`;
