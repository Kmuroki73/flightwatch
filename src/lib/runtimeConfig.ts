export type SongaRuntimeConfig = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_FLIGHT_SEARCH_FUNCTION_URL?: string;
  VITE_WHATSAPP_LINK_FUNCTION_URL?: string;
};

declare global {
  interface Window { SONGA_CONFIG?: SongaRuntimeConfig; }
}

export function envValue(key: keyof SongaRuntimeConfig): string | undefined {
  const built = import.meta.env[key] as string | undefined;
  const runtime = typeof window !== 'undefined' ? window.SONGA_CONFIG?.[key] : undefined;
  return built || runtime || undefined;
}
