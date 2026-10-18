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
  departureDelayMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
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
  // Provider-supplied delay values take precedence; timestamp math is the
  // justified fallback when the provider gives times but no delay field.
  const departureDelay = flight.departureDelayMinutes ?? minutesBetween(flight.scheduledDeparture, flight.estimatedDeparture ?? flight.actualDeparture);
  const arrivalDelay = flight.arrivalDelayMinutes ?? minutesBetween(flight.scheduledArrival, flight.estimatedArrival ?? flight.actualArrival);
  const delaySource: 'provider' | 'calculated' | null = departureDelay == null && arrivalDelay == null
    ? null
    : (flight.departureDelayMinutes != null || flight.arrivalDelayMinutes != null) ? 'provider' : 'calculated';
  const providerStatus = flight.status ?? '';
  const providerSaysDelayed = DELAYED_PATTERN.test(providerStatus);
  const delayed = departureDelay != null && departureDelay >= DELAY_THRESHOLD_MINUTES;
  const arrivalDelayed = arrivalDelay != null && arrivalDelay >= DELAY_THRESHOLD_MINUTES;

  if (flight.cancelled === true) {
    return { status: 'Cancelled', phase: 'unknown', disruption: 'cancelled', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (flight.diverted === true) {
    return { status: 'Diverted', phase: 'unknown', disruption: 'diverted', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (flight.actualArrival) {
    return { status: 'Landed', phase: 'arrived', disruption: arrivalDelayed ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (flight.actualDeparture || AIRBORNE_PATTERN.test(providerStatus)) {
    return { status: 'In flight', phase: 'airborne', disruption: arrivalDelayed ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (BOARDING_PATTERN.test(providerStatus)) {
    return { status: 'Boarding', phase: 'boarding', disruption: delayed || providerSaysDelayed ? 'delay' : 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: delayed || providerSaysDelayed ? delaySource : null };
  }
  if (delayed || arrivalDelayed) {
    return { status: 'Delayed', phase: 'scheduled', disruption: 'delay', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  if (providerSaysDelayed) {
    return { status: 'Delayed', phase: 'scheduled', disruption: 'delay', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource: 'provider' };
  }
  // Without a provider status word or delay evidence, never claim "On time".
  if (!providerStatus) {
    return { status: 'Unknown', phase: 'scheduled', disruption: 'unknown', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
  }
  return { status: 'On time', phase: 'scheduled', disruption: 'none', departureDelayMinutes: departureDelay, arrivalDelayMinutes: arrivalDelay, delaySource };
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
