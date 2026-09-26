import { useQuery } from '@tanstack/react-query';

import type { WeatherPlace } from '@/lib/preferences';

const CONDITIONS: [number, string][] = [
  [0, 'clear'],
  [2, 'partly cloudy'],
  [3, 'overcast'],
  [48, 'fog'],
  [57, 'drizzle'],
  [67, 'rain'],
  [77, 'snow'],
  [82, 'showers'],
  [86, 'snow showers'],
  [99, 'thunderstorms'],
];

export const describeWeather = (code: number) =>
  CONDITIONS.find(([max]) => code <= max)?.[1] ?? 'mixed';

export type Weather = { temperature: number; code: number };

export function useWeather(place: WeatherPlace | null) {
  return useQuery({
    queryKey: ['weather', place?.latitude, place?.longitude],
    enabled: place !== null,
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Weather> => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(place!.latitude));
      url.searchParams.set('longitude', String(place!.longitude));
      url.searchParams.set('current', 'temperature_2m,weather_code');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather unavailable');
      const body = await response.json();
      return {
        temperature: Math.round(body.current.temperature_2m),
        code: body.current.weather_code,
      };
    },
  });
}

export async function findPlace(name: string): Promise<WeatherPlace | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  const response = await fetch(url);
  if (!response.ok) return null;
  const body = await response.json();
  const hit = body.results?.[0];
  return hit
    ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude }
    : null;
}
