import { CalendarDays, ArrowRight, ArrowUpRight, Bell, Clock3, Compass, MapPin, MessageCircle, Plane, Radar, Search, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Flight } from '@/types';
import { flightProvider } from '@/lib/flightProvider';

type Props = {
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  searchDate: string;
  setSearchDate: (value: string) => void;
  searchError: string;
  searchLoading: boolean;
  session: Session | null;
  watchedFlights: Flight[];
  recentSearches: Flight[];
  onOpenFlight: (flight: Flight) => void;
  onOpenWatch: () => void;
  onOpenAlerts: () => void;
  onOpenCompanion: () => void;
  onOpenWhatsApp: () => void;
  onOpenCommerce: () => void;
  onOpenAccount: () => void;
};

const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export function FlightHomeScreen(props: Props) {
  const {
    onSearch, searchTerm, setSearchTerm, searchDate, setSearchDate, searchError,
    searchLoading, session, watchedFlights, recentSearches, onOpenFlight,
    onOpenWatch, onOpenAlerts, onOpenCompanion, onOpenWhatsApp, onOpenCommerce, onOpenAccount,
  } = props;
  const latest = [...watchedFlights].sort((a, b) => (b.fetchedAt ?? b.lastUpdatedAt).localeCompare(a.fetchedAt ?? a.lastUpdatedAt)).slice(0, 2);
  const examples = ['KQ100', 'EK720', 'BA63', 'QR1341'];

  return (
    <div className="songa-home-v21">
      <section className="v21-hero">
        <div className="v21-hero-copy">
          <div className="v21-kicker"><span className="v21-kicker-dot" /> YOUR JOURNEY, MADE CLEARER</div>
          <h1>Travel with<br /><em>confidence.</em></h1>
          <p>Search a flight, keep an eye on changes and know what to do next. Your journey, brought together in one place.</p>
          <div className="v21-trust-row"><span><ShieldCheck size={15}/> Flight information with source labels</span><span><Bell size={15}/> Journey alerts when available</span></div>
        </div>
        <div className="v21-hero-art" aria-hidden="true">
          <div className="v21-orbit v21-orbit-one"/><div className="v21-orbit v21-orbit-two"/>
          <div className="v21-flight-emblem"><Plane size={54}/></div>
          <span className="v21-coordinate v21-coordinate-top">FLIGHT INTELLIGENCE</span>
          <span className="v21-coordinate v21-coordinate-bottom">GLOBAL JOURNEYS · 24/7</span>
        </div>
      </section>

      <section className="v21-search-section" aria-labelledby="v21-search-title">
        <div className="v21-section-heading">
          <div><span className="v21-eyebrow">START HERE</span><h2 id="v21-search-title">Where are you flying?</h2></div>
          <span className={flightProvider.mode === 'live' ? 'v21-data-state is-live' : 'v21-data-state is-demo'}><i/>{flightProvider.mode === 'live' ? 'Live provider connected' : 'Sample data mode'}</span>
        </div>
        <form className="v21-search-form" onSubmit={onSearch}>
          <label className="v21-flight-input"><Search size={21}/><span><small>FLIGHT NUMBER</small><input value={searchTerm} onChange={e => setSearchTerm(e.target.value.toUpperCase())} placeholder="e.g. KQ100" autoComplete="off" required /></span></label>
          <label className="v21-date-input"><CalendarDays size={19}/><span><small>TRAVEL DATE</small><input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}/></span></label>
          <button className="v21-search-submit" type="submit" disabled={searchLoading}>{searchLoading ? 'Searching…' : 'Search flight'} <ArrowRight size={18}/></button>
        </form>
        {searchError && <p className="v21-error" role="alert">{searchError}</p>}
        <div className="v21-examples"><span>TRY A FLIGHT</span>{examples.map(code => <button key={code} type="button" onClick={() => setSearchTerm(code)}>{code}</button>)}</div>
        {flightProvider.mode !== 'live' && <p className="v21-data-note">This deployment is currently showing sample flight information. Live flight status will be labelled with its data provider when the connection is enabled.</p>}
      </section>

      <section className="v21-journey-strip">
        <div><span className="v21-eyebrow">YOUR JOURNEY SPACE</span><h2>{session ? 'Welcome back.' : 'Everything about your trip.'}</h2><p>{session ? 'Your saved flights and travel activity are ready when you need them.' : 'Sign in to save flights, receive updates and keep your travel details together.'}</p></div>
        <button className="v21-outline-action" onClick={session ? onOpenWatch : onOpenAccount}>{session ? 'View my journeys' : 'Create your account'} <ArrowUpRight size={17}/></button>
      </section>

      {latest.length > 0 && <section className="v21-content-section">
        <div className="v21-section-heading"><div><span className="v21-eyebrow">FLIGHT WATCH</span><h2>Journeys you are following</h2></div><button className="v21-text-action" onClick={onOpenWatch}>All journeys <ArrowRight size={16}/></button></div>
        <div className="v21-flight-grid">{latest.map(flight => <button className="v21-flight-card" key={flight.id} onClick={() => onOpenFlight(flight)}>
          <div className="v21-flight-card-top"><span>{flight.flightNumber}</span><span className={'v21-status status-' + flight.status.toLowerCase().replace(/\s+/g, '-')}>{flight.status}</span></div>
          <div className="v21-route"><div><strong>{flight.origin.code}</strong><small>{flight.origin.city}</small></div><span className="v21-route-line"><Plane size={16}/></span><div><strong>{flight.destination.code}</strong><small>{flight.destination.city}</small></div></div>
          <div className="v21-flight-card-bottom"><span><Clock3 size={14}/> {dateText(flight.date)}</span><ArrowUpRight size={17}/></div>
        </button>)}</div>
      </section>}

      {recentSearches.length > 0 && <section className="v21-content-section">
        <div className="v21-section-heading"><div><span className="v21-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recent searches</h2></div></div>
        <div className="v21-recent-list">{recentSearches.slice(0, 4).map(flight => <button key={flight.id} onClick={() => onOpenFlight(flight)}><span className="v21-recent-plane"><Plane size={17}/></span><span><strong>{flight.flightNumber}</strong><small>{flight.origin.code} to {flight.destination.code} · {dateText(flight.date)}</small></span><ArrowUpRight size={17}/></button>)}</div>
      </section>}

      <section className="v21-content-section">
        <div className="v21-section-heading"><div><span className="v21-eyebrow">HOW SONGA HELPS</span><h2>What would you like to do?</h2></div><p>Choose a task. Songa brings the relevant tools together.</p></div>
        <div className="v21-action-grid">
          <button onClick={onOpenWatch}><span className="v21-action-icon"><Radar size={22}/></span><strong>Track my flights</strong><small>Save a journey and return to its latest available status.</small><ArrowUpRight size={17}/></button>
          <button onClick={onOpenAlerts}><span className="v21-action-icon"><Bell size={22}/></span><strong>Understand a disruption</strong><small>Explore delays, cancellations and passenger-rights information.</small><ArrowUpRight size={17}/></button>
          <button onClick={onOpenCompanion}><span className="v21-action-icon"><Sparkles size={22}/></span><strong>Ask Songa AI</strong><small>Get help making sense of your flight and travel options.</small><ArrowUpRight size={17}/></button>
          <button onClick={onOpenCommerce}><span className="v21-action-icon"><Ticket size={22}/></span><strong>Explore travel services</strong><small>See assistance and services available through Songa.</small><ArrowUpRight size={17}/></button>
          <button onClick={onOpenWhatsApp}><span className="v21-action-icon"><MessageCircle size={22}/></span><strong>Connect WhatsApp</strong><small>Continue your travel updates in the messaging app.</small><ArrowUpRight size={17}/></button>
          <button onClick={onOpenAccount}><span className="v21-action-icon"><Compass size={22}/></span><strong>Manage my profile</strong><small>Sign in and manage your personal travel space.</small><ArrowUpRight size={17}/></button>
        </div>
      </section>
    </div>
  );
}
