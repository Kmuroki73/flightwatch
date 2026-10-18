import { demoFlights } from '@/data/demoFlights';
import type { BoardResult, Flight, FlightDataMode } from '@/types';
import { classifyFlight } from '@/lib/flightStatus';
import { supabase } from '@/lib/supabase';

export type FlightSearchInput = {
  flightNumber: string;
  travelDate?: string;
};

export type AirportSearchInput = {
  airport: string;
  direction?: 'departures' | 'arrivals';
  travelDate?: string;
};

export type FlightProviderMode = 'demo' | 'live';

export interface FlightDataProvider {
  readonly mode: FlightProviderMode;
  readonly availabilityNote: string | null;
  search(input: FlightSearchInput): Promise<Flight[]>;
  searchAirport(input: AirportSearchInput): Promise<BoardResult>;
}

export class FlightProviderError extends Error {
  constructor(
    public readonly kind: 'invalid' | 'empty' | 'auth' | 'not_configured' | 'not_deployed' | 'rate_limit' | 'timeout' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'FlightProviderError';
  }
}

class DemoFlightProvider implements FlightDataProvider {
  readonly mode = 'demo' as const;
  readonly availabilityNote = 'Showing clearly labelled demonstration flights. Live provider coverage is not configured yet.';

  async search(input: FlightSearchInput): Promise<Flight[]> {
    const normalizedFlightNumber = normalizeFlightNumber(input.flightNumber);
    const matches = demoFlights.filter((flight) => {
      const numberMatches = compactFlightNumber(flight.flightNumber) === normalizedFlightNumber;
      const dateMatches = !input.travelDate || flight.scheduledDeparture?.startsWith(input.travelDate);
      return numberMatches && dateMatches;
    });

    if (!matches.length) throw new FlightProviderError('empty', 'No demonstration flight matched that number and travel date. Try KQ100, EK720, BA63 or KQ310.');
    return matches;
  }

  async searchAirport(input: AirportSearchInput): Promise<BoardResult> {
    const code = input.airport.trim().toUpperCase();
    const flights = demoFlights.filter((flight) =>
      (input.direction === 'arrivals' ? flight.destination.code : flight.origin.code) === code);
    return {
      airport: code,
      direction: input.direction ?? 'departures',
      flights,
      source: 'Demonstration dataset',
      fetchedAt: new Date().toISOString(),
      dataMode: 'demo',
      note: 'Demonstration board only. Live airport boards require configured provider coverage.',
    };
  }
}

type LiveFlightResponse = { flights: LiveFlightPayload[] };
type LiveEnvelope<T> = LiveFlightResponse & Partial<T>;

class EdgeFunctionFlightProvider implements FlightDataProvider {
  readonly mode = 'live' as const;
  readonly availabilityNote = null;

  constructor(private readonly endpoint: string) {}

  async search(input: FlightSearchInput): Promise<Flight[]> {
    const envelope = await this.call<Record<string, never>>({
      flightNumber: normalizeFlightNumber(input.flightNumber),
      travelDate: input.travelDate || null,
    });
    const flights = envelope.flights;
    if (!flights.length) throw new FlightProviderError('empty', 'No matching flights found for that number and travel date. Adjust the date or try again.');
    return flights.map(normalizeLiveFlight);
  }

  async searchAirport(input: AirportSearchInput): Promise<BoardResult> {
    const code = input.airport.trim().toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(code)) throw new FlightProviderError('invalid', 'Enter a 3 or 4 letter airport code, e.g. NBO.');
    const board = await this.call<LiveBoardPayload>({ airport: code, direction: input.direction ?? 'departures', travelDate: input.travelDate || null });
    return {
      airport: board.airport ?? code,
      direction: board.direction ?? input.direction ?? 'departures',
      flights: (board.flights ?? []).map(normalizeLiveFlight),
      source: board.source ?? 'FlightAware AeroAPI',
      fetchedAt: board.fetchedAt ?? new Date().toISOString(),
      dataMode: 'live',
      note: board.note,
    };
  }

  private async call<T>(body: Record<string, unknown>): Promise<LiveEnvelope<T>> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionData.session?.access_token) headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      if (import.meta.env.VITE_SUPABASE_ANON_KEY) headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload: unknown = await response.json().catch(() => null);
      const message = readMessage(payload);

      if (response.status === 503 && payload && typeof payload === 'object' && 'error' in payload && (payload as { error?: string }).error === 'not_configured') {
        throw new FlightProviderError('not_configured', message || 'Live flight data is not configured yet.');
      }
      if (response.status === 401 || response.status === 403) throw new FlightProviderError('auth', message || 'Live flight search is not authorized.');
      if (response.status === 429) throw new FlightProviderError('rate_limit', message || 'Live flight search is temporarily rate limited. Try again shortly.');
      if (!response.ok) {
        if (response.status === 404 && message?.includes('not found')) {
          throw new FlightProviderError('not_deployed', 'Live flight search is being deployed. Try again shortly.');
        }
        throw new FlightProviderError('unavailable', message || 'Live flight search is temporarily unavailable.');
      }

      if (!payload || typeof payload !== 'object' || !('flights' in payload) || !Array.isArray((payload as { flights?: unknown }).flights)) {
        throw new FlightProviderError('unavailable', 'The live provider returned an unsupported response.');
      }
      // A 200 with an empty flights array is a genuine no-match, not a protocol failure.
      return payload as LiveEnvelope<T>;
    } catch (error) {
      if (error instanceof FlightProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new FlightProviderError('timeout', 'Live flight search took too long to respond.');
      throw new FlightProviderError('unavailable', 'Live flight search could not be reached.');
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

type LiveFlightPayload = {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: { code: string; city: string; timezone?: string; scheduledTime?: string; estimatedTime?: string; actualTime?: string };
  destination: { code: string; city: string; timezone?: string; scheduledTime?: string; estimatedTime?: string; actualTime?: string };
  date: string;
  status?: string;
  statusDetail?: string;
  cancelled?: boolean;
  diverted?: boolean;
  departureDelayMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
  duration?: string;
  terminal?: string;
  gate?: string;
  source?: string;
  lastUpdatedAt: string;
  fetchedAt?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  aircraft?: string;
  aircraftRegistration?: string;
};

type LiveBoardPayload = {
  airport?: string;
  direction?: 'departures' | 'arrivals';
  flights?: LiveFlightPayload[];
  source?: string;
  fetchedAt?: string;
  note?: string;
};

function readMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message;
  }
  return undefined;
}

function normalizeLiveFlight(flight: LiveFlightPayload): Flight {
  const classification = classifyFlight(flight);
  const originTime = formatLocalTime(pickTime(flight.origin), flight.origin.timezone);
  const destinationTime = formatLocalTime(pickTime(flight.destination), flight.destination.timezone);

  return {
    id: flight.id,
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    airlineCode: flight.airlineCode,
    origin: { code: flight.origin.code, city: flight.origin.city, time: originTime },
    destination: { code: flight.destination.code, city: flight.destination.city, time: destinationTime },
    date: flight.date,
    status: classification.status,
    statusDetail: deriveStatusDetail(flight, classification),
    duration: flight.duration ?? 'Unavailable',
    terminal: flight.terminal ?? 'Not provided',
    updated: flight.lastUpdatedAt,
    route: `${flight.origin.city} to ${flight.destination.city}`,
    timeline: [],
    dataMode: 'live',
    source: flight.source ?? 'FlightAware AeroAPI',
    lastUpdatedAt: flight.lastUpdatedAt,
    fetchedAt: flight.fetchedAt,
    phase: classification.phase,
    disruption: classification.disruption,
    departureDelayMinutes: classification.departureDelayMinutes,
    arrivalDelayMinutes: classification.arrivalDelayMinutes,
    delaySource: classification.delaySource,
    position: null,
    providerFlightId: flight.id,
    scheduledDeparture: flight.scheduledDeparture,
    scheduledArrival: flight.scheduledArrival,
    estimatedDeparture: flight.estimatedDeparture,
    estimatedArrival: flight.estimatedArrival,
    actualDeparture: flight.actualDeparture,
    actualArrival: flight.actualArrival,
    gate: flight.gate,
    aircraft: flight.aircraft,
    aircraftRegistration: flight.aircraftRegistration,
  };
}
function pickTime(airport: LiveFlightPayload['origin']): string | undefined {
  return airport.actualTime ?? airport.estimatedTime ?? airport.scheduledTime;
}

function normalizeFlightNumber(value: string): string {
  const compact = compactFlightNumber(value);
  if (!/^[A-Z0-9]{3,8}$/.test(compact) || !/[A-Z]/.test(compact) || !/\d/.test(compact)) {
    throw new FlightProviderError('invalid', 'Enter a valid airline code and flight number.');
  }
  return compact;
}

function compactFlightNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function formatLocalTime(value: string | undefined, timezone: string | undefined): string {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !timezone) return value;
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed);
  } catch {
    return value;
  }
}

function deriveStatusDetail(flight: LiveFlightPayload, classification: ReturnType<typeof classifyFlight>): string {
  if (flight.cancelled) return 'Cancellation reported by the provider.';
  if (flight.diverted) return 'Diversion reported by the provider.';
  if (classification.status === 'Unknown') return 'The provider has not supplied enough information to classify this flight.';
  if (classification.departureDelayMinutes != null && classification.departureDelayMinutes >= 15) {
    const source = classification.delaySource === 'provider' ? 'reported by the provider' : 'calculated by Songa from timestamps';
    return `Departure delay of ${classification.departureDelayMinutes} minutes, ${source}.`;
  }
  if (classification.status === 'In flight') return 'The provider reports this flight as airborne.';
  if (classification.status === 'Landed') return 'The provider reports this flight as arrived.';
  if (flight.statusDetail) return flight.statusDetail;
  return 'Operating to the latest available schedule. This is not a guarantee of on-time performance.';
}

class LegacyFlightawareProvider implements FlightDataProvider {
  readonly mode = 'live' as const;
  readonly availabilityNote = null;

  constructor(private readonly endpoint: string) {}

  async search(input: FlightSearchInput): Promise<Flight[]> {
    const ident = normalizeFlightNumber(input.flightNumber);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.endpoint}?ident=${encodeURIComponent(ident)}`, {
        headers: anonHeaders(),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new FlightProviderError('unavailable', readMessage(payload) || 'Live flight search is temporarily unavailable.');
      const rawFlights = payload && typeof payload === 'object' && 'flights' in payload && Array.isArray((payload as { flights?: unknown }).flights)
        ? (payload as { flights: unknown[] }).flights
        : [];
      const mapped = rawFlights
        .map((f) => mapRawAeroFlight(f as Record<string, unknown>))
        .filter((f): f is LiveFlightPayload => f !== null)
        .filter((f) => !input.travelDate || f.scheduledDeparture?.slice(0, 10) === input.travelDate);
      if (!mapped.length) throw new FlightProviderError('empty', 'No flight matched that number and travel date.');
      return mapped.map(normalizeLiveFlight);
    } catch (error) {
      if (error instanceof FlightProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new FlightProviderError('timeout', 'Live flight search took too long to respond.');
      throw new FlightProviderError('unavailable', 'Live flight search could not be reached.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async searchAirport(_input: AirportSearchInput): Promise<BoardResult> {
    void _input;
    throw new FlightProviderError('unavailable', 'Live airport boards are not available on the current provider endpoint.');
  }
}

class ResilientFlightProvider implements FlightDataProvider {
  readonly availabilityNote: string | null;
  private readonly live: EdgeFunctionFlightProvider;
  private readonly legacy: LegacyFlightawareProvider | null;
  private readonly demo = new DemoFlightProvider();

  constructor(endpoint: string, legacyEndpoint: string | null) {
    this.live = new EdgeFunctionFlightProvider(endpoint);
    this.legacy = legacyEndpoint ? new LegacyFlightawareProvider(legacyEndpoint) : null;
    this.availabilityNote = null;
  }

  get mode(): FlightProviderMode {
    return 'live';
  }

  async search(input: FlightSearchInput): Promise<Flight[]> {
    try {
      return await this.live.search(input);
    } catch (error) {
      if (error instanceof FlightProviderError && error.kind === 'not_deployed' && this.legacy) {
        return this.legacy.search(input);
      }
      if (error instanceof FlightProviderError && error.kind === 'not_configured') return this.demo.search(input);
      throw error;
    }
  }

  async searchAirport(input: AirportSearchInput): Promise<BoardResult> {
    try {
      return await this.live.searchAirport(input);
    } catch (error) {
      if (error instanceof FlightProviderError && error.kind === 'not_configured') return this.demo.searchAirport(input);
      throw error;
    }
  }
}

function anonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (key) headers.apikey = key;
  return headers;
}

function mapRawAeroFlight(f: Record<string, unknown>): LiveFlightPayload | null {
  const ident = typeof f.ident === 'string' ? f.ident : typeof f.ident_iata === 'string' ? f.ident_iata : null;
  const origin = f.origin as Record<string, unknown> | undefined;
  const destination = f.destination as Record<string, unknown> | undefined;
  if (!ident || !origin || !destination) return null;

  const operator = f.operator as string | undefined;
  const operatorIata = f.operator_iata as string | undefined;
  const airlineCode = operatorIata ?? operator?.slice(0, 3) ?? ident.replace(/\d+$/, '');
  const statusRaw = typeof f.status === 'string' ? f.status : '';
  const date = (typeof f.day === 'string' && f.day) || (typeof f.scheduled_off === 'string' ? f.scheduled_off.slice(0, 10) : '') || '';
  const seconds = typeof f.block_time === 'number' ? f.block_time : typeof f.filed_ete === 'number' ? f.filed_ete : undefined;
  const minutes = seconds != null ? Math.round(seconds / 60) : undefined;
  const duration = minutes && minutes > 0
    ? `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}h ` : ''}${Math.round(minutes % 60)}m`
    : undefined;

  return {
    id: typeof f.fa_flight_id === 'string' ? f.fa_flight_id : `${ident}-${date}`,
    flightNumber: formatIdentWithSpace(ident),
    airline: operatorIata ? `${operatorIata} ${String(f.flight_number ?? '').trim()}`.trim() : operator ?? airlineCode,
    airlineCode,
    origin: {
      code: (origin.code_iata ?? origin.code) as string,
      city: (origin.city ?? origin.code_iata ?? origin.code) as string,
      timezone: origin.timezone as string | undefined,
      scheduledTime: (f.scheduled_off ?? f.scheduled_departure) as string | undefined,
      estimatedTime: (f.estimated_off ?? f.estimated_departure) as string | undefined,
      actualTime: (f.actual_off ?? f.actual_departure) as string | undefined,
    },
    destination: {
      code: (destination.code_iata ?? destination.code) as string,
      city: (destination.city ?? destination.code_iata ?? destination.code) as string,
      timezone: destination.timezone as string | undefined,
      scheduledTime: (f.scheduled_in ?? f.scheduled_arrival) as string | undefined,
      estimatedTime: (f.estimated_in ?? f.estimated_arrival) as string | undefined,
      actualTime: (f.actual_in ?? f.actual_arrival) as string | undefined,
    },
    date,
    status: statusRaw,
    cancelled: f.cancelled === true || statusRaw.toLowerCase().includes('cancelled'),
    diverted: f.diverted === true || statusRaw.toLowerCase().includes('diverted'),
    duration,
    terminal: (origin.terminal ?? origin.terminal_gate) as string | undefined,
    gate: (origin.gate ?? origin.gate_origin) as string | undefined,
    aircraft: typeof f.aircraft_type === 'string' ? f.aircraft_type : undefined,
    aircraftRegistration: typeof f.registration === 'string' ? f.registration : undefined,
    departureDelayMinutes: toDelayMinutes(f.departure_delay),
    arrivalDelayMinutes: toDelayMinutes(f.arrival_delay),
    scheduledDeparture: (f.scheduled_off ?? f.scheduled_departure) as string | undefined,
    scheduledArrival: (f.scheduled_in ?? f.scheduled_arrival) as string | undefined,
    estimatedDeparture: (f.estimated_off ?? f.estimated_departure) as string | undefined,
    estimatedArrival: (f.estimated_in ?? f.estimated_arrival) as string | undefined,
    actualDeparture: (f.actual_off ?? f.actual_departure) as string | undefined,
    actualArrival: (f.actual_in ?? f.actual_arrival) as string | undefined,
    lastUpdatedAt: ((f.last_position as Record<string, unknown> | undefined)?._ts ?? f.updated ?? new Date().toISOString()) as string,
  };
}

function formatIdentWithSpace(ident: string): string {
  const match = ident.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : ident;
}

// AeroAPI reports departure_delay/arrival_delay in seconds (may be null).
function toDelayMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value / 60);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredEndpoint = (import.meta.env.VITE_FLIGHT_SEARCH_FUNCTION_URL as string | undefined)
  ?? (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/flight-search` : undefined);
const legacyEndpoint = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/flightaware` : null;

export const flightProvider: FlightDataProvider = configuredEndpoint
  ? new ResilientFlightProvider(configuredEndpoint, legacyEndpoint)
  : new DemoFlightProvider();

export const flightProviderMode: FlightDataMode = flightProvider.mode;
