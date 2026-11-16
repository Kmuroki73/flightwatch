import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Bot, ChevronRight, CircleAlert, Clock3, CloudSun, Compass, Filter,
  Eye, EyeOff, Globe2, Heart, Info, LocateFixed, Lock, MapPin, MessageCircle, Menu, Moon, Plane, PlaneTakeoff, Radar, Search, ShieldAlert, ShieldCheck, Sparkles, Sun, Ticket, X,
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
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { addWatchedFlight, loadWatchedFlights, removeWatchedFlight, watchedRowToFlight } from '@/lib/watchlist';
import { requestTravellerLocation } from '@/lib/travellerLocation';
import { getTravellerWeather, type SongaWeather } from '@/lib/weather';
import type { Flight, Screen } from '@/types';

const navItems: { id: Screen; label: string; icon: typeof Plane }[] = [
  { id: 'dashboard', label: 'My Songa', icon: Activity },
  { id: 'home', label: 'Search', icon: Search },
  { id: 'watch', label: 'My flights', icon: Radar },
  { id: 'alerts', label: 'Disruptions', icon: Bell },
  { id: 'airports', label: 'Airports', icon: Globe2 },
  { id: 'companion', label: 'Songa AI', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'workspace', label: 'Trip tools', icon: Compass },
  { id: 'commerce', label: 'Travel services', icon: Ticket },
  { id: 'live-desk', label: 'Live desk', icon: Activity },
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
      <div className={`demo-ribbon ${flightProvider.mode === 'live' ? 'live-ribbon' : ''}`}><span className="demo-dot" /> {flightProvider.mode === 'live' ? 'Live provider mode · source and freshness shown on results' : 'Demo mode · sample flight information only'}</div>
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
        {screen === 'home' && <HomeScreen onSearch={searchFlights} onShowLookupResults={(flights) => { setSearchResults(flights); setSelectedFlight(flights[0] ?? null); goTo('results'); }} searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchDate={searchDate} setSearchDate={setSearchDate} searchError={searchError} searchLoading={searchLoading} session={session} watchedFlights={watchedFlights} onOpenFlight={openFlight} onOpenWatch={() => goTo('watch')} onOpenAlerts={() => goTo('alerts')} onOpenCompanion={() => goTo('companion')} onOpenWhatsApp={() => goTo('whatsapp')} onOpenCommerce={() => goTo('commerce')} />}
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
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        <button className={screen === 'home' ? 'active' : ''} onClick={() => goTo('home')}><Search size={19}/><span>Search</span></button>
        <button className={screen === 'watch' ? 'active' : ''} onClick={() => goTo('watch')}><Radar size={19}/><span>My flights</span></button>
        <button className={screen === 'companion' ? 'active' : ''} onClick={() => goTo('companion')}><Bot size={19}/><span>Songa AI</span></button>
        <button className={screen === 'whatsapp' ? 'active' : ''} onClick={() => goTo('whatsapp')}><MessageCircle size={19}/><span>WhatsApp</span></button>
        <button onClick={() => setMobileNavOpen((open) => !open)}><Menu size={19}/><span>More</span></button>
      </nav>
      <footer className="site-footer"><span>SONGA AI / TRAVEL COMPANION</span><span>Your flight changes. Songa knows and alerts you in real time.</span><span>{flightProvider.mode === 'live' ? 'Flight data provider connected.' : 'Flight provider not configured.'}</span></footer>
    </div>
  );
}

type HomeProps = {
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  onShowLookupResults: (flights: Flight[]) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  searchDate: string;
  setSearchDate: (value: string) => void;
  searchError: string;
  searchLoading: boolean;
  session: Session | null;
  watchedFlights: Flight[];
  onOpenFlight: (flight: Flight) => void;
  onOpenWatch: () => void;
  onOpenAlerts: () => void;
  onOpenCompanion: () => void;
  onOpenWhatsApp: () => void;
  onOpenCommerce: () => void;
};

function HomeScreen(props: HomeProps) {
  const {
    onSearch, onShowLookupResults, searchTerm, setSearchTerm, searchDate, setSearchDate, searchError,
    searchLoading, session, watchedFlights, onOpenWatch, onOpenAlerts,
    onOpenCompanion, onOpenWhatsApp, onOpenCommerce,
  } = props;
  const quickFlights = ['KQ100', 'EK720', 'BA63', 'QR1341'];
  const savedCount = watchedFlights.length;
  const [travellerProfile, setTravellerProfile] = useState<{ displayName: string; homeAirport: string }>({ displayName: '', homeAirport: '' });

  useEffect(() => {
    if (!session || !supabase) {
      setTravellerProfile({ displayName: '', homeAirport: '' });
      return;
    }
    let active = true;
    supabase.from('songa_traveller_profiles')
      .select('display_name,home_airport')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) {
          setTravellerProfile({
            displayName: typeof data.display_name === 'string' ? data.display_name : '',
            homeAirport: typeof data.home_airport === 'string' ? data.home_airport : '',
          });
        }
      })
      .catch(() => {
        // A missing optional personalisation table must never block public flight search.
      });
    return () => { active = false; };
  }, [session?.user.id]);
  const [typedLookup, setTypedLookup] = useState<{ key: string; status: 'loading' | 'done' | 'error'; flights: Flight[]; message?: string } | null>(null);
  useEffect(() => {
    const ident = searchTerm.trim().toUpperCase().replace(/\s+/g, '');
    const key = searchCacheKey(ident, searchDate);
    if (!/^[A-Z]{2,3}\d{1,5}[A-Z]?$/.test(ident)) {
      setTypedLookup(null);
      return;
    }
    const cached = flightSearchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setTypedLookup({ key, status: 'done', flights: cached.flights });
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      if (active) setTypedLookup({ key, status: 'loading', flights: [] });
      try {
        const flights = await flightProvider.search({ flightNumber: ident, travelDate: searchDate || undefined });
        rememberFlightSearch(key, flights);
        if (active) setTypedLookup({ key, status: 'done', flights });
      } catch (error) {
        const message = error instanceof FlightProviderError ? error.message : 'Flight details could not be retrieved right now.';
        if (active) setTypedLookup({ key, status: 'error', flights: [], message });
      }
    }, 650);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchTerm, searchDate]);
  const activeLookupKey = searchCacheKey(searchTerm, searchDate);
  return <div className="songa2-home">
    <section className="songa2-hero page-width">
      <div className="songa2-hero-copy">
        {session && <div className="songa2-personal-welcome">
          <span className="songa2-personal-orbit"><Activity size={13}/></span>
          <span><strong>{travellerProfile.displayName ? `Welcome back, ${travellerProfile.displayName}` : 'Welcome back to Songa'}</strong>
          <small>{travellerProfile.homeAirport ? `Your home airport · ${travellerProfile.homeAirport}` : 'Your personal aviation workspace'}</small></span>
        </div>}
        <div className="songa2-eyebrow"><span className="songa2-live-dot"/> YOUR JOURNEY, WATCHED INTELLIGENTLY</div>
        <h1>What's happening<br className="desktop-break"/> with your <span>flight?</span></h1>
        <p className="songa2-lede">Check your flight, stay ahead of changes and know what to do next. Songa keeps the important details in view.</p>
        <form className="songa2-search" onSubmit={onSearch}>
          <div className="songa2-search-input-wrap">
            <PlaneTakeoff size={21}/>
            <label htmlFor="songa-flight-search">Flight number</label>
            <input id="songa-flight-search" list="songa-flight-suggestions" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value.toUpperCase().replace(/\s+/g, ''))} placeholder="Try KQ100 or EK720" autoComplete="off" spellCheck={false} maxLength={10} aria-describedby="songa-search-help" /><datalist id="songa-flight-suggestions">{quickFlights.map((code) => <option key={code} value={code}/>)}</datalist>
            {searchTerm && <button type="button" className="songa2-clear" onClick={() => setSearchTerm('')} aria-label="Clear flight number"><X size={17}/></button>}
          </div>
          <div className="songa2-date-row"><label htmlFor="songa-travel-date"><Clock3 size={15}/> Travel date <span>Optional</span></label><input id="songa-travel-date" type="date" value={searchDate} onChange={(event) => setSearchDate(event.target.value)} /></div>
          <button className="songa2-search-submit" type="submit" disabled={searchLoading || !searchTerm.trim()}>{searchLoading ? <><span className="songa2-loader"/> Checking flight…</> : <>Check flight <ArrowRight size={19}/></>}</button>
          {searchError && <div className="songa2-search-error" role="alert"><CircleAlert size={16}/>{searchError}</div>}
        </form>
        {typedLookup?.key === activeLookupKey && typedLookup.status === 'loading' && <div className="songa2-live-suggestion loading"><span className="songa2-loader"/><span>Checking available flight information for <strong>{searchTerm}</strong>…</span></div>}
        {typedLookup?.key === activeLookupKey && typedLookup.status === 'done' && typedLookup.flights.length > 0 && <button type="button" className="songa2-live-suggestion found" onClick={() => onShowLookupResults(typedLookup.flights)}><span className="suggestion-status"><i/> FLIGHT INFORMATION FOUND · {typedLookup.flights[0].dataMode === 'demo' ? 'SAMPLE' : typedLookup.flights[0].source.toUpperCase()}</span><strong>{typedLookup.flights[0].flightNumber}</strong><span>{typedLookup.flights[0].origin.code} {typedLookup.flights[0].origin.city} <ArrowRight size={14}/> {typedLookup.flights[0].destination.code} {typedLookup.flights[0].destination.city}</span><small>{typedLookup.flights.length} matching record{typedLookup.flights.length === 1 ? '' : 's'} · Updated {typedLookup.flights[0].lastUpdatedAt}</small></button>}
        {typedLookup?.key === activeLookupKey && typedLookup.status === 'error' && <div className="songa2-live-suggestion unavailable"><Info size={16}/><span>{typedLookup.message} You can still press Check flight to retry.</span></div>}
        <div className="songa2-search-meta" id="songa-search-help"><ShieldCheck size={15}/> Search first. No account required. Sign in only when you save a flight.</div>
        <div className="songa2-quick-searches"><span>FLIGHT NUMBER EXAMPLES</span>{quickFlights.map((code) => <button type="button" key={code} onClick={() => setSearchTerm(code)}>{code}</button>)}</div>
      </div>
      <div className="songa2-hero-art" aria-hidden="true">
        <div className="songa2-flight-orbit orbit-a"/><div className="songa2-flight-orbit orbit-b"/>
        <div className="songa2-planet"><div className="planet-gridline grid-one"/><div className="planet-gridline grid-two"/><div className="planet-land land-one"/><div className="planet-land land-two"/><div className="planet-land land-three"/></div>
        <div className="songa2-plane-3d"><PlaneTakeoff size={94} strokeWidth={1.1}/></div>
        <div className="songa2-art-label label-left"><span>NBO</span><small>NAIROBI</small></div><div className="songa2-art-label label-right"><span>WORLD</span><small>ONE JOURNEY AT A TIME</small></div>
        <div className="songa2-art-caption"><span className="songa2-live-dot"/> Flight intelligence, made personal</div>
      </div>
    </section>

    <TravellerContextPanel />

    <section className="songa2-map-section page-width" aria-label="Live flight activity">
      <FlightActivityMap />
    </section>

    <section className="songa2-quick-services page-width">
      <div className="songa2-section-heading"><div><span>YOUR TRAVEL DESK</span><h2>What do you need today?</h2></div><p>Everything important, without the noise.</p></div>
      <div className="songa2-service-grid">
        <button className="songa2-service-card" onClick={onOpenWatch}><span className="service-icon"><Radar size={22}/></span><strong>My Flight Watch</strong><small>{savedCount ? `${savedCount} saved ${savedCount === 1 ? 'flight' : 'flights'}` : 'Save flights and keep them close'}</small><ArrowUpRight size={17}/></button>
        <button className="songa2-service-card" onClick={onOpenAlerts}><span className="service-icon"><Bell size={22}/></span><strong>Flight delayed?</strong><small>Understand changes and explore your options</small><ArrowUpRight size={17}/></button>
        <button className="songa2-service-card" onClick={onOpenCompanion}><span className="service-icon"><Sparkles size={22}/></span><strong>Ask Songa AI</strong><small>Get help understanding your journey</small><ArrowUpRight size={17}/></button>
        <button className="songa2-service-card" onClick={onOpenCommerce}><span className="service-icon"><Ticket size={22}/></span><strong>Travel services</strong><small>Premium assistance, group watch and Airside</small><ArrowUpRight size={17}/></button>
        <button className="songa2-service-card" onClick={onOpenWhatsApp}><span className="service-icon whatsapp-service"><MessageCircle size={22}/></span><strong>WhatsApp companion</strong><small>Continue your journey on WhatsApp</small><ArrowUpRight size={17}/></button>
      </div>
    </section>

    <section className="songa2-airhelp-band page-width">
      <div className="songa2-airhelp-icon"><ShieldAlert size={28}/></div>
      <div><span>WHEN TRAVEL DOESN'T GO TO PLAN</span><h2>Delayed or cancelled flight?</h2><p>Find out whether your disruption may qualify for assistance or compensation.</p></div>
      <button type="button" onClick={onOpenAlerts}>Review passenger rights <ArrowUpRight size={18}/></button>
    </section>
  </div>;
}


function TravellerContextPanel() {
  const [weather, setWeather] = useState<SongaWeather | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  const loadWeather = async (location: { latitude: number; longitude: number } | { query: string }) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await getTravellerWeather(location);
      setWeather(result);
      setExpanded(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Weather is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    setBusy(true);
    setMessage('');
    try {
      const location = await requestTravellerLocation();
      await loadWeather({ latitude: location.latitude, longitude: location.longitude });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Location is unavailable. Choose a city or airport instead.');
      setBusy(false);
      setExpanded(true);
    }
  };

  return <section className="songa2-location-panel page-width" aria-label="Local travel context">
    <div className="songa2-location-copy">
      <span className="songa2-location-icon"><Globe2 size={17}/></span>
      <div><strong>{weather ? `${weather.location.name}, ${weather.location.country}` : 'Make Songa local to you'}</strong>
        <small>{weather ? `Local time ${weather.location.tz_id} · Weather updated ${new Date(weather.fetchedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Choose your location to see local weather and travel context.'}</small>
      </div>
    </div>
    {weather && <div className="songa2-location-weather"><img src={`https:${weather.current.condition.icon}`} alt="" /><strong>{Math.round(weather.current.temp_c)}°C</strong><span>{weather.current.condition.text}</span></div>}
    <div className="songa2-location-actions">
      {!weather && <button type="button" className="songa2-location-button" onClick={() => void useMyLocation()} disabled={busy}><LocateFixed size={15}/>{busy ? 'Locating…' : 'Use my location'}</button>}
      <button type="button" className="songa2-location-manual" onClick={() => setExpanded((value) => !value)}>{weather ? 'Change location' : 'Choose city / airport'}</button>
    </div>
    {expanded && <form className="songa2-location-manual-form" onSubmit={(event) => { event.preventDefault(); if (manualLocation.trim()) void loadWeather({ query: manualLocation.trim() }); }}>
      <input value={manualLocation} onChange={(event) => setManualLocation(event.target.value)} placeholder="Enter city, country or airport" aria-label="City, country or airport"/>
      <button type="submit" disabled={busy || !manualLocation.trim()}>{busy ? 'Loading…' : 'Apply location'}</button>
    </form>}
    {message && <p className="songa2-location-message" role="status">{message}</p>}
    {weather && <small className="songa2-weather-credit">Weather by WeatherAPI.com · Local surface weather, not aircraft cabin or cruise-altitude conditions.</small>}
  </section>;
}

function FlightActivityMap() {
  type Position = { id: string; ident: string; origin: string; destination: string; latitude: number; longitude: number; altitudeFt?: number; groundspeedKts?: number; headingDeg?: number; updatedAt: string };
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [mapError, setMapError] = useState('');

  const client = supabase;
  useEffect(() => {
    if (!client) { setMapError('Connect the Songa flight data service to show live aircraft positions.'); return; }
    let active = true;
    let first = true;
    const load = async () => {
      if (!active) return;
      if (first) setLoading(true);
      try {
        const { data, error } = await client.functions.invoke('flight-positions');
        if (error) throw error;
        const rows = Array.isArray(data?.positions) ? data.positions as Position[] : [];
        if (!active) return;
        setPositions(rows.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).slice(0, 30));
        setLastUpdated(data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now');
        setMapError(rows.length ? '' : 'No current aircraft positions were returned by the provider.');
      } catch {
        if (active) setMapError('Live position coverage is not enabled for this provider connection yet. Flight search remains available above.');
      } finally {
        if (active) setLoading(false);
        first = false;
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, [client]);

  const xFor = (longitude: number) => 40 + ((longitude + 180) / 360) * 920;
  const yFor = (latitude: number) => 40 + ((85 - latitude) / 170) * 420;
  return <div className="songa2-map-card">
    <div className="songa2-map-header"><div><span>THE WORLD, IN MOTION</span><h2>Flight activity</h2></div><div className="songa2-map-status">{positions.length > 0 ? <><span className="songa2-live-dot"/> LIVE POSITIONS</> : <><span className="map-status-muted"/>{loading ? 'CONNECTING' : 'POSITIONS UNAVAILABLE'}</>}</div></div>
    <div className="songa2-map-canvas">
      <svg viewBox="0 0 1000 500" role="img" aria-label={positions.length ? `${positions.length} provider-reported aircraft positions` : 'Illustrated world map; live aircraft positions are not currently available'}>
        <defs><radialGradient id="mapGlow"><stop offset="0" stopColor="#ff8b37" stopOpacity=".18"/><stop offset="1" stopColor="#ff8b37" stopOpacity="0"/></radialGradient><pattern id="mapGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#e9a36b" strokeOpacity=".13" strokeWidth="1"/></pattern></defs>
        <rect width="1000" height="500" fill="#161b20"/><rect width="1000" height="500" fill="url(#mapGrid)"/>
        <g fill="#3b4247" stroke="#657079" strokeOpacity=".4" strokeWidth="1.2">
          <path d="M70 110 110 72 177 65 218 92 270 87 310 120 290 153 245 164 228 203 188 217 165 255 128 242 104 202 80 177Z"/>
          <path d="M240 260 272 277 295 328 286 375 265 432 240 405 225 350Z"/>
          <path d="M420 105 458 80 493 88 512 117 491 145 455 147 435 130Z"/>
          <path d="M435 160 470 147 510 165 530 205 515 253 492 286 470 254 448 223Z"/>
          <path d="M520 104 565 83 634 75 682 96 718 80 780 103 844 95 909 139 884 173 830 179 797 206 747 194 708 217 674 190 635 198 596 171 560 184 531 151Z"/>
          <path d="M730 235 778 224 819 248 823 282 793 296 762 275Z"/>
          <path d="M874 317 914 305 944 329 930 357 892 354Z"/>
        </g>
        {positions.map((p) => <g key={p.id} transform={`translate(${xFor(p.longitude)} ${yFor(p.latitude)}) rotate(${p.headingDeg ?? 0})`}><circle r="15" fill="url(#mapGlow)"/><path d="M0 -9 3.8 5 0 2.5 -3.8 5Z" fill="#ff8b37" stroke="#fff2e7" strokeWidth="1.2"/><circle r="2" fill="#fff2e7"/></g>)}
      </svg>
      <div className="songa2-map-overlay"><strong>{positions.length ? positions.length.toLocaleString() : '—'}</strong><span>aircraft positions<br/>returned by provider</span></div>
    </div>
    <div className="songa2-map-footer"><span>{mapError || (lastUpdated ? `Provider positions refreshed at ${lastUpdated}` : 'Waiting for provider positions')}</span><span>Position data is provider-dependent</span></div>
  </div>;
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
  return <section className="page-width page-section"><div className="section-heading watch-heading"><div><div className="section-kicker">YOUR FLIGHT WATCH</div><h2>Keep the important<br /><span>moments in view.</span></h2><p className="heading-description">{session ? 'Your saved flights are private to your account and persist across sessions. Background monitoring is not active yet.' : 'Sign in to save flights across sessions and keep them private.'}</p></div><div className="watch-orbit"><Radar size={21} /><span>{flights.length}<small>watching</small></span></div></div>{watchError && <div className="inline-error" role="alert"><CircleAlert size={15} /> {watchError}</div>}{!session ? <EmptyState title="Sign in to start watching" text="A secure account is required before a flight can be saved." action="Open account" onAction={onOpenAccount} /> : <><div className="filter-row"><div className="filter-label"><Filter size={15} /> Filter flights</div>{(['All flights', 'Needs attention', 'On time'] as const).map((item) => <button key={item} className={filter === item ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter(item)}>{item}</button>)}</div>{flights.length ? <div className="watch-grid">{flights.map((flight) => <WatchCard key={flight.id} flight={flight} onOpen={() => onOpenFlight(flight)} onRemove={() => void onToggleWatch(flight)} />)}</div> : <EmptyState title="Your watch is clear" text="Search for a flight and add it here once you are signed in." action="Search flights" onAction={onGoSearch} />}</>}</section>;
}

function WatchCard({ flight, onOpen, onRemove }: { flight: Flight; onOpen: () => void; onRemove: () => void }) { return <article className="watch-card"><div className="watch-card-head"><span className="flight-code">{flight.flightNumber}</span><StatusBadge status={flight.status} /></div><p className="watch-airline">{flight.airline} · {flight.date}</p><div className="mini-route"><strong>{flight.origin.code}</strong><span /><Plane size={15} /><span /><strong>{flight.destination.code}</strong></div><p className="watch-detail"><Clock3 size={14} /> {flight.statusDetail}</p><div className="watch-card-actions"><button className="text-link" onClick={onOpen}>Open flight <ArrowRight size={15} /></button><button className="icon-text-button" onClick={onRemove}><X size={14} /> Remove</button></div></article>; }

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
    if (!supabase) { setError('Songa AI is not configured in this deployment yet. Add the Supabase connection and AI function secrets.'); return; }
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

  <form className="songa2-ai-composer" onSubmit={send}>
    <textarea
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder="Ask Songa about your journey…"
      rows={2}
      maxLength={1200}
      aria-label="Message Songa AI"
    />
    <button
      type="submit"
      disabled={busy || !draft.trim()}
      aria-label="Send message"
    >
      {busy ? <span className="songa2-loader" /> : <ArrowUpRight size={21} />}
    </button>
  </form>

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
