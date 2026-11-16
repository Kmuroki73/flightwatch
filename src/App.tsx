import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Bot, ChevronRight, CircleAlert, Clock3, Compass,
  Eye, EyeOff, Globe2, Heart, Info, LocateFixed, MessageCircle, Menu, Moon, Plane, PlaneTakeoff, Radar, Search, ShieldAlert, ShieldCheck, Sparkles, Sun, Ticket, X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AirportsScreen as AirportBoardScreen } from '@/screens/AirportBoard';
import { DisruptionsScreen, StatusBadge as SharedStatusBadge } from '@/screens/DisruptionScreens';
import { CompensationModule } from '@/screens/WorkspaceScreens';
import { WhatsAppCompanionScreen } from '@/screens/WhatsAppCompanionScreen';
import { LiveDeskScreen } from '@/screens/LiveDeskScreen';
import { WorkspaceScreen } from '@/screens/WorkspaceScreen';
import { CommerceScreen } from '@/screens/CommerceScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { FlightHomeScreen } from '@/screens/FlightHomeScreen';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { addWatchedFlight, loadWatchedFlights, removeWatchedFlight, watchedRowToFlight } from '@/lib/watchlist';
import type { Flight, Screen } from '@/types';

const navItems: { id: Screen; label: string; icon: typeof Plane }[] = [
  { id: 'home', label: 'Flights', icon: Plane },
  { id: 'watch', label: 'My journeys', icon: Radar },
  { id: 'companion', label: 'Songa AI', icon: Bot },
  { id: 'commerce', label: 'Services', icon: Ticket },
  { id: 'account', label: 'Profile', icon: Compass },
];

type WatchFilter = 'All flights' | 'Needs attention' | 'On time';
type Theme = 'dark' | 'light';
type SearchCacheEntry = { expiresAt: number; flights: Flight[] };
const flightSearchCache = new Map<string, SearchCacheEntry>();
function searchCacheKey(flightNumber: string, travelDate: string): string {
  return `${flightNumber.trim().toUpperCase().replace(/\s+/g, '')}|${travelDate || ''}`;
}
function rememberFlightSearch(key: string, flights: Flight[]) {
  flightSearchCache.set(key, { expiresAt: Date.now() + 90_000, flights });
  if (flightSearchCache.size > 40) {
    const oldest = flightSearchCache.keys().next().value;
    if (oldest) flightSearchCache.delete(oldest);
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => new URLSearchParams(window.location.search).get('screen') === 'commerce' ? 'commerce' : 'home');
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [searchResults, setSearchResults] = useState<Flight[]>([]);
  const [recentSearches, setRecentSearches] = useState<Flight[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [watchedFlights, setWatchedFlights] = useState<Flight[]>([]);
  const [watchError, setWatchError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [commerceNotice, setCommerceNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [watchFilter, setWatchFilter] = useState<WatchFilter>('All flights');
  const [theme, setTheme] = useState<Theme>(() => window.localStorage.getItem('songa-theme') === 'light' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('songa-theme', theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalState = params.get('paypal');
    const orderId = params.get('token') || params.get('orderId');
    if (paypalState === 'cancel') {
      setCommerceNotice('PayPal checkout was cancelled. No payment was captured.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (paypalState !== 'success' || !orderId || !supabase) return;
    if (!session) {
      setCommerceNotice('Sign in with the account used at checkout to verify your PayPal payment.');
      return;
    }
    let active = true;
    supabase.functions.invoke('paypal-capture-order', { body: { orderId } }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.completed) {
        setCommerceNotice(data?.message || 'We could not verify the payment yet. Please contact Songa support before trying again.');
      } else {
        setCommerceNotice('Payment verified. Your Songa Premium Travel Assistance is now active.');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }).catch(() => {
      if (active) setCommerceNotice('Payment verification is temporarily unavailable. Your order has not been marked active.');
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const commerceState = params.get('songa_commerce');
    const orderId = params.get('token') || params.get('orderId');
    if (commerceState === 'cancel') {
      setCommerceNotice('PayPal checkout was cancelled. No payment was captured.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (commerceState !== 'success' || !orderId || !supabase) return;
    if (!session) {
      setCommerceNotice('Sign in with the Songa account used at checkout to verify and activate your purchase.');
      return;
    }
    let active = true;
    supabase.functions.invoke('songa-commerce-capture-order', { body: { orderId } }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.completed) {
        setCommerceNotice(data?.message || 'We could not verify this PayPal payment yet. Do not pay again until the order has been checked.');
      } else {
        const detail = data.giftCode ? ` Gift code: ${data.giftCode}.` : data.groupCode ? ` Family invite code: ${data.groupCode}.` : data.airsideOrder?.pickup_reference ? ` Airside order: ${data.airsideOrder.pickup_reference}.` : '';
        setCommerceNotice(`${data.productName || 'Songa service'} payment verified and service issued.${detail}`);
        window.dispatchEvent(new CustomEvent('songa-commerce-updated'));
      }
      window.history.replaceState({}, '', window.location.pathname);
    }).catch(() => {
      if (active) setCommerceNotice('Payment verification is temporarily unavailable. Do not pay again until the order status is checked.');
    });
    return () => { active = false; };
  }, [session]);

  const visibleWatchedFlights = useMemo(() => {
    if (watchFilter === 'Needs attention') return watchedFlights.filter((flight) => flight.status === 'Delayed');
    if (watchFilter === 'On time') return watchedFlights.filter((flight) => flight.status === 'On time');
    return watchedFlights;
  }, [watchFilter, watchedFlights]);

  useEffect(() => {
    const key = `songa-search-history:${session?.user.id ?? 'guest'}`;
    try {
      const raw = window.localStorage.getItem(key);
      setRecentSearches(raw ? (JSON.parse(raw) as Flight[]).slice(0, 12) : []);
    } catch { setRecentSearches([]); }
  }, [session?.user.id]);

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
    setWatchError('');
    if (!session) {
      window.sessionStorage.setItem('songa-pending-watch', JSON.stringify(flight));
      goTo('account');
      return;
    }
    const savedFlight = watchedFlights.find((item) => item.flightNumber === flight.flightNumber && item.date === flight.date);
    try {
      if (savedFlight) {
        await removeWatchedFlight(savedFlight.id);
        setWatchedFlights((current) => current.filter((item) => item.id !== savedFlight.id));
      } else {
        const savedRow = await addWatchedFlight(flight);
        setWatchedFlights((current) => [...current, watchedRowToFlight(savedRow)]);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        setWatchError('This flight is already in your watchlist.');
      } else {
        setWatchError('We could not update your watchlist. Please try again.');
      }
    }
  };

  const searchFlights = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchError('');
    setSearchLoading(true);
    try {
      const key = searchCacheKey(searchTerm, searchDate);
      const cached = flightSearchCache.get(key);
      const results = cached && cached.expiresAt > Date.now()
        ? cached.flights
        : await flightProvider.search({ flightNumber: searchTerm, travelDate: searchDate || undefined });
      rememberFlightSearch(key, results);
      if (results[0]) {
        setRecentSearches((current) => {
          const next = [results[0], ...current.filter((item) => !(item.flightNumber === results[0].flightNumber && item.date === results[0].date))].slice(0, 12);
          try { window.localStorage.setItem(`songa-search-history:${session?.user.id ?? 'guest'}`, JSON.stringify(next)); } catch { /* local history is optional */ }
          return next;
        });
      }
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
      <header className="site-header">
        <button className="brand" onClick={() => goTo('home')} aria-label="Go to Songa Flight Watch home"><span className="brand-mark"><img src="/songa-logo-64.png" alt="" width={40} height={40} /></span><span className="brand-copy"><strong>Songa<span className="brand-spark">.</span></strong><span>AI TRAVEL COMPANION</span></span></button>
        <nav className={`main-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={screen === id ? 'nav-link active' : 'nav-link'} onClick={() => goTo(id)}><Icon size={16} /> {label}</button>)}
        </nav>
        <div className="header-actions"><button className="icon-button mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button><button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className="profile-button" onClick={() => goTo('account')}><span className="profile-avatar">{session?.user.email?.slice(0, 1).toUpperCase() ?? 'A'}</span><span>{session ? 'Account' : 'Sign in'}</span></button></div>
      </header>
      <main>
        {commerceNotice && <div className="commerce-notice page-width" role="status"><ShieldCheck size={17} /><span>{commerceNotice}</span><button onClick={() => setCommerceNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
        {screen === 'dashboard' && <DashboardScreen session={session} watchedFlights={watchedFlights} recentSearches={recentSearches} onOpenFlight={openFlight} onOpenCommerce={() => goTo('commerce')} onOpenAccount={() => goTo('account')} />}
        {screen === 'home' && <FlightHomeScreen onSearch={searchFlights} searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchDate={searchDate} setSearchDate={setSearchDate} searchError={searchError} searchLoading={searchLoading} session={session} watchedFlights={watchedFlights} recentSearches={recentSearches} onOpenFlight={openFlight} onOpenWatch={() => goTo('watch')} onOpenAlerts={() => goTo('alerts')} onOpenCompanion={() => goTo('companion')} onOpenWhatsApp={() => goTo('whatsapp')} onOpenCommerce={() => goTo('commerce')} onOpenAccount={() => goTo('account')} />}
        {screen === 'results' && <ResultsScreen flights={searchResults} onBack={() => goTo('home')} onOpenFlight={openFlight} watchedFlights={watchedFlights} onToggleWatch={toggleWatch} watchError={watchError} />}
        {screen === 'details' && selectedFlight && <DetailsScreen flight={selectedFlight} session={session} onBack={() => goTo('results')} isWatched={watchedFlights.some((flight) => flight.flightNumber === selectedFlight.flightNumber && flight.date === selectedFlight.date)} onToggleWatch={toggleWatch} onOpenAlerts={() => goTo('alerts')} onOpenAccount={() => goTo('account')} onAskAI={() => goTo('companion')} />}
        {screen === 'watch' && <WatchScreen flights={visibleWatchedFlights} filter={watchFilter} setFilter={setWatchFilter} onOpenFlight={openFlight} onGoSearch={() => goTo('home')} onToggleWatch={toggleWatch} watchError={watchError} session={session} onOpenAccount={() => goTo('account')} />}
        {screen === 'live-desk' && <LiveDeskScreen session={session} watchedFlights={watchedFlights} onOpenFlight={openFlight} />}
        {screen === 'alerts' && <DisruptionsScreen onOpenFlight={openFlight} onToggleWatch={toggleWatch} watchedFlights={watchedFlights} watchError={watchError} session={session} onOpenAccount={() => goTo('account')} />}
        {screen === 'airports' && <AirportBoardScreen initialAirport={null} onOpenFlight={openFlight} />}
        {screen === 'workspace' && <WorkspaceScreen flights={[...watchedFlights, ...searchResults].filter((flight, index, list) => list.findIndex((item) => item.id === flight.id) === index)} selectedFlight={selectedFlight} onSelectFlight={openFlight} session={session} />}
        {screen === 'companion' && <CompanionScreen flight={selectedFlight} session={session} onOpenFlight={() => selectedFlight ? openFlight(selectedFlight) : goTo('home')} />}
        {screen === 'whatsapp' && <WhatsAppCompanionScreen session={session} onOpenFlight={openFlight} onOpenAccount={() => goTo('account')} />}
        {screen === 'commerce' && <CommerceScreen session={session} selectedFlight={selectedFlight} onOpenAccount={() => goTo('account')} />}
        {screen === 'account' && <AccountScreen session={session} authReady={authReady} onSessionChange={setSession} onBack={() => goTo('home')} />}
      </main>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <button className={screen === 'home' || screen === 'results' || screen === 'details' ? 'active' : ''} onClick={() => goTo('home')}><Plane size={19}/><span>Flights</span></button>
        <button className={screen === 'watch' || screen === 'dashboard' || screen === 'live-desk' ? 'active' : ''} onClick={() => goTo('watch')}><Radar size={19}/><span>My journeys</span></button>
        <button className={screen === 'companion' ? 'active' : ''} onClick={() => goTo('companion')}><Bot size={19}/><span>Songa AI</span></button>
        <button className={screen === 'commerce' ? 'active' : ''} onClick={() => goTo('commerce')}><Ticket size={19}/><span>Services</span></button>
        <button className={screen === 'account' ? 'active' : ''} onClick={() => goTo('account')}><Compass size={19}/><span>Profile</span></button>
      </nav>
      <footer className="site-footer"><span>SONGA AI / TRAVEL COMPANION</span><span>Your flight changes. Songa knows and alerts you in real time.</span><span>{flightProvider.mode === 'live' ? 'Flight data provider connected.' : 'Flight provider not configured.'}</span></footer>
    </div>
  );
}

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

function DetailsScreen({ flight, session, onBack, isWatched, onToggleWatch, onOpenAlerts, onOpenAccount, onAskAI }: { flight: Flight; session: Session | null; onBack: () => void; isWatched: boolean; onToggleWatch: (flight: Flight) => Promise<void>; onOpenAlerts: () => void; onOpenAccount: () => void; onAskAI: () => void }) {
  const liveLabel = flight.dataMode === 'live' ? `Source: ${flight.source}` : 'Demo mode · source connection is not active';
  return <section className="page-width page-section"><BackButton onClick={onBack} label="Back to results" /><div className="detail-header"><div><div className="section-kicker">FLIGHT DETAILS / {flight.dataMode === 'demo' ? 'SAMPLE DATA' : 'LIVE'}</div><h2>{flight.flightNumber}</h2><p>{flight.airline} · {flight.date}</p></div><StatusBadge status={flight.status} /></div><div className="detail-layout"><div><div className="flight-card detail-route-card"><div className="route-row large-route"><div><span className="airport-code">{flight.origin.code}</span><span className="city-name">{flight.origin.city}</span><strong>{flight.origin.time}</strong></div><div className="route-visual"><div className="route-line"><span /><Plane size={22} /></div><span className="route-date">{flight.duration} · {flight.terminal}</span></div><div className="align-right"><span className="airport-code">{flight.destination.code}</span><span className="city-name">{flight.destination.city}</span><strong>{flight.destination.time}</strong></div></div><div className="source-note"><ShieldCheck size={17} /><span><strong>{liveLabel}</strong><br />Last updated {flight.lastUpdatedAt}. Fields not supplied by the source are left unavailable.</span></div><button className="primary-button full-button" onClick={() => void onToggleWatch(flight)}><Bell size={16} /> {isWatched ? 'Remove from Flight Watch' : 'Add to Flight Watch'}</button></div><div className="section-heading compact-heading"><div><div className="section-kicker">WHAT CHANGED</div><h3>Flight timeline</h3></div><button className="text-link" onClick={onOpenAlerts}>View disruption board <ChevronRight size={15} /></button></div>{flight.timeline.length ? <Timeline flight={flight} /> : <EmptyState title="Timeline unavailable" text="This source has not supplied timeline events for this flight." action="View disruption board" onAction={onOpenAlerts} />}</div><aside className="detail-aside"><div className="aside-card orange-aside"><Sparkles size={20} /><span className="section-kicker">SONGA AI</span><h3>Need a clearer next step?</h3><p>Ask Songa to explain the flight information and help you consider your options.</p><button className="text-link light-link" onClick={onAskAI}>Ask Songa AI <ArrowRight size={15} /></button></div><div className="aside-card"><span className="section-kicker">TRIP CONTEXT</span><div className="context-row"><Globe2 size={17} /><span><strong>{flight.route}</strong><small>Route from provider response</small></span></div><div className="context-row"><Compass size={17} /><span><strong>{flight.duration}</strong><small>Estimated flight time</small></span></div>{(flight.aircraft || flight.aircraftRegistration) && <div className="context-row"><Plane size={17} /><span><strong>{flight.aircraft ?? 'Aircraft details available'}</strong><small>{flight.aircraftRegistration ?? 'Aircraft type'}</small></span></div>}</div><PremiumAssistanceCard flight={flight} session={session} onSignIn={onOpenAccount}/><CompensationModule flight={flight} /></aside></div></section>;
}

function PremiumAssistanceCard({ flight, session, onSignIn }: { flight: Flight; session: Session | null; onSignIn: () => void }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const startCheckout = async () => {
    if (flight.dataMode !== 'live') { setNotice('Premium checkout is available after Songa retrieves a provider-backed flight result.'); return; }
    if (!session) { onSignIn(); return; }
    if (!supabase) { setNotice('PayPal checkout is not configured in this deployment.'); return; }
    setLoading(true); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('paypal-create-order', { body: { productId: 'premium-travel-assistance', flightNumber: flight.flightNumber, travelDate: flight.date } });
      if (error || !data?.approvalUrl) throw new Error(data?.message || 'PayPal checkout could not be started.');
      window.location.assign(data.approvalUrl);
    } catch (err) { setNotice(err instanceof Error ? err.message : 'PayPal checkout is temporarily unavailable.'); }
    finally { setLoading(false); }
  };
  return <div className="songa2-premium-card"><div className="premium-top"><span>SONGA PREMIUM</span><BadgeCheck size={19}/></div><h3>Extra help when plans change.</h3><p>Extended AI disruption guidance, a personalised action plan and a practical traveller checklist for this flight.</p><div className="premium-price"><strong>US$3.99</strong><small>Sandbox demonstration price</small></div><button type="button" onClick={() => void startCheckout()} disabled={loading || flight.dataMode !== 'live'}>{loading ? 'Connecting to PayPal…' : flight.dataMode !== 'live' ? 'Live flight required' : session ? 'Continue with PayPal' : 'Sign in to purchase'} <ArrowRight size={16}/></button><small className="premium-footnote">Secure PayPal Sandbox checkout. A payment is verified on the server before service access is granted.</small>{notice && <p className="premium-error" role="alert">{notice}</p>}</div>;
}

function Timeline({ flight }: { flight: Flight }) { return <div className="timeline">{flight.timeline.map((event) => <div className={`timeline-item ${event.state}`} key={event.title}><div className="timeline-marker" /><div className="timeline-content"><span>{event.time}</span><h4>{event.title}</h4><p>{event.description}</p></div></div>)}</div>; }

function WatchScreen({ flights, filter, setFilter, onOpenFlight, onGoSearch, onToggleWatch, watchError, session, onOpenAccount }: { flights: Flight[]; filter: WatchFilter; setFilter: (filter: WatchFilter) => void; onOpenFlight: (flight: Flight) => void; onGoSearch: () => void; onToggleWatch: (flight: Flight) => Promise<void>; watchError: string; session: Session | null; onOpenAccount: () => void }) {
  const attentionCount = flights.filter((flight) => flight.status === 'Delayed' || flight.status === 'Cancelled' || flight.status === 'Diverted').length;
  const onTimeCount = flights.filter((flight) => flight.status === 'On time').length;
  return (
    <section className="page-width page-section v21-journeys">
      <div className="v21-page-intro">
        <span className="v21-eyebrow">MY JOURNEYS</span>
        <h1>Your flights,<br/><em>all in one place.</em></h1>
        <p>Save the flights that matter. Open any journey to see its latest available information, source and travel options.</p>
      </div>
      {watchError && <div className="inline-error" role="alert"><CircleAlert size={15}/> {watchError}</div>}
      {!session ? (
        <div className="v21-empty-card"><div className="v21-action-icon"><Radar size={22}/></div><h2>Sign in to keep your journeys together</h2><p>Your saved flights are private to your account and can be accessed across your devices.</p><button className="primary-button" onClick={onOpenAccount}>Sign in or create an account <ArrowRight size={16}/></button></div>
      ) : (
        <>
          <div className="v21-journey-stats">
            <div><strong>{flights.length}</strong><span>Saved flights</span></div>
            <div><strong>{attentionCount}</strong><span>Need attention</span></div>
            <div><strong>{onTimeCount}</strong><span>On time</span></div>
          </div>
          <div className="v21-journey-toolbar">
            <div><h2>Saved journeys</h2><p>Choose a flight to see its details.</p></div>
            <button className="v21-outline-action" onClick={onGoSearch}><Search size={15}/> Find a flight</button>
          </div>
          <div className="v21-journey-filters">{(['All flights', 'Needs attention', 'On time'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
          {flights.length ? <div className="v21-journey-list">{flights.map((flight) => (
            <article className="v21-journey-card" key={flight.id}>
              <div className="v21-journey-card-head"><div><span>{flight.flightNumber}</span><small>{flight.airline}</small></div><StatusBadge status={flight.status}/></div>
              <div className="v21-journey-route"><div><strong>{flight.origin.code}</strong><small>{flight.origin.city}</small><b>{flight.origin.time}</b></div><span><Plane size={18}/></span><div><strong>{flight.destination.code}</strong><small>{flight.destination.city}</small><b>{flight.destination.time}</b></div></div>
              <p className="v21-journey-detail">{flight.statusDetail}</p>
              <div className="v21-journey-meta"><span>{flight.date}</span><span>{flight.dataMode === 'live' ? `Source: ${flight.source}` : 'Sample flight data'}</span><span>Updated {flight.lastUpdatedAt}</span></div>
              <div className="v21-journey-actions"><button className="primary-button" onClick={() => onOpenFlight(flight)}>Open journey <ArrowRight size={15}/></button><button className="v21-remove-action" onClick={() => void onToggleWatch(flight)}><X size={14}/> Remove</button></div>
            </article>
          ))}</div> : <div className="v21-empty-card"><div className="v21-action-icon"><Plane size={22}/></div><h2>{filter === 'All flights' ? 'No saved flights yet' : 'No flights match this filter'}</h2><p>{filter === 'All flights' ? 'Search for a flight, open its details and choose “Watch flight” to add it here.' : 'Try another filter or return to all saved flights.'}</p><button className="primary-button" onClick={filter === 'All flights' ? onGoSearch : () => setFilter('All flights')}>{filter === 'All flights' ? 'Search for a flight' : 'Show all flights'} <ArrowRight size={16}/></button></div>}
          <p className="v21-monitoring-note"><ShieldCheck size={15}/> Saved flights are stored in your account. Automatic background alerts are only available when the monitoring and notification services are configured.</p>
        </>
      )}
    </section>
  );
}

/* The example-alert inbox is superseded by the provider-backed Disruptions screen; kept out of navigation. */

function CompanionScreen({ flight, session, onOpenFlight }: { flight: Flight | null; session: Session | null; onOpenFlight: () => void }) {
  type ChatMessage = { role: 'user' | 'assistant'; content: string };
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: flight ? `Hi, I’m Songa. I have ${flight.flightNumber} in view. Ask me about its status, delays, connections or what to consider next.` : 'Hi, I’m Songa, your AI travel companion. Ask me about a flight, a disruption or planning your next journey. You can also search for a flight first so I can use its available details.' }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const client = supabase;
  useEffect(() => {
    let active = true;
    setPremiumUnlocked(false);
    if (!flight || !session || !client) return () => { active = false; };
    const flightNumber = flight.flightNumber.toUpperCase().replace(/\s+/g, '');
    const loadPremiumAccess = async () => {
      try {
        const now = new Date().toISOString();
        const [legacy, owned, gifted] = await Promise.all([
          client.from('premium_entitlements').select('id').eq('user_id', session.user.id).eq('flight_number', flightNumber).eq('travel_date', flight.date).eq('status', 'active').maybeSingle(),
          client.from('songa_commerce_entitlements').select('id,product_id,metadata,ends_at').eq('purchaser_user_id', session.user.id).in('status', ['ACTIVE','CLAIMED']).lte('starts_at', now),
          client.from('songa_commerce_entitlements').select('id,product_id,metadata,ends_at').eq('beneficiary_user_id', session.user.id).in('status', ['ACTIVE','CLAIMED']).lte('starts_at', now),
        ]);
        const rows = [...(owned.data ?? []), ...(gifted.data ?? [])].filter((row) => !row.ends_at || new Date(row.ends_at).getTime() > Date.now());
        const general = rows.some((row) => ['songa-premium-30','songa-premium-365'].includes(row.product_id));
        const rescue = rows.some((row) => {
          if (row.product_id !== 'songa-trip-rescue') return false;
          const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
          return String(metadata.flightNumber ?? '').toUpperCase().replace(/\s+/g, '') === flightNumber && String(metadata.travelDate ?? '') === flight.date;
        });
        if (active) setPremiumUnlocked(!!legacy.data || general || rescue);
      } catch { if (active) setPremiumUnlocked(false); }
    };
    void loadPremiumAccess();
    return () => { active = false; };
  }, [flight, session, client]);
  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!supabase) { setError('Songa AI is temporarily unavailable. You can still search for a flight and review its available status and travel options.'); return; }
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next); setDraft(''); setError(''); setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('songa-ai-assistant', {
        body: { messages: next.slice(-10), premium: premiumUnlocked, flight: flight ? { flightNumber: flight.flightNumber, airline: flight.airline, origin: flight.origin, destination: flight.destination, date: flight.date, dataMode: flight.dataMode, status: flight.status, statusDetail: flight.statusDetail, source: flight.source, lastUpdatedAt: flight.lastUpdatedAt, departureDelayMinutes: flight.departureDelayMinutes, arrivalDelayMinutes: flight.arrivalDelayMinutes, gate: flight.gate, terminal: flight.terminal } : null },
      });
      if (invokeError) throw invokeError;
      const reply = typeof data?.reply === 'string' ? data.reply : 'I could not prepare an answer just now. Please try again.';
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch {
      setError('Songa AI could not reach its assistant service. Please try again shortly.');
    } finally { setBusy(false); }
  };
  return <section className="page-width page-section songa2-ai-page">
    <div className="songa2-ai-heading">
  <div className="songa2-ai-avatar">
    <Sparkles size={25} />
  </div>
  <div>
    <span>SONGA AI / TRAVEL COMPANION</span>
    <h1>Let's make your next<br /><em>move clearer.</em></h1>
    <p>
      Ask about a flight, a disruption or your next step. Songa uses the
      flight details you provide and clearly separates facts from suggestions.
    </p>
  </div>
</div>

{flight && (
  <div className="songa2-ai-context">
    <Plane size={17} />
    <span>
      Flight context: <strong>{flight.flightNumber}</strong> ·
      {flight.origin.code} → {flight.destination.code} · {flight.status}
    </span>
    <button type="button" onClick={onOpenFlight}>View flight</button>
  </div>
)}

{premiumUnlocked && (
  <div className="songa2-premium-unlocked">
    <BadgeCheck size={16} />
    Premium assistance active for {flight?.flightNumber}. Your AI responses
    include an expanded action plan and traveller checklist.
  </div>
)}

<div className="songa2-ai-chat">
  <div className="songa2-ai-chat-header">
    <span><i /> Songa AI</span>
    <small>
      AI-generated travel guidance · verify operational decisions with the airline
    </small>
  </div>

  <div className="songa2-ai-messages" aria-live="polite">
    {messages.map((m, i) => (
      <div className={`songa2-ai-message ${m.role}`} key={i}>
        <span className="message-label">
          {m.role === 'user' ? 'YOU' : 'SONGA'}
        </span>

        <div className="songa2-ai-message-content">
          {m.role === 'assistant' ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {m.content}
            </ReactMarkdown>
          ) : (
            <p>{m.content}</p>
          )}
        </div>
      </div>
    ))}

    {busy && (
      <div className="songa2-ai-message assistant">
        <span className="message-label">SONGA</span>
        <p className="songa2-typing">
          Thinking through your journey<span>•••</span>
        </p>
      </div>
    )}
  </div>

  {error && (
    <div className="songa2-search-error ai-error" role="alert">
      {error}
    </div>
  )}

  {supabase ? (
    <form className="songa2-ai-composer" onSubmit={send}>
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Songa about your journey…" rows={2} maxLength={1200} aria-label="Message Songa AI" />
      <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">
        {busy ? <span className="songa2-loader" /> : <ArrowUpRight size={21} />}
      </button>
    </form>
  ) : (
    <div className="songa2-ai-unavailable" role="status">
      <div><ShieldCheck size={18}/><strong>Chat is temporarily unavailable</strong></div>
      <p>You can still search for a flight, save a journey and review the flight information and passenger-rights guidance available in Songa.</p>
      <button type="button" className="v21-outline-action" onClick={onOpenFlight}>{flight ? 'Review this flight' : 'Search for a flight'} <ArrowRight size={15}/></button>
    </div>
  )}

  <div className="songa2-ai-footnote">
    <ShieldCheck size={15} />
    Songa does not make airline decisions or guarantee compensation,
    rebooking or refunds.
  </div>
</div>
  </section>;
}

function AccountScreen({ session, authReady, onSessionChange, onBack }: { session: Session | null; authReady: boolean; onSessionChange: (session: Session | null) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [travelInterests, setTravelInterests] = useState('flight updates, airport services');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const client = supabase;

  useEffect(() => {
    let active = true;
    if (!session || !client) { setProfileLoaded(false); return () => { active = false; }; }
    client.from('songa_traveller_profiles')
      .select('display_name,home_airport,preferred_currency,travel_interests')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) {
          setDisplayName(data.display_name ?? '');
          setHomeAirport(data.home_airport ?? '');
          setPreferredCurrency(data.preferred_currency ?? 'USD');
          setTravelInterests(Array.isArray(data.travel_interests) ? data.travel_interests.join(', ') : '');
        }
        setProfileLoaded(true);
      });
    return () => { active = false; };
  }, [session?.user.id, client]);

  const saveTravellerProfile = async () => {
    if (!session || !client) return;
    setProfileBusy(true);
    setError('');
    setMessage('');
    const airport = homeAirport.trim().toUpperCase();
    if (airport && !/^[A-Z]{3}$/.test(airport)) {
      setError('Home airport must be a three-letter IATA code, such as NBO.');
      setProfileBusy(false);
      return;
    }
    const interests = travelInterests.split(',').map((value) => value.trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    const { error: saveError } = await client.from('songa_traveller_profiles').upsert({
      user_id: session.user.id,
      display_name: displayName.trim().slice(0, 80) || null,
      home_airport: airport || null,
      preferred_currency: preferredCurrency,
      travel_interests: interests,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setProfileBusy(false);
    if (saveError) setError('Your preferences could not be saved. Apply the Songa personalisation migration and try again.');
    else setMessage('Your Songa travel preferences have been saved.');
  };

  if (!authReady) return <section className="page-width page-section auth-state"><div className="loading-orb"><Radar size={22} /></div><h2>Checking your account</h2><p>Restoring your secure session.</p></section>;
  if (session) return <section className="page-width page-section auth-state">
    <div className="loading-orb"><ShieldCheck size={22} /></div>
    <div className="section-kicker">ACCOUNT / YOUR TRAVEL PROFILE</div>
    <h2>Make Songa feel like yours.</h2>
    <p>Signed in as {session.user.email}. Save your travel preferences to personalise the Songa experience across your devices.</p>
    <div className="traveller-profile-card">
      <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="How should Songa address you?"/></label>
      <label>Home airport <span>Three-letter IATA code</span><input value={homeAirport} onChange={(event) => setHomeAirport(event.target.value.toUpperCase().slice(0, 3))} maxLength={3} placeholder="e.g. NBO"/></label>
      <label>Preferred currency<select value={preferredCurrency} onChange={(event) => setPreferredCurrency(event.target.value)}><option value="USD">USD · US Dollar</option><option value="KES">KES · Kenyan Shilling</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · Pound Sterling</option></select></label>
      <label>Travel interests <span>Separate with commas · up to 8</span><input value={travelInterests} onChange={(event) => setTravelInterests(event.target.value)} placeholder="flight updates, airport services, family travel"/></label>
      <button className="primary-button full-button" onClick={() => void saveTravellerProfile()} disabled={profileBusy || !profileLoaded}>{profileBusy ? 'Saving preferences…' : 'Save my preferences'} <ArrowRight size={16}/></button>
      {error && <div className="inline-error" role="alert"><CircleAlert size={15}/> {error}</div>}
      {message && <div className="auth-message" role="status">{message}</div>}
    </div>
    <button className="primary-button" onClick={() => void client?.auth.signOut().then(() => onSessionChange(null))}>Sign out <ArrowRight size={16} /></button>
    <button className="back-button auth-back" onClick={onBack}>Return to search</button>
  </section>;
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
