export type AlertItem = {
  id: string;
  flightId: string;
  title: string;
  detail: string;
  time: string;
  tone: 'warning' | 'info';
};

export type FlightStatus = 'On time' | 'Delayed' | 'Boarding' | 'Cancelled' | 'Diverted' | 'In flight' | 'Landed' | 'Unknown';

export type FlightPhase = 'scheduled' | 'boarding' | 'airborne' | 'arrived' | 'unknown';

export type DisruptionCategory = 'none' | 'delay' | 'cancelled' | 'diverted' | 'unknown';

export type FlightDataMode = 'demo' | 'live';

export type Screen = 'home' | 'results' | 'details' | 'watch' | 'alerts' | 'airports' | 'companion' | 'workspace' | 'whatsapp' | 'account';

export type FlightPosition = {
  latitude: number;
  longitude: number;
  altitudeFt?: number;
  groundspeedKts?: number;
  headingDeg?: number;
  updatedAt: string;
};

export type TimelineEvent = {
  time: string;
  title: string;
  description: string;
  state: 'complete' | 'current' | 'upcoming';
};

export type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: { code: string; city: string; time: string };
  destination: { code: string; city: string; time: string };
  date: string;
  status: FlightStatus;
  statusDetail: string;
  duration: string;
  terminal: string;
  updated: string;
  route: string;
  timeline: TimelineEvent[];
  dataMode: FlightDataMode;
  source: string;
  lastUpdatedAt: string;
  phase: FlightPhase;
  disruption: DisruptionCategory;
  departureDelayMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
  delaySource?: 'provider' | 'calculated' | null;
  position?: FlightPosition | null;
  fetchedAt?: string;
  providerFlightId?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  gate?: string;
  aircraft?: string;
  aircraftRegistration?: string;
};

export type BoardResult = {
  airport: string;
  direction: 'departures' | 'arrivals';
  flights: Flight[];
  source: string;
  fetchedAt: string;
  dataMode: FlightDataMode;
  note?: string;
};
