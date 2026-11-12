import type { Flight } from '@/types';
import { supabase } from '@/lib/supabase';

/**
 * UI-facing watchlist row. Values are adapted from the production schema:
 * flight_watches -> flights. Do not query the legacy watched_flights table.
 */
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

type FlightDbRow = {
  id: string;
  provider: string;
  provider_flight_id: string | null;
  ident: string;
  origin: string | null;
  destination: string | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  estimated_departure: string | null;
  estimated_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  status: string | null;
  delay_minutes: number | null;
  diverted: boolean;
  cancelled: boolean;
  last_provider_update: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  airline: string | null;
  airline_code: string | null;
  origin_city: string | null;
  destination_city: string | null;
  duration: string | null;
  terminal: string | null;
  gate: string | null;
  aircraft: string | null;
  aircraft_registration: string | null;
};

type FlightWatchDbRow = {
  id: string;
  user_id: string;
  flight_id: string;
  whatsapp_contact_id: string | null;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  alert_on_delay: boolean;
  alert_on_cancellation: boolean;
  alert_on_diversion: boolean;
  alert_on_schedule_change: boolean;
  active: boolean;
  watched_at: string;
  stopped_at: string | null;
  flights: FlightDbRow | FlightDbRow[] | null;
};

const WATCH_SELECT = `
  id, user_id, flight_id, whatsapp_contact_id, email_enabled, whatsapp_enabled,
  alert_on_delay, alert_on_cancellation, alert_on_diversion,
  alert_on_schedule_change, active, watched_at, stopped_at,
  flights:flights(
    id, provider, provider_flight_id, ident, origin, destination,
    scheduled_departure, scheduled_arrival, estimated_departure, estimated_arrival,
    actual_departure, actual_arrival, status, delay_minutes, diverted, cancelled,
    last_provider_update, last_checked_at, created_at, updated_at,
    airline, airline_code, origin_city, destination_city, duration, terminal,
    gate, aircraft, aircraft_registration
  )
`;

export async function loadWatchedFlights(): Promise<WatchedFlightRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('flight_watches')
    .select(WATCH_SELECT)
    .eq('active', true)
    .order('watched_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FlightWatchDbRow[]).map(toWatchedFlightRow);
}

export async function addWatchedFlight(flight: Flight): Promise<WatchedFlightRow> {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error('Sign in before adding a flight to your watchlist.');

  const flightId = await findOrCreateFlight(flight);
  const { data: existing, error: existingError } = await client
    .from('flight_watches')
    .select('id')
    .eq('user_id', user.id)
    .eq('flight_id', flightId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const row = await loadOneWatch(existing.id);
    if (!row) throw new Error('The existing flight watch could not be reloaded.');
    return row;
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('flight_watches')
    .insert({
      user_id: user.id,
      flight_id: flightId,
      whatsapp_contact_id: null,
      email_enabled: true,
      whatsapp_enabled: false,
      alert_on_delay: true,
      alert_on_cancellation: true,
      alert_on_diversion: true,
      alert_on_schedule_change: true,
      active: true,
      watched_at: now,
      stopped_at: null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const row = await loadOneWatch(data.id);
  if (!row) throw new Error('The flight watch was created but could not be reloaded.');
  return row;
}

export async function removeWatchedFlight(id: string): Promise<void> {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in before updating your watchlist.');

  const { error } = await client
    .from('flight_watches')
    .update({ active: false, stopped_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', authData.user.id)
    .eq('active', true);
  if (error) throw error;
}

export function watchedRowToFlight(row: WatchedFlightRow): Flight {
  const normalizedStatus = normalizeStatus(row.status);
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airline: row.airline ?? row.provider_source ?? 'Saved flight',
    airlineCode: row.flight_number.split(' ')[0] ?? '',
    origin: { code: row.origin_code ?? '—', city: row.origin_city ?? 'Origin unavailable', time: row.departure_time ?? 'Unavailable' },
    destination: { code: row.destination_code ?? '—', city: row.destination_city ?? 'Destination unavailable', time: row.arrival_time ?? 'Unavailable' },
    date: row.travel_date,
    status: normalizedStatus,
    statusDetail: 'Saved flight · live updates depend on the configured flight-monitoring service.',
    duration: row.duration ?? 'Unavailable',
    terminal: row.terminal ?? 'Not provided',
    updated: row.last_updated_at ?? row.updated_at,
    route: `${row.origin_city ?? row.origin_code ?? 'Origin'} to ${row.destination_city ?? row.destination_code ?? 'destination'}`,
    timeline: [],
    dataMode: 'live',
    phase: normalizedStatus === 'Boarding' ? 'boarding' : normalizedStatus === 'In flight' ? 'airborne' : normalizedStatus === 'Landed' ? 'arrived' : 'unknown',
    disruption: normalizedStatus === 'Delayed' ? 'delay' : normalizedStatus === 'Cancelled' ? 'cancelled' : normalizedStatus === 'Diverted' ? 'diverted' : 'none',
    departureDelayMinutes: null,
    arrivalDelayMinutes: null,
    delaySource: null,
    position: null,
    source: row.provider_source ?? 'Saved flight record',
    lastUpdatedAt: row.last_updated_at ?? row.updated_at,
  };
}

async function findOrCreateFlight(flight: Flight): Promise<string> {
  const client = requireSupabase();
  const provider = flight.source || 'FlightAware AeroAPI';
  const providerFlightId = flight.providerFlightId || flight.id || null;

  if (providerFlightId) {
    const { data, error } = await client
      .from('flights')
      .select('id')
      .eq('provider_flight_id', providerFlightId)
      .eq('provider', provider)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  let lookup = client.from('flights').select('id').eq('provider', provider).eq('ident', flight.flightNumber);
  const departure = toTimestamp(flight.scheduledDeparture);
  if (departure) lookup = lookup.eq('scheduled_departure', departure);
  const { data: existing, error: lookupError } = await lookup.limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id as string;

  const now = new Date().toISOString();
  const payload = {
    provider,
    provider_flight_id: providerFlightId,
    ident: flight.flightNumber,
    origin: nonEmpty(flight.origin.code),
    destination: nonEmpty(flight.destination.code),
    scheduled_departure: toTimestamp(flight.scheduledDeparture),
    scheduled_arrival: toTimestamp(flight.scheduledArrival),
    estimated_departure: toTimestamp(flight.estimatedDeparture),
    estimated_arrival: toTimestamp(flight.estimatedArrival),
    actual_departure: toTimestamp(flight.actualDeparture),
    actual_arrival: toTimestamp(flight.actualArrival),
    status: flight.status,
    delay_minutes: flight.departureDelayMinutes ?? null,
    diverted: flight.status === 'Diverted' || flight.disruption === 'diverted',
    cancelled: flight.status === 'Cancelled' || flight.disruption === 'cancelled',
    last_provider_update: toTimestamp(flight.lastUpdatedAt),
    last_checked_at: now,
    created_at: now,
    updated_at: now,
    airline: nonEmpty(flight.airline),
    airline_code: nonEmpty(flight.airlineCode),
    origin_city: nonEmpty(flight.origin.city),
    destination_city: nonEmpty(flight.destination.city),
    duration: nonEmpty(flight.duration),
    terminal: nonEmpty(flight.terminal),
    gate: nonEmpty(flight.gate),
    aircraft: nonEmpty(flight.aircraft),
    aircraft_registration: nonEmpty(flight.aircraftRegistration),
  };
  const { data, error } = await client.from('flights').insert(payload).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function loadOneWatch(id: string): Promise<WatchedFlightRow | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('flight_watches')
    .select(WATCH_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toWatchedFlightRow(data as unknown as FlightWatchDbRow) : null;
}

function toWatchedFlightRow(watch: FlightWatchDbRow): WatchedFlightRow {
  const joined = Array.isArray(watch.flights) ? watch.flights[0] : watch.flights;
  if (!joined) throw new Error('The saved flight watch has no matching flights record. Check the flight_watches.flight_id relationship.');
  const flight = joined as FlightDbRow;
  const departure = flight.scheduled_departure ?? flight.estimated_departure ?? flight.actual_departure;
  const arrival = flight.scheduled_arrival ?? flight.estimated_arrival ?? flight.actual_arrival;
  const created = watch.watched_at ?? flight.created_at;
  const updated = flight.last_provider_update ?? flight.last_checked_at ?? flight.updated_at ?? created;
  return {
    id: watch.id,
    flight_number: flight.ident,
    travel_date: departure?.slice(0, 10) ?? arrival?.slice(0, 10) ?? created.slice(0, 10),
    origin_code: flight.origin,
    destination_code: flight.destination,
    monitoring_status: watch.active ? 'active' : watch.stopped_at ? 'expired' : 'paused',
    provider_source: flight.provider,
    airline: flight.airline,
    origin_city: flight.origin_city,
    destination_city: flight.destination_city,
    departure_time: departure,
    arrival_time: arrival,
    status: flight.status,
    duration: flight.duration,
    terminal: flight.terminal,
    last_updated_at: updated,
    created_at: created,
    updated_at: updated,
  };
}

function normalizeStatus(status: string | null): Flight['status'] {
  if (!status) return 'Unknown';
  const value = status.toLowerCase();
  if (value.includes('cancel')) return 'Cancelled';
  if (value.includes('divert')) return 'Diverted';
  if (value.includes('delay')) return 'Delayed';
  if (value.includes('board')) return 'Boarding';
  if (value.includes('airborne') || value.includes('in flight') || value.includes('en route')) return 'In flight';
  if (value.includes('land') || value.includes('arriv')) return 'Landed';
  if (value.includes('on time') || value.includes('scheduled')) return 'On time';
  return 'Unknown';
}

function toTimestamp(value: string | undefined | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nonEmpty(value: string | undefined | null): string | null {
  return value?.trim() ? value.trim() : null;
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}
