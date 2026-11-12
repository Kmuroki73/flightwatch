import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowRight, BedDouble, CalendarDays, Clock3, Copy, Crown, Gift, LifeBuoy,
  MapPin, Minus, PackageCheck, Plane, Plus, Search, ShieldCheck, Sparkles, Utensils, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Flight } from '@/types';

type ProductId = 'songa-premium-30' | 'songa-premium-365' | 'songa-trip-rescue' | 'songa-family-watch' | 'songa-gift-watch' | 'songa-airside-order';
type Props = { session: Session | null; selectedFlight: Flight | null; onOpenAccount: () => void };
type ActiveEntitlement = { id: string; product_id: string; status: string; starts_at: string; ends_at: string | null; gift_code: string | null; beneficiary_email: string | null; metadata: Record<string, unknown> };
type Group = { id: string; group_name: string; share_code: string; journey_limit: number; created_at: string };
type GroupFlight = { id: string; group_id: string; flight_number: string; travel_date: string; origin_code: string | null; destination_code: string | null; provider_status: string | null };
type AirsideOrder = { id: string; airport_code: string; merchant_name: string; pickup_reference: string; fulfilment_status: string; items: Array<{name:string;quantity:number;unitPrice:number}>; total: number; currency_code: string; created_at: string };
type Order = { id: string; product_id: string; product_name: string; amount: number; currency_code: string; payment_status: string; fulfilment_status: string; created_at: string };
type StayOffer = { id: string; name: string; location: string; description?: string; imageUrl?: string; price: number; currency: string; priceUnit?: string; providerName?: string; checkoutUrl?: string };

const AIRSIDE_MENU = [
  { sku: 'coffee-pastry', name: 'Coffee & pastry', description: 'A warm coffee with a fresh pastry', price: 5.5, icon: '☕' },
  { sku: 'chicken-wrap', name: 'Chicken wrap meal', description: 'A filling meal for the next leg', price: 8.5, icon: '🥪' },
  { sku: 'water', name: 'Bottled water', description: 'Stay hydrated before boarding', price: 1.5, icon: '💧' },
  { sku: 'snack-box', name: 'Travel snack box', description: 'A compact selection for your journey', price: 4.5, icon: '🍱' },
] as const;

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function CommerceScreen({ session, selectedFlight, onOpenAccount }: Props) {
  const [busyProduct, setBusyProduct] = useState<ProductId | null>(null);
  const [notice, setNotice] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [entitlements, setEntitlements] = useState<ActiveEntitlement[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFlights, setGroupFlights] = useState<GroupFlight[]>([]);
  const [airsideOrders, setAirsideOrders] = useState<AirsideOrder[]>([]);
  const [flightNumber, setFlightNumber] = useState(selectedFlight?.flightNumber ?? '');
  const [travelDate, setTravelDate] = useState(selectedFlight?.date ?? new Date().toISOString().slice(0, 10));
  const [groupName, setGroupName] = useState('Family journey');
  const [memberEmails, setMemberEmails] = useState('');
  const [beneficiaryEmail, setBeneficiaryEmail] = useState('');
  const [giftCode, setGiftCode] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupFlightNumber, setGroupFlightNumber] = useState('');
  const [groupTravelDate, setGroupTravelDate] = useState(new Date().toISOString().slice(0, 10));
  const [cart, setCart] = useState<Record<string, number>>({ 'coffee-pastry': 0, 'chicken-wrap': 0, water: 0, 'snack-box': 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [stayCity, setStayCity] = useState('Nairobi');
  const [stayCheckIn, setStayCheckIn] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [stayCheckOut, setStayCheckOut] = useState(new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10));
  const [stayGuests, setStayGuests] = useState(2);
  const [stayOffers, setStayOffers] = useState<StayOffer[]>([]);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayNotice, setStayNotice] = useState('');
  const [selectedStay, setSelectedStay] = useState<string>('');

  const refresh = useCallback(async () => {
    if (!supabase || !session) { setOrders([]); setEntitlements([]); setGroups([]); setGroupFlights([]); setAirsideOrders([]); return; }
    setRefreshing(true);
    try {
      const [ordersResult, entResult, groupsResult, airsideResult] = await Promise.all([
        supabase.from('songa_commerce_orders').select('id,product_id,product_name,amount,currency_code,payment_status,fulfilment_status,created_at').order('created_at', { ascending: false }).limit(15),
        supabase.from('songa_commerce_entitlements').select('id,product_id,status,starts_at,ends_at,gift_code,beneficiary_email,metadata').order('created_at', { ascending: false }).limit(20),
        supabase.from('songa_group_journeys').select('id,group_name,share_code,journey_limit,created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('songa_airside_orders').select('id,airport_code,merchant_name,pickup_reference,fulfilment_status,items,total,currency_code,created_at').order('created_at', { ascending: false }).limit(10),
      ]);
      if (!ordersResult.error) setOrders((ordersResult.data ?? []) as Order[]);
      if (!entResult.error) setEntitlements((entResult.data ?? []) as ActiveEntitlement[]);
      if (!groupsResult.error) setGroups((groupsResult.data ?? []) as Group[]);
      if (!airsideResult.error) setAirsideOrders((airsideResult.data ?? []) as AirsideOrder[]);
      if (!groupsResult.error && groupsResult.data?.length) {
        const ids = groupsResult.data.map((group) => group.id);
        const { data: flights } = await supabase.from('songa_group_flights').select('id,group_id,flight_number,travel_date,origin_code,destination_code,provider_status').in('group_id', ids).order('travel_date');
        setGroupFlights((flights ?? []) as GroupFlight[]);
        setSelectedGroup((current) => current || groupsResult.data![0].id);
      }
    } finally { setRefreshing(false); }
  }, [session]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener('songa-commerce-updated', handler);
    return () => window.removeEventListener('songa-commerce-updated', handler);
  }, [refresh]);

  const cartTotal = useMemo(() => AIRSIDE_MENU.reduce((total, item) => total + item.price * (cart[item.sku] ?? 0), 0), [cart]);
  const cartCount = useMemo(() => Object.values(cart).reduce((total, count) => total + count, 0), [cart]);

  const checkout = async (productId: ProductId, context: Record<string, unknown> = {}) => {
    setNotice('');
    if (!session) { setNotice('Sign in to continue to secure PayPal checkout.'); onOpenAccount(); return; }
    if (!supabase) { setNotice('Songa checkout is not configured in this deployment.'); return; }
    setBusyProduct(productId);
    try {
      const { data, error } = await supabase.functions.invoke('songa-commerce-create-order', { body: { productId, ...context } });
      if (error) throw error;
      if (typeof data?.approvalUrl !== 'string') throw new Error(data?.message || 'PayPal did not return an approval link.');
      window.location.assign(data.approvalUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start PayPal checkout. Please try again.');
      setBusyProduct(null);
    }
  };

  const redeemGift = async () => {
    if (!session) { onOpenAccount(); return; }
    if (!supabase) return;
    setNotice('');
    const { data, error } = await supabase.functions.invoke('songa-redeem-gift', { body: { giftCode } });
    setNotice(error ? (data?.message || 'Gift redemption failed.') : (data?.message || 'Gift claimed.'));
    if (!error) { setGiftCode(''); await refresh(); }
  };

  const joinGroup = async () => {
    if (!session) { onOpenAccount(); return; }
    if (!supabase) return;
    setNotice('');
    const { data, error } = await supabase.functions.invoke('songa-join-group', { body: { shareCode: groupCode } });
    setNotice(error ? (data?.message || 'Could not join this family journey.') : (data?.message || 'Joined family journey.'));
    if (!error) { setGroupCode(''); await refresh(); }
  };

  const addGroupFlight = async () => {
    if (!session || !selectedGroup || !supabase) { if (!session) onOpenAccount(); return; }
    setNotice('');
    const { data, error } = await supabase.functions.invoke('songa-group-add-flight', { body: { groupId: selectedGroup, flightNumber: groupFlightNumber, travelDate: groupTravelDate } });
    setNotice(error ? (data?.message || 'Could not add this flight.') : (data?.message || 'Flight added.'));
    if (!error) { setGroupFlightNumber(''); await refresh(); }
  };

  const updateQuantity = (sku: string, delta: number) => setCart((current) => ({ ...current, [sku]: Math.max(0, Math.min(8, (current[sku] ?? 0) + delta)) }));

  const searchStays = async () => {
    if (!session) { setStayNotice('Sign in to search and save accommodation options.'); onOpenAccount(); return; }
    if (!supabase) { setStayNotice('Accommodation search is not configured in this deployment.'); return; }
    if (!stayCity.trim() || stayCheckOut <= stayCheckIn || stayCheckIn < new Date().toISOString().slice(0, 10)) {
      setStayNotice('Enter a destination and valid future check-in/check-out dates.'); return;
    }
    setStayLoading(true);
    setStayNotice('');
    setStayOffers([]);
    setSelectedStay('');
    try {
      const { data, error } = await supabase.functions.invoke('songa-accommodation-search', {
        body: { city: stayCity.trim(), checkIn: stayCheckIn, checkOut: stayCheckOut, guests: stayGuests },
      });
      if (error) throw error;
      if (!Array.isArray(data?.offers)) throw new Error(data?.message || 'No accommodation offers were returned.');
      setStayOffers(data.offers as StayOffer[]);
      if (!data.offers.length) setStayNotice('No matching accommodation offers were returned for these dates.');
    } catch (error) {
      setStayNotice(error instanceof Error ? error.message : 'Accommodation search is temporarily unavailable.');
    } finally {
      setStayLoading(false);
    }
  };
  const currentFlightReady = !!flightNumber.trim() && /^\d{4}-\d{2}-\d{2}$/.test(travelDate);

  return <section className="page-width page-section songa-commerce-page">
    <div className="commerce-hero">
      <div className="commerce-kicker"><Sparkles size={15}/> THE SONGA TRAVEL DESK</div>
      <h1>More than knowing.<br/><em>Ready to move.</em></h1>
      <p>Travel intelligence, journey protection and airport essentials — connected through one simple experience.</p>
      <div className="commerce-trust"><ShieldCheck size={15}/> Every PayPal purchase is verified on the server before Songa activates the service.</div>
    </div>

    {notice && <div className="commerce-alert" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}

    <div className="commerce-section-title"><div><span>TRAVEL INTELLIGENCE</span><h2>Choose your Songa experience.</h2></div><p>Start with what your journey needs.</p></div>
    <div className="commerce-plan-grid">
      <article className="commerce-plan-card featured">
        <div className="commerce-plan-top"><span><Crown size={17}/> SONGA PREMIUM</span><small>BEST FOR FREQUENT TRAVELLERS</small></div>
        <h3>Stay ahead of every journey.</h3>
        <p>Enhanced travel intelligence for people who travel often or manage more than one journey.</p>
        <ul><li>Expanded AI disruption analysis</li><li>Enhanced traveller action plans</li><li>Premium access pass saved to your account</li><li>Premium assistance across your active journeys</li></ul>
        <div className="commerce-price-row"><strong>$25</strong><span>30-day pass</span></div>
        <button type="button" onClick={() => void checkout('songa-premium-30')} disabled={!!busyProduct}>{busyProduct === 'songa-premium-30' ? 'Opening PayPal…' : 'Get 30-day Premium'} <ArrowRight size={16}/></button>
        <div className="commerce-annual"><span>$250 · 365-day pass</span><button type="button" onClick={() => void checkout('songa-premium-365')} disabled={!!busyProduct}>Choose annual <ArrowRight size={14}/></button></div>
        <small className="commerce-fineprint">Prepaid access passes. They do not automatically renew. Premium access is a prepaid duration pass and is checked by Songa AI for enhanced assistance.</small>
      </article>

      <article className="commerce-plan-card">
        <div className="commerce-plan-top"><span><LifeBuoy size={17}/> TRIP RESCUE</span><small>FOR A DISRUPTED JOURNEY</small></div>
        <h3>Let's work out your next move.</h3>
        <p>An expanded AI disruption report, alternative options where live booking data exists and a personalised action checklist.</p>
        <div className="commerce-flight-fields">
          <label>Flight number<input value={flightNumber} onChange={(event) => setFlightNumber(event.target.value.toUpperCase().replace(/\s+/g, ''))} placeholder="e.g. KQ100" maxLength={10}/></label>
          <label>Travel date<input type="date" value={travelDate} onChange={(event) => setTravelDate(event.target.value)}/></label>
        </div>
        <div className="commerce-price-row"><strong>$4.99</strong><span>one disrupted journey</span></div>
        <button type="button" onClick={() => void checkout('songa-trip-rescue', { flightNumber, travelDate })} disabled={!!busyProduct || !currentFlightReady}>{busyProduct === 'songa-trip-rescue' ? 'Opening PayPal…' : 'Get Trip Rescue'} <ArrowRight size={16}/></button>
        <small className="commerce-fineprint">Basic flight status remains free. Airlines and booking partners control actual rebooking and ticket issuance.</small>
      </article>

      <article className="commerce-plan-card">
        <div className="commerce-plan-top"><span><Users size={17}/> FAMILY & GROUP WATCH</span><small>TRAVEL TOGETHER</small></div>
        <h3>One journey. Everyone in view.</h3>
        <p>Create a shared family journey with up to five flight slots and invitations for the people travelling with you.</p>
        <label className="commerce-label">Journey name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60}/></label>
        <label className="commerce-label">Invite emails <span>Optional · up to 5, comma separated</span><textarea value={memberEmails} onChange={(event) => setMemberEmails(event.target.value)} rows={2} placeholder="family@example.com, friend@example.com"/></label>
        <div className="commerce-price-row"><strong>$9.99</strong><span>14-day group pass</span></div>
        <button type="button" onClick={() => void checkout('songa-family-watch', { groupName, memberEmails: memberEmails.split(',').map((email) => email.trim()).filter(Boolean).slice(0, 5) })} disabled={!!busyProduct}>{busyProduct === 'songa-family-watch' ? 'Opening PayPal…' : 'Create family journey'} <ArrowRight size={16}/></button>
        <small className="commerce-fineprint">The pass creates a shared journey workspace. Flight refresh and notification coverage depend on provider access.</small>
      </article>

      <article className="commerce-plan-card">
        <div className="commerce-plan-top"><span><Gift size={17}/> GIFT A JOURNEY WATCH</span><small>A THOUGHTFUL TRAVEL GIFT</small></div>
        <h3>Watch over someone else's journey.</h3>
        <p>Purchase a Songa Journey Watch gift and send the recipient a claim code to link the pass to their account.</p>
        <label className="commerce-label">Recipient email <span>Optional — restricts redemption to that address</span><input type="email" value={beneficiaryEmail} onChange={(event) => setBeneficiaryEmail(event.target.value)} placeholder="traveller@example.com"/></label>
        <div className="commerce-price-row"><strong>$4.99</strong><span>14-day gift pass</span></div>
        <button type="button" onClick={() => void checkout('songa-gift-watch', { beneficiaryEmail })} disabled={!!busyProduct}>{busyProduct === 'songa-gift-watch' ? 'Opening PayPal…' : 'Purchase a gift'} <ArrowRight size={16}/></button>
        <small className="commerce-fineprint">A unique code is issued only after verified payment. The recipient claims the gift from their Songa account.</small>
      </article>
    </div>

    <section className="airside-store" id="songa-airside">
      <div className="airside-store-head">
        <div><div className="commerce-kicker"><Utensils size={15}/> SONGA AIRPORT MARKETPLACE</div><h2>Your layover,<br/><em>better spent.</em></h2><p>Explore airport food and travel essentials, build an order and complete a PayPal Sandbox checkout. The first demonstration merchant is configured for Nairobi (NBO); Songa's marketplace is designed to support additional airports as merchant partners are onboarded.</p></div>
        <div className="airside-stamp"><Plane size={28}/><span>NAIROBI · NBO</span><small>SANDBOX MERCHANT</small></div>
      </div>
      <div className="airside-menu-grid">
        {AIRSIDE_MENU.map((item) => <article className="airside-item" key={item.sku}>
          <div className="airside-item-emoji" aria-hidden="true">{item.icon}</div>
          <div className="airside-item-copy"><strong>{item.name}</strong><small>{item.description}</small><b>{money(item.price)}</b></div>
          <div className="airside-quantity"><button type="button" onClick={() => updateQuantity(item.sku, -1)} aria-label={`Remove ${item.name}`}><Minus size={14}/></button><span>{cart[item.sku] ?? 0}</span><button type="button" onClick={() => updateQuantity(item.sku, 1)} aria-label={`Add ${item.name}`}><Plus size={14}/></button></div>
        </article>)}
      </div>
      <div className="airside-checkout-bar"><div><span>{cartCount} item{cartCount === 1 ? '' : 's'} in your order</span><strong>{money(cartTotal)}</strong></div><button type="button" disabled={!cartCount || !!busyProduct} onClick={() => void checkout('songa-airside-order', { airportCode: 'NBO', items: AIRSIDE_MENU.filter((item) => (cart[item.sku] ?? 0) > 0).map((item) => ({ sku: item.sku, quantity: cart[item.sku] })) })}>{busyProduct === 'songa-airside-order' ? 'Opening PayPal…' : 'Continue with PayPal'} <ArrowRight size={16}/></button></div>
      <div className="airside-disclosure"><ShieldCheck size={15}/> Sandbox demonstration: payment and Songa order records are real within the test environment; food preparation, collection and delivery are not provided by this demo merchant. Additional airports become orderable when local merchants are connected.</div>
    </section>

    <section className="songa-stays" id="songa-stays">
      <div className="commerce-section-title">
        <div><span>STAYS & ACCOMMODATION</span><h2>Find somewhere to land.</h2></div>
        <p>Compare stays for the next leg of your journey.</p>
      </div>
      <div className="stays-search-panel">
        <div className="stays-search-intro">
          <div className="stays-icon"><BedDouble size={22}/></div>
          <div><strong>Accommodation, connected to your trip</strong><p>Search partner-backed stays, compare offers and continue to a secure booking when a supplier confirms availability.</p></div>
        </div>
        <div className="stays-search-fields">
          <label><span><MapPin size={14}/> Destination</span><input value={stayCity} onChange={(event) => setStayCity(event.target.value)} placeholder="City or destination" maxLength={100}/></label>
          <label><span><CalendarDays size={14}/> Check-in</span><input type="date" value={stayCheckIn} onChange={(event) => setStayCheckIn(event.target.value)}/></label>
          <label><span><CalendarDays size={14}/> Check-out</span><input type="date" value={stayCheckOut} onChange={(event) => setStayCheckOut(event.target.value)}/></label>
          <label><span><Users size={14}/> Guests</span><select value={stayGuests} onChange={(event) => setStayGuests(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count} guest{count === 1 ? '' : 's'}</option>)}</select></label>
          <button type="button" onClick={() => void searchStays()} disabled={stayLoading}>{stayLoading ? 'Searching…' : <><Search size={16}/> Search stays</>}</button>
        </div>
        {stayNotice && <div className="stays-notice" role="status">{stayNotice}</div>}
        {!!stayOffers.length && <div className="stays-offer-grid">{stayOffers.map((offer) => <article className={`stays-offer ${selectedStay === offer.id ? 'selected' : ''}`} key={offer.id}>
          {offer.imageUrl && <img src={offer.imageUrl} alt="" loading="lazy"/>}
          <div className="stays-offer-body"><div className="stays-provider">{offer.providerName || 'Verified accommodation partner'}</div><h3>{offer.name}</h3><p>{offer.location}</p>{offer.description && <small>{offer.description}</small>}
            <div className="stays-price">{money(Number(offer.price), offer.currency)} <small>{offer.priceUnit || 'per stay'}</small></div>
            <button type="button" onClick={() => setSelectedStay(offer.id)}>{selectedStay === offer.id ? 'Selected' : 'Select stay'} <ArrowRight size={14}/></button>
          </div>
        </article>)}</div>}
        {selectedStay && <div className="stays-selected" role="status">Stay selected. Supplier confirmation and secure checkout will be enabled when the accommodation partner is connected.</div>}
        <div className="stays-disclosure"><ShieldCheck size={15}/> Prices and availability must be confirmed by the accommodation provider before payment. Songa will never charge for an unconfirmed room.</div>
      </div>
    </section>

    <section className="commerce-account-tools">
      <div className="commerce-section-title"><div><span>YOUR SONGA SERVICES</span><h2>Passes, gifts and orders.</h2></div><button type="button" className="commerce-refresh" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'} <ArrowRight size={14}/></button></div>
      {!session ? <div className="commerce-empty"><ShieldCheck size={20}/><div><strong>Sign in to manage purchases</strong><p>Your purchased passes, family journeys, gift codes and Airside orders will appear here.</p></div><button type="button" onClick={onOpenAccount}>Sign in <ArrowRight size={15}/></button></div> : <>
        <div className="commerce-tool-grid">
          <div className="commerce-tool-card"><div className="commerce-tool-title"><Gift size={17}/> Redeem a gift</div><div className="commerce-inline-form"><input value={giftCode} onChange={(event) => setGiftCode(event.target.value.toUpperCase())} placeholder="SONGA-XXXXXXXXXXXX"/><button type="button" onClick={() => void redeemGift()} disabled={!giftCode.trim()}>Claim</button></div></div>
          <div className="commerce-tool-card"><div className="commerce-tool-title"><Users size={17}/> Join a family journey</div><div className="commerce-inline-form"><input value={groupCode} onChange={(event) => setGroupCode(event.target.value.toUpperCase())} placeholder="FAMILY-XXXXXXXXXXXX"/><button type="button" onClick={() => void joinGroup()} disabled={!groupCode.trim()}>Join</button></div></div>
        </div>
        {!!groups.length && <div className="commerce-list-panel"><div className="commerce-list-head"><strong>Family journeys</strong><small>Shared flight slots</small></div>{groups.map((group) => <div className="commerce-group-row" key={group.id}><div><strong>{group.group_name}</strong><small>{group.journey_limit} flight slots · invite code {group.share_code}</small></div><button type="button" onClick={() => { void navigator.clipboard?.writeText(group.share_code); setNotice('Family invitation code copied.'); }}><Copy size={14}/> Copy code</button></div>)}
          <div className="commerce-group-flight-form"><select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} aria-label="Choose family journey">{groups.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}</select><input value={groupFlightNumber} onChange={(event) => setGroupFlightNumber(event.target.value.toUpperCase())} placeholder="Flight number"/><input type="date" value={groupTravelDate} onChange={(event) => setGroupTravelDate(event.target.value)}/><button type="button" onClick={() => void addGroupFlight()} disabled={!selectedGroup || !groupFlightNumber.trim()}>Add flight</button></div>
          {groupFlights.length > 0 && <div className="commerce-group-flights">{groupFlights.map((flight) => <div key={flight.id}><Plane size={14}/><strong>{flight.flight_number}</strong><span>{flight.origin_code ?? '—'} → {flight.destination_code ?? '—'}</span><small>{flight.travel_date}</small></div>)}</div>}</div>}
        {!!entitlements.length && <div className="commerce-list-panel"><div className="commerce-list-head"><strong>Your active passes and gifts</strong><small>{entitlements.length} record{entitlements.length === 1 ? '' : 's'}</small></div>{entitlements.map((item) => <div className="commerce-group-row" key={item.id}><div><strong>{item.product_id.replace(/-/g, ' ')}</strong><small>{item.status} · {item.ends_at ? `Expires ${new Date(item.ends_at).toLocaleDateString()}` : 'No expiry recorded'}</small></div>{item.gift_code && <button type="button" onClick={() => { void navigator.clipboard?.writeText(item.gift_code!); setNotice('Gift code copied.'); }}><Copy size={14}/> {item.gift_code}</button>}</div>)}</div>}
        {!!airsideOrders.length && <div className="commerce-list-panel"><div className="commerce-list-head"><strong>Airport marketplace orders</strong><small>Sandbox merchant</small></div>{airsideOrders.map((order) => <div className="commerce-group-row" key={order.id}><div><strong>{order.pickup_reference} · {money(Number(order.total), order.currency_code)}</strong><small>{order.airport_code} · {order.fulfilment_status.replace(/_/g, ' ').toLowerCase()} · {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}</small></div><PackageCheck size={18}/></div>)}</div>}
        {!!orders.length && <div className="commerce-list-panel"><div className="commerce-list-head"><strong>Recent PayPal transactions</strong><small>Sandbox / test transactions</small></div>{orders.map((order) => <div className="commerce-group-row" key={order.id}><div><strong>{order.product_name}</strong><small>{new Date(order.created_at).toLocaleString()} · {order.fulfilment_status.replace(/_/g, ' ').toLowerCase()}</small></div><div className="commerce-order-status"><b>{money(Number(order.amount), order.currency_code)}</b><small>{order.payment_status}</small></div></div>)}</div>}
      </>}
    </section>
    <div className="commerce-footer-note"><Clock3 size={15}/> Prices shown are demonstration USD prices for PayPal Sandbox. Actual merchant fulfilment, airline reservations and live subscriptions require their respective provider agreements and operational connections.</div>
  </section>;
}
