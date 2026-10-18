import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Bell, BellOff, CheckCircle2, CircleAlert, Clock3, Link2, Loader2, MessageCircle, Plane, PlaneTakeoff,
  RefreshCw, Send, ShieldCheck, Signal,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { StatusBadge as SharedStatusBadge } from '@/screens/DisruptionScreens';
import { demoFlights } from '@/data/demoFlights';
import type { Flight } from '@/types';
import { flightProvider, FlightProviderError } from '@/lib/flightProvider';
import {
  type CompanionConnection, type CompanionStatus, disconnectLink, loadCompanionStatus,
  savePreferences, startLinking, verifyLink,
} from '@/lib/whatsappCompanion';

type ScreenProps = {
  session: Session | null;
  onOpenFlight: (flight: Flight) => void;
  onOpenAccount: () => void;
};

export function WhatsAppCompanionScreen({ session, onOpenFlight, onOpenAccount }: ScreenProps) {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const refresh = useCallback(async () => {
    if (!session) {
      setStatus(null);
      return;
    }
    setStatusLoading(true);
    setStatusError('');
    try {
      setStatus(await loadCompanionStatus());
    } catch {
      setStatusError('Your connection status could not be loaded. Please try again.');
    } finally {
      setStatusLoading(false);
    }
  }, [session]);

  useEffect(() => { void refresh(); }, [refresh]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const connection = status?.connection ?? null;

  return (
    <section className="page-width wa-companion">
      <div className="wa-hero">
        <div className="wa-hero-copy">
          <div className="section-kicker">SONGA / WHATSAPP COMPANION</div>
          <h1>Your flight doesn't stop<br /><span>at the website.</span></h1>
          <p className="wa-hero-lede">Meet Songa on WhatsApp. Check your flight, get verified updates and keep important changes within reach.</p>
          <div className="wa-hero-actions">
            <button className="primary-button" onClick={() => scrollTo('wa-connect')}><MessageCircle size={16} /> {connection?.status === 'verified' ? 'Manage connection' : 'Connect WhatsApp'}</button>
            <button className="secondary-button" onClick={() => scrollTo('wa-how')}><Signal size={16} /> See how it works</button>
          </div>
          <p className="wa-trust"><ShieldCheck size={14} /> Flight information is checked against available provider data. Update times and availability may vary.</p>
        </div>
        <ChatPreview connected={connection?.status === 'verified'} />
      </div>

      <HowItWorks />

      <ConnectionPanel
        session={session}
        status={status}
        statusLoading={statusLoading}
        statusError={statusError}
        onRefresh={refresh}
        onOpenAccount={onOpenAccount}
        onChanged={refresh}
      />

      {connection?.status === 'verified' && (
        <>
          <WatchListPanel session={session} onOpenFlight={onOpenFlight} />
          <NotificationPrefs connection={connection} onChanged={refresh} />
        </>
      )}

      <div className="wa-page-footer">
        <button className="back-button" onClick={() => onOpenFlight(demoFlights[0])}><Plane size={14} /> Explore a demo flight</button>
        <span className="wa-footer-rule" />
        <p>The chat illustration above is a labelled example. Real messaging happens on WhatsApp itself, after linking.</p>
      </div>
    </section>
  );
}

function WaHeader({ connected }: { connected: boolean }) {
  return (
    <div className="wa-chat-head">
      <span className="wa-chat-avatar"><img src="/songa-logo-64.png" alt="" width={34} height={34} /></span>
      <span className="wa-chat-name"><strong>Songa Flight Watch</strong><small>{connected ? 'Linked companion' : 'Example chat'}</small></span>
      <span className="wa-preview-pill">{connected ? 'LINKED' : 'EXAMPLE'}</span>
    </div>
  );
}

function ChatPreview({ connected }: { connected: boolean }) {
  return (
    <div className="wa-chat" aria-label="Example WhatsApp conversation">
      <WaHeader connected={connected} />
      <div className="wa-chat-body">
        <div className="wa-date-sep">Today</div>
        <div className="wa-bubble out"><p>What's happening with my flight?</p><span className="wa-stamp">14:02</span></div>
        <div className="wa-bubble in"><p>{connected ? 'On WhatsApp, send a flight number like KQ100 and I will answer with the latest provider data.' : 'This is a labelled example. After you link your number, you can message Songa on WhatsApp and get the latest provider data.'}</p><span className="wa-stamp">14:02</span></div>
        <div className="wa-bubble in wa-bubble-card">
          <FlightInfoCard flight={demoFlights[0]} example={!connected} />
          <span className="wa-stamp">14:03</span>
        </div>
      </div>
      <form className="wa-chat-input" onSubmit={(event) => event.preventDefault()}>
        <input
          placeholder="Example only — real replies arrive on WhatsApp"
          aria-label="Example message input"
          readOnly
        />
        <button type="button" aria-label="Example send button" disabled><Send size={17} /></button>
      </form>
    </div>
  );
}

type FlightInfoCardProps = {
  flight?: Flight | null;
  example?: boolean;
  onViewFlight?: () => void;
  loading?: boolean;
  error?: string;
  stale?: boolean;
};

export function FlightInfoCard({ flight, example, onViewFlight, loading, error, stale }: FlightInfoCardProps) {
  if (loading) {
    return (
      <article className="wa-flight-card" aria-label="Loading flight information">
        <div className="wa-flight-card-top">
          <span className="wa-flight-mark"><Loader2 size={16} className="wa-spin" /></span>
          <div className="wa-flight-id"><strong>Checking…</strong><small>Fetching provider data</small></div>
        </div>
        <div className="wa-flight-rows"><div><span>Status</span><small>Waiting for the flight data provider…</small></div></div>
      </article>
    );
  }
  if (error) {
    return (
      <article className="wa-flight-card" aria-label="Flight lookup error">
        <div className="wa-flight-card-top">
          <span className="wa-flight-mark"><CircleAlert size={16} /></span>
          <div className="wa-flight-id"><strong>Lookup failed</strong></div>
        </div>
        <div className="wa-flight-rows"><div><span>Provider message</span><small>{error}</small></div></div>
      </article>
    );
  }
  if (!flight) return null;
  const number = flight.flightNumber;
  const scheduledDep = flight.scheduledDeparture?.slice(11, 16) ?? flight.origin.time ?? 'Not supplied';
  const scheduledArr = flight.scheduledArrival?.slice(11, 16) ?? flight.destination.time ?? 'Not supplied';
  const estimatedDep = flight.estimatedDeparture?.slice(11, 16) ?? null;
  const delay = flight.departureDelayMinutes ?? null;

  return (
    <article className="wa-flight-card" aria-label={`Flight card for ${number}`}>
      <div className="wa-flight-card-top">
        <span className="wa-flight-mark"><PlaneTakeoff size={16} /></span>
        <div className="wa-flight-id">
          <strong>{number}</strong>
          <small>{flight.airline}</small>
        </div>
        <SharedStatusBadge status={flight.status} />
      </div>
      <div className="wa-flight-route">
        <div className="wa-endpoint">
          <strong>{flight.origin.code}</strong>
          <small>{flight.origin.city}</small>
          <span>Scheduled {scheduledDep}</span>
        </div>
        <span className="wa-route-line" />
        <div className="wa-endpoint align-right">
          <strong>{flight.destination.code}</strong>
          <small>{flight.destination.city}</small>
          <span>Scheduled {scheduledArr}</span>
        </div>
      </div>
      <div className="wa-flight-rows">
        <div><span>Status source</span><small>{example ? 'Labelled example — not live' : `${flight.source} · provider response`}</small></div>
        <div><span>Estimated departure</span><small>{estimatedDep ?? 'Not supplied'}</small></div>
        <div><span>Delay</span><small>{delay != null ? `${delay} min` : 'Not supplied'}</small></div>
        <div><span>Last checked</span><small>{flight.lastUpdatedAt ?? flight.updated}</small></div>
      </div>
      {stale && <p className="wa-prefs-note"><Clock3 size={14} /> This is the last successful result. A fresh lookup failed just now, so treat it as possibly out of date.</p>}
      {onViewFlight && (
        <div className="wa-flight-actions">
          <button className="wa-flight-btn primary" onClick={onViewFlight}>View full flight on Songa <ArrowRight size={14} /></button>
        </div>
      )}
    </article>
  );
}

function HowItWorks() {
  const steps = [
    { no: '01', title: 'Connect', text: 'Securely link your WhatsApp number to your Songa account.' },
    { no: '02', title: 'Track', text: 'Choose a flight from your private Songa watchlist or request a supported flight search.' },
    { no: '03', title: 'Stay informed', text: 'Receive meaningful, verified flight updates when important flight information changes.' },
  ];
  return (
    <div id="wa-how" className="wa-how">
      <div className="wa-section-heading">
        <div className="section-kicker">HOW SONGA KEEPS YOU INFORMED</div>
        <h2>Three quiet steps,<br /><span>one clear journey.</span></h2>
      </div>
      <ol className="wa-steps">
        {steps.map((step) => (
          <li key={step.no}>
            <span className="wa-step-no">{step.no}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

type ConnectionState =
  | 'not-connected'
  | 'verification-pending'
  | 'connected'
  | 'notifications-enabled'
  | 'notifications-paused';

function deriveState(connection: CompanionConnection | null): ConnectionState {
  if (!connection) return 'not-connected';
  if (connection.status === 'pending_verification') return 'verification-pending';
  if (connection.notificationsEnabled) return 'notifications-enabled';
  return 'connected';
}

function ConnectionPanel({ session, status, statusLoading, statusError, onRefresh, onOpenAccount, onChanged }: {
  session: Session | null;
  status: CompanionStatus | null;
  statusLoading: boolean;
  statusError: string;
  onRefresh: () => Promise<void>;
  onOpenAccount: () => void;
  onChanged: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [busy, setBusy] = useState<'start' | 'verify' | 'disconnect' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const connection = status?.connection ?? null;
  const state = deriveState(connection);

  const stateCopy: Record<ConnectionState, { heading: string; text: string; icon: typeof Link2 }> = {
    'not-connected': { heading: 'Not connected', text: 'No WhatsApp number is linked to this Songa account yet.', icon: Link2 },
    'verification-pending': { heading: 'Verification pending', text: 'A verification code was sent to your number. Enter it below to finish linking.', icon: Clock3 },
    connected: { heading: 'Account linked', text: 'A verified WhatsApp number is linked to this account. Linking does not enable notifications by itself.', icon: Link2 },
    'notifications-enabled': { heading: 'Notifications enabled', text: 'You explicitly opted in. Songa can send verified flight updates to your linked number.', icon: Bell },
    'notifications-paused': { heading: 'Notifications paused', text: 'Updates are on hold. Your linked number and watchlist stay untouched.', icon: BellOff },
  };
  const Icon = stateCopy[state].icon;

  const start = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('start');
    setError('');
    setNotice('');
    try {
      const result = await startLinking(phone);
      setSentPhone(result.phone);
      setNotice(result.delivery === 'twilio_verify'
        ? `Twilio Verify started for ${result.phone}. Enter the code you received.`
        : `A verification code was sent by WhatsApp to ${result.phone}. Enter it below.`);
      onChanged();
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Linking could not be started.');
    } finally {
      setBusy(null);
    }
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('verify');
    setError('');
    setNotice('');
    try {
      await verifyLink(sentPhone || phone, code);
      setCode('');
      setNotice('Your number is verified and linked.');
      onChanged();
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Verification failed.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setError('');
    setNotice('');
    try {
      await disconnectLink();
      setNotice('The WhatsApp link was removed and notification consent revoked.');
      onChanged();
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'The link could not be removed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="wa-connect" className="wa-connect">
      <div className="wa-section-heading">
        <div className="section-kicker">CONNECT YOUR WHATSAPP</div>
        <h2>Linking first.<br /><span>Notifications only with consent.</span></h2>
      </div>
      <div className="wa-connect-grid">
        <div className="wa-connect-panel">
          <div className="wa-state-card" aria-live="polite">
            <Icon size={22} />
            <div>
              <strong>{stateCopy[state].heading}</strong>
              <p>{statusError || stateCopy[state].text}</p>
            </div>
            <button className="wa-refresh" onClick={() => void onRefresh()} aria-label="Refresh connection status" disabled={statusLoading}>
              <RefreshCw size={15} className={statusLoading ? 'wa-spin' : ''} />
            </button>
          </div>
          <ol className="wa-flow">
            <li>You sign in to your Songa account.</li>
            <li>You enter your number and Songa sends a real verification code.</li>
            <li>You confirm the code — verification happens on the server.</li>
            <li>You explicitly opt in to flight notifications.</li>
            <li>You can pause, disconnect or stop at any time (STOP also works in chat).</li>
          </ol>
          {status && !status.twilioConfigured && (
            <div className="inline-error" role="status"><CircleAlert size={15} /> Twilio is not configured on the server yet, so no verification message can be sent. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FILTER in Supabase (Edge Functions → Secrets) to activate messaging.</div>
          )}
        </div>

        <div className="wa-connect-cta">
          {!session ? (
            <>
              <p className="wa-cta-note"><ShieldCheck size={15} /> Signing in to your Songa account is required before a private watch can be linked. Songa never exposes saved flights to an unverified number.</p>
              <button className="primary-button full-button" onClick={onOpenAccount}>Sign in first <ArrowRight size={16} /></button>
            </>
          ) : state === 'verification-pending' || (state === 'not-connected' && sentPhone) ? (
            <form className="wa-cta-form" onSubmit={verify}>
              <p className="wa-cta-note"><MessageCircle size={15} /> {notice || `Enter the 6-digit code sent to ${sentPhone || phone}.`}</p>
              <label htmlFor="wa-code">Verification code</label>
              <input
                id="wa-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
              <button className="primary-button full-button" type="submit" disabled={busy === 'verify' || code.length < 6}>
                {busy === 'verify' ? 'Verifying…' : 'Confirm and link'} {!busy && <ArrowRight size={16} />}
              </button>
              <button type="button" className="text-link" onClick={() => { setSentPhone(''); setCode(''); setNotice(''); }}>Use a different number</button>
            </form>
          ) : state === 'not-connected' ? (
            <form className="wa-cta-form" onSubmit={start}>
              {notice && <p className="wa-cta-note"><CheckCircle2 size={15} /> {notice}</p>}
              <label htmlFor="wa-phone">Your WhatsApp number (international format)</label>
              <input
                id="wa-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+254712345678"
                autoComplete="tel"
                required
              />
              <button className="primary-button full-button" type="submit" disabled={busy === 'start'}>
                {busy === 'start' ? 'Sending code…' : 'Send verification code'} {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          ) : (
            <div className="wa-cta-form">
              <p className="wa-cta-note"><CheckCircle2 size={15} /> Linked to {connection?.phone}. Manage notifications below.</p>
              <button className="secondary-button full-button" onClick={() => void disconnect()} disabled={busy === 'disconnect'}>
                {busy === 'disconnect' ? 'Removing…' : 'Disconnect number'}
              </button>
            </div>
          )}
          {error && <div className="inline-error" role="alert"><CircleAlert size={15} /> {error}</div>}
        </div>
      </div>
    </div>
  );
}

const notificationOptions = [
  { id: 'notifyDelayChanges', label: 'Significant delay changes' },
  { id: 'notifyCancellationDiversion', label: 'Flight cancellation or diversion updates' },
  { id: 'notifyDepartureChanges', label: 'Departure-time changes' },
  { id: 'notifyArrivalUpdates', label: 'Arrival updates' },
] as const;

function NotificationPrefs({ connection, onChanged }: { connection: CompanionConnection; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(connection.notificationsEnabled);
  const [selected, setSelected] = useState(connection.preferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const persist = async (nextEnabled: boolean, nextSelected: typeof selected, consent: boolean) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await savePreferences(connection, {
        notificationsEnabled: nextEnabled,
        preferences: nextSelected,
      });
      void consent;
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'The preferences could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMaster = () => {
    if (enabled) {
      setEnabled(false);
      void persist(false, selected, false);
    } else {
      setConfirmOpen(true);
    }
  };

  const confirmEnable = (consent: boolean) => {
    setConfirmOpen(false);
    setEnabled(consent);
    if (consent) void persist(true, selected, true);
  };

  const toggleOption = (id: typeof notificationOptions[number]['id']) => {
    const next = { ...selected, [id]: !selected[id] };
    setSelected(next);
    void persist(enabled, next, true);
  };

  return (
    <div className="wa-prefs">
      <div className="wa-section-heading">
        <div className="section-kicker">NOTIFICATION PREFERENCES</div>
        <h2>You decide<br /><span>what reaches you.</span></h2>
      </div>
      <div className="wa-prefs-card">
        <div className="wa-prefs-toggle">
          <div>
            <strong>{enabled ? 'Notifications enabled' : 'Notifications paused'}</strong>
            <p>Master switch for {connection.phone}. Enabling requires explicit consent.</p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Pause notifications' : 'Enable notifications'}
            className={enabled ? 'wa-switch on' : 'wa-switch'}
            onClick={toggleMaster}
            disabled={saving}
          >
            <span />
          </button>
        </div>
        <ul className="wa-prefs-list">
          {notificationOptions.map((option) => (
            <li key={option.id}>
              <label className={selected[option.id] ? 'wa-check checked' : 'wa-check'}>
                <input
                  type="checkbox"
                  checked={selected[option.id]}
                  disabled={!enabled || saving}
                  onChange={() => toggleOption(option.id)}
                />
                <span className="wa-check-box" aria-hidden="true" />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
        {saving && <p className="wa-prefs-note"><Loader2 size={14} className="wa-spin" /> Saving…</p>}
        {!saving && saved && <p className="wa-prefs-note"><CheckCircle2 size={14} /> Saved on the server. Your changes persist across sessions.</p>}
        {error && <p className="wa-prefs-note"><CircleAlert size={14} /> {error}</p>}
        {confirmOpen && (
          <div className="demo-modal-backdrop" onClick={() => setConfirmOpen(false)} role="presentation">
            <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="wa-consent-title" onClick={(event) => event.stopPropagation()}>
              <div className="panel-heading"><h3 id="wa-consent-title">Consent to WhatsApp notifications</h3></div>
              <p>Songa will send flight updates for your watched flights to {connection.phone} on WhatsApp. Message frequency depends on your watchlist and your airline's changes. You can pause or revoke this at any time, including by replying STOP on WhatsApp.</p>
              <label className={consentChecked ? 'wa-check checked' : 'wa-check'} style={{ margin: '12px 0' }}>
                <input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} />
                <span className="wa-check-box" aria-hidden="true" />
                I agree to receive flight notifications on this number.
              </label>
              <button className="primary-button full-button" disabled={!consentChecked} onClick={() => confirmEnable(true)}>Enable notifications</button>
              <button type="button" className="text-link" onClick={() => confirmEnable(false)}>Not now</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchListPanel({ session, onOpenFlight }: { session: Session | null; onOpenFlight: (flight: Flight) => void }) {
  const [watchlist, setWatchlist] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<Flight | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');

  const loadList = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setListError('');
    try {
      const { loadWatchedFlights, watchedRowToFlight } = await import('@/lib/watchlist');
      const rows = await loadWatchedFlights();
      setWatchlist(rows.map(watchedRowToFlight));
    } catch {
      setListError('Your saved flights could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadList(); }, [loadList]);

  const lookup = async (flightNumber: string, travelDate?: string) => {
    setLookupLoading(true);
    setLookupError('');
    setStale(false);
    setSelected(null);
    try {
      const results = await flightProvider.search({ flightNumber, travelDate });
      setSelected(results[0] ?? null);
      if (!results.length) setLookupError('No matching flight was found for that number and date.');
    } catch (err) {
      if (err instanceof FlightProviderError && err.kind === 'empty') {
        setLookupError('No matching flight was found for that number and date.');
      } else {
        setLookupError(err instanceof FlightProviderError ? err.message : 'The flight data provider is temporarily unavailable.');
      }
      if (err instanceof FlightProviderError && ['unavailable', 'timeout', 'rate_limit'].includes(err.kind)) setStale(true);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="wa-prefs">
      <div className="wa-section-heading">
        <div className="section-kicker">YOUR SAVED WATCHES</div>
        <h2>Real flights,<br /><span>real provider data.</span></h2>
      </div>
      <div className="wa-prefs-card">
        {loading && <p className="wa-prefs-note"><Loader2 size={14} className="wa-spin" /> Loading your watchlist…</p>}
        {listError && <p className="wa-prefs-note"><CircleAlert size={14} /> {listError}</p>}
        {!loading && !listError && !watchlist.length && (
          <p className="wa-prefs-note"><Bell size={14} /> You have no saved watches yet. Search a flight in Songa and add it to your watchlist.</p>
        )}
        {!!watchlist.length && (
          <ul className="wa-steps" style={{ listStyle: 'none', padding: 0 }}>
            {watchlist.map((flight) => (
              <li key={flight.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Plane size={15} />
                <button className="text-link" onClick={() => void lookup(flight.flightNumber, flight.date.slice(0, 10))}>
                  {flight.flightNumber} · {flight.date}
                </button>
                <SharedStatusBadge status={flight.status} />
              </li>
            ))}
          </ul>
        )}
        <form className="wa-cta-form" onSubmit={(event) => { event.preventDefault(); if (query.trim()) void lookup(query.trim()); }}>
          <label htmlFor="wa-lookup">Check any supported flight</label>
          <input
            id="wa-lookup"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. KQ100"
          />
          <button className="primary-button full-button" type="submit" disabled={lookupLoading}>
            {lookupLoading ? 'Checking provider…' : 'Check flight'} {!lookupLoading && <RefreshCw size={15} />}
          </button>
        </form>
        {lookupError && <p className="wa-prefs-note"><CircleAlert size={14} /> {lookupError}</p>}
        <FlightInfoCard
          flight={selected}
          loading={lookupLoading}
          stale={stale}
          onViewFlight={selected ? () => onOpenFlight(selected) : undefined}
        />
      </div>
    </div>
  );
}
