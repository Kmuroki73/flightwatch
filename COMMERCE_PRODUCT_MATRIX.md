# Songa 2.0 Commerce Product Matrix

All amounts below are Sandbox catalogue values defined server-side in `supabase/functions/_shared/commerce.ts`. They are not approved real-world consumer prices.

| Product family | Product ID | Sandbox amount | Fulfilment | What still needs verification |
|---|---|---:|---|---|
| Premium 30-day | `songa-premium-30` | USD 25.00 | 30-day entitlement | End-to-end Sandbox capture and entitlement; exact Premium feature gating |
| Premium 365-day | `songa-premium-365` | USD 250.00 | 365-day entitlement | End-to-end Sandbox capture and entitlement; exact Premium feature gating |
| Trip Rescue | `songa-trip-rescue` | USD 4.99 | One-flight AI recovery entitlement | Verify flight and date; confirm AI checks entitlement and returns expanded plan |
| Family & Group Watch | `songa-family-watch` | USD 9.99 | 14-day group with up to five journey slots | Group creation, invitation, join and flight-add tests |
| Gift a Journey Watch | `songa-gift-watch` | USD 4.99 | 14-day gift with unique redemption code | Purchase, recipient restriction, single-use claim and expiry tests |
| Airside | `songa-airside-order` | Server-calculated cart total | NBO Sandbox order and pickup reference | Cart tampering, total validation, order persistence and clearly disclosed demo fulfilment |

There are five product families; Premium has two duration choices. The implementation uses one shared order engine and product-specific fulfilment logic.

## Payment endpoints

- `songa-commerce-create-order`: validates the signed-in buyer, product and server-defined amount; creates a PayPal order and stores the local order context.
- `songa-commerce-capture-order`: verifies order ownership, captures through PayPal, checks completed status and amount/currency, records the capture and issues fulfilment.
- `songa-commerce-webhook`: validates PayPal webhook signatures and processes supported payment events idempotently.
- `songa-group-add-flight`: adds a flight to a purchased group entitlement.
- `songa-join-group`: accepts a valid family/group invitation.
- `songa-redeem-gift`: claims a purchased gift subject to the recipient/claim rules.

The older `paypal-create-order`, `paypal-capture-order` and `paypal-webhook` endpoints are retained for the existing flight-specific Premium Assistance flow. Do not register the same PayPal webhook URL/ID for the two webhook endpoints. Create one Sandbox webhook for each endpoint and store the corresponding ID in the correct secret.

## Airside scope

Airside currently uses a fixed NBO/JKIA Sandbox menu. The successful payment creates a Songa database order and pickup reference under a demo merchant identity. There is no actual airport merchant, inventory, payment settlement to a merchant, kitchen, pickup counter or delivery integration in this candidate.

## Commercial and operational scope

- Premium passes are prepaid 30-day and 365-day passes, not automatic recurring subscriptions.
- Trip Rescue purchases an AI-assisted report/action-plan entitlement. It does not buy an airline ticket, guarantee compensation or arrange accommodation.
- Family Watch provides a shared group workspace and slots; background monitoring/notifications depend on the verified Flight Watch and notification infrastructure.
- Gift Watch issues a claim code. Verify its redemption and entitlement handling before presenting it as fully operational.
- Airside is a Sandbox ordering prototype, not a live airport marketplace.

## Accommodation

The Travel Desk now includes a provider-backed accommodation search interface and authenticated Edge Function adapter. It returns only normalized offers supplied by a configured HTTPS partner adapter. No hotel inventory is fabricated. Booking confirmation and PayPal charging for stays are deliberately not enabled until a supplier hold/confirm API and cancellation/refund rules are agreed and configured.
