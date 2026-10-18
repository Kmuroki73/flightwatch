import { useState } from 'react';
import {
  ArrowRight, Bell, BellOff, CircleAlert, Clock3, Link2, MessageCircle, Plane, PlaneTakeoff, Send, ShieldCheck, Signal,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { StatusBadge as SharedStatusBadge } from '@/screens/DisruptionScreens';
import { demoFlights } from '@/data/demoFlights';
import type { Flight, FlightStatus } from '@/types';

type ScreenProps = {
  session: Session | null;
  onOpenFlight: (flight: Flight) => void;
  onOpenAccount: () => void;
};

export function WhatsAppCompanionScreen({ session, onOpenFlight, onOpenAccount }: ScreenProps) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="page-width wa-companion">
      <div className="wa-hero">
        <div className="wa-hero-copy">
          <div className="section-kicker">SONGA / WHATSAPP COMPANION · PREVIEW</div>
          <h1>Your flight doesn't stop<br /><span>at the website.</span></h1>
          <p className="wa-hero-lede">Meet Songa on WhatsApp. Check your flight, get verified updates and keep important changes within reach.</p>
          <div className="wa-hero-actions">
            <button className="primary-button" onClick={() => scrollTo('wa-connect')}><MessageCircle size={16} /> Connect WhatsApp</button>
            <button className="secondary-button" onClick={() => scrollTo('wa-how')}><Signal size={16} /> See how it works</button>
          </div>
          <p className="wa-trust"><ShieldCheck size={14} /> Flight information is checked against available provider data. Update times and availability may vary.</p>
        </div>
        <ChatPreview onViewFlight={() => onOpenFlight(demoFlights[0])} />
      </div>

      <HowItWorks />

      <ConnectionPanel session={session} onOpenAccount={onOpenAccount} />

      <NotificationPrefs />

      <div className="wa-page-footer">
        <button className="back-button" onClick={() => onOpenFlight(demoFlights[0])}><Plane size={14} /> Explore a demo flight</button>
        <span className="wa-footer-rule" />
        <p>Demonstration conversation. Flight information shown here is illustrative, not live.</p>
      </div>
    </section>
  );
}

function WaHeader() {
  return (
    <div className="wa-chat-head">
      <span className="wa-chat-avatar"><img src="/songa-logo-64.png" alt="" width={34} height={34} /></span>
      <span className="wa-chat-name"><strong>Songa Flight Watch</strong><small>Preview chat</small></span>
      <span className="wa-preview-pill">PREVIEW</span>
    </div>
  );
}

type ChatBubble = { id: string; role: 'user' | 'songa'; text: string; time: string };

const conversation: ChatBubble[] = [
  { id: 'c1', role: 'user', text: "What's happening with my flight?", time: '14:02' },
  { id: 'c2', role: 'songa', text: "Let's check your flight. Send your flight number or choose one of your linked watches.", time: '14:02' },
  { id: 'c3', role: 'user', text: 'KQ100', time: '14:03' },
  { id: 'c4', role: 'songa', text: "I'm checking the latest available flight information.", time: '14:03' },
];

function ChatPreview({ onViewFlight }: { onViewFlight: () => void }) {
  const [reply, setReply] = useState('');

  return (
    <div className="wa-chat" aria-label="Example WhatsApp conversation preview">
      <WaHeader />
      <div className="wa-chat-body">
        <div className="wa-date-sep">Today</div>
        {conversation.map((bubble) => (
          <div key={bubble.id} className={`wa-bubble ${bubble.role === 'user' ? 'out' : 'in'}`}>
            <p>{bubble.text}</p>
            <span className="wa-stamp">{bubble.time}</span>
          </div>
        ))}
        <div className="wa-bubble in wa-bubble-card">
          <FlightInfoCard onViewFlight={onViewFlight} />
          <span className="wa-stamp">14:03</span>
        </div>
      </div>
      <form
        className="wa-chat-input"
        onSubmit={(event) => { event.preventDefault(); setReply(''); }}
      >
        <input
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Preview only — not connected to WhatsApp"
          aria-label="Preview message input"
        />
        <button type="submit" aria-label="Preview send button"><Send size={17} /></button>
      </form>
    </div>
  );
}

type FlightInfoCardProps = {
  flight?: Flight | null;
  onViewFlight?: () => void;
};

export function FlightInfoCard({ flight, onViewFlight }: FlightInfoCardProps) {
  const sample = flight ?? null;
  const number = sample?.flightNumber ?? 'KQ100';
  const airline = sample?.airline ?? 'Kenya Airways';
  const originCode = sample?.origin.code ?? 'NBO';
  const destinationCode = sample?.destination.code ?? 'LHR';
  const originName = sample?.origin.city ?? "Nairobi — Jomo Kenyatta Int'l";
  const destinationName = sample?.destination.city ?? 'London — Heathrow';
  const status: FlightStatus = 'Unknown';
  const scheduledDep = sample?.scheduledDeparture ?? '14:20';
  const scheduledArr = sample?.scheduledArrival ?? '21:05';
  const estimatedDep = sample?.estimatedDeparture ?? null;
  const delay = sample?.departureDelayMinutes ?? null;
  const lastChecked = sample?.lastUpdatedAt ?? 'Example timestamp';

  return (
    <article className="wa-flight-card" aria-label={`Example flight card for ${number}`}>
      <div className="wa-flight-card-top">
        <span className="wa-flight-mark"><PlaneTakeoff size={16} /></span>
        <div className="wa-flight-id">
          <strong>{number}</strong>
          <small>{airline}</small>
        </div>
        <SharedStatusBadge status={status} />
      </div>
      <div className="wa-flight-route">
        <div className="wa-endpoint">
          <strong>{originCode}</strong>
          <small>{originName}</small>
          <span>Scheduled {scheduledDep}</span>
        </div>
        <span className="wa-route-line" />
        <div className="wa-endpoint align-right">
          <strong>{destinationCode}</strong>
          <small>{destinationName}</small>
          <span>Scheduled {scheduledArr}</span>
        </div>
      </div>
      <div className="wa-flight-rows">
        <div><span>Verified status</span><small>Example status — preview only</small></div>
        <div><span>Estimated departure</span><small>{estimatedDep ?? 'Not supplied'}</small></div>
        <div><span>Delay</span><small>{delay != null ? `${delay} min` : 'Not supplied'}</small></div>
        <div><span>Last checked</span><small>{lastChecked}</small></div>
      </div>
      {onViewFlight && (
        <div className="wa-flight-actions">
          <button className="wa-flight-btn primary" onClick={onViewFlight}>View full flight on Songa <ArrowRight size={14} /></button>
          <button className="wa-flight-btn" disabled title="Messaging actions unlock once the WhatsApp service is connected">Ask about this flight</button>
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

const connectionStates = [
  { id: 'not-connected', label: 'Not connected' },
  { id: 'verification-pending', label: 'Verification pending' },
  { id: 'connected', label: 'Connected' },
  { id: 'notifications-enabled', label: 'Notifications enabled' },
  { id: 'notifications-paused', label: 'Notifications paused' },
  { id: 'disconnected', label: 'Disconnected' },
] as const;

type ConnectionStateId = (typeof connectionStates)[number]['id'];

function ConnectionPanel({ session, onOpenAccount }: { session: Session | null; onOpenAccount: () => void }) {
  const [previewState, setPreviewState] = useState<ConnectionStateId>('not-connected');
  const [ctaState, setCtaState] = useState<'idle' | 'unavailable'>('idle');

  const connect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCtaState('unavailable');
  };

  const stateCopy: Record<ConnectionStateId, { heading: string; text: string; icon: typeof Link2 }> = {
    'not-connected': { heading: 'Not connected', text: 'No WhatsApp number is linked to this Songa account yet.', icon: Link2 },
    'verification-pending': { heading: 'Verification pending', text: 'Songa is confirming that the link belongs to the intended account.', icon: Clock3 },
    connected: { heading: 'Account linked', text: 'A verified WhatsApp number is linked to this account. Linking does not enable notifications by itself.', icon: Link2 },
    'notifications-enabled': { heading: 'Notifications enabled', text: 'You explicitly opted in. Songa can send verified flight updates to your linked number.', icon: Bell },
    'notifications-paused': { heading: 'Notifications paused', text: 'Updates are on hold. Your linked number and watchlist stay untouched.', icon: BellOff },
    disconnected: { heading: 'Disconnected', text: 'The link was removed. No number is linked to this account.', icon: Link2 },
  };
  const Icon = stateCopy[previewState].icon;

  return (
    <div id="wa-connect" className="wa-connect">
      <div className="wa-section-heading">
        <div className="section-kicker">CONNECT YOUR WHATSAPP</div>
        <h2>Linking first.<br /><span>Notifications only with consent.</span></h2>
      </div>
      <div className="wa-connect-grid">
        <div className="wa-connect-panel">
          <div className="wa-state-tabs" role="tablist" aria-label="Connection state preview">
            {connectionStates.map((state) => (
              <button
                key={state.id}
                role="tab"
                aria-selected={previewState === state.id}
                className={previewState === state.id ? 'active' : ''}
                onClick={() => setPreviewState(state.id)}
              >
                {state.label}
              </button>
            ))}
          </div>
          <p className="wa-state-caption">Visual preview of each connection state. Songa has no WhatsApp connection data yet, so no state is shown as real.</p>
          <div className="wa-state-card" aria-live="polite">
            <Icon size={22} />
            <div>
              <strong>{stateCopy[previewState].heading}</strong>
              <p>{stateCopy[previewState].text}</p>
            </div>
          </div>
          <ol className="wa-flow">
            <li>You sign in to your Songa account.</li>
            <li>You start the secure WhatsApp linking flow.</li>
            <li>Songa verifies the link to the intended account.</li>
            <li>You explicitly opt in to flight notifications.</li>
            <li>You can pause or stop notifications at any time.</li>
          </ol>
        </div>
        <div className="wa-connect-cta">
          {session ? (
            <p className="wa-cta-note"><ShieldCheck size={15} /> Signed in as {session.user.email}. The WhatsApp service is not configured yet, so no link can be completed today.</p>
          ) : (
            <p className="wa-cta-note"><ShieldCheck size={15} /> Signing in to your Songa account is required before a private watch can be linked. Songa never exposes saved flights to an unverified number.</p>
          )}
          <form className="wa-cta-form" onSubmit={connect}>
            <button className="primary-button full-button" type="submit"><MessageCircle size={16} /> Connect my WhatsApp</button>
            <button className="secondary-button full-button" type="button" onClick={onOpenAccount}>{session ? 'Account settings' : 'Sign in first'}</button>
          </form>
          {ctaState === 'unavailable' && (
            <div className="inline-error" role="status"><CircleAlert size={15} /> WhatsApp setup is not available yet. The service will appear here once the official integration is configured — nothing was changed on your account.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const notificationOptions = [
  { id: 'delays', label: 'Significant delay changes' },
  { id: 'cancel', label: 'Flight cancellation or diversion updates' },
  { id: 'dep', label: 'Departure-time changes' },
  { id: 'arr', label: 'Arrival updates' },
] as const;

function NotificationPrefs() {
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({ delays: true, cancel: true, dep: true, arr: false });

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
            <p>Master switch for the linked WhatsApp number.</p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Pause notifications' : 'Enable notifications'}
            className={enabled ? 'wa-switch on' : 'wa-switch'}
            onClick={() => setEnabled((value) => !value)}
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
                  disabled={!enabled}
                  onChange={(event) => setSelected((current) => ({ ...current, [option.id]: event.target.checked }))}
                />
                <span className="wa-check-box" aria-hidden="true" />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="wa-prefs-note"><CircleAlert size={14} /> Preview only — these controls are not saved or connected to a notification service yet.</p>
      </div>
    </div>
  );
}
