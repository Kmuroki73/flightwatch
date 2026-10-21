
import type { Flight } from '@/types';
import { supabase } from '@/lib/supabase';

export type WatchedFlightRow = {
  id: string;
  user_id: string;
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

const ROW_COLUMNS =
  'id, user_id, flight_number, travel_date, origin_code, destination_code, monitoring_status, provider_source, airline, origin_city, destination_city, departure_time, arrival_time, status, duration, terminal, last_updated_at, created_at, updated_at';

async function requireUserId(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  if (!data.user) {
    throw new Error('Please sign in before managing your watchlist.');
  }

  return data.user.id;
}

export async function loadWatchedFlights(): Promise<WatchedFlightRow[]> {
  const userId = await requireUserId();

  const { data, error } = await supabase!
    .from('watched_flights')
    .select(ROW_COLUMNS)
    .eq('user_id', userId)
    .eq('monitoring_status', 'active')
    .order('travel_date', { ascending: true });

  if (error) throw error;

  return (data ?? []) as WatchedFlightRow[];
}

export async function addWatchedFlight(
  flight: Flight,
): Promise<WatchedFlightRow> {
  const userId = await requireUserId();
  const travelDate = toDateValue(flight.date);

  const { data, error } = await supabase!
    .from('watched_flights')
    .insert({
      user_id: userId,
      flight_number: flight.flightNumber,
      travel_date: travelDate,
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
    .select(ROW_COLUMNS)
    .single();

  if (!error && data) {
    return data as WatchedFlightRow;
  }

  // If this user already saved the same flight/date, return
  // their existing record instead of creating a duplicate.
  if (error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase!
      .from('watched_flights')
      .select(ROW_COLUMNS)
      .eq('user_id', userId)
      .eq('flight_number', flight.flightNumber)
      .eq('travel_date', travelDate)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) return existing as WatchedFlightRow;
  }

  if (error) throw error;

  throw new Error('The flight could not be saved.');
}

export async function removeWatchedFlight(id: string): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase!
    .from('watched_flights')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export function watchedRowToFlight(row: WatchedFlightRow): Flight {
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airline: row.airline ?? row.provider_source ?? 'Saved flight',
    airlineCode: row.flight_number.split(' ')[0] ?? '',
    origin: {
      code: row.origin_code ?? '—',
      city: row.origin_city ?? 'Origin unavailable',
      time: row.departure_time ?? 'Unavailable',
    },
    destination: {
      code: row.destination_code ?? '—',
      city: row.destination_city ?? 'Destination unavailable',
      time: row.arrival_time ?? 'Unavailable',
    },
    date: row.travel_date,
    status:
      row.status === 'Delayed' || row.status === 'Boarding'
        ? row.status
        : 'Unknown',
    statusDetail:
      'Saved flight · background monitoring is not active in this release.',
    duration: row.duration ?? 'Unavailable',
    terminal: row.terminal ?? 'Not provided',
    updated: row.last_updated_at ?? row.updated_at,
    route: `${row.origin_city ?? row.origin_code ?? 'Origin'} to ${
      row.destination_city ?? row.destination_code ?? 'destination'
    }`,
    timeline: [],
    dataMode: 'live',
    phase: row.status === 'Boarding' ? 'boarding' : 'unknown',
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

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toISOString().slice(0, 10);
}
