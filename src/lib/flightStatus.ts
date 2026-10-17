import type { DisruptionCategory, FlightPhase, FlightStatus } from '@/types';

export type ProviderFlightCore = {
  status?: string;
  cancelled?: boolean;
  diverted?: boolean;
  scheduledDeparture?: string;
  estimatedDeparture?: string;
  actualDeparture?: string;
  scheduledArrival?: string;
  estimatedArrival?: string;
  actualArrival?: string;
};

export type Classification = {
  status: FlightStatus;
  phase: FlightPhase;
  disruption: DisruptionCategory;
  departureDelayMinutes: number | null;
  arrivalDelayMinutes: number | null;
  delaySource: 'provider' | 'calculated' | null;
};

const BOARDING_PATTERN = /boarding/i;
const AIRBORNE_PATTERN = /en\s?route|airborne|in\s?air|inflight|in\s?flight|cruis/i;
const DELAYED_PATTERN = /delay/i;
const DELAY_THRESHOLD_MINUTES = 15;

export function classifyFlight(flight: ProviderFlightCore): Classification {
  const departureDelay = minutesBetween(flight.scheduledDeparture, flight.estimatedDeparture ?? flight.actualDeparture);
  const arrivalDelay = minutesBetween(flight.scheduledArrival, flight.estimatedArrival ?? flight.actualArrival);
  const providerStatus = flight.status ?? '';
  const providerSaysDelayed = DELAYED_PATTERN.test(providerStatus);
  const delaySource = providerSaysDelayed ? 'provider' as const : 'calculated' as const;

  if (flight.cancelled === true) {
    return { status: 'Cancelled', phase: 'unknown', disruption: 'cancelled', departureDelayMinutes: null, arrivalDelayMinutes: null, delaySource: null };
  }
  if (flight.diverted === true) {
    return { status: 'Diverted', phase: 'unknown', disruption: 'diverted', departureDelayMinutes: departureDelay, arrivalDelayMinutes: null, delaySource: departureDelay == null ? null : delaySource };
  }
  if (flight.actualArrival) {
    return { status: 'Landed', phase: 'arrived', disruption: arrivalDelay != null && arrivalDelay >= DELAY_THRESHOLD_MINUTES ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: arrivalDelay == null && departureDelay == null ? null : delaySource };
  }
  if (flight.actualDeparture || AIRBORNE_PATTERN.test(providerStatus)) {
    return { status: 'In flight', phase: 'airborne', disruption: arrivalDelay != null && arrivalDelay >= DELAY_THRESHOLD_MINUTES ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: arrivalDelay == null && departureDelay == null ? null : delaySource };
  }
  if (BOARDING_PATTERN.test(providerStatus)) {
    const delayed = departureDelay != null && departureDelay >= DELAY_THRESHOLD_MINUTES;
    return { status: 'Boarding', phase: 'boarding', disruption: delayed || providerSaysDelayed ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: delayed || providerSaysDelayed ? delaySource : null };
  }
  if (departureDelay != null && departureDelay >= DELAY_THRESHOLD_MINUTES) {
    return { status: 'Delayed', phase: 'scheduled', disruption: 'delay', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (arrivalDelay != null && arrivalDelay >= DELAY_THRESHOLD_MINUTES) {
    return { status: 'Delayed', phase: 'scheduled', disruption: 'delay', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (providerSaysDelayed) {
    return { status: 'Delayed', phase: 'scheduled', disruption: 'delay', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: 'provider' };
  }
  if (!providerStatus && !flight.scheduledDeparture && !flight.estimatedDeparture) {
    return { status: 'Unknown', phase: 'unknown', disruption: 'unknown', departureDelayMinutes: null, arrivalDelayMinutes: null, delaySource: null };
  }
  return { status: 'On time', phase: 'scheduled', disruption: 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: departureDelay == null && arrivalDelay == null ? null : delaySource };
}

export function needsAttention(flight: { status: FlightStatus; disruption?: DisruptionCategory }): boolean {
  return flight.disruption === 'delay' || flight.disruption === 'cancelled' || flight.disruption === 'diverted' || flight.status === 'Delayed' || flight.status === 'Cancelled' || flight.status === 'Diverted';
}

export function operatingSmoothly(flight: { status: FlightStatus; disruption?: DisruptionCategory }): boolean {
  return (flight.disruption ?? 'none') === 'none' && ['On time', 'Boarding', 'In flight', 'Landed'].includes(flight.status);
}

export function statusSlug(status: FlightStatus): string {
  return status.toLowerCase().replace(/\s+/g, '-');
}

function minutesBetween(scheduled: string | undefined, actualOrEstimated: string | undefined): number | null {
  const base = parseTimestamp(scheduled);
  const compare = parseTimestamp(actualOrEstimated);
  if (!base || !compare) return null;
  return Math.round((compare.getTime() - base.getTime()) / 60_000);
}

function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
