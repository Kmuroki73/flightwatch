import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CircleAlert, Clock3, Globe2, LocateFixed, MapPin, Plane, PlaneLanding, PlaneTakeoff, RefreshCw, Search } from 'lucide-react';
import type { BoardResult, Flight } from '@/types';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';

type Airport = { code: string; name: string; city: string; lat: number; lon: number };

// Coordinates are for discovery only; the provider remains the source of flight data.
const AIRPORTS: Airport[] = [
  { code: 'NBO', name: 'Jomo Kenyatta International', city: 'Nairobi, Kenya', lat: -1.3192, lon: 36.9278 },
  { code: 'WIL', name: 'Wilson Airport', city: 'Nairobi, Kenya', lat: -1.3217, lon: 36.8148 },
  { code: 'MBA', name: 'Moi International', city: 'Mombasa, Kenya', lat: -4.0348, lon: 39.5942 },
  { code: 'KIS', name: 'Kisumu International', city: 'Kisumu, Kenya', lat: -0.0861, lon: 34.7289 },
  { code: 'EDL', name: 'Eldoret International', city: 'Eldoret, Kenya', lat: 0.4045, lon: 35.2389 },
  { code: 'MYD', name: 'Malindi Airport', city: 'Malindi, Kenya', lat: -3.2293, lon: 40.1017 },
  { code: 'LAU', name: 'Manda Airport', city: 'Lamu, Kenya', lat: -2.2524, lon: 40.9131 },
  { code: 'UAS', name: 'Samburu Airport', city: 'Samburu, Kenya', lat: 0.5306, lon: 37.5342 },
  { code: 'LHR', name: 'Heathrow Airport', city: 'London, United Kingdom', lat: 51.4700, lon: -0.4543 },
  { code: 'LGW', name: 'Gatwick Airport', city: 'London, United Kingdom', lat: 51.1537, lon: -0.1821 },
  { code: 'DXB', name: 'Dubai International', city: 'Dubai, UAE', lat: 25.2532, lon: 55.3657 },
  { code: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam, Netherlands', lat: 52.3105, lon: 4.7683 },
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York, USA', lat: 40.6413, lon: -73.7781 },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles, USA', lat: 33.9416, lon: -118.4085 },
  { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', lat: 1.3644, lon: 103.9915 },
];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1); const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function AirportsScreen({ initialAirport, onOpenFlight }: { initialAirport: string | null; onOpenFlight: (flight: Flight) => void }) {
  const [airport, setAirport] = useState((initialAirport ?? 'NBO').toUpperCase().slice(0, 4));
  const [direction, setDirection] = useState<'departures' | 'arrivals'>('departures');
  const [board, setBoard] = useState<BoardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<Array<Airport & { distance: number }> | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const load = useCallback((code: string, dir: 'departures' | 'arrivals') => {
    setLoading(true);
    setError('');
    flightProvider.searchAirport({ airport: code, direction: dir })
      .then(setBoard)
      .catch((err) => setError(err instanceof FlightProviderError ? err.message : 'The airport board could not be loaded right now.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load((initialAirport ?? 'NBO').toUpperCase(), direction); }, [direction, initialAirport, load]);

  const visibleFlights = useMemo(() => {
    if (!board) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return board.flights;
    return board.flights.filter((flight) =>
      `${flight.flightNumber} ${flight.airline} ${flight.origin.code} ${flight.destination.code} ${flight.origin.city} ${flight.destination.city}`.toLowerCase().includes(needle));
  }, [board, query]);

  const metrics = useMemo(() => {
    if (!board) return null;
    const flights = board.flights;
    const delayed = flights.filter((flight) => flight.disruption === 'delay').length;
    const cancelled = flights.filter((flight) => flight.disruption === 'cancelled').length;
    const delays = flights.map((flight) => flight.departureDelayMinutes).filter((value): value is number => value != null && value >= 0);
    const averageDelay = delays.length ? Math.round(delays.reduce((total, value) => total + value, 0) / delays.length) : null;
    return { total: flights.length, delayed, cancelled, averageDelay, onTime: flights.length - delayed - cancelled };
  }, [board]);

  return (
    <section className="page-width page-section boards-page">
      <div className="boards-hero">
        <div>
          <div className="section-kicker">AIRPORT INTELLIGENCE</div>
          <h1>{board?.airport ?? airport} <span className="boards-city">{board ? `${direction}` : 'board'}</span></h1>
          <p className="boards-lede">A clean, honest departure and arrival board for any airport the provider covers.</p>
        </div>
        <form className="boards-controls" onSubmit={(event) => { event.preventDefault(); load(airport.toUpperCase(), direction); }}>
          <div className="boards-input">
            <Search size={16} />
            <input
              id="airport-code"
              value={airport}
              onChange={(event) => setAirport(event.target.value.toUpperCase())}
              maxLength={4}
              placeholder="Airport code, e.g. NBO"
              aria-label="Airport code"
            />
          </div>
          <div className="boards-direction" role="tablist" aria-label="Board direction">
            {(['departures', 'arrivals'] as const).map((item) => (
              <button
                type="button"
                key={item}
                role="tab"
                aria-selected={direction === item}
                className={direction === item ? 'board-tab active' : 'board-tab'}
                onClick={() => setDirection(item)}
              >
                {item === 'departures' ? <PlaneTakeoff size={15} /> : <PlaneLanding size={15} />} {item}
              </button>
            ))}
          </div>
          <button className="primary-button" type="submit" disabled={loading || airport.trim().length < 3}>
            {loading ? 'Loading…' : 'Load board'} {!loading && <RefreshCw size={14} />}
          </button>
        </form>
      </div>

      <div className="nearby-airports-panel" style={{ marginBottom: 22, padding: 18, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={20} color="var(--orange)" />
            <div><strong style={{ color: 'var(--warm)' }}>Find airports near you</strong><p style={{ margin: '4px 0 0', color: '#8fa5ab', fontSize: 12 }}>Location is optional. Your coordinates are used in this browser to calculate distances and are not sent to Songa.</p></div>
          </div>
          <button className="secondary-button" type="button" disabled={locationLoading} onClick={() => {
            setLocationError('');
            if (!navigator.geolocation) { setLocationError('Location is not available in this browser. Search for an airport manually instead.'); return; }
            setLocationLoading(true);
            navigator.geolocation.getCurrentPosition((position) => {
              const { latitude, longitude } = position.coords;
              const results = AIRPORTS.map((item) => ({ ...item, distance: distanceKm(latitude, longitude, item.lat, item.lon) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
              setNearby(results); setLocationLoading(false);
            }, (geoError) => {
              setLocationLoading(false);
              setLocationError(geoError.code === geoError.PERMISSION_DENIED ? 'Location permission was denied. You can still enter an airport code above.' : 'We could not determine your location. You can still enter an airport code above.');
            }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
          }}><LocateFixed size={15} /> {locationLoading ? 'Finding airports…' : 'Use my location'}</button>
        </div>
        {locationError && <p className="inline-error" role="alert" style={{ marginTop: 12 }}>{locationError}</p>}
        {nearby && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 16 }}>
          {nearby.map((item) => <button key={item.code} type="button" className={airport === item.code ? 'secondary-button selected' : 'secondary-button'} onClick={() => { setAirport(item.code); load(item.code, direction); }} style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12 }}>
            <Globe2 size={16} style={{ marginTop: 2, flexShrink: 0 }} /><span><strong>{item.code} · {Math.round(item.distance)} km</strong><small style={{ display: 'block', marginTop: 4, whiteSpace: 'normal' }}>{item.name}<br />{item.city}</small></span>
          </button>)}
          <p style={{ gridColumn: '1 / -1', margin: '2px 0 0', color: '#8fa5ab', fontSize: 11 }}>Nearby results use a curated airport list, not a complete global directory. Flight boards load from the configured provider and may be unavailable for some airports.</p>
        </div>}
      </div>

      {error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}

      {metrics && board && (
        <div className="boards-metrics">
          <div className="boards-metric"><Plane size={17} /><strong>{metrics.total}</strong><span>flights on board</span></div>
          <div className="boards-metric ok"><Clock3 size={17} /><strong>{metrics.onTime}</strong><span>no reported disruption</span></div>
          <div className="boards-metric warn"><Clock3 size={17} /><strong>{metrics.delayed}</strong><span>confirmed delays</span></div>
          <div className="boards-metric bad"><CircleAlert size={17} /><strong>{metrics.cancelled}</strong><span>cancellations</span></div>
          <div className="boards-metric"><Globe2 size={17} /><strong>{metrics.averageDelay != null ? `${metrics.averageDelay}m` : '—'}</strong><span>avg delay in sample</span></div>
        </div>
      )}

      {board && (
        <div className="boards-body">
          <div className="boards-table-head">
            <div className="boards-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by flight, airline or city" aria-label="Filter board rows" />
            </div>
            <span className="boards-freshness"><Clock3 size={13} /> Fetched {new Date(board.fetchedAt).toLocaleTimeString()} · {board.source}</span>
          </div>
          <div className="boards-table" role="table" aria-label={`${direction} board`}>
            <div className="boards-row head" role="row">
              <span role="columnheader">Flight</span><span role="columnheader">Destination / Origin</span><span role="columnheader">Scheduled</span><span role="columnheader">Status</span><span role="columnheader" />
            </div>
            {loading && <div className="boards-empty"><RefreshCw size={18} /> Loading board…</div>}
            {!loading && visibleFlights.map((flight) => (
              <button className="boards-row" role="row" key={flight.id} onClick={() => onOpenFlight(flight)}>
                <span role="cell" className="boards-flight"><strong>{flight.flightNumber}</strong><small>{flight.airline}</small></span>
                <span role="cell" className="boards-route">{direction === 'departures' ? <><strong>{flight.destination.code}</strong><small>{flight.destination.city}</small></> : <><strong>{flight.origin.code}</strong><small>{flight.origin.city}</small></>}</span>
                <span role="cell" className="boards-time">{direction === 'departures' ? flight.origin.time : flight.destination.time}</span>
                <span role="cell"><StatusBadgeInline status={flight.status} /></span>
                <span role="cell" className="boards-open"><ArrowRight size={15} /></span>
              </button>
            ))}
            {!loading && visibleFlights.length === 0 && (
              <div className="boards-empty">
                <Globe2 size={20} />
                <p>{query ? 'No flights match that filter.' : 'The provider returned no flights for this airport and window. This is not treated as a disruption.'}</p>
              </div>
            )}
          </div>
          <p className="boards-footnote">
            {board.dataMode === 'demo'
              ? 'Sample board for illustration - rows come from Songa\'s built-in dataset, not the live provider.'
              : 'Live provider response.'}
            {board.note ? ` ${board.note}` : ''}
          </p>
        </div>
      )}
    </section>
  );
}

function StatusBadgeInline({ status }: { status: Flight['status'] }) {
  const slug = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-badge ${slug}`}><span />{status}</span>;
}
