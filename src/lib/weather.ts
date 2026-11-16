import { supabase } from '@/lib/supabase';

export type SongaWeather = {
  source: 'WeatherAPI.com';
  fetchedAt: string;
  cached: boolean;
  location: { name: string; region: string; country: string; tz_id: string; lat: number; lon: number };
  current: { temp_c: number; condition: { text: string; icon: string }; humidity: number; wind_kph: number; feelslike_c: number };
  forecast: { forecastday: Array<{ date: string; day: { maxtemp_c: number; mintemp_c: number; condition: { text: string; icon: string } } }> };
};

export async function getTravellerWeather(location: { latitude: number; longitude: number } | { query: string }): Promise<SongaWeather> {
  if (!supabase) throw new Error('Weather needs a configured Songa account service.');
  const { data, error } = await supabase.functions.invoke('songa-weather', { body: location });
  if (error) throw new Error('Weather is temporarily unavailable. Please try again.');
  if (!data || typeof data !== 'object' || !('current' in data) || !('location' in data)) {
    throw new Error(data?.message || 'Weather is not configured yet.');
  }
  return data as SongaWeather;
}
