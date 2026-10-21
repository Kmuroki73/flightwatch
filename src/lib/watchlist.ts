
import type { Flight, FlightStatus } from '@/types';
import { supabase } from '@/lib/supabase';

export type WatchedFlightRow = {
  id: string;
  user_id: string;
  flight_number: string;
  provider_flight_id?: string | null;
  travel_date: string;
  origin_code: string | null;
  destination_code: string | null;
  monitoring_status: 'active' | 'paused' | 'expired';
  provider_source: string | null;
  airline: string | null;
  airline_code?: string | null;
  origin_city: string | null;
  destination_city: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  status: string | null;
  duration: string | null;
  terminal: string | null;
  gate?: string | null;
  aircraft?: string | null;
  aircraft_registration?: string | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type FunctionResponse<T> = {
  data: T | null;
  error: Error | null;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireUserId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) throw error;

  if (!data.user) {
    throw new Error('Please sign in before managing your watchlist.');
  }

  return data.user.id;
}

async function invokeWatchFlight<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const client = requireSupabase();

  const result = (await client.functions.invoke('watch-flight', {
    body,
  })) as FunctionResponse<T>;

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error('The watchlist service returned no data.');
  }

  const response = result.data as T & { error?: string };

  if (response.error) {
    throw new Error(response.error);
  }

  return response;
}

export async function loadWatchedFlights(): Promise<WatchedFlightRow[]> {
  await requireUserId();

  const response = await invokeWatchFlight<{
    rows: WatchedFlightRow[];
  }>({ operation: 'list' });

  return response.rows ?? [];
}

export async function addWatchedFlight(
  flight: Flight,
): Promise<WatchedFlightRow> {
  await requireUserId();

  const response = await invokeWatchFlight<{
    row: WatchedFlightRow;
  }>({
    operation: 'add',
    flight,
  });

  if (!response.row) {
    throw new Error('The flight could not be saved.');
  }

  return response.row;
}

export async function removeWatchedFlight(id: string): Promise<void> {
  await requireUserId();

  await invokeWatchFlight<{ success: boolean }>({
    operation: 'remove',
    id,
  });
}

function displayTime(value: string | null): string {
  if (!value) return 'Unavailable';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function flightStatus(value: string | null): FlightStatus {
  const allowed: FlightStatus[] = [
    'On time',
    'Delayed',
    'Boarding',
    'Cancelled',
    'Diverted',
    'In flight',
    'Landed',
    'Unknown',
  ];

  return allowed.includes(value as FlightStatus)
    ? (value as FlightStatus)
    : 'Unknown';
}

export function watchedRowToFlight(row: WatchedFlightRow): Flight {
  const status = flightStatus(row.status);

  const disruption =
    status === 'Delayed'
      ? 'delay'
      : status === 'Cancelled'
        ? 'cancelled'
        : status === 'Diverted'
          ? 'diverted'
          : 'none';

  return {
    id: row.id,
    flightNumber: row.flight_number,
    providerFlightId: row.provider_flight_id ?? undefined,

    airline: row.airline ?? 'Airline unavailable',
    airlineCode: row.airline_code ?? '',

    origin: {
      code: row.origin_code ?? '—',
      city: row.origin_city ?? row.origin_code ?? 'Origin unavailable',
      time: displayTime(row.departure_time),
    },

    destination: {
      code: row.destination_code ?? '—',
      city:
        row.destination_city ??
        row.destination_code ??
        'Destination unavailable',
      time: displayTime(row.arrival_time),
    },

    date: row.travel_date,
    status,
    statusDetail:
      'Saved flight · background monitoring depends on the configured alert service.',

    duration: row.duration ?? 'Unavailable',
    terminal: row.terminal ?? 'Not provided',
    gate: row.gate ?? undefined,
    aircraft: row.aircraft ?? undefined,
    aircraftRegistration: row.aircraft_registration ?? undefined,

    updated: row.last_updated_at ?? row.updated_at,

    route: `${row.origin_city ?? row.origin_code ?? 'Origin'} to ${
      row.destination_city ?? row.destination_code ?? 'destination'
    }`,

    timeline: [],
    dataMode: 'live',
    source: row.provider_source ?? 'FlightAware',
    lastUpdatedAt: row.last_updated_at ?? row.updated_at,

    phase: status === 'Boarding' ? 'boarding' : 'unknown',
    disruption,
    departureDelayMinutes: null,
    arrivalDelayMinutes: null,
    delaySource: null,
    position: null,
  };
}
