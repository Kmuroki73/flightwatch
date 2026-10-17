import { useMemo, useState } from 'react';
import { ArrowRight, Radar } from 'lucide-react';
import type { Flight } from '@/types';
import { StatusBadge } from '@/screens/DisruptionScreens';
import { CompensationModule, CompanionChat, GateNavigationModule, LiveMapPanel, VaultModule } from '@/screens/WorkspaceScreens';

export function WorkspaceScreen({ flights, selectedFlight, onSelectFlight, session }: {
  flights: Flight[];
  selectedFlight: Flight | null;
  onSelectFlight: (flight: Flight) => void;
  session: unknown;
}) {
  const [activeFlightId, setActiveFlightId] = useState<string | null>(selectedFlight?.id ?? flights[0]?.id ?? null);
  const activeFlight = useMemo(
    () => flights.find((flight) => flight.id === activeFlightId) ?? selectedFlight ?? flights[0] ?? null,
    [activeFlightId, flights, selectedFlight],
  );

  return (
    <section className="page-width page-section workspace-page">
      <div className="section-heading">
        <div>
          <div className="section-kicker">ACTIVE TRIP WORKSPACE</div>
          <h2>Everything for this journey,<br /><span>in one working view.</span></h2>
        </div>
        <div className="watch-orbit"><Radar size={21} /><span>{flights.length}<small>in view</small></span></div>
      </div>

      <div className="workspace-flight-picker">
        {flights.map((flight) => (
          <button
            key={flight.id}
            className={`workspace-flight-chip ${flight.id === activeFlight?.id ? 'active' : ''}`}
            onClick={() => { setActiveFlightId(flight.id); onSelectFlight(flight); }}
          >
            <span className="flight-code">{flight.flightNumber}</span>
            <small>{flight.origin.code} → {flight.destination.code}</small>
            <StatusBadge status={flight.status} />
          </button>
        ))}
      </div>

      <div className="workspace-grid">
        <div className="workspace-main">
          <LiveMapPanel flights={flights} onSelectFlight={onSelectFlight} />
          <div className="workspace-modules">
            <GateNavigationModule flight={activeFlight} />
            <VaultModule flight={activeFlight} session={session} />
            <CompensationModule flight={activeFlight} />
          </div>
        </div>
        <aside className="workspace-aside">
          <CompanionChat flights={activeFlight ? [activeFlight] : []} />
          <div className="aside-card">
            <span className="section-kicker">TRIP SUMMARY</span>
            {activeFlight ? (
              <>
                <div className="context-row"><strong>{activeFlight.airline}</strong><small>{activeFlight.flightNumber} · {activeFlight.date}</small></div>
                <div className="context-row"><strong>{activeFlight.origin.city} → {activeFlight.destination.city}</strong><small>{activeFlight.origin.time} → {activeFlight.destination.time}</small></div>
                <button className="secondary-button full-button" onClick={() => onSelectFlight(activeFlight)}>Open full details <ArrowRight size={15} /></button>
              </>
            ) : <p className="vault-signin">No flight selected yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
