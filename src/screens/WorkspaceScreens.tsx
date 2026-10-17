import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CircleAlert, FileText, Landmark, MessageCircle, Plane, MapPin, Gauge, Receipt, ShieldCheck, Sparkles, Send, Ticket, Trash2, Upload, Wallet, Footprints, Bell, Download, Map,
} from 'lucide-react';
import type { Flight } from '@/types';
import { StatusBadge } from '@/screens/DisruptionScreens';
import { flightProvider } from '@/lib/flightProvider';
import { supabase } from '@/lib/supabase';
import { deleteTripDocument, documentsToCsv, loadTripDocuments, saveTripDocument, type TripDocument, type TripDocumentKind } from '@/lib/tripVault';
import { assessCompensation, buildClaimText, buildGateNavigation, buildWhatsAppPreview, carrierCountryFromCode, determineJurisdiction } from '@/lib/copilot';

export function LiveMapPanel({ flights, onSelectFlight }: { flights: Flight[]; onSelectFlight: (flight: Flight) => void }) {
  const markers = useMemo(() => flights.slice(0, 24).map((flight, index) => {
    const seed = index * 137.5 + 23;
    const angle = (seed % 360) * Math.PI / 180;
    const radius = 90 + (seed % 110);
    return {
      flight,
      x: 260 + Math.cos(angle) * radius * 1.35,
      y: 200 + Math.sin(angle) * radius * 0.72,
      heading: (seed * 3) % 360,
    };
  }), [flights]);

  return (
    <div className="live-map" role="group" aria-label="Regional aircraft traffic map">
      <div className="live-map-toolbar">
        <span className="live-map-title"><Plane size={15} /> Live traffic view</span>
        <span className="live-map-note">{flightProvider.mode === 'live' ? 'Positions from provider' : 'Illustrative layout'}</span>
      </div>
      <div className="live-map-stage">
        <svg viewBox="0 0 520 400" className="live-map-svg" aria-hidden="true">
          <defs>
            <radialGradient id="mapBg" cx="50%" cy="42%">
              <stop offset="0" stopColor="#12324d" />
              <stop offset="1" stopColor="#081c30" />
            </radialGradient>
            <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#1d3f5e" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="520" height="400" rx="18" fill="url(#mapBg)" />
          <rect width="520" height="400" rx="18" fill="url(#mapGrid)" />
          <path d="M0 150 C 120 120, 240 190, 520 140" fill="none" stroke="#2c5578" strokeWidth="1.4" />
          <path d="M0 260 C 160 300, 300 220, 520 280" fill="none" stroke="#2c5578" strokeWidth="1.4" />
          <path d="M120 0 C 150 130, 90 260, 160 400" fill="none" stroke="#2c5578" strokeWidth="1.4" />
          <path d="M360 0 C 340 140, 420 260, 380 400" fill="none" stroke="#2c5578" strokeWidth="1.4" />
          <text x="36" y="52" fill="#5f89a8" fontSize="13" letterSpacing="2">GREAT LAKES REGION</text>
          <text x="404" y="376" fill="#5f89a8" fontSize="11" letterSpacing="1.6">N 1°S · E 37°E</text>
        </svg>
        {markers.map(({ flight, x, y }) => (
          <button
            key={flight.id}
            className="live-plane"
            style={{ left: `${(x / 520) * 100}%`, top: `${(y / 400) * 100}%` }}
            onClick={() => onSelectFlight(flight)}
            aria-label={`Open ${flight.flightNumber} details`}
            title={flight.flightNumber}
          >
            <Plane size={15} />
          </button>
        ))}
        <div className="live-map-hub hub-nbo"><MapPin size={13} /> NBO</div>
        <div className="live-map-hub hub-lhr"><MapPin size={13} /> LHR</div>
      </div>
      <p className="live-map-caption"><Gauge size={13} /> Tap an aircraft to open its flight. When live position coverage is connected, markers move with real reports.</p>
    </div>
  );
}

export function GateNavigationModule({ flight }: { flight: Flight | null }) {
  if (!flight) {
    return <ModuleShell icon={<Map size={18} />} title="Gate-to-Gate Navigation" kicker="MODULE 01"><p className="module-empty">Open or watch a flight to see arrival navigation.</p></ModuleShell>;
  }
  const navigation = buildGateNavigation({ arrivalGate: 'B22', connectingGate: undefined });
  const preview = buildWhatsAppPreview(
    { flightNumber: flight.flightNumber, airline: flight.airline, origin: flight.origin, destination: flight.destination, status: flight.status, statusDetail: flight.statusDetail },
    { arrivalGate: navigation.arrivalGate, target: navigation.target, transitMinutes: navigation.transitMinutes },
  );
  return (
    <ModuleShell icon={<Map size={18} />} title="Gate-to-Gate Navigation" kicker="MODULE 01">
      <p className="module-lede">When a landing or gate-change event arrives, Songa maps your arrival gate to your next stop and estimates the walk.</p>
      <div className="gate-route">
        <div className="gate-node current"><strong>{navigation.arrivalGate}</strong><span>Arrival gate</span></div>
        <div className="gate-walk"><Footprints size={17} /><span>{navigation.transitMinutes} min</span></div>
        <div className="gate-node target"><strong>{navigation.targetKind === 'connecting gate' ? navigation.target : 'Belt 5'}</strong><span>{navigation.targetKind}</span></div>
      </div>
      <ol className="gate-steps">{navigation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="whatsapp-preview mini">
        <div className="whatsapp-preview-head"><MessageCircle size={14} /> WhatsApp message preview</div>
        <pre>{preview}</pre>
      </div>
    </ModuleShell>
  );
}

export function VaultModule({ flight, session }: { flight: Flight | null; session: unknown }) {
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const signedIn = Boolean(supabase && session);

  useEffect(() => {
    if (!signedIn) { setLoading(false); return; }
    let active = true;
    loadTripDocuments()
      .then((docs) => { if (active) setDocuments(docs); })
      .catch(() => { if (active) setError('Your vault could not be loaded. Please refresh.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn]);

  const simulateUpload = async (kind: TripDocumentKind) => {
    setError(''); setNotice('');
    if (!signedIn) { setError('Sign in to store documents in your vault.'); return; }
    if (!flight) { setError('Open or watch a flight first so the document can be linked to a trip.'); return; }
    const fileName = kind === 'boarding_pass' ? 'boarding-pass.jpg' : 'airport-receipt.pdf';
    try {
      const doc = await saveTripDocument({
        kind,
        fileName,
        flightNumber: flight.flightNumber,
        travelDate: flight.date.slice(0, 10),
        ...(kind === 'boarding_pass'
          ? { seatNumber: '14A', boardingGroup: 'Group 2', cabinClass: 'Economy', merchant: null, totalAmount: null, currency: null, category: null }
          : { seatNumber: null, boardingGroup: null, cabinClass: null, merchant: 'Airport Bistro', totalAmount: 24.5, currency: 'EUR', category: 'Meal' }),
      });
      setDocuments((current) => [doc, ...current]);
      setNotice(kind === 'boarding_pass' ? 'Boarding pass parsed. Your travel card is pinned.' : 'Receipt parsed and logged to trip expenses.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be saved.');
    }
  };

  const removeDocument = async (id: string) => {
    try { await deleteTripDocument(id); setDocuments((current) => current.filter((doc) => doc.id !== id)); }
    catch { setError('The document could not be removed.'); }
  };

  const exportCsv = () => {
    const csv = documentsToCsv(documents);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'songa-trip-expenses.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const boardingPass = documents.find((doc) => doc.kind === 'boarding_pass');
  const receipts = documents.filter((doc) => doc.kind === 'receipt');

  return (
    <ModuleShell icon={<Wallet size={18} />} title="Expense & Boarding Pass Vault" kicker="MODULE 02">
      <p className="module-lede">Forward or upload boarding passes and receipts. Songa extracts the key details and keeps your trip organised.</p>
      <div className="vault-actions">
        <button className="secondary-button" onClick={() => void simulateUpload('boarding_pass')}><Ticket size={15} /> Add boarding pass</button>
        <button className="secondary-button" onClick={() => void simulateUpload('receipt')}><Receipt size={15} /> Add receipt</button>
        <span className="vault-hint"><Upload size={13} /> Images and PDFs, like documents forwarded on WhatsApp</span>
      </div>
      {error && <div className="inline-error" role="alert"><CircleAlert size={14} /> {error}</div>}
      {notice && <div className="auth-message" role="status">{notice}</div>}
      {!signedIn && <p className="vault-signin">Sign in and your vault syncs privately to your account.</p>}
      {boardingPass && (
        <div className="boarding-card">
          <div className="boarding-top"><Ticket size={17} /><div><strong>Boarding pass</strong><span>{boardingPass.flightNumber} · {boardingPass.travelDate}</span></div><StatusBadge status="Boarding" /></div>
          <div className="boarding-grid">
            <div><small>Seat</small><strong>{boardingPass.seatNumber}</strong></div>
            <div><small>Group</small><strong>{boardingPass.boardingGroup}</strong></div>
            <div><small>Cabin</small><strong>{boardingPass.cabinClass}</strong></div>
          </div>
          <button className="icon-text-button" onClick={() => void removeDocument(boardingPass.id)}><Trash2 size={13} /> Remove</button>
        </div>
      )}
      {receipts.length > 0 && (
        <div className="expense-list">
          <div className="expense-head"><span>Trip expenses</span><button className="text-link" onClick={exportCsv}><Download size={14} /> Export expense report</button></div>
          {receipts.map((doc) => (
            <div className="expense-row" key={doc.id}>
              <span className="expense-merchant">{doc.merchant}</span>
              <span className="expense-category">{doc.category}</span>
              <strong>{doc.currency} {doc.totalAmount?.toFixed(2)}</strong>
              <button className="icon-text-button" onClick={() => void removeDocument(doc.id)} aria-label="Remove receipt"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {loading && <p className="vault-signin">Checking your vault…</p>}
      {!loading && !boardingPass && receipts.length === 0 && signedIn && <p className="vault-signin">No documents yet. Add a boarding pass or receipt to get started.</p>}
    </ModuleShell>
  );
}

export function CompensationModule({ flight }: { flight: Flight | null }) {
  if (!flight) {
    return <ModuleShell icon={<Landmark size={18} />} title="Delay Compensation Copilot" kicker="MODULE 03"><p className="module-empty">Open or watch a disrupted flight to assess your rights.</p></ModuleShell>;
  }
  const jurisdiction = determineJurisdiction(carrierCountryFromCode(flight.airlineCode), flight.origin.code, flight.destination.code);
  const assessment = assessCompensation({
    disruption: flight.disruption,
    phase: flight.phase,
    arrivalDelayMinutes: flight.arrivalDelayMinutes ?? null,
    departureDelayMinutes: flight.departureDelayMinutes ?? null,
    jurisdiction,
  });
  const claimText = buildClaimText({
    flightNumber: flight.flightNumber,
    date: flight.date,
    from: `${flight.origin.city} (${flight.origin.code})`,
    to: `${flight.destination.city} (${flight.destination.code})`,
    assessment,
  });
  const priority = assessment.qualifiesForCompensation;
  return (
    <ModuleShell icon={<Landmark size={18} />} title="Delay Compensation Copilot" kicker="MODULE 03" priority={priority}>
      {priority && <div className="priority-banner"><Bell size={15} /> This disruption may qualify for care or compensation. A priority WhatsApp brief is prepared.</div>}
      <div className="rights-grid">
        <div><small>Jurisdiction</small><strong>{jurisdiction.title}</strong><span>{jurisdiction.thresholdNote}</span></div>
        <div><small>Care (meals & refreshments)</small><strong>{assessment.qualifiesForCare ? 'Likely applies' : 'Ask at the service desk'}</strong><span>{jurisdiction.mealVoucherRight}</span></div>
        <div><small>Compensation</small><strong>{assessment.qualifiesForCompensation ? 'Threshold met' : 'Not indicated yet'}</strong><span>{assessment.reason}</span></div>
      </div>
      <details className="claim-draft">
        <summary><FileText size={15} /> Copy-ready claim text</summary>
        <pre>{claimText}</pre>
        <button className="secondary-button" onClick={() => void navigator.clipboard?.writeText(claimText)}>Copy claim text</button>
      </details>
    </ModuleShell>
  );
}

function ModuleShell({ icon, title, kicker, children, priority }: { icon: React.ReactNode; title: string; kicker: string; children: React.ReactNode; priority?: boolean }) {
  return <section className={`module-card ${priority ? 'priority' : ''}`}><div className="module-head"><span className="module-icon">{icon}</span><div><span className="section-kicker">{kicker}</span><h3>{title}</h3></div></div>{children}</section>;
}

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

export function CompanionChat({ flights }: { flights: Flight[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: 'Ask me about any flight in view - status, delays, gates or your rights.' },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);

  const respond = (question: string): string => {
    const q = question.toLowerCase();
    const flight = flights[0] ?? null;
    if (!flight) return 'I do not have a flight loaded yet. Search for a flight first, then ask me about it here.';
    if (/status|delay|late|on time/.test(q)) {
      return `${flight.flightNumber} (${flight.origin.code} → ${flight.destination.code}) is currently: ${flight.status}. ${flight.statusDetail} Last updated ${flight.lastUpdatedAt}.`;
    }
    if (/gate|terminal|baggage|walk|connect/.test(q)) {
      const nav = buildGateNavigation({ arrivalGate: 'B22' });
      return `On arrival at ${nav.arrivalGate}, follow signs to ${nav.target.toLowerCase()} - roughly ${nav.transitMinutes} minutes on foot. I will push the exact walkthrough to WhatsApp when a landing event arrives.`;
    }
    if (/compensat|rights|claim|voucher|refund/.test(q)) {
      const jurisdiction = determineJurisdiction(carrierCountryFromCode(flight.airlineCode), flight.origin.code, flight.destination.code);
      const assessment = assessCompensation({ disruption: flight.disruption, phase: flight.phase, arrivalDelayMinutes: flight.arrivalDelayMinutes ?? null, departureDelayMinutes: flight.departureDelayMinutes ?? null, jurisdiction });
      return `${jurisdiction.title}: ${assessment.reason} ${assessment.qualifiesForCare ? 'Care (meals and refreshments) likely applies now.' : 'Care obligations depend on the final delay duration.'} The dashboard Compensation module has a copy-ready claim.`;
    }
    if (/whatsapp|notify|alert/.test(q)) {
      return 'WhatsApp alerts are in early access. Join the list on the landing page and you will be among the first activated once the sender is verified.';
    }
    if (/expense|receipt|boarding|vault/.test(q)) {
      return 'Your vault turns forwarded boarding passes and receipts into a pinned travel card and a structured expense log. Open the Trip Workspace to add one.';
    }
    return `I can help with ${flight.flightNumber}: status, gate navigation, expenses, and your disruption rights. Try "is it delayed?" or "what are my rights?"`;
  };

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || thinking) return;
    setThinking(true);
    setDraft('');
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', text: question }]);
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', text: respond(question) }]);
      setThinking(false);
    }, 450);
  };

  return (
    <div className="chat-window live">
      <div className="chat-top"><span><span className="online-dot" /> Trip assistant</span><span>Answers from your loaded flight data</span></div>
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}>
            {message.role === 'assistant' && <div className="message-avatar"><Sparkles size={14} /></div>}
            <div><p>{message.text}</p></div>
          </div>
        ))}
        {thinking && <div className="message assistant-message"><div className="message-avatar"><Sparkles size={14} /></div><div><p>Checking the flight data…</p></div></div>}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about status, gates, expenses or rights"
          aria-label="Message the trip assistant"
        />
        <button type="submit" disabled={thinking || !draft.trim()} aria-label="Send message"><Send size={17} /></button>
      </form>
    </div>
  );
}

export function WhatsAppSection({ onJoin }: { onJoin: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'joining' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('joining'); setMessage('');
    try { await onJoin(email); setState('idle'); setMessage('You are on the list. We will email you when your number is activated.'); setEmail(''); }
    catch (err) { setState('error'); setMessage(err instanceof Error ? err.message : 'Could not join the list. Please try again.'); }
  };

  return (
    <section className="whatsapp-section page-width" id="whatsapp">
      <div className="whatsapp-copy">
        <div className="section-kicker">WHATSAPP FLIGHT COMPANION · EARLY ACCESS</div>
        <h2>Your flight.<br /><span>Your WhatsApp.</span></h2>
        <p>Check flight status, follow your journey and get important flight updates through WhatsApp — without constantly refreshing a tracking website.</p>
        <div className="benefit-cards">
          <div><MessageCircle size={17} /><strong>Check a flight</strong><span>Check a flight using its flight number.</span></div>
          <div><Bell size={17} /><strong>Delay and cancellation alerts</strong><span>Receive alerts for confirmed delays and cancellations when notifications are enabled.</span></div>
          <div><ShieldCheck size={17} /><strong>Full details in one tap</strong><span>Open the full Songa flight details and tracking experience from WhatsApp.</span></div>
        </div>
        <div className="whatsapp-cta">
          <span className="coming-soon-pill">Coming soon</span>
          <button className="primary-button whatsapp-cta-button" type="button" onClick={(event) => { const form = event.currentTarget.closest('.whatsapp-cta')?.querySelector('.early-access-form input') as HTMLInputElement | null; form?.focus(); }}><MessageCircle size={16} /> Get Songa on WhatsApp</button>
          <p className="whatsapp-cta-note">The WhatsApp service is not active yet — join the early-access list below and you will be among the first activated once the official sender is verified.</p>
          <form className="early-access-form" onSubmit={submit}>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email for early access" />
            <button className="primary-button" disabled={state === 'joining'}>{state === 'joining' ? 'Joining…' : 'Join early access'} <ArrowRight size={15} /></button>
          </form>
          {message && <p className={state === 'error' ? 'inline-error' : 'auth-message'} role={state === 'error' ? 'alert' : 'status'}><CircleAlert size={14} /> {message}</p>}
        </div>
      </div>
      <div className="whatsapp-preview full" aria-hidden="true">
        <div className="whatsapp-preview-head"><MessageCircle size={15} /> Songa Flight Companion</div>
        <div className="whatsapp-bubble in"><p>KQ 100 · Nairobi → London</p><strong>Status: Delayed</strong><p>New departure 15:10 (was 14:20). Meal vouchers available at the service desk.</p></div>
        <div className="whatsapp-bubble out"><p>What time should I be at the gate?</p></div>
        <div className="whatsapp-bubble in"><p>Boarding starts 14:40 at Gate B22. Allow about 12 min to walk there.</p></div>
        <div className="whatsapp-typing"><span /><span /><span /></div>
      </div>
    </section>
  );
}

export function useWhatsAppJoin() {
  const [joined, setJoined] = useState(false);
  const join = async (email: string) => {
    const { joinWhatsAppEarlyAccess } = await import('@/lib/tripVault');
    await joinWhatsAppEarlyAccess(email);
    setJoined(true);
  };
  return { joined, join };
}
