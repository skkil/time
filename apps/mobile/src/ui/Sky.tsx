import { SHADE, readabilityShade } from '@skkil-time/design/contrast';
import { rgb, skyAt } from '@skkil-time/design/sky';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

const GLOWS = [
  { size: 0.75, left: -0.15, top: -0.2 },
  { size: 0.65, left: 0.55, top: -0.1 },
  { size: 0.7, left: -0.1, top: 0.45 },
  { size: 0.6, left: 0.6, top: 0.5 },
];

const hourNow = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

function useHour() {
  const [hour, setHour] = useState(hourNow);
  useEffect(() => {
    const id = setInterval(() => setHour(hourNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

/** The time-of-day sky every screen sits on, drawn like desktop's `ZenBackdrop`. */
export function Sky({ deep = false }: { deep?: boolean }) {
  const { width, height } = useWindowDimensions();
  const sky = skyAt(useHour());
  const vmax = Math.max(width, height);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundImage: `linear-gradient(180deg, ${rgb(sky.top)} 0%, ${rgb(sky.bottom)} 100%)`,
        },
      ]}
    >
      {GLOWS.map((glow, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: glow.size * vmax,
            height: glow.size * vmax,
            left: glow.left * width,
            top: glow.top * height,
            backgroundImage: `radial-gradient(circle closest-side, ${rgb(sky.glows[i], 0.85)}, ${rgb(sky.glows[i], 0)})`,
          }}
        />
      ))}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: rgb(SHADE, readabilityShade(sky)) },
        ]}
      />
      {deep && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(4, 8, 18, 0.45)' },
          ]}
        />
      )}
    </View>
  );
}
