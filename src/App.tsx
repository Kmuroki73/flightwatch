import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Bot, ChevronRight, CircleAlert, Clock3, Compass, Filter,
  Eye, EyeOff, Globe2, Heart, Info, MapPin, MessageCircle, Menu, Moon, Plane, PlaneTakeoff, Radar, Route, Search, ShieldAlert, ShieldCheck, Sparkles, Sun, Ticket, Timer, X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { demoFlights } from '@/data/demoFlights';
import { AirportsScreen as AirportBoardScreen } from '@/screens/AirportBoard';
import { DisruptionsScreen, StatusBadge as SharedStatusBadge } from '@/screens/DisruptionScreens';
import { CompensationModule, WhatsAppSection, useWhatsAppJoin } from '@/screens/WorkspaceScreens';
import { WhatsAppCompanionScreen } from '@/screens/WhatsAppCompanionScreen';
import { WorkspaceScreen } from '@/screens/WorkspaceScreen';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { addWatchedFlight, loadWatchedFlights, removeWatchedFlight, watchedRowToFlight } from '@/lib/watchlist';
import type { Flight, Screen } from '@/types';

const navItems: { id: Screen; label: string; icon: typeof Plane }[] = [
  { id: 'home', label: 'Flight Command', icon: Search },
  { id: 'workspace', label: 'Trip Workspace', icon: Compass },
  { id: 'watch', label: 'My Flight Watch', icon: Radar },
  { id: 'alerts', label: 'Disruptions', icon: Bell },
  { id: 'airports', label: 'Airport Boards', icon: Globe2 },
  { id: 'companion', label: 'Companion', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp Companion', icon: MessageCircle },
  { id: 'account', label: 'Account', icon: ShieldCheck },
];

type WatchFilter = 'All flights' | 'Needs attention' | 'On time';
type Theme = 'dark' | 'light';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [searchResults, setSearchResults] = useState<Flight[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [watchedFlights, setWatchedFlights] = useState<Flight[]>([]);
  const [watchError, setWatchError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { join } = useWhatsAppJoin();
  const [watchFilter, setWatchFilter] = useState<WatchFilter>('All flights');
  const [theme, setTheme] = useState<Theme>(() => window.localStorage.getItem('songa-theme') === 'light' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('songa-theme', theme);
  }, [theme]);

  const visibleWatchedFlights = useMemo(() => {
    if (watchFilter === 'Needs attention') return watchedFlights.filter((flight) => flight.status === 'Delayed');
    if (watchFilter === 'On time') return watchedFlights.filter((flight) => flight.status === 'On time');
    return watchedFlights;
  }, [watchFilter, watchedFlights]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthReady(true);
      }
    }).catch(() => {
      if (active) {
        setSession(null);
        setAuthReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setWatchedFlights([]);
      return;
    }
    let active = true;
    loadWatchedFlights().then((rows) => {
      if (active) setWatchedFlights(rows.map(watchedRowToFlight));
    }).catch(() => {
      if (active) setWatchError('Your saved flights could not be loaded. Please try again.');
    }).finally(() => {
      if (!active) return;
      const pendingRaw = window.sessionStorage.getItem('songa-pending-watch');
      if (pendingRaw) {
        window.sessionStorage.removeItem('songa-pending-watch');
        try {
          const pending = JSON.parse(pendingRaw) as Flight;
          setSelectedFlight(pending);
          goTo('details');
        } catch {
          window.sessionStorage.removeItem('songa-pending-watch');
        }
      }
    });
    return () => { active = false; };
  }, [session]);

    const goTo = (nextScreen: Screen) => {
    setScreen(nextScreen);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openFlight = (flight: Flight) => {
    setSelectedFlight(flight);
    goTo('details');
  };

  const toggleWatch = async (flight: Flight) => {

   const toggleWatch = async (flight: Flight) => {
    setWatchError('');

    if (!supabase) {
      setWatchError('Supabase is not configured. Please try again later.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        window.sessionStorage.setItem(
          'songa-pending-watch',
          JSON.stringify(flight)
        );
        goTo('account');
        return;
      }

      if (flight.dataMode !== 'live') {
        setWatchError(
          'Flight Watch is available for live flight results only. Search again to refresh this flight.'
        );
        return;
      }

      const savedFlight = watchedFlights.find(
        (item) =>
          item.flightNumber === flight.flightNumber &&
          item.date === flight.date
      );

      if (savedFlight) {
        await removeWatchedFlight(savedFlight.id);

        setWatchedFlights((current) =>
          current.filter((item) => item.id !== savedFlight.id)
        );
      } else {
        const savedRow = await addWatchedFlight(flight);
        const convertedFlight = watchedRowToFlight(savedRow);

        setWatchedFlights((current) => {
          if (current.some((item) => item.id === convertedFlight.id)) {
            return current;
          }

          return [...current, convertedFlight];
        });
      }
    } catch (error) {
      console.error('Flight Watch error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';

      setWatchError(`Flight Watch failed: ${message}`);
    }
  };
  const searchFlights = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchError('');
    setSearchLoading(true);
    try {
      const results = await flightProvider.search({ flightNumber: searchTerm, travelDate: searchDate || undefined });
      setSearchResults(results);
      setSelectedFlight(results[0] ?? null);
      goTo('results');
    } catch (error) {
      if (error instanceof FlightProviderError) setSearchError(error.message);
      else setSearchError('Flight search is temporarily unavailable. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className={`demo-ribbon ${flightProvider.mode === 'live' ? 'live-ribbon' : ''}`}><span className="demo-dot" /> {flightProvider.mode === 'live' ? 'Live provider mode · source and freshness shown on results' : 'Demo mode · sample flight information only'}</div>
      <header className="site-header">
        <button className="brand" onClick={() => goTo('home')} aria-label="Go to Songa Flight Watch home"><span className="brand-mark"><img src="/songa-logo-64.png" alt="" width={40} height={40} /></span><span className="brand-copy"><strong>Songa</strong><span>Flight Companion</span></span></button>
        <nav className={`main-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={screen === id ? 'nav-link active' : 'nav-link'} onClick={() => goTo(id)}><Icon size={16} /> {label}</button>)}
        </nav>
        <div className="header-actions"><button className="icon-button mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button><button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className="profile-button" onClick={() => goTo('account')}><span className="profile-avatar">{session?.user.email?.slice(0, 1).toUpperCase() ?? 'A'}</span><span>{session ? 'Account' : 'Sign in'}</span></button></div>
      </header>
      <main>
        {screen === 'home' && <HomeScreen onSearch={searchFlights} searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchDate={searchDate} setSearchDate={setSearchDate} searchError={searchError} searchLoading={searchLoading} onOpenFlight={openFlight} onWhatsAppJoin={join} />}
        {screen === 'results' && <ResultsScreen flights={searchResults} onBack={() => goTo('home')} onOpenFlight={openFlight} watchedFlights={watchedFlights} onToggleWatch={toggleWatch} watchError={watchError} />}
        {screen === 'details' && selectedFlight && <DetailsScreen flight={selectedFlight} onBack={() => goTo('results')} isWatched={watchedFlights.some((flight) => flight.flightNumber === selectedFlight.flightNumber && flight.date === selectedFlight.date)} onToggleWatch={toggleWatch} onOpenAlerts={() => goTo('alerts')} />}
        {screen === 'watch' && <WatchScreen flights={visibleWatchedFlights} filter={watchFilter} setFilter={setWatchFilter} onOpenFlight={openFlight} onToggleWatch={toggleWatch} watchError={watchError} session={session} onOpenAccount={() => goTo('account')} />}
        {screen === 'alerts' && <DisruptionsScreen onOpenFlight={openFlight} onToggleWatch={toggleWatch} watchedFlights={watchedFlights} watchError={watchError} session={session} onOpenAccount={() => goTo('account')} />}
        {screen === 'airports' && <AirportBoardScreen initialAirport={null} onOpenFlight={openFlight} />}
        {screen === 'workspace' && <WorkspaceScreen flights={[...watchedFlights, ...searchResults, ...demoFlights].filter((flight, index, list) => list.findIndex((item) => item.id === flight.id) === index)} selectedFlight={selectedFlight} onSelectFlight={openFlight} session={session} />}
        {screen === 'companion' && <CompanionScreen onOpenFlight={() => openFlight(demoFlights[0])} />}
        {screen === 'whatsapp' && <WhatsAppCompanionScreen session={session} onOpenFlight={openFlight} onOpenAccount={() => goTo('account')} />}
        {screen === 'account' && <AccountScreen session={session} authReady={authReady} onSessionChange={setSession} onBack={() => goTo('home')} />}
      </main>
      <footer className="site-footer"><span>SONGA / FLIGHT WATCH</span><span>Secure watchlists, clear journeys.</span><span>{flightProvider.mode === 'live' ? 'Live source configured.' : 'Demo data is not live data.'}</span></footer>
    </div>
  );
}

type HomeProps = { onSearch: (event: React.FormEvent<HTMLFormElement>) => void; searchTerm: string; setSearchTerm: (value: string) => void; searchDate: string; setSearchDate: (value: string) => void; searchError: string; searchLoading: boolean; onOpenFlight: (flight: Flight) => void; onWhatsAppJoin: (email: string) => Promise<void> };

function HomeScreen({ onSearch, searchTerm, setSearchTerm, searchDate, setSearchDate, searchError, searchLoading, onOpenFlight, onWhatsAppJoin }: HomeProps) {
  return <div className="landing-page"><section className="hero-section"><div className="hero-grid" /><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> GLOBAL FLIGHT INTELLIGENCE</div><h1>Track the world.<br /><em>Stay ahead.</em></h1><p className="hero-lede">Real-time flight tracking, disruption alerts and smarter travel decisions — all in one place.</p><SearchForm onSearch={onSearch} searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchDate={searchDate} setSearchDate={setSearchDate} searchError={searchError} searchLoading={searchLoading} /><div className="quick-searches"><span>Try a flight</span>{demoFlights.map((flight) => <button key={flight.id} onClick={() => setSearchTerm(flight.flightNumber)}>{flight.flightNumber}</button>)}</div></div><GlobeVisual onSelectFlight={onOpenFlight} /><div className="hero-live-chip"><span className="live-dot" /> {flightProvider.mode === 'live' ? 'Live data · updated moments ago' : 'Sample routes · connect live coverage for real-time positions'}</div><div className="hero-footnote"><span>01</span><span className="footnote-rule" /><span>Designed for the moments between departure and arrival.</span></div></section><CommandMetrics /><section className="command-grid page-width"><WatchPreview onOpenFlight={onOpenFlight} /><IntelligencePreview /></section><section className="feature-strip page-width"><Feature icon={<Radar />} title="Watch the change" text="A clear view of the flight details that actually move." /><Feature icon={<Sparkles />} title="Understand the moment" text="Plain-language context, never invented certainty." /><Feature icon={<ShieldCheck />} title="Travel with confidence" text="A calmer, more useful way to follow your journey." /></section><WhatsAppSection onJoin={onWhatsAppJoin} /><AirHelpSection /><section className="mission-section page-width"><div><div className="section-kicker">MORE THAN A FLIGHT</div><h2>The calm between<br /><span>takeoff and touch down.</span></h2></div><div className="mission-copy"><p>Songa brings status, meaningful changes, disruption context and next steps into one quietly intelligent companion for every journey.</p><div className="mission-points"><span><BadgeCheck size={17} /> Verified where possible</span><span><BadgeCheck size={17} /> Private by design</span><span><BadgeCheck size={17} /> Clear when unavailable</span></div><button className="text-link" onClick={() => onOpenFlight(demoFlights[0])}>Explore a flight <ArrowRight size={16} /></button></div></section></div>;
}

type SearchMode = 'flight' | 'airport' | 'route';

function SearchForm({ onSearch, searchTerm, setSearchTerm, searchDate, setSearchDate, searchError, searchLoading }: Omit<HomeProps, 'onOpenFlight' | 'onWhatsAppJoin' | 'whatsappJoined'>) {
  const [mode, setMode] = useState<SearchMode>('flight');
  const [modeError, setModeError] = useState('');
  const labels: Record<SearchMode, string> = { flight: 'Flight number', airport: 'Airport', route: 'Route' };
  const placeholders: Record<SearchMode, string> = { flight: 'e.g. KQ100, KQA100', airport: 'e.g. NBO or London', route: 'e.g. Nairobi to London' };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    if (mode !== 'flight') {
      event.preventDefault();
      setModeError('Airport and route search will unlock with live provider coverage. Try a flight number for now.');
      return;
    }
    setModeError('');
    onSearch(event);
  };
  return <form className="search-panel" onSubmit={submit}><div className="search-tabs">{([['flight', PlaneTakeoff], ['airport', MapPin], ['route', Route]] as const).map(([value, Icon]) => <button type="button" key={value} className={mode === value ? 'search-tab active' : 'search-tab'} onClick={() => { setMode(value); setModeError(''); }}><Icon size={13} /> {labels[value]}</button>)}</div><div className="search-input-row"><div className="search-field"><Plane size={18} /><label htmlFor="flight-number">{labels[mode]}</label><input id="flight-number" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={placeholders[mode]} /></div><div className="search-divider" /><div className="search-field date-field"><Clock3 size={18} /><label htmlFor="flight-date">Travel date</label><input id="flight-date" type="date" value={searchDate} onChange={(event) => setSearchDate(event.target.value)} aria-label="Travel date, optional" /></div><button className="primary-button search-button" type="submit" disabled={searchLoading}>{searchLoading ? 'Checking…' : 'Search'} {!searchLoading && <ArrowRight size={17} />}</button></div>{(searchError || modeError) && <div className="form-error" role="alert"><CircleAlert size={15} />{searchError || modeError}</div>}</form>;
}

function GlobeVisual({ onSelectFlight }: { onSelectFlight: (flight: Flight) => void }) {
  return <div className="globe-visual" aria-label="Interactive flight routes across the earth" role="group"><div className="globe-orbit orbit-one" /><div className="globe-orbit orbit-two" /><div className="globe-shadow" /><svg viewBox="0 0 420 420" className="globe-svg"><defs><radialGradient id="earth" cx="35%" cy="25%"><stop offset="0" stopColor="#294c66" /><stop offset="0.6" stopColor="#102a40" /><stop offset="1" stopColor="#071727" /></radialGradient><linearGradient id="route" x1="0" x2="1"><stop stopColor="#ffb14a" /><stop offset="1" stopColor="#ff5c16" /></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><g className="globe-spin"><circle cx="210" cy="210" r="166" fill="url(#earth)" stroke="#3c6074" strokeWidth="1" /><ellipse cx="210" cy="210" rx="166" ry="67" fill="none" stroke="#6e97a8" strokeOpacity=".26" /><ellipse cx="210" cy="210" rx="72" ry="166" fill="none" stroke="#6e97a8" strokeOpacity=".18" /><path d="M70 165c60-44 126-54 215-14 41 19 70 18 86 9M73 254c55 36 137 47 259 6M136 82c-12 48-14 102-4 167 5 32 19 62 39 86M294 73c-33 47-43 109-33 188 4 34 15 60 31 81" fill="none" stroke="#8cb3bd" strokeOpacity=".16" strokeWidth="1" /><path d="M116 274C153 195 252 145 315 122" fill="none" stroke="url(#route)" strokeWidth="2.5" strokeDasharray="6 7" filter="url(#glow)" /><path d="M100 202C164 253 228 276 310 232" fill="none" stroke="#ff8b25" strokeOpacity=".72" strokeWidth="1.5" strokeDasharray="4 9" /><circle cx="116" cy="274" r="5" fill="#ff7a1a" stroke="#fff1dc" strokeWidth="3" /><circle cx="315" cy="122" r="5" fill="#ff7a1a" stroke="#fff1dc" strokeWidth="3" /><circle cx="100" cy="202" r="4" fill="#ffb14a" /><circle cx="310" cy="232" r="4" fill="#ffb14a" /></g></svg><button className="map-flight-marker marker-kq" onClick={() => onSelectFlight(demoFlights[0])} aria-label="Open KQ 100 flight details"><span className="marker-pulse" /><Plane size={14} /></button><button className="map-flight-marker marker-ek" onClick={() => onSelectFlight(demoFlights[1])} aria-label="Open EK 720 flight details"><span className="marker-pulse" /><Plane size={13} /></button><button className="map-flight-marker marker-ba" onClick={() => onSelectFlight(demoFlights[2])} aria-label="Open BA 63 flight details"><span className="marker-pulse" /><Plane size={12} /></button><div className="map-label label-nbo"><span>NBO</span><small>Nairobi</small></div><div className="map-label label-lhr"><span>LHR</span><small>London</small></div><div className="globe-caption"><Globe2 size={14} /> Click a route to explore</div></div>;
}

function CommandMetrics() {
  const metrics = [
    { icon: PlaneTakeoff, value: '03', label: 'Demo routes available', detail: 'Clearly labelled examples' },
    { icon: Timer, value: '50m', label: 'KQ 100 delay found', detail: 'Calculated from timestamps' },
    { icon: ShieldAlert, value: '01', label: 'Disruption in view', detail: 'AirHelp guidance available' },
    { icon: Activity, value: '24/7', label: 'Journey awareness', detail: 'Watch what changes next' },
  ];
  return <section className="command-metrics page-width" aria-label="Flight command highlights">{metrics.map(({ icon: Icon, value, label, detail }) => <div className="metric-item" key={label}><Icon size={19} /><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>)}</section>;
}

function WatchPreview({ onOpenFlight }: { onOpenFlight: (flight: Flight) => void }) {
  return <section className="command-panel watch-preview"><div className="panel-heading"><div><div className="section-kicker">MY FLIGHT WATCH</div><h3>Keep the important moments in view.</h3></div><button className="panel-link" onClick={() => onOpenFlight(demoFlights[0])}>View all <ArrowUpRight size={14} /></button></div><div className="preview-flight-list">{demoFlights.map((flight) => <button className="preview-flight" key={flight.id} onClick={() => onOpenFlight(flight)}><span className="preview-airline-mark">{flight.airlineCode}</span><span className="preview-flight-main"><strong>{flight.flightNumber}</strong><small>{flight.origin.code} → {flight.destination.code}</small></span><StatusBadge status={flight.status} /><ChevronRight size={15} /></button>)}</div><div className="panel-footnote"><ShieldCheck size={14} /> Saved flights stay private to your account.</div></section>;
}

type IntelligenceTab = 'Delays' | 'Cancellations' | 'Airports';

function IntelligencePreview() {
  const [tab, setTab] = useState<IntelligenceTab>('Delays');
  const [airport, setAirport] = useState('NBO');
  const [airline, setAirline] = useState('All airlines');
  const [demoOpen, setDemoOpen] = useState(false);
  const airports = useMemo(() => Array.from(new Set(demoFlights.flatMap((flight) => [flight.origin.code, flight.destination.code]))), []);
  const airlines = useMemo(() => Array.from(new Set(demoFlights.map((flight) => flight.airline))), []);
  const scoped = demoFlights.filter((flight) => (flight.origin.code === airport || flight.destination.code === airport) && (airline === 'All airlines' || flight.airline === airline));
  const delayed = scoped.filter((flight) => flight.status === 'Delayed');
  useEffect(() => {
    if (!demoOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDemoOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [demoOpen]);
  return <section className="command-panel intelligence-preview">
    <div className="panel-heading"><div><div className="section-kicker">AIRPORT & AIRLINE INTELLIGENCE</div><h3>See the signal behind the schedule.</h3></div><button type="button" className="demo-label demo-label-button" onClick={() => setDemoOpen(true)} aria-haspopup="dialog" aria-expanded={demoOpen}>DEMO VIEW</button></div>
    <div className="intelligence-tabs" role="tablist" aria-label="Intelligence views">{(['Delays', 'Cancellations', 'Airports'] as const).map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="intelligence-selector">
      <span><MapPin size={14} />
        <select className="intelligence-select" value={airport} onChange={(event) => setAirport(event.target.value)} aria-label="Select airport">{airports.map((code) => <option key={code} value={code}>{code} · {demoFlights.find((flight) => flight.origin.code === code)?.origin.city ?? demoFlights.find((flight) => flight.destination.code === code)?.destination.city}</option>)}</select>
      </span>
      <span>
        <select className="intelligence-select" value={airline} onChange={(event) => setAirline(event.target.value)} aria-label="Filter by airline"><option>All airlines</option>{airlines.map((name) => <option key={name}>{name}</option>)}</select>
      </span>
    </div>
    {tab === 'Delays' && (delayed.length ? <div className="intelligence-cards">{delayed.map((flight) => <div key={flight.id}><strong>{flight.flightNumber} · {flight.statusDetail}</strong><small>{flight.origin.code} → {flight.destination.code} · {flight.date}</small></div>)}</div> : <div className="intelligence-empty"><Activity size={19} /><p>No delays found for this airport and airline in the demonstration dataset.</p></div>)}
    {tab === 'Cancellations' && <div className="intelligence-empty"><Activity size={19} /><p>No cancellations in the demonstration dataset. Live cancellation data is not connected yet — this view stays empty rather than showing invented totals.</p></div>}
    {tab === 'Airports' && <div className="intelligence-cards">{airports.map((code) => { const flights = demoFlights.filter((flight) => flight.origin.code === code || flight.destination.code === code); return <div key={code}><strong>{code} · {flights.length} demo {flights.length === 1 ? 'route' : 'routes'}</strong><small>{flights.map((flight) => flight.flightNumber).join(', ')}</small></div>; })}</div>}
    <div className="intelligence-empty"><Activity size={19} /><p>Figures come from the labelled demonstration dataset. Live statistics appear when supported provider data is connected — Songa will never fill this view with invented totals.</p></div>
    {demoOpen && <div className="demo-modal-backdrop" onClick={() => setDemoOpen(false)} role="presentation"><div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><h3 id="demo-modal-title">About this demo view</h3><button type="button" className="icon-button" onClick={() => setDemoOpen(false)} aria-label="Close dialog"><X size={18} /></button></div><p>This panel is an illustration built from Songa’s labelled demonstration flights (KQ 100, EK 720, BA 63). Nothing here is live airport or airline data.</p><p>Live delay, cancellation and airport intelligence activate once a supported provider is connected. Until then the empty states stay honest instead of showing estimated totals.</p><button type="button" className="primary-button" onClick={() => setDemoOpen(false)}>Got it</button></div></div>}
  </section>;
}

function AirHelpSection() {
  return <section className="airhelp-section page-width"><div className="airhelp-copy"><div className="section-kicker">AIRHELP DE PARTNER EXPERIENCE</div><h2>Flight disrupted?<br /><span>Ask in one sentence.</span></h2><p>Songa structures your disruption details, then sends you securely to AirHelp DE for the official assessment.</p><div className="airhelp-disclosure"><BadgeCheck size={16} /> Official partner referral · eligibility is assessed by AirHelp.</div><a className="primary-button airhelp-button" href="https://affiliate-tt.airhelp.de/c?c=38376&m=12&a=512363&r=&u=%2F" target="_blank" rel="noreferrer">Check possible compensation <ArrowUpRight size={16} /></a></div><div className="airhelp-card"><div className="airhelp-card-top"><img className="airhelp-logo" src="/airhelp.jpg" alt="AirHelp logo" width={44} height={44} /><strong>AirHelp assessment</strong><div className="language-pills"><span className="active">EN</span><span>DE</span><span>SW</span></div></div><div className="airhelp-input">My Kenya Airways flight KQ100 from Nairobi to London was delayed by five hours.</div><a className="airhelp-card-action airhelp-button" href="https://affiliate-tt.airhelp.de/c?c=38376&m=12&a=512363&r=&u=%2F" target="_blank" rel="noreferrer">Check possible compensation <ArrowRight size={16} /></a><small>Eligibility is estimated. AirHelp performs the official assessment and handles the claim.</small></div></section>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>; }

function ResultsScreen({ flights, onBack, onOpenFlight, watchedFlights, onToggleWatch, watchError }: { flights: Flight[]; onBack: () => void; onOpenFlight: (flight: Flight) => void; watchedFlights: Flight[]; onToggleWatch: (flight: Flight) => Promise<void>; watchError: string }) {
  return <section className="page-width page-section"><BackButton onClick={onBack} label="Back to search" /><div className="section-heading"><div><div className="section-kicker">SEARCH RESULT / {flightProvider.mode.toUpperCase()}</div><h2>Here is the signal.</h2></div><span className="result-count">{flights.length} {flights.length === 1 ? 'flight' : 'flights'} found</span></div>{watchError && <div className="inline-error" role="alert"><CircleAlert size={15} /> {watchError}</div>}{flights.length ? <div className="result-list">{flights.map((flight) => <FlightResultCard key={flight.id} flight={flight} onOpen={() => onOpenFlight(flight)} isWatched={watchedFlights.some((saved) => saved.flightNumber === flight.flightNumber && saved.date === flight.date)} onToggleWatch={onToggleWatch} />)}</div> : <EmptyState title="No result to show" text="Return to search and try a valid flight number and travel date." action="Return to search" onAction={onBack} />}</section>;
}

function FlightResultCard({ flight, onOpen, isWatched, onToggleWatch }: { flight: Flight; onOpen: () => void; isWatched: boolean; onToggleWatch: (flight: Flight) => Promise<void> }) {
  const [whatsappHint, setWhatsappHint] = useState(false);
  const enableWhatsappAlerts = async (target: Flight) => {
    await onToggleWatch(target);
    setWhatsappHint(true);
  };
  return <article className="flight-card result-card"><div className="flight-card-top"><div><span className="flight-code">{flight.flightNumber}</span><span className="airline-name">{flight.airline}</span></div><StatusBadge status={flight.status} /></div><div className="route-row"><div><span className="airport-code">{flight.origin.code}</span><span className="city-name">{flight.origin.city}</span><strong>{flight.origin.time}</strong></div><div className="route-visual"><span className="route-duration">{flight.duration}</span><div className="route-line"><span /><Plane size={18} /></div><span className="route-date">{flight.date}</span></div><div className="align-right"><span className="airport-code">{flight.destination.code}</span><span className="city-name">{flight.destination.city}</span><strong>{flight.destination.time}</strong></div></div><div className="flight-meta"><span><Info size={15} /> {flight.statusDetail}</span><span><Clock3 size={15} /> Updated {flight.lastUpdatedAt}</span><span><Ticket size={15} /> {flight.terminal}</span></div><div className="source-chip"><ShieldCheck size={14} /> Source: {flight.source} · {flight.dataMode === 'demo' ? 'sample data' : 'provider response'}</div><div className="card-actions"><button className="primary-button" onClick={onOpen}>View flight details <ArrowRight size={16} /></button><button className={isWatched ? 'secondary-button selected' : 'secondary-button'} onClick={() => void onToggleWatch(flight)}><Heart size={16} fill={isWatched ? 'currentColor' : 'none'} /> {isWatched ? 'Watching' : 'Watch flight'}</button><button className="secondary-button whatsapp-option" onClick={() => void enableWhatsappAlerts(flight)}><MessageCircle size={16} /> WhatsApp alerts</button></div>{whatsappHint && <p className="whatsapp-hint"><MessageCircle size={14} /> Watching this flight. WhatsApp delivery activates for early-access users once the official sender is verified - join the list on the home page.</p>}</article>;
}

function DetailsScreen({ flight, onBack, isWatched, onToggleWatch, onOpenAlerts }: { flight: Flight; onBack: () => void; isWatched: boolean; onToggleWatch: (flight: Flight) => Promise<void>; onOpenAlerts: () => void }) {
  const liveLabel = flight.dataMode === 'live' ? `Source: ${flight.source}` : 'Demo mode · source connection is not active';
  return <section className="page-width page-section"><BackButton onClick={onBack} label="Back to result" /><div className="detail-header"><div><div className="section-kicker">FLIGHT DETAILS / {flight.dataMode === 'demo' ? 'SAMPLE DATA' : 'LIVE'}</div><h2>{flight.flightNumber}</h2><p>{flight.airline} · {flight.date}</p></div><StatusBadge status={flight.status} /></div><div className="detail-layout"><div><div className="flight-card detail-route-card"><div className="route-row large-route"><div><span className="airport-code">{flight.origin.code}</span><span className="city-name">{flight.origin.city}</span><strong>{flight.origin.time}</strong></div><div className="route-visual"><div className="route-line"><span /><Plane size={22} /></div><span className="route-date">{flight.duration} · {flight.terminal}</span></div><div className="align-right"><span className="airport-code">{flight.destination.code}</span><span className="city-name">{flight.destination.city}</span><strong>{flight.destination.time}</strong></div></div><div className="source-note"><ShieldCheck size={17} /><span><strong>{liveLabel}</strong><br />Last updated {flight.lastUpdatedAt}. Fields not supplied by the source are left unavailable.</span></div><button className="primary-button full-button" onClick={() => void onToggleWatch(flight)}><Bell size={16} /> {isWatched ? 'Remove from Flight Watch' : 'Add to Flight Watch'}</button></div><div className="section-heading compact-heading"><div><div className="section-kicker">WHAT CHANGED</div><h3>Flight timeline</h3></div><button className="text-link" onClick={onOpenAlerts}>View disruption board <ChevronRight size={15} /></button></div>{flight.timeline.length ? <Timeline flight={flight} /> : <EmptyState title="Timeline unavailable" text="This source has not supplied timeline events for this flight." action="View disruption board" onAction={onOpenAlerts} />}</div><aside className="detail-aside"><div className="aside-card orange-aside"><Sparkles size={20} /><span className="section-kicker">TRAVEL COPILOT</span><h3>Need a clearer next step?</h3><p>Gate navigation, expenses and your disruption rights are ready in the Trip Workspace.</p><button className="text-link light-link" onClick={onOpenAlerts}>Open disruption tools <ArrowRight size={15} /></button></div><div className="aside-card"><span className="section-kicker">TRIP CONTEXT</span><div className="context-row"><Globe2 size={17} /><span><strong>{flight.route}</strong><small>Route from provider response</small></span></div><div className="context-row"><Compass size={17} /><span><strong>{flight.duration}</strong><small>Estimated flight time</small></span></div>{(flight.aircraft || flight.aircraftRegistration) && <div className="context-row"><Plane size={17} /><span><strong>{flight.aircraft ?? 'Aircraft details available'}</strong><small>{flight.aircraftRegistration ?? 'Aircraft type'}</small></span></div>}</div><CompensationModule flight={flight} /></aside></div></section>;
}

function Timeline({ flight }: { flight: Flight }) { return <div className="timeline">{flight.timeline.map((event) => <div className={`timeline-item ${event.state}`} key={event.title}><div className="timeline-marker" /><div className="timeline-content"><span>{event.time}</span><h4>{event.title}</h4><p>{event.description}</p></div></div>)}</div>; }

function WatchScreen({ flights, filter, setFilter, onOpenFlight, onToggleWatch, watchError, session, onOpenAccount }: { flights: Flight[]; filter: WatchFilter; setFilter: (filter: WatchFilter) => void; onOpenFlight: (flight: Flight) => void; onToggleWatch: (flight: Flight) => Promise<void>; watchError: string; session: Session | null; onOpenAccount: () => void }) {
  return <section className="page-width page-section"><div className="section-heading watch-heading"><div><div className="section-kicker">YOUR FLIGHT WATCH</div><h2>Keep the important<br /><span>moments in view.</span></h2><p className="heading-description">{session ? 'Your saved flights are private to your account and persist across sessions. Background monitoring is not active yet.' : 'Sign in to save flights across sessions and keep them private.'}</p></div><div className="watch-orbit"><Radar size={21} /><span>{flights.length}<small>watching</small></span></div></div>{watchError && <div className="inline-error" role="alert"><CircleAlert size={15} /> {watchError}</div>}{!session ? <EmptyState title="Sign in to start watching" text="A secure account is required before a flight can be saved." action="Open account" onAction={onOpenAccount} /> : <><div className="filter-row"><div className="filter-label"><Filter size={15} /> Filter flights</div>{(['All flights', 'Needs attention', 'On time'] as const).map((item) => <button key={item} className={filter === item ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter(item)}>{item}</button>)}</div>{flights.length ? <div className="watch-grid">{flights.map((flight) => <WatchCard key={flight.id} flight={flight} onOpen={() => onOpenFlight(flight)} onRemove={() => void onToggleWatch(flight)} />)}</div> : <EmptyState title="Your watch is clear" text="Search for a flight and add it here once you are signed in." action="Search flights" onAction={() => onOpenFlight(demoFlights[0])} />}</>}</section>;
}

function WatchCard({ flight, onOpen, onRemove }: { flight: Flight; onOpen: () => void; onRemove: () => void }) { return <article className="watch-card"><div className="watch-card-head"><span className="flight-code">{flight.flightNumber}</span><StatusBadge status={flight.status} /></div><p className="watch-airline">{flight.airline} · {flight.date}</p><div className="mini-route"><strong>{flight.origin.code}</strong><span /><Plane size={15} /><span /><strong>{flight.destination.code}</strong></div><p className="watch-detail"><Clock3 size={14} /> {flight.statusDetail}</p><div className="watch-card-actions"><button className="text-link" onClick={onOpen}>Open flight <ArrowRight size={15} /></button><button className="icon-text-button" onClick={onRemove}><X size={14} /> Remove</button></div></article>; }

/* The example-alert inbox is superseded by the provider-backed Disruptions screen; kept out of navigation. */

function CompanionScreen({ onOpenFlight }: { onOpenFlight: () => void }) { return <section className="page-width page-section companion-page"><div className="companion-intro"><div className="companion-orb"><Bot size={25} /></div><div><div className="section-kicker">AI TRAVEL COMPANION / DEMONSTRATION</div><h2>Clarity for the<br /><span>next decision.</span></h2><p>These clearly labelled example responses show how Songa can explain verified flight information without inventing what it does not know.</p></div></div><div className="chat-window"><div className="chat-top"><span><span className="online-dot" /> Demonstration conversation</span><span>Not connected to a live flight</span></div><div className="chat-messages"><div className="message user-message">What changed with my flight?</div><div className="message assistant-message"><div className="message-avatar"><Sparkles size={14} /></div><div><strong>Example response</strong><p>The latest demonstration information shows that KQ 100’s departure moved from 14:20 to 15:10. The source snapshot does not explain why, so I won’t guess at the cause. Check with Kenya Airways for rebooking or airport guidance.</p><small>Based on labelled demonstration data · not a live recommendation</small></div></div><div className="message user-message">What should I do next?</div><div className="message assistant-message"><div className="message-avatar"><Sparkles size={14} /></div><div><strong>Example response</strong><p>Keep your original travel documents close, allow extra time at the airport, and confirm the updated departure directly with the airline before leaving.</p><small>General travel guidance · airline decisions may differ</small></div></div></div><div className="chat-input"><span>Ask about this example flight</span><button onClick={onOpenFlight}><ArrowRight size={17} /></button></div></div><div className="companion-footnote"><ShieldCheck size={16} /> Songa explains verified information. It does not make airline decisions or promise compensation.</div></section>; }

function AccountScreen({ session, authReady, onSessionChange, onBack }: { session: Session | null; authReady: boolean; onSessionChange: (session: Session | null) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const client = supabase;

  if (!authReady) return <section className="page-width page-section auth-state"><div className="loading-orb"><Radar size={22} /></div><h2>Checking your account</h2><p>Restoring your secure session.</p></section>;
  if (session) return <section className="page-width page-section auth-state"><div className="loading-orb"><ShieldCheck size={22} /></div><div className="section-kicker">ACCOUNT / CONNECTED</div><h2>Your watch is private.</h2><p>Signed in as {session.user.email}. Saved flights will persist across sessions.</p><button className="primary-button" onClick={() => void client?.auth.signOut().then(() => onSessionChange(null))}>Sign out <ArrowRight size={16} /></button><button className="back-button auth-back" onClick={onBack}>Return to search</button></section>;
  if (!client) return <section className="page-width page-section auth-state"><div className="loading-orb"><ShieldCheck size={22} /></div><div className="section-kicker">ACCOUNT / NOT CONFIGURED</div><h2>Secure watchlists need a dedicated connection.</h2><p>Supabase client configuration is not available in this environment, so saving flights is disabled rather than simulated.</p><button className="back-button auth-back" onClick={onBack}>Return to search</button></section>;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (mode === 'sign-up' && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(password)) {
      setError('Use at least 8 characters with one uppercase letter, one lowercase letter, and one number.');
      return;
    }
    setSubmitting(true);
    try {
      const result = mode === 'sign-in' ? await client.auth.signInWithPassword({ email, password }) : await client.auth.signUp({ email, password });
      if (result.error) {
        setError('We could not complete that request. Check your details and try again.');
        return;
      }
      if (mode === 'sign-up' && !result.data.session) setMessage('Check your email for the confirmation link before signing in.');
      if (result.data.session) onSessionChange(result.data.session);
    } catch {
      setError('The account service is unavailable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const result = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (result.error) {
        setError('We could not send the reset email. Check the address and try again.');
      } else {
        setMessage('If an account exists for that address, password-reset instructions are on the way.');
      }
    } catch {
      setError('The account service is unavailable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (result.error) setError('Google sign-in could not be started. If it persists, the Google provider must be enabled in the Songa Supabase project\'s Authentication settings.');
  };

  if (resetMode) return <section className="page-width page-section auth-layout"><div className="auth-copy"><div className="section-kicker">ACCOUNT / RESET ACCESS</div><h2>Back to a clearer<br /><span>journey.</span></h2><p>We will send reset instructions without revealing whether an address is registered.</p></div><form className="auth-card" onSubmit={sendReset}><div className="auth-card-top"><div><h3>Reset your password</h3><p>Enter the email used for your Songa account.</p></div><div className="auth-card-icon"><ShieldCheck size={18} /></div></div><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />{error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}{message && <div className="auth-message" role="status">{message}</div>}<button className="primary-button full-button" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset email'} <ArrowRight size={16} /></button><button type="button" className="text-link auth-switch" onClick={() => { setResetMode(false); setError(''); setMessage(''); }}>Back to sign in</button></form></section>;

  return <section className="page-width page-section auth-layout"><div className="auth-copy"><div className="section-kicker">ACCOUNT / FLIGHT WATCH</div><h2>Keep your journey<br /><span>in view.</span></h2><p>Sign in to save flights privately across your devices. Songa never needs more personal information than this experience requires.</p><div className="auth-promise"><ShieldCheck size={17} /><span>Ownership is derived from your secure session, not from the browser.</span></div></div><form className="auth-card" onSubmit={submit}><div className="auth-card-top"><div><h3>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h3><p>{mode === 'sign-in' ? 'Continue to your private Flight Watch.' : 'Start a private watchlist for your journeys.'}</p></div><div className="auth-card-icon"><Plane size={18} /></div></div><button type="button" className="google-button" onClick={() => void signInWithGoogle()}><span className="google-mark">G</span> Continue with Google</button><div className="auth-separator"><span>or use email</span></div><label htmlFor="account-email">Email address</label><input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /><label htmlFor="account-password">Password</label><div className="password-input"><input id="account-password" type={passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required /><button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{mode === 'sign-up' && <p className="password-hint">At least 8 characters, including uppercase, lowercase and a number.</p>}{error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}{message && <div className="auth-message" role="status">{message}</div>}<button className="primary-button full-button" disabled={submitting}>{submitting ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button>{mode === 'sign-in' && <button type="button" className="text-link auth-switch" onClick={() => { setResetMode(true); setError(''); setMessage(''); }}>Forgot password?</button>}<button type="button" className="text-link auth-switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage(''); }}>{mode === 'sign-in' ? 'New to Songa? Create an account' : 'Already have an account? Sign in'}</button></form></section>;
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) { return <button className="back-button" onClick={onClick}><ArrowLeft size={15} /> {label}</button>; }
function StatusBadge({ status }: { status: Flight['status'] }) { return <SharedStatusBadge status={status} />; }
function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-state"><div className="empty-icon"><Globe2 size={23} /></div><h3>{title}</h3><p>{text}</p><button className="secondary-button" onClick={onAction}>{action} <ArrowRight size={15} /></button></div>; }

export default App;
