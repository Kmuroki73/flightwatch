import type { Flight } from '@/types';
import { supabase } from '@/lib/supabase';

export type WatchedFlightRow = {
  id: string;
  flight_number: string;
  travel_date: string;
  origin_code: string | null;
  destination_code: string | null;
  monitoring_status: 'active' | 'paused' | 'expired';
  provider_source: string | null;
  airline: string | null;
  origin_city: string | null;
  destination_city: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  status: string | null;
  duration: string | null;
  terminal: string | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadWatchedFlights(): Promise<WatchedFlightRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('watched_flights')
    .select('id, flight_number, travel_date, origin_code, destination_code, monitoring_status, provider_source, airline, origin_city, destination_city, departure_time, arrival_time, status, duration, terminal, last_updated_at, created_at, updated_at')
    .eq('monitoring_status', 'active')
    .order('travel_date', { ascending: true });
  if (error) throw error;
  return data as WatchedFlightRow[];
}

export async function addWatchedFlight(flight: Flight): Promise<WatchedFlightRow> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('watched_flights')
    .insert({
      flight_number: flight.flightNumber,
      travel_date: toDateValue(flight.date),
      origin_code: flight.origin.code,
      destination_code: flight.destination.code,
      provider_source: flight.source,
      airline: flight.airline,
      origin_city: flight.origin.city,
      destination_city: flight.destination.city,
      departure_time: flight.origin.time,
      arrival_time: flight.destination.time,
      status: flight.status,
      duration: flight.duration,
      terminal: flight.terminal,
      last_updated_at: flight.lastUpdatedAt,
    })
    .select('id, flight_number, travel_date, origin_code, destination_code, monitoring_status, provider_source, airline, origin_city, destination_city, departure_time, arrival_time, status, duration, terminal, last_updated_at, created_at, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The flight could not be saved.');
  return data as WatchedFlightRow;
}

export async function removeWatchedFlight(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('watched_flights').delete().eq('id', id);
  if (error) throw error;
}

export function watchedRowToFlight(row: WatchedFlightRow): Flight {
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airline: row.airline ?? row.provider_source ?? 'Saved flight',
    airlineCode: row.flight_number.split(' ')[0] ?? '',
    origin: { code: row.origin_code ?? '—', city: row.origin_city ?? 'Origin unavailable', time: row.departure_time ?? 'Unavailable' },
    destination: { code: row.destination_code ?? '—', city: row.destination_city ?? 'Destination unavailable', time: row.arrival_time ?? 'Unavailable' },
    date: row.travel_date,
    status: row.status === 'Delayed' || row.status === 'Boarding' ? row.status : 'On time',
    statusDetail: 'Saved flight · background monitoring is not active in this release.',
    duration: row.duration ?? 'Unavailable',
    terminal: row.terminal ?? 'Not provided',
    updated: row.last_updated_at ?? row.updated_at,
    route: `${row.origin_city ?? row.origin_code ?? 'Origin'} to ${row.destination_city ?? row.destination_code ?? 'destination'}`, 
    timeline: [],
    dataMode: 'live',
    phase: row.status === 'Boarding' ? 'boarding' : 'scheduled',
    disruption: row.status === 'Delayed' ? 'delay' : 'none',
    departureDelayMinutes: null,
    arrivalDelayMinutes: null,
    delaySource: null,
    position: null,
    source: row.provider_source ?? 'Saved flight record',
    lastUpdatedAt: row.last_updated_at ?? row.updated_at,
  };
}

function toDateValue(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}
