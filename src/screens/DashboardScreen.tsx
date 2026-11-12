import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Activity, ArrowRight, Clock3, CreditCard, Crown, Gift, Plane, Radar, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Flight } from '@/types';

type Order = { id: string; product_name: string; amount: number; currency_code: string; payment_status: string; fulfilment_status: string; created_at: string };
type Entitlement = { id: string; product_id: string; status: string; starts_at: string; ends_at: string | null; gift_code: string | null };
type Props = { session: Session | null; watchedFlights: Flight[]; recentSearches: Flight[]; onOpenFlight: (flight: Flight) => void; onOpenCommerce: () => void; onOpenAccount: () => void };

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));

export function DashboardScreen({ session, watchedFlights, recentSearches, onOpenFlight, onOpenCommerce, onOpenAccount }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!session || !supabase) { setOrders([]); setEntitlements([]); return; }
    setLoading(true); setError('');
    try {
      const [orderResult, entitlementResult] = await Promise.all([
        supabase.from('songa_commerce_orders').select('id,product_name,amount,currency_code,payment_status,fulfilment_status,created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('songa_commerce_entitlements').select('id,product_id,status,starts_at,ends_at,gift_code').order('created_at', { ascending: false }).limit(8),
      ]);
      if (orderResult.error) throw orderResult.error;
      if (entitlementResult.error) throw entitlementResult.error;
      setOrders((orderResult.data ?? []) as Order[]);
      setEntitlements((entitlementResult.data ?? []) as Entitlement[]);
    } catch { setError('Your account activity could not be loaded. Check the Commerce migration and try again.'); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const listener = () => void refresh(); window.addEventListener('songa-commerce-updated', listener); return () => window.removeEventListener('songa-commerce-updated', listener); }, [refresh]);

  if (!session) return <section className="page-width page-section dashboard-page"><div className="dashboard-welcome"><span>YOUR SONGA SPACE</span><h1>Your journeys,<br/><em>all in one place.</em></h1><p>Sign in to see your saved flights, purchases, active travel services and recent activity.</p><button className="primary-button" onClick={onOpenAccount}>Sign in to your account <ArrowRight size={16}/></button></div></section>;
  const active = entitlements.filter((item) => ['ACTIVE', 'CLAIMED'].includes(item.status) && (!item.ends_at || new Date(item.ends_at).getTime() > Date.now()));
  const paid = orders.filter((item) => item.payment_status === 'COMPLETED');
  return <section className="page-width page-section dashboard-page">
    <div className="dashboard-welcome"><div><span>YOUR SONGA SPACE / ACCOUNT OVERVIEW</span><h1>Welcome back.<br/><em>Your travel, in view.</em></h1><p>{session.user.email} · Your personal travel activity and services.</p></div><button className="dashboard-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/> Refresh</button></div>
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    <div className="dashboard-stats"><article><Radar/><strong>{watchedFlights.length}</strong><span>Saved flights</span></article><article><Crown/><strong>{active.length}</strong><span>Active services</span></article><article><CreditCard/><strong>{paid.length}</strong><span>Paid orders</span></article><article><Activity/><strong>{recentSearches.length}</strong><span>Recent searches</span></article></div>
    <div className="dashboard-grid">
      <section className="dashboard-panel"><div className="dashboard-panel-head"><div><span>FLIGHT WATCH</span><h2>Your saved journeys</h2></div><button onClick={onOpenCommerce}>Travel services <ArrowRight size={14}/></button></div>
        {watchedFlights.length ? watchedFlights.slice(0, 5).map((flight) => <button className="dashboard-flight-row" key={flight.id} onClick={() => onOpenFlight(flight)}><span className="dashboard-flight-icon"><Plane size={16}/></span><span><strong>{flight.flightNumber}</strong><small>{flight.origin.code} → {flight.destination.code} · {flight.date}</small></span><b>{flight.status}</b><ArrowRight size={15}/></button>) : <p className="dashboard-empty">No saved flights yet. Search for a flight and add it to Flight Watch.</p>}
      </section>
      <section className="dashboard-panel"><div className="dashboard-panel-head"><div><span>YOUR SERVICES</span><h2>Active entitlements</h2></div><ShieldCheck size={18}/></div>
        {active.length ? active.map((item) => <div className="dashboard-service-row" key={item.id}><span className="dashboard-flight-icon">{item.product_id.includes('gift') ? <Gift size={16}/> : <Ticket size={16}/>}</span><span><strong>{item.product_id.replace('songa-', '').replace(/-/g, ' ')}</strong><small>{item.ends_at ? `Expires ${dateLabel(item.ends_at)}` : 'No expiry date recorded'}</small></span><b>ACTIVE</b></div>) : <p className="dashboard-empty">Your active services will appear here after a verified purchase or gift claim.</p>}
      </section>
      <section className="dashboard-panel"><div className="dashboard-panel-head"><div><span>PAYMENT HISTORY</span><h2>Recent orders</h2></div><CreditCard size={18}/></div>
        {orders.length ? orders.map((order) => <div className="dashboard-order-row" key={order.id}><span><strong>{order.product_name}</strong><small>{dateLabel(order.created_at)} · {order.fulfilment_status.replace(/_/g, ' ')}</small></span><b>{money(order.amount, order.currency_code)}</b><i className={order.payment_status === 'COMPLETED' ? 'success' : ''}>{order.payment_status}</i></div>) : <p className="dashboard-empty">No purchases yet. Your verified PayPal orders will be listed here.</p>}
      </section>
      <section className="dashboard-panel"><div className="dashboard-panel-head"><div><span>RECENT ACTIVITY</span><h2>Recent flight searches</h2></div><Clock3 size={18}/></div>
        {recentSearches.length ? recentSearches.slice(0, 6).map((flight, index) => <button className="dashboard-flight-row" key={`${flight.flightNumber}-${flight.date}-${index}`} onClick={() => onOpenFlight(flight)}><span className="dashboard-flight-icon"><SearchIcon/></span><span><strong>{flight.flightNumber}</strong><small>{flight.origin.code} → {flight.destination.code} · {flight.date}</small></span><b>{flight.status}</b><ArrowRight size={15}/></button>) : <p className="dashboard-empty">Your recent searches on this device will appear here.</p>}
      </section>
    </div>
    <p className="dashboard-footnote"><ShieldCheck size={14}/> Account data is loaded from your signed-in Supabase account. Recent search history is stored locally on this device.</p>
  </section>;
}
function SearchIcon() { return <Activity size={16}/>; }
