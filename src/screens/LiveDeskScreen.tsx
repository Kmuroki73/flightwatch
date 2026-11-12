import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, AlertTriangle, Ban, Clock3, Radar, RefreshCw, ShieldCheck, Timer, Wifi, WifiOff } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { Flight } from '@/types';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';
import { EmptyState, StatusBadge } from '@/screens/DisruptionScreens';

type EventRow = { id: string; watched_flight_id: string; event_type: string; previous_value: unknown; new_value: unknown; detected_at: string; flight_number?: string };

const EVENT_LABELS: Record<string, string> = {
  cancellation_confirmed: 'CANCELLATION CONFIRMED',
  diversion_confirmed: 'DIVERSION CONFIRMED',
  status_changed: 'FLIGHT STATUS CHANGED',
  departure_estimate_changed: 'DEPARTURE ESTIMATE UPDATED',
  arrival_estimate_changed: 'ARRIVAL ESTIMATE UPDATED',
  delay_changed: 'DELAY VALUE CHANGED',
};

export function LiveDeskScreen({ session, watchedFlights, onOpenFlight }: { session: Session | null; watchedFlights: Flight[]; onOpenFlight: (flight: Flight) => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<'WAITING' | 'LIVE' | 'DEMO' | 'UNAVAILABLE'>('WAITING');
  const [liveByWatchId, setLiveByWatchId] = useState<Record<string, Flight>>({});
  const liveByWatchIdRef = useRef<Record<string, Flight>>({});
  const refreshingRef = useRef(false);
  const [filter, setFilter] = useState<'All activity' | 'Delays' | 'Cancellations' | 'Other changes'>('All activity');

  useEffect(() => { liveByWatchIdRef.current = liveByWatchId; }, [liveByWatchId]);

  const refreshFlights = useCallback(async (automatic = false) => {
    if (!session) {
      setError('Sign in to open your private flight desk.');
      return;
    }
    if (!watchedFlights.length) {
      setNotice('No flights are on watch. Search for a flight and add it to My Flight Watch first.');
      return;
    }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError('');
    if (!automatic) setNotice('');
    let checked = 0;
    let liveCount = 0;
    let demoCount = 0;
    let failures = 0;
    let changes = 0;
    const nextByWatchId = { ...liveByWatchIdRef.current };
    const newEvents: EventRow[] = [];

    try {
      // Sequential polling is intentional: it avoids bursting requests against AeroAPI.
      for (const watched of watchedFlights) {
        try {
          const matches = await flightProvider.search({ flightNumber: watched.flightNumber, travelDate: watched.date });
          const flight = matches.find((candidate) => candidate.date === watched.date) ?? matches[0];
          if (!flight) { failures++; continue; }

          if (flight.dataMode === 'live') liveCount++;
          else demoCount++;
          const previous = nextByWatchId[watched.id];
          if (flight.dataMode === 'live' && previous?.dataMode === 'live') {
            const detected: Array<{ type: string; previous: unknown; next: unknown }> = [];
            const oldStatus = (previous.status ?? '').toLowerCase();
            const newStatus = (flight.status ?? '').toLowerCase();
            if (newStatus.includes('cancel') && !oldStatus.includes('cancel')) detected.push({ type: 'cancellation_confirmed', previous: previous.status, next: flight.status });
            else if (newStatus.includes('divert') && !oldStatus.includes('divert')) detected.push({ type: 'diversion_confirmed', previous: previous.status, next: flight.status });
            else if (previous.status !== flight.status && flight.status !== 'Unknown') detected.push({ type: 'status_changed', previous: previous.status, next: flight.status });
            if (previous.estimatedDeparture !== flight.estimatedDeparture && previous.estimatedDeparture && flight.estimatedDeparture) detected.push({ type: 'departure_estimate_changed', previous: previous.estimatedDeparture, next: flight.estimatedDeparture });
            if (previous.estimatedArrival !== flight.estimatedArrival && previous.estimatedArrival && flight.estimatedArrival) detected.push({ type: 'arrival_estimate_changed', previous: previous.estimatedArrival, next: flight.estimatedArrival });
            if (previous.departureDelayMinutes !== flight.departureDelayMinutes && previous.departureDelayMinutes != null && flight.departureDelayMinutes != null) detected.push({ type: 'delay_changed', previous: `${previous.departureDelayMinutes} min departure delay`, next: `${flight.departureDelayMinutes} min departure delay` });
            for (const event of detected) {
              newEvents.push({
                id: `${Date.now()}-${watched.id}-${newEvents.length}`,
                watched_flight_id: watched.id,
                flight_number: watched.flightNumber,
                event_type: event.type,
                previous_value: event.previous,
                new_value: event.next,
                detected_at: new Date().toISOString(),
              });
            }
            changes += detected.length;
          }
          // Keep the saved watch ID for stable row identity; provider data remains the displayed source.
          nextByWatchId[watched.id] = { ...flight, id: watched.id };
          checked++;
        } catch (itemError) {
          failures++;
          if (itemError instanceof FlightProviderError) {
            if (itemError.kind === 'rate_limit') setError('AeroAPI rate limit reached. The last successful data is preserved; wait before the next check.');
            else if (itemError.kind === 'not_configured' || itemError.kind === 'not_deployed') setError(itemError.message);
            else if (!automatic) setError(itemError.message);
          }
        }
      }

      liveByWatchIdRef.current = nextByWatchId;
      setLiveByWatchId(nextByWatchId);
      if (newEvents.length) setEvents((current) => [...newEvents, ...current].slice(0, 100));
      const checkedAt = new Date().toISOString();
      setLastChecked(checkedAt);
      if (liveCount > 0) { setLastSuccess(checkedAt); setDataStatus('LIVE'); }
      else if (demoCount > 0) setDataStatus('DEMO');
      else if (failures > 0) setDataStatus('UNAVAILABLE');
      if (liveCount > 0 && failures === 0) setError('');
      setNotice(`${checked} flight${checked === 1 ? '' : 's'} checked${changes ? ` · ${changes} change${changes === 1 ? '' : 's'} detected` : ' · no changes detected'}${failures ? ` · ${failures} unavailable` : ''}${demoCount ? ' · DEMONSTRATION DATA ONLY' : ''}.`);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [session, watchedFlights]);

  useEffect(() => {
    if (!session || !watchedFlights.length) return;
    void refreshFlights(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshFlights(true);
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [session, watchedFlights, refreshFlights]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    if (filter === 'Delays') return event.event_type.includes('delay') || event.event_type.includes('departure') || event.event_type.includes('arrival');
    if (filter === 'Cancellations') return event.event_type.includes('cancel') || event.event_type.includes('divert');
    if (filter === 'Other changes') return !event.event_type.includes('delay') && !event.event_type.includes('departure') && !event.event_type.includes('arrival') && !event.event_type.includes('cancel') && !event.event_type.includes('divert');
    return true;
  }), [events, filter]);
  const delayed = watchedFlights.filter((flight) => {
    const current = liveByWatchId[flight.id] ?? flight;
    return current.disruption === 'delay' || current.status === 'Delayed';
  }).length;
  const cancelled = watchedFlights.filter((flight) => {
    const current = liveByWatchId[flight.id] ?? flight;
    return current.status === 'Cancelled' || current.disruption === 'cancelled';
  }).length;

  return <section className="page-width page-section live-terminal">
    <div className="terminal-topline"><span><span className="terminal-live-dot" /> SONGA FLIGHT WATCH / OPERATIONS TERMINAL</span><span className="terminal-clock">{new Date().toLocaleTimeString()}</span></div>
    <div className="section-heading live-terminal-heading"><div><div className="section-kicker">LIVE DESK // FLIGHT MONITOR</div><h2>Flight status.<br /><span>In real time.</span></h2><p className="heading-description">Signed-in watchlist · provider checks every 2 minutes while this desk is open. Provider coverage and API limits apply.</p></div><button className="secondary-button terminal-refresh" onClick={() => void refreshFlights()} disabled={refreshing || !session || !watchedFlights.length}>{refreshing ? <><Radar size={15} className="terminal-spin" /> Polling…</> : <><RefreshCw size={15} /> Poll provider</>}</button></div>
    <div className="terminal-status-strip"><span className={lastSuccess ? 'terminal-status-ok' : 'terminal-status-wait'}>{dataStatus === 'LIVE' ? <Wifi size={14} /> : <WifiOff size={14} />} {dataStatus === 'LIVE' ? 'LIVE DATA LINK ESTABLISHED' : dataStatus === 'DEMO' ? 'DEMONSTRATION DATA — NOT LIVE' : dataStatus === 'UNAVAILABLE' ? 'PROVIDER UNAVAILABLE' : 'AWAITING PROVIDER DATA'}</span><span>MODE: {dataStatus}</span><span>WATCHING: {watchedFlights.length.toString().padStart(2, '0')}</span><span>LAST POLL: {lastChecked ? new Date(lastChecked).toLocaleTimeString() : '--:--:--'}</span></div>
    <div className="metrics-grid live-desk-metrics terminal-metrics"><Metric icon={<Radar size={18} />} value={String(watchedFlights.length).padStart(2, '0')} label="Flights on watch"/><Metric icon={<Timer size={18} />} value={String(delayed).padStart(2, '0')} label="Delayed now"/><Metric icon={<Ban size={18} />} value={String(cancelled).padStart(2, '0')} label="Cancelled now"/><Metric icon={<Activity size={18} />} value={String(events.length).padStart(2, '0')} label="Session changes"/></div>
    {error && <div className="inline-error" role="alert">{error}</div>}{notice && <div className="disruption-banner terminal-notice"><ShieldCheck size={18}/><p>{notice}</p></div>}
    {!session ? <EmptyState title="Sign in to open your Live Desk" text="Your saved flights and activity are private to your Songa account."/> : !watchedFlights.length ? <EmptyState title="No flights on watch" text="Search for a flight and add it to My Flight Watch. The desk will start polling after a flight is saved."/> : <>
      <div className="section-heading live-desk-subheading terminal-section-heading"><div><div className="section-kicker">01 // TRACKED FLIGHTS</div><h3>Active flight feed</h3></div><span className="board-footnote">{lastSuccess ? `Last successful data ${new Date(lastSuccess).toLocaleString()}` : 'Waiting for first successful provider response'}</span></div>
      <div className="terminal-table-wrap"><table className="terminal-flight-table"><thead><tr><th>Flight</th><th>Route</th><th>Scheduled / estimate</th><th>Status</th><th>Source / updated</th><th></th></tr></thead><tbody>{watchedFlights.map((saved) => { const flight = liveByWatchId[saved.id] ?? saved; const hasLive = flight.dataMode === 'live' && Boolean(liveByWatchId[saved.id]); return <tr key={saved.id} className={hasLive ? 'terminal-row-live' : ''}><td><button className="terminal-flight-link" onClick={() => onOpenFlight(flight)}>{flight.flightNumber}</button><small>{flight.airline}</small></td><td><strong>{flight.origin.code} <span>→</span> {flight.destination.code}</strong><small>{flight.origin.city} → {flight.destination.city}</small></td><td><strong>{flight.origin.time} <span className="terminal-arrow">/</span> {flight.destination.time}</strong><small>Updated {flight.lastUpdatedAt ? new Date(flight.lastUpdatedAt).toLocaleTimeString() : '—'}</small></td><td><StatusBadge status={flight.status}/>{hasLive && <small className="terminal-verified">● PROVIDER DATA</small>}</td><td><strong>{flight.source || 'Saved record'}</strong><small>{hasLive ? 'LIVE RESPONSE' : 'NOT YET VERIFIED'}</small></td><td><button className="terminal-open" onClick={() => onOpenFlight(flight)} aria-label={`Open ${flight.flightNumber}`}>OPEN ↗</button></td></tr>; })}</tbody></table></div>
      <div className="section-heading live-desk-subheading terminal-section-heading"><div><div className="section-kicker">02 // EVENT STREAM</div><h3>Change log <span className="terminal-count">{visibleEvents.length.toString().padStart(2, '0')}</span></h3></div><span className="board-footnote">Changes detected during this session</span></div>
      <div className="filter-row terminal-filters">{(['All activity', 'Delays', 'Cancellations', 'Other changes'] as const).map((item) => <button key={item} className={filter === item ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {refreshing && <div className="terminal-poll-line"><span className="terminal-live-dot" /> Querying flight provider…</div>}
      {visibleEvents.length ? <div className="terminal-event-stream">{visibleEvents.map((event) => { const previous = event.previous_value; const next = event.new_value; return <article className="terminal-event" key={event.id}><span className="terminal-event-time">{new Date(event.detected_at).toLocaleTimeString()}</span><span className="terminal-event-indicator"><AlertTriangle size={14}/></span><div className="terminal-event-copy"><strong>{EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, ' ').toUpperCase()}</strong><p>{event.flight_number ?? 'FLIGHT'} <span>·</span> {String(previous ?? 'Unknown')} <span>→</span> {String(next ?? 'Unknown')}</p></div><span className="terminal-event-state">DETECTED</span></article>; })}</div> : <div className="terminal-empty-log"><Activity size={18}/><div><strong>EVENT STREAM STANDBY</strong><p>When a successful live provider response changes status, estimated times, or delay values, the event will appear here. Initial data loads establish the baseline.</p></div></div>}
    </>}
    <div className="terminal-footer"><span><Clock3 size={14}/> {lastChecked ? `Last poll ${new Date(lastChecked).toLocaleString()}` : 'No provider poll yet'}</span><span>{dataStatus === 'LIVE' ? 'AEROAPI / EDGE FUNCTION' : dataStatus === 'DEMO' ? 'DEMONSTRATION DATA' : 'FLIGHT PROVIDER'} · WHATSAPP INTEGRATION: NEXT PHASE</span></div>
  </section>;
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) { return <div className="airport-metric"><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
