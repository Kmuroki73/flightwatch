import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CircleAlert, Clock3, Globe2, Plane, PlaneLanding, PlaneTakeoff, RefreshCw, Search } from 'lucide-react';
import type { BoardResult, Flight } from '@/types';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';

export function AirportsScreen({ initialAirport, onOpenFlight }: { initialAirport: string | null; onOpenFlight: (flight: Flight) => void }) {
  const [airport, setAirport] = useState((initialAirport ?? 'NBO').toUpperCase().slice(0, 4));
  const [direction, setDirection] = useState<'departures' | 'arrivals'>('departures');
  const [board, setBoard] = useState<BoardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = (code: string, dir: 'departures' | 'arrivals') => {
    setLoading(true);
    setError('');
    flightProvider.searchAirport({ airport: code, direction: dir })
      .then(setBoard)
      .catch((err) => setError(err instanceof FlightProviderError ? err.message : 'The airport board could not be loaded right now.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load((initialAirport ?? 'NBO').toUpperCase(), direction); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [direction, initialAirport]);

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
