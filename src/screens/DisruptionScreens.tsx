import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Bell, CircleAlert, Clock3, Globe2, Heart, Plane, Radar, RefreshCw } from 'lucide-react';
import type { BoardResult, Flight, FlightStatus } from '@/types';
import { statusSlug } from '@/lib/flightStatus';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';

export function StatusBadge({ status }: { status: FlightStatus }) {
  return <span className={`status-badge ${statusSlug(status)}`}><span />{status}</span>;
}

export function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Globe2 size={23} /></div><h3>{title}</h3><p>{text}</p>{action && onAction && <button className="secondary-button" onClick={onAction}>{action} <ArrowRight size={15} /></button>}</div>;
}

const MONITORED_AIRPORTS = ['NBO', 'LHR', 'DXB'];

async function fetchBoards(direction: 'departures' | 'arrivals'): Promise<BoardResult[]> {
  const results = await Promise.allSettled(MONITORED_AIRPORTS.map((airport) => flightProvider.searchAirport({ airport, direction })));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

function dedupeFlights(flights: Flight[]): Flight[] {
  const seen = new Set<string>();
  return flights.filter((flight) => {
    if (seen.has(flight.id)) return false;
    seen.add(flight.id);
    return true;
  });
}

function useAirportBoards() {
  const [boards, setBoards] = useState<BoardResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchBoards('departures'), fetchBoards('arrivals')])
      .then(([departures, arrivals]) => {
        if (active) setBoards([...departures, ...arrivals]);
      })
      .catch(() => {
        if (active) setError('Flight boards could not be loaded right now. Live provider coverage or connectivity may be unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const flights = useMemo(() => dedupeFlights(boards.flatMap((board) => board.flights)), [boards]);
  const latestFetch = useMemo(() => boards.map((board) => board.fetchedAt).sort().slice(-1)[0] ?? null, [boards]);
  return { flights, boards, loading, error, latestFetch, reload: () => setReloadKey((key) => key + 1) };
}

type DisruptionTab = 'Delayed' | 'Cancelled';

export function DisruptionsScreen({ onOpenFlight, onToggleWatch, watchedFlights, watchError, onOpenAccount, session }: {
  onOpenFlight: (flight: Flight) => void;
  onToggleWatch: (flight: Flight) => Promise<void>;
  watchedFlights: Flight[];
  watchError: string;
  session: unknown;
  onOpenAccount: () => void;
}) {
  const [tab, setTab] = useState<DisruptionTab>('Delayed');
  const { flights, boards, loading, error, latestFetch, reload } = useAirportBoards();

  const disrupted = flights.filter((flight) => tab === 'Cancelled' ? flight.disruption === 'cancelled' : flight.disruption === 'delay');
  const providerLabel = flightProvider.mode === 'live' ? 'Live provider boards' : 'Demonstration boards';

  return <section className="page-width page-section"><div className="section-heading"><div><div className="section-kicker">DISRUPTIONS / {providerLabel.toUpperCase()}</div><h2>Confirmed change,<br /><span>never guessed.</span></h2></div><button className="secondary-button" onClick={reload} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh boards'} {!loading && <RefreshCw size={15} />}</button></div>
    <div className="disruption-banner"><Bell size={19} /><p>Only provider-confirmed delays and cancellations appear here. A missing record or a failed request is never treated as a disruption.</p></div>
    <div className="filter-row"><div className="filter-label"><Activity size={15} /> Category</div>{(['Delayed', 'Cancelled'] as const).map((item) => <button key={item} className={tab === item ? 'filter-pill active' : 'filter-pill'} onClick={() => setTab(item)}>{item}</button>)}</div>
    {watchError && <div className="inline-error" role="alert"><CircleAlert size={15} /> {watchError}</div>}
    {error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}
    {loading ? <div className="board-loading"><Radar size={22} /> Loading {tab.toLowerCase()} flights from airport boards…</div>
      : disrupted.length
        ? <div className="result-list">{disrupted.map((flight) => <DisruptionRow key={flight.id} flight={flight} tab={tab} onOpen={() => onOpenFlight(flight)} isWatched={watchedFlights.some((saved) => saved.flightNumber === flight.flightNumber && saved.date === flight.date)} onToggleWatch={() => void onToggleWatch(flight)} />)}</div>
        : <EmptyState title={`No confirmed ${tab.toLowerCase()} flights right now`} text={tab === 'Cancelled' ? 'Cancellation is only shown when the provider explicitly reports it. None of the flights on the current boards are cancelled.' : 'No provider-reported or timestamp-calculated delays meet the threshold on the current boards.'} action={session ? undefined : 'Sign in to watch flights'} onAction={session ? undefined : onOpenAccount} />}
    <div className="board-footnote"><Clock3 size={14} /> {latestFetch ? `Boards fetched ${new Date(latestFetch).toLocaleString()} · ${boards.length} board${boards.length === 1 ? '' : 's'} · source: ${boards[0]?.source ?? flightProvider.mode}` : 'Board availability limited · demonstration data is labelled on each row'}</div>
  </section>;
}

function DisruptionRow({ flight, tab, onOpen, isWatched, onToggleWatch }: { flight: Flight; tab: DisruptionTab; onOpen: () => void; isWatched: boolean; onToggleWatch: () => void }) {
  const delayMinutes = tab === 'Delayed' ? flight.departureDelayMinutes ?? flight.arrivalDelayMinutes ?? null : null;
  return <article className="flight-card disruption-row"><button className="disruption-main" onClick={onOpen}><span className="flight-code">{flight.flightNumber}</span><span className="airline-name">{flight.airline}</span><span className="disruption-route">{flight.origin.code} → {flight.destination.code}</span><span className="disruption-times">Sch {flight.origin.time} · Est {flight.destination.time}</span><StatusBadge status={flight.status} /></button><div className="disruption-side"><span className="delay-chip">{delayMinutes != null ? `${delayMinutes} min ${flight.delaySource === 'provider' ? 'provider-reported' : 'Songa-calculated'}` : tab === 'Cancelled' ? 'Cancelled by provider' : 'Delay details unavailable'}</span><button className={isWatched ? 'secondary-button selected' : 'secondary-button'} onClick={onToggleWatch}><Heart size={15} fill={isWatched ? 'currentColor' : 'none'}/> {isWatched ? 'Watching' : 'Watch'}</button></div><small className="disruption-updated">Updated {flight.lastUpdatedAt} · {flight.dataMode === 'demo' ? 'demonstration data' : flight.source}</small></article>;
}

export function AirportsScreen({ initialAirport }: { initialAirport: string | null }) {
  const [airport, setAirport] = useState((initialAirport ?? 'NBO').toUpperCase().slice(0, 4));
  const [direction, setDirection] = useState<'departures' | 'arrivals'>('departures');
  const [board, setBoard] = useState<BoardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = (code: string, dir: 'departures' | 'arrivals') => {
    setLoading(true);
    setError('');
    flightProvider.searchAirport({ airport: code, direction: dir })
      .then(setBoard)
      .catch((err) => setError(err instanceof FlightProviderError ? err.message : 'The airport board could not be loaded right now.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(airport, direction); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [direction, initialAirport]);

  const metrics = useMemo(() => {
    if (!board) return null;
    const flights = board.flights;
    const delayed = flights.filter((flight) => flight.disruption === 'delay').length;
    const cancelled = flights.filter((flight) => flight.disruption === 'cancelled').length;
    const delays = flights.map((flight) => flight.departureDelayMinutes).filter((value): value is number => value != null && value >= 0);
    const averageDelay = delays.length ? Math.round(delays.reduce((total, value) => total + value, 0) / delays.length) : null;
    return { total: flights.length, delayed, cancelled, averageDelay, sample: flights.length };
  }, [board]);

  return <section className="page-width page-section"><div className="section-heading"><div><div className="section-kicker">AIRPORT INTELLIGENCE / {flightProvider.mode.toUpperCase()}</div><h2>One airport,<br /><span>one honest board.</span></h2></div></div>
    <form className="airport-controls" onSubmit={(event) => { event.preventDefault(); load(airport.toUpperCase(), direction); }}>
      <label htmlFor="airport-code">Airport code</label>
      <input id="airport-code" value={airport} onChange={(event) => setAirport(event.target.value.toUpperCase())} maxLength={4} placeholder="NBO" />
      <div className="direction-toggle">{(['departures', 'arrivals'] as const).map((item) => <button type="button" key={item} className={direction === item ? 'filter-pill active' : 'filter-pill'} onClick={() => setDirection(item)}>{item}</button>)}</div>
      <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load board'}</button>
    </form>
    {error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}
    {metrics && board && <div className="airport-metrics">
      <div><strong>{metrics.total}</strong><span>{direction} on board</span></div>
      <div><strong>{metrics.delayed}</strong><span>with confirmed delay</span></div>
      <div><strong>{metrics.cancelled}</strong><span>confirmed cancellations</span></div>
      <div><strong>{metrics.averageDelay != null ? `${metrics.averageDelay}m` : '—'}</strong><span>avg departure delay (sample of {metrics.sample})</span></div>
    </div>}
    {board && <div className="board-footnote"><Clock3 size={14} /> Window: current provider response · Source: {board.source} · Fetched {new Date(board.fetchedAt).toLocaleString()} · {board.dataMode === 'demo' ? 'Demonstration board, not live data' : 'Live provider response'}{board.note ? ` · ${board.note}` : ''}</div>}
    {board && board.flights.length
      ? <div className="result-list">{board.flights.map((flight) => <BoardRow key={flight.id} flight={flight} onOpenFlight={onOpenBoardFlight} />)}</div>
      : board && !loading ? <EmptyState title="No flights on this board" text="The provider returned no matching flights for this airport, direction and window. This is not treated as a disruption." /> : null}
  </section>;
}

function onOpenBoardFlight(flight: Flight) { void flight; }

function BoardRow({ flight, onOpenFlight }: { flight: Flight; onOpenFlight: (flight: Flight) => void }) {
  return <article className="flight-card disruption-row"><button className="disruption-main" onClick={() => onOpenFlight(flight)}><span className="flight-code">{flight.flightNumber}</span><span className="airline-name">{flight.airline}</span><span className="disruption-route">{flight.origin.code} → {flight.destination.code}</span><span className="disruption-times">{flight.origin.time} → {flight.destination.time}</span><StatusBadge status={flight.status} /></button><div className="disruption-side"><Plane size={16} /></div><small className="disruption-updated">Updated {flight.lastUpdatedAt} · {flight.dataMode === 'demo' ? 'demonstration data' : flight.source}</small></article>;
}
